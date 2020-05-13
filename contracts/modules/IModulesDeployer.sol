pragma solidity 0.5.10;

/**
 * @title Interface for the modules deployer
 */
interface IModulesDeployer {
    /**
    * @notice Deploys an instance of a new Security Token and records it to the registry
    * @param _extensionProtocolNames The name of the extensions to deploy
    * @param _major The major version of the release
    * @param _minor The minor version of the release
    * @param _patch The patch version
    */
    function deployMultipleModulesFromFactories(
        bytes32[] calldata _extensionProtocolNames,
        uint8 _major,
        uint8 _minor,
        uint8 _patch
    )
    external returns(address[] memory deployedModuleAddresses);
}
