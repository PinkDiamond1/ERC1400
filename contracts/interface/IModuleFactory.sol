pragma solidity 0.5.10;

/**
 * @title Interface for deploying a module
 */
interface IModuleFactory {

    // Emit when new contract deployed
    event ModuleDeployed(address _newContract, address _admin);

    /**
     * @notice Deploys the token extension
     * @param _admin The account which will be able to configure the security token afterwards
     */
    function deployModule(address _admin)
    external
    returns(address tokenAddress);
}
