pragma solidity 0.5.10;

import "../../extensions/userExtensions/IERC1400TokensRecipient.sol";
import "../../interface/ERC1820Implementer.sol";
import "../../IFetchSupply.sol";
import "../IConfigurableModule.sol";
import "../Module.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./ICheckpointsModule.sol";

contract CheckpointsModule is IERC1400TokensRecipient, ERC1820Implementer, Module, IConfigurableModule, ICheckpointsModule {

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
  Checkpoint[] checkpointTotalSupply;

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
    checkpointTotalSupply.push
    (Checkpoint({checkpointId: currentCheckpointId, value: IERC20(securityToken).totalSupply()}));

    // Partitioned tokens
    bytes32[] memory partitions = IFetchSupply(securityToken).totalPartitions();
    for (uint i=0; i < partitions.length; i++) {
      // Fetch the balance for the current partition
      uint256 totalSupplyForPartition = IFetchSupply(address(securityToken))
      .totalSupplyByPartition(partitions[i]);

      // Push the new checkpoint to the partition
      checkpointByPartitionTotalSupply.partitionedCheckpoints[partitions[i]].push
      (Checkpoint({checkpointId: currentCheckpointId, value: totalSupplyForPartition}));
    }

    emit CheckpointCreated(currentCheckpointId);
    return currentCheckpointId;
  }

  /**
 * @notice Queries a partitioned value at a defined checkpoint
 * @param _partition is the partition we are interested in
 * @param _tokenHolder the holder we are interested in
 * @param _checkpointId is the Checkpoint ID to query
 * @return uint256
 */
  function getValueAt(bytes32 _partition, address _tokenHolder, uint256 _checkpointId) external view returns(uint256) {
    Checkpoint[] storage _checkpoints = checkpointTokenHolderBalances[_tokenHolder].partitionedCheckpoints[_partition];

    // Checkpoint id 0 is when the token is first created - everyone has a zero balance
    if (_checkpointId == 0) {
      return 0;
    }

    // There are no recorded partitioned token transfers recorded by module for token holder
    if (_checkpoints.length == 0) {
      return 0;
    }

    // The first checkpoint for this tokenholder had an id equal to or greater than the checkpoint id passed as argument
    if (_checkpoints[0].checkpointId >= _checkpointId - 1) {
      return _checkpoints[0].value;
    }

    // If checkpoint id passed as argument is greater than the most recent checkpoint taken, just return the most recent one
    if (_checkpoints[_checkpoints.length - 1].checkpointId < _checkpointId - 1) {
      return _checkpoints[_checkpoints.length - 1].value;
    }

    // Most recent checkpoint same as checkpoint passed as argument
    if (_checkpoints[_checkpoints.length - 1].checkpointId == _checkpointId - 1) {
      return _checkpoints[_checkpoints.length - 1].value;
    }

    // Search for the checkpoint
    uint256 min = 0;
    uint256 max = _checkpoints.length - 1;
    while (max > min) {
      uint256 mid = (max + min) / 2;
      if (_checkpoints[mid].checkpointId == _checkpointId - 1) {
        max = mid;
        break;
      }
      if (_checkpoints[mid].checkpointId < _checkpointId - 1) {
        min = mid + 1;
      } else {
        max = mid;
      }
    }
    return _checkpoints[max].value;
  }

  /**
 * @notice Queries a partitioned value at a defined checkpoint
 * @param _partition is the partition we are interested in
 * @param _checkpointId is the Checkpoint ID to query
 * @return uint256
 */
  function getPartitionedTotalSupplyAt(bytes32 _partition, uint256 _checkpointId) external view returns(uint256) {
    Checkpoint[] storage _checkpoints = checkpointByPartitionTotalSupply.partitionedCheckpoints[_partition];

    // Checkpoint id 0 is when the token is first created - everyone has a zero balance
    if (_checkpointId == 0) {
      return 0;
    }

    // There are no recorded partitioned token transfers recorded by module for token holder
    if (_checkpoints.length == 0) {
      return 0;
    }

    // The first checkpoint for this tokenholder had an id equal to or greater than the checkpoint id passed as argument
    if (_checkpoints[0].checkpointId >= _checkpointId) {
      return _checkpoints[0].value;
    }

    // If checkpoint id passed as argument is greater than the most recent checkpoint taken, just return the most recent one
    if (_checkpoints[_checkpoints.length - 1].checkpointId < _checkpointId) {
      return _checkpoints[_checkpoints.length - 1].value;
    }

    // Most recent checkpoint same as checkpoint passed as argument
    if (_checkpoints[_checkpoints.length - 1].checkpointId == _checkpointId) {
      return _checkpoints[_checkpoints.length - 1].value;
    }

    // Search for the checkpoint
    uint256 min = 0;
    uint256 max = _checkpoints.length - 1;
    while (max > min) {
      uint256 mid = (max + min) / 2;
      if (_checkpoints[mid].checkpointId == _checkpointId) {
        max = mid;
        break;
      }
      if (_checkpoints[mid].checkpointId < _checkpointId) {
        min = mid + 1;
      } else {
        max = mid;
      }
    }
    return _checkpoints[max].value;
  }


  /**
 * @notice Queries a value at a defined checkpoint for total supply
 * @param _checkpointId is the Checkpoint ID to query
 * @return uint256
 */
  function getTotalSupplyAt(uint256 _checkpointId) external view returns(uint256) {
    Checkpoint[] storage _checkpoints = checkpointTotalSupply;

    // Checkpoint id 0 is when the token is first created - everyone has a zero balance
    if (_checkpointId == 0) {
      return 0;
    }

    // There are no recorded partitioned token transfers recorded by module for token holder
    if (_checkpoints.length == 0) {
      return 0;
    }

    // The first checkpoint for this tokenholder had an id equal to or greater than the checkpoint id passed as argument
    if (_checkpoints[0].checkpointId >= _checkpointId) {
      return _checkpoints[0].value;
    }

    // If checkpoint id passed as argument is greater than the most recent checkpoint taken, just return the most recent one
    if (_checkpoints[_checkpoints.length - 1].checkpointId < _checkpointId) {
      return _checkpoints[_checkpoints.length - 1].value;
    }

    // Most recent checkpoint same as checkpoint passed as argument
    if (_checkpoints[_checkpoints.length - 1].checkpointId == _checkpointId) {
      return _checkpoints[_checkpoints.length - 1].value;
    }

    // Search for the checkpoint
    uint256 min = 0;
    uint256 max = _checkpoints.length - 1;
    while (max > min) {
      uint256 mid = (max + min) / 2;
      if (_checkpoints[mid].checkpointId == _checkpointId) {
        max = mid;
        break;
      }
      if (_checkpoints[mid].checkpointId < _checkpointId) {
        min = mid + 1;
      } else {
        max = mid;
      }
    }
    return _checkpoints[max].value;
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
