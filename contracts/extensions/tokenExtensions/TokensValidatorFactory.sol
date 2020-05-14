pragma solidity 0.5.10;

import "../../interface/IModuleFactory.sol";
import "./ERC1400TokensValidatorSTE.sol";

/**
 * @title Use this Multiple Issuance Module factory to deploy an instance
 */
contract TokensValidatorFactory is IModuleFactory {

    // Emit when new contract deployed
    event ModuleDeployed(address _newContract, address _admin);

    /**
     * @notice deploys the MIM
     */
    function deployModule(address _admin)
        external
        returns(address)
    {
        // Launch the validator with admin and all features enabled
        ERC1400TokensValidatorSTE contractDeployment = new ERC1400TokensValidatorSTE(true, true, _admin);

        emit ModuleDeployed(address(contractDeployment), _admin);

        return address(contractDeployment);
    }
}
