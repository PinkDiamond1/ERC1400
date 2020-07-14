pragma solidity 0.5.10;

import "./CheckpointsModule.sol";
import "../../interface/IModuleFactory.sol";

/**
 * @title Use this Checkpoints Module factory to deploy an instance
 */
contract CheckpointsModuleFactory is IModuleFactory {

    // Emit when new contract deployed
    event ModuleDeployed(address _newContract, address _admin);

    /**
     * @notice deploys the Checkpoints Module
     */
    function deployModule(address _admin)
        external
        returns(address)
    {
        // Whoever calls this factory module has "factory" rights
        CheckpointsModule contractDeployment = new CheckpointsModule(_admin);

        emit ModuleDeployed(address(contractDeployment), _admin);

        return address(contractDeployment);
    }
}
