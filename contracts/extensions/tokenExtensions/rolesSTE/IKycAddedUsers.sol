pragma solidity 0.5.10;

/**
 * @title IKycAddedUsers standard
 */
interface IKycAddedUsers {
  function getKycAddedUsers() external view returns(address[] memory users);
}