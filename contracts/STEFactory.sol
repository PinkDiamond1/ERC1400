pragma solidity 0.5.10;

import "./ISTEFactory.sol";
import "./ERC1400.sol";

/**
 * @title Use this STE Factory to deploy instances of the ERC1400 Contract
 */
contract STEFactory is ISTEFactory {
    // Emit when new contract deployed
    event NewContractDeployed(address _newContract);

    /**
     * @notice deploys the ERC1400 token
     */
    function deployToken(
        string calldata _name,
        string calldata _symbol,
        uint8 _granularity,
        address[] calldata _controllers,
        //address _certificateSigner,
        // bool _certificateActivated,
        bytes32[] calldata _defaultPartitions,
        address _owner,
        bytes32[] calldata _hookContractNames,
        address[] calldata _hookContracts
    )
        external
        returns(address)
    {
        ERC1400 contractDeployment = new ERC1400(
            _name,
            _symbol,
            _granularity,
            _controllers,
        // _certificateSigner,
        // _certificateActivated,
            _defaultPartitions
        );

        emit NewContractDeployed(address(contractDeployment));

        address securityToken = address(contractDeployment);

        // Set preliminary hook contracts
        for (uint j = 0; j<_hookContracts.length; j++){
            ERC1400(securityToken).setHookContract(_hookContracts[j], bytes32ToStr(_hookContractNames[j]));
        }
        address[] memory allControllers = new address[](_controllers.length+1);

        for (uint j = 0; j<_controllers.length; j++){
            allControllers[j] = _controllers[j];
        }
        allControllers[_controllers.length] = _hookContracts[0];

        ERC1400(securityToken).addMinter(_owner);
        // Add minters all controllers
         for (uint j = 0; j<allControllers.length; j++){
            ERC1400(securityToken).addMinter(allControllers[j]);
         }

        // Add all controllers on the token
        ERC1400(securityToken).setControllers(allControllers);

        // Add all partition controllers on the token
        for (uint j = 0; j<_defaultPartitions.length; j++){
            ERC1400(securityToken).setPartitionControllers(_defaultPartitions[j], allControllers);
        }

        // Set the owner of the ERC1400 contract
        ERC1400(securityToken).transferOwnership(_owner);

        return securityToken;
    }

    function bytes32ToStr(bytes32 _bytes32) internal pure returns (string memory) {
        // string memory str = string(_bytes32);
        // TypeError: Explicit type conversion not allowed from "bytes32" to "string storage pointer"
        // thus we should fist convert bytes32 to bytes (to dynamically-sized byte array)
        bytes memory bytesArray = new bytes(32);
        for (uint256 i; i < 32; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }
}