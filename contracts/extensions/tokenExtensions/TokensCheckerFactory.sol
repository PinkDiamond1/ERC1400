pragma solidity 0.5.10;

import "../../interface/IModuleFactory.sol";
import "./ERC1400TokensChecker.sol";

/**
 * @title Use this Multiple Issuance Module factory to deploy an instance
 */
contract TokensCheckerFactory is IModuleFactory {

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
        ERC1400TokensChecker contractDeployment = new ERC1400TokensChecker();

        emit ModuleDeployed(address(contractDeployment), _admin);

        return address(contractDeployment);
    }
}
