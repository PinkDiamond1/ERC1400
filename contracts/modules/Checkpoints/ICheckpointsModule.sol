pragma solidity 0.5.10;

/**
 * @title Interface for a checkpoints module
 */
interface ICheckpointsModule {
    /**
   * @notice Queries a partitioned value at a defined checkpoint
   * @param _partition is the partition we are interested in
   * @param _tokenHolder the holder we are interested in
   * @param _checkpointId is the Checkpoint ID to query
   * @return uint256
   */
    function getValueAt(bytes32 _partition, address _tokenHolder, uint256 _checkpointId) external view returns(uint256);

    /**
   * @notice Queries a partitioned value at a defined checkpoint
   * @param _partition is the partition we are interested in
   * @param _checkpointId is the Checkpoint ID to query
   * @return uint256
   */
    function getPartitionedTotalSupplyAt(bytes32 _partition, uint256 _checkpointId) external view returns(uint256);

    /**
   * @notice Queries a value at a defined checkpoint for total supply
   * @param _checkpointId is the Checkpoint ID to query
   * @return uint256
   */
    function getTotalSupplyAt(uint256 _checkpointId) external view returns(uint256);
}
