pragma solidity 0.5.10;

/**
 * @title Interface for multiple issuance configuration
 */
interface IMultipleIssuanceModule {

    function configure(
        address _securityToken
    ) external;
}
