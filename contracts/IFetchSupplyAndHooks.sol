pragma solidity 0.5.10;

/**
 * @title IFetchSupplyAndHooks standard
 */
interface IFetchSupplyAndHooks {
  function totalPartitions() external view returns (bytes32[] memory);
  function totalSupplyByPartition(bytes32 partition) external view returns (uint256);
  function setHookContract(address validatorAddress, string calldata interfaceLabel) external;
  }