pragma solidity 0.5.10;

import "./MultipleIssuanceModule.sol";
import "../../interface/IModuleFactory.sol";

/**
 * @title Use this Multiple Issuance Module factory to deploy an instance
 */
contract MultipleIssuanceModuleFactory is IModuleFactory {

    // Emit when new contract deployed
    event ModuleDeployed(address _newContract, address admin);

    /**
     * @notice deploys the MIM
     */
    function deployModule(address _admin)
        external
        returns(address)
    {
        // Whoever calls this factory module has "factory" rights
        MultipleIssuanceModule contractDeployment = new MultipleIssuanceModule(_admin);

        emit ModuleDeployed(address(contractDeployment), _admin);

        return address(contractDeployment);
    }
}
