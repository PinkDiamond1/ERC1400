pragma solidity 0.5.10;

/**
 * @title Interface for checkpoint module configuration
 */
interface ICheckpointsModule {

    function configure(
        address _securityToken
    ) external;
}
