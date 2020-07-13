pragma solidity 0.5.10;

import "./VotingModule.sol";
import "../../../interface/IModuleFactory.sol";

/**
 * @title Use this Voting Module factory to deploy an instance
 */
contract VotingModuleFactory is IModuleFactory {

    // Emit when new contract deployed
    event ModuleDeployed(address _newContract, address _admin);

    /**
     * @notice deploys the Voting Module
     */
    function deployModule(address _admin)
        external
        returns(address)
    {
        // Whoever calls this factory module has "factory" rights
        VotingModule contractDeployment = new VotingModule(_admin);

        emit ModuleDeployed(address(contractDeployment), _admin);

        return address(contractDeployment);
    }
}
