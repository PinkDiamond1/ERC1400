pragma solidity 0.5.10;

import "../../extensions/userExtensions/IERC1400TokensRecipient.sol";
import "../../extensions/userExtensions/IERC1400TokensSender.sol";
import "../../interface/ERC1820Implementer.sol";
import "../../IFetchSupplyAndHooks.sol";
import "../IConfigurableModule.sol";
import "../Module.sol";
import "../../libraries/BokkyPooBahsDateTimeLibrary.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./ICheckpointsModule.sol";

contract CheckpointsModule is IERC1400TokensRecipient, IERC1400TokensSender, ERC1820Implementer, Module, IConfigurableModule, ICheckpointsModule {
  using SafeMath for uint256;
  string constant internal CHECKPOINTS_MODULE = "ERC1400TokensCheckpoints";

  event CheckpointCreated(uint256 indexed _checkpointId);
  event AddSchedule(bytes32 _name, uint256 _startTime, uint256 _endTime, uint256 _frequency, FrequencyUnit _frequencyUnit);
  event RemoveSchedule(bytes32 _name);
  event ModifyScheduleEndTime(bytes32 _name, uint256 _oldEndTime, uint256 _newEndTime);

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

  enum FrequencyUnit { SECONDS, DAYS, WEEKS, MONTHS, QUARTER, YEARS }

  uint256 internal constant MAXLIMIT = uint256(10);

  struct Schedule {
    uint256 index;
    bytes32 name;
    uint256 startTime;
    uint256 endTime;
    uint256 createNextCheckpointAt;
    uint256 frequency;
    FrequencyUnit frequencyUnit;
    uint256[] checkpointIds;
    uint256[] timestamps;
    uint256[] periods;
    uint256 totalPeriods;
  }

  bytes32[] public names;

  mapping(bytes32 => Schedule) public schedules;

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
    bytes calldata payload,
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
    bytes calldata payload,
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


  function canTransfer(
    bytes calldata payload,
    bytes32 partition,
    address operator,
    address from,
    address to,
    uint value,
    bytes calldata data,
    bytes calldata operatorData
  ) external view returns(bool){
    return false;
  }

  function tokensToTransfer(
    bytes calldata payload,
    bytes32 partition,
    address operator,
    address from,
    address to,
    uint value,
    bytes calldata data,
    bytes calldata operatorData
  ) external {
    require(msg.sender == address(securityToken), "Sender is not the security token");
    _updateAll();
  }


  /**
   * @notice Gets current checkpoint id
   * @return uint256
   */
  function getCurrentCheckpointId() external view returns(uint256) {
    return currentCheckpointId;
  }

  /**
   * @notice Creates a checkpoint that can be used to query historical balances / totalSupply
   * @return uint256
   */
  function createCheckpoint() external withControllerPermission returns(uint256) {
    return _createCheckpoint();
  }

    /**
     * @notice Creates a checkpoint that can be used to query historical balances / totalSupply
     * @return uint256
     */
  function _createCheckpoint() internal returns(uint256) {
    currentCheckpointId = currentCheckpointId + 1;
    checkpointTimes.push(now);

    // Overall Token Total Supply
    checkpointTotalSupply.push
    (Checkpoint({checkpointId: currentCheckpointId, value: IERC20(securityToken).totalSupply()}));

    // Partitioned tokens
    bytes32[] memory partitions = IFetchSupplyAndHooks(securityToken).totalPartitions();
    for (uint i=0; i < partitions.length; i++) {
      // Fetch the balance for the current partition
      uint256 totalSupplyForPartition = IFetchSupplyAndHooks(address(securityToken))
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

    // The first checkpoint for this token holder had an id equal to or greater than the checkpoint id passed as argument
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

  /**
     * @notice adds a new schedule for checkpoints
     * @param _name name of the new schedule (must be unused)
     * @param _startTime start time of the schedule (first checkpoint)
     * @param _endTime End time of the schedule
     * @param _frequency How frequent checkpoint will being created
     * @param _frequencyUnit Unit of frequency i.e If issuer puts _frequency = 10
     * & frequency unit is DAYS then it means every 10 day frequency new checkpoint will be created
     */
  function addSchedule(bytes32 _name, uint256 _startTime, uint256 _endTime, uint256 _frequency, FrequencyUnit _frequencyUnit) withControllerPermission external {
    require(_name != bytes32(0), "Empty name");
    require(_startTime > now, "Start time must be in the future");
    require(schedules[_name].name == bytes32(0), "Name already in use");
    _validateMaximumLimitCount();
    uint256 endTime = _endTime;
    if (_endTime <= _startTime)
      endTime = uint256(0);
    schedules[_name].name = _name;
    schedules[_name].startTime = _startTime;
    schedules[_name].endTime = endTime;
    schedules[_name].createNextCheckpointAt = _startTime;
    schedules[_name].frequency = _frequency;
    schedules[_name].frequencyUnit = _frequencyUnit;
    schedules[_name].index = names.length;
    names.push(_name);
    emit AddSchedule(_name, _startTime, endTime, _frequency, _frequencyUnit);
  }

  /**
   * @notice removes a schedule for checkpoints
   * @param _name name of the schedule to be removed
   */
  function removeSchedule(bytes32 _name) withControllerPermission external {
    require(_name != bytes32(0), "Invalid schedule name");
    require(schedules[_name].name == _name, "Schedule does not exist");
    uint256 index = schedules[_name].index;
    uint256 lengthOfNameArray = names.length;
    if (index != lengthOfNameArray - 1) {
      names[index] = names[lengthOfNameArray - 1];
      schedules[names[index]].index = index;
    }
    names.length--;
    delete schedules[_name];
    emit RemoveSchedule(_name);
  }

  /**
   * @notice Used to modify the end time of the schedule
   * @dev new endtime can be set as 0 or any value greater than now.
   * @param _name Name of the schedule that need to modify
   * @param _newEndTime New end time of the schedule
   */
  function modifyScheduleEndTime(bytes32 _name, uint256 _newEndTime) withControllerPermission external {
    Schedule memory _schedule = schedules[_name];
    require(_schedule.name != bytes32(0), "Invalid name");
    if (_schedule.endTime > 0)
      require(_schedule.endTime > now, "Schedule already ended");
    if (_newEndTime > 0)
      require(_newEndTime > now && _newEndTime > _schedule.startTime, "Invalid end time");
    emit ModifyScheduleEndTime(_name, _schedule.endTime, _newEndTime);
    schedules[_name].endTime = _newEndTime;
  }

  /**
   * @notice gets schedule details
   * @param  name name of the schedule.
   * @return name Name of the schedule
   * @return startTime Unix timestamps at which schedule of creating the checkpoint will start
   * @return endTime Unix timestamps at which schedule of creation the checkpoint will stop
   * @return createNextCheckpointAt Unix timestamp at which next checkpoint will be created
   * @return frequency Frequency at which checkpoint has been created
   * @return frequencyUnit Unit of frequency
   * @return checkpointIds List of checkpoint Ids that been created in the schedule
   * @return timestamps List of unix timestamp at which checkpoints have been created
   * @return periods List of periods covered
   * @return totalPeriods Total periods covered
   */
  function getSchedule(bytes32 _name) external view returns(
    bytes32 name,
    uint256 startTime,
    uint256 endTime,
    uint256 createNextCheckpointAt,
    uint256 frequency,
    FrequencyUnit frequencyUnit,
    uint256[] memory checkpointIds,
    uint256[] memory timestamps,
    uint256[] memory periods,
    uint256 totalPeriods
  ){
    Schedule storage schedule = schedules[_name];
    return (
    schedule.name,
    schedule.startTime,
    schedule.endTime,
    schedule.createNextCheckpointAt,
    schedule.frequency,
    schedule.frequencyUnit,
    schedule.checkpointIds,
    schedule.timestamps,
    schedule.periods,
    schedule.totalPeriods
    );
  }

  /**
   * @notice manually triggers update outside of transfer request for named schedule (can be used to reduce user gas costs)
   * @param _name name of the schedule
   */
  function update(bytes32 _name) withControllerPermission external {
    _update(_name);
  }

  function _update(bytes32 _name) internal {
    Schedule storage schedule = schedules[_name];
    if (_isScheduleActive(schedule.createNextCheckpointAt, schedule.endTime)) {
      uint256 newCheckpointId = _createCheckpoint();
      schedule.checkpointIds.push(newCheckpointId);
      // Checkpoint has already been created in the above two lines now `createNextCheckpointAt` treated as `lastCheckpointCreatedAt`
      uint256 lastCheckpointCreatedAt = schedule.createNextCheckpointAt;
      schedule.timestamps.push(lastCheckpointCreatedAt);
      uint256 periods;
      if (schedule.frequencyUnit == FrequencyUnit.SECONDS ) {
        periods = now
        .sub(lastCheckpointCreatedAt)
        .div(schedule.frequency)
        .add(1); // 1 is added for the next period
        schedule.createNextCheckpointAt = periods.mul(schedule.frequency).add(lastCheckpointCreatedAt);
      } else if (schedule.frequencyUnit == FrequencyUnit.DAYS ) {
        periods = BokkyPooBahsDateTimeLibrary
        .diffDays(lastCheckpointCreatedAt, now)
        .div(schedule.frequency)
        .add(1); // 1 is added for the next period
        schedule.createNextCheckpointAt = BokkyPooBahsDateTimeLibrary.addDays(
          lastCheckpointCreatedAt, periods.mul(schedule.frequency)
        );
      } else if (schedule.frequencyUnit == FrequencyUnit.WEEKS ) {
        periods = BokkyPooBahsDateTimeLibrary
        .diffDays(lastCheckpointCreatedAt, now)
        .div(7)
        .div(schedule.frequency)
        .add(1); // 1 is added for the next period
        schedule.createNextCheckpointAt = BokkyPooBahsDateTimeLibrary.addDays(
          lastCheckpointCreatedAt, periods.mul(schedule.frequency).mul(7)
        );
      } else if (schedule.frequencyUnit == FrequencyUnit.MONTHS ) {
        periods = BokkyPooBahsDateTimeLibrary
        .diffMonths(lastCheckpointCreatedAt, now)
        .div(schedule.frequency)
        .add(1); // 1 is added for the next period
        schedule.createNextCheckpointAt = BokkyPooBahsDateTimeLibrary.addMonths(
          lastCheckpointCreatedAt, periods.mul(schedule.frequency)
        );
      } else if (schedule.frequencyUnit == FrequencyUnit.QUARTER ) {
        periods = BokkyPooBahsDateTimeLibrary
        .diffMonths(lastCheckpointCreatedAt, now)
        .div(3)
        .div(schedule.frequency)
        .add(1); // 1 is added for the next period
        schedule.createNextCheckpointAt = BokkyPooBahsDateTimeLibrary.addMonths(
          lastCheckpointCreatedAt, periods.mul(schedule.frequency).mul(3)
        );
      } else if (schedule.frequencyUnit == FrequencyUnit.YEARS ) {
        periods = BokkyPooBahsDateTimeLibrary
        .diffYears(lastCheckpointCreatedAt, now)
        .div(schedule.frequency)
        .add(1); // 1 is added for the next period
        schedule.createNextCheckpointAt = BokkyPooBahsDateTimeLibrary.addYears(
          lastCheckpointCreatedAt, periods.mul(schedule.frequency)
        );
      }
      schedule.totalPeriods = schedule.totalPeriods.add(periods);
      schedule.periods.push(periods);
    }
  }

  function _isScheduleActive(uint256 _createNextCheckpointAt, uint256 _endTime) internal view returns(bool isActive) {
    isActive = _endTime > 0 ? _createNextCheckpointAt <= now && _createNextCheckpointAt <= _endTime : _createNextCheckpointAt <= now;
  }

  function _validateMaximumLimitCount() internal view {
    require(names.length < MAXLIMIT, "Max Limit Reached");
  }

  /**
   * @notice manually triggers update outside of transfer request for all schedules (can be used to reduce user gas costs)
   */
  function updateAll() withControllerPermission external {
    _updateAll();
  }

  function _updateAll() internal {
    uint256 i;
    for (i = 0; i < names.length; i++) {
      _update(names[i]);
    }
  }
}
