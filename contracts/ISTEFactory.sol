pragma solidity 0.5.10;

/**
 * @title Interface for security token deployment
 */
interface ISTEFactory {

    // Emit when new contract deployed
    event NewContractDeployed(address _newContract);
    /**
     * @notice Deploys the token and adds token extensions and other such code
     * @param _name is the name of the Security token
     * @param _symbol is the symbol of the Security Token
     * @param _granularity is the number of granularity of the Security Token
     * @param _controllers Issuer controllers whom will be able to do force transfer, redemptions, etc
     * @param _defaultPartitions An array of bytes32 representations of the  Whether to activate the certificates feature
     * @param _owner New Owner
     */
    function deployToken(
        string calldata _name,
        string calldata _symbol,
        uint8 _granularity,
        address[] calldata _controllers,
        // address _certificateSigner,
        // bool _certificateActivated,
        bytes32[] calldata _defaultPartitions,
        address _owner,
        bytes32[] calldata hookContractNames,
        address[] calldata deployedModules
    )
    external
    returns(address tokenAddress);
}
