pragma solidity 0.5.10;

/**
 * @title IFetchSupply standard
 */
interface IFetchSupply {
  function totalPartitions() external view returns (bytes32[] memory);
  function totalSupplyByPartition(bytes32 partition) external view returns (uint256);
  }