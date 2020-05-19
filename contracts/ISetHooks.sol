pragma solidity 0.5.10;

/**
 * @title ISetHooks standard
 */
interface ISetHooks {
  function setHookContract(address validatorAddress, string calldata interfaceLabel) external;
  }