pragma solidity 0.5.10;

/**
 * @title Interface for checkpoint module configuration
 */
interface IConfigurableModule {

    function configure(
        address _securityToken
    ) external;
}
