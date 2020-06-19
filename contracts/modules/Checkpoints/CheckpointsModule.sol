pragma solidity 0.5.10;

import "../../extensions/userExtensions/IERC1400TokensRecipient.sol";
import "../../interface/ERC1820Implementer.sol";
import "../../IFetchSupply.sol";
import "../IConfigurableModule.sol";
import "../Module.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";


contract CheckpointsModule is IERC1400TokensRecipient, ERC1820Implementer, Module, IConfigurableModule {

  string constant internal CHECKPOINTS_MODULE = "ERC1400TokensCheckpoints";

  event CheckpointCreated(uint256 indexed _checkpointId);

  struct PartitionedCheckpoints {
    mapping (bytes32 => Checkpoint[]) partitionedCheckpoints;
  }

  struct Checkpoint {
    uint256 checkpointId;
    uint256 value;
  }

  // What checkpoint we are currently on
  uint256 public currentCheckpointId;

  // Time corresponding to the checkpoints above
  uint256[] checkpointTimes;

  // Map the above checkpoint id to the total supply at the time it was made
  mapping (uint256 => uint256) checkpointTotalSupply;

  // Map the above checkpoint id to the partitions total supply at time it was made
  PartitionedCheckpoints checkpointByPartitionTotalSupply;

  // Kyc investor mapped to an array of all balances
  mapping(address => PartitionedCheckpoints) checkpointTokenHolderBalances;

  constructor(address factory) public
    Module(factory)
  {
    ERC1820Implementer._setInterface(CHECKPOINTS_MODULE);
  }

  /**
* @notice This function returns the signature of configure function
*/
  function getInitFunction() public pure returns (bytes4) {
    return this.configure.selector;
  }

  /**
  * @notice Function used to initialize the contract variables
  */
  function configure(
    address _securityToken
  )
  external
  onlyFactory
  {
    securityToken = _securityToken;
  }

  // For now the tokens checkpoint cannot receive security tokens
  function canReceive(
    bytes4 /*functionSig*/,
    bytes32 /*partition*/,
    address /*operator*/,
    address from,
    address to,
    uint value,
    bytes calldata data,
    bytes calldata /*operatorData*/
  ) // Comments to avoid compilation warnings for unused variables.
    external
    view
    returns(bool)
  {
    return false;
  }

  function tokensReceived(
    bytes4 /*functionSig*/,
    bytes32 partition,
    address /*operator*/,
    address from,
    address to,
    uint value,
    bytes calldata data,
    bytes calldata /*operatorData*/
  ) // Comments to avoid compilation warnings for unused variables.
    external
  {
//    require(_canReceive(from, to, value, data), "57"); // 0x57	invalid receiver

    require(msg.sender == address(securityToken), "Sender is not the security token");

    _adjustCheckpoints(from, IERC1400(securityToken).balanceOfByPartition(partition, from), partition, currentCheckpointId);

    _adjustCheckpoints(to, IERC1400(securityToken).balanceOfByPartition(partition, to), partition, currentCheckpointId);

  }

  /**
   * @notice Creates a checkpoint that can be used to query historical balances / totalSuppy
   * @return uint256
   */
  function createCheckpoint() external withControllerPermission returns(uint256) {
    currentCheckpointId = currentCheckpointId + 1;
    checkpointTimes.push(now);

    // Overall Token Total Supply
    checkpointTotalSupply[currentCheckpointId] = IERC20(securityToken).totalSupply();

    // Partitioned tokens
    bytes32[] memory partitions = IFetchSupply(securityToken).totalPartitions();
    for (uint i=0; i < partitions.length; i++) {
      // Fetch the balance for the current partition
      uint256 totalSupplyForPartition = IFetchSupply(address(securityToken))
      .totalSupplyByPartition(partitions[i]);

      // Push the new checkpoint to the partition (TODO getters for this)
      checkpointByPartitionTotalSupply.partitionedCheckpoints[partitions[i]].push
      (Checkpoint({checkpointId: currentCheckpointId, value: totalSupplyForPartition}));
    }

    emit CheckpointCreated(currentCheckpointId);
    return currentCheckpointId;
  }

  /**
 * @notice Queries a value at a defined checkpoint
 * @param _tokenHolder the holder we are interested in
 * @param _checkpointId is the Checkpoint ID to query
 * @param _partition is the partition we are interested in
 * @param _currentValue is the Current value of checkpoint
 * @return uint256
 */
  function getValueAt(address _tokenHolder, uint256 _checkpointId, bytes32 _partition, uint256 _currentValue) external view returns(uint256) {
    //Checkpoint id 0 is when the token is first created - everyone has a zero balance // ???
    Checkpoint[] memory partitionCheckpoints = checkpointTokenHolderBalances[_tokenHolder].partitionedCheckpoints[_partition];
    if (_checkpointId == 0) {
      return 0;
    }
    if (partitionCheckpoints.length == 0) {
      return _currentValue; // This should be likely 0
    }
    if (partitionCheckpoints[0].checkpointId >= _checkpointId) {
      return partitionCheckpoints[0].value;
    }
    if (partitionCheckpoints[partitionCheckpoints.length - 1].checkpointId < _checkpointId) {
      return _currentValue; // This should be likely 0
    }
    if (partitionCheckpoints[partitionCheckpoints.length - 1].checkpointId == _checkpointId) {
      return partitionCheckpoints[partitionCheckpoints.length - 1].value;
    }
    uint256 min = 0;
    uint256 max = partitionCheckpoints.length - 1;
    while (max > min) {
      uint256 mid = (max + min) / 2;
      if (partitionCheckpoints[mid].checkpointId == _checkpointId) {
        max = mid;
        break;
      }
      if (partitionCheckpoints[mid].checkpointId < _checkpointId) {
        min = mid + 1;
      } else {
        max = mid;
      }
    }
    return partitionCheckpoints[max].value;
  }

  /**
   * @notice Stores the changes to the checkpoint objects
   * @param _tokenHolder The tokenholder that made a transfer
   * @param _newValue is the new value that needs to be stored
   * @param _partition is the partition being moved
   * @param _currentCheckpointId the checkpoint id that we want to adjust with a new value
   */
  function _adjustCheckpoints(address _tokenHolder, uint256 _newValue, bytes32 _partition, uint256 _currentCheckpointId) internal  {
    uint256 chkptLength = checkpointTokenHolderBalances[_tokenHolder].partitionedCheckpoints[_partition].length;
    if (chkptLength != 0 && (checkpointTokenHolderBalances[_tokenHolder].partitionedCheckpoints[_partition][chkptLength - 1].checkpointId == _currentCheckpointId)){
      // Existing checkpoint, update the value
      checkpointTokenHolderBalances[_tokenHolder].partitionedCheckpoints[_partition][chkptLength -1].value = _newValue;
    } else {
      //New checkpoint, so record balance
      checkpointTokenHolderBalances[_tokenHolder].partitionedCheckpoints[_partition].push(Checkpoint({checkpointId: _currentCheckpointId, value: _newValue}));
    }

  }
}
