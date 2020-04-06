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
        address _certificateSigner,
        bool _certificateActivated,
        bytes32[] calldata _defaultPartitions,
        address _owner
    )
        external
        returns(address)
    {
        address securityToken = _deploy(
            _name,
            _symbol,
            _granularity,
            _controllers,
            _certificateSigner,
            _certificateActivated,
            _defaultPartitions
        );

        // Set the owner of the ERC1400 contract
        ERC1400(securityToken).transferOwnership(_owner);
        
        return securityToken;
    }

    function _deploy(
        string memory _name,
        string memory _symbol,
        uint8 _granularity,
        address[] memory _controllers,
        address _certificateSigner,
        bool _certificateActivated,
        bytes32[] memory _defaultPartitions
    ) internal returns(address) {

        // Create the Deployment for Consensys ERC1400
        ERC1400 contractDeployment = new ERC1400(
            _name,
            _symbol,
            _granularity,
            _controllers,
            _certificateSigner,
            _certificateActivated,
            _defaultPartitions
        );

        emit NewContractDeployed(address(contractDeployment));

        return address(contractDeployment);
    }

}
