pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "../interface/IModuleFactory.sol";
import "../storage/EternalStorage.sol";
import "../libraries/Util.sol";
import "../libraries/Encoder.sol";
import "../libraries/VersionUtils.sol";
import "../libraries/DecimalMath.sol";
import "../libraries/IOwnable.sol";
import "../proxy/OwnedUpgradeabilityProxy.sol";
import "./IModulesDeployer.sol";

/**
 * @title Deployer to launch modules from module factories
 */
contract ModulesDeployer is IModulesDeployer, EternalStorage, OwnedUpgradeabilityProxy {
    using SafeMath for uint256;

    bytes32 constant OWNER = 0x02016836a56b71f0d02689e69e326f4f4c1b9057164ef592671cf0d37c8040c0; //keccak256("owner")
    bytes32 constant LATEST_VERSION = 0x4c63b69b9117452b9f11af62077d0cda875fb4e2dbe07ad6f31f728de6926230; //keccak256("latestVersion")
    bytes32 constant INITIALIZE = 0x9ef7257c3339b099aacf96e55122ee78fb65a36bd2a6c19249882be9c98633bf; //keccak256("initialised")
    bytes32 constant MODULE_GETTER = 0x982f24b3bd80807ec3cb227ba152e15c07d66855fa8ae6ca536e689205c0e2e9; //keccak256("moduleGetter")

    event ExtensionContractsDeployed(bytes32[] extensionContractNames, address[] extensionContracts);

    event ProtocolFactorySet(string _protocolName, address indexed _factoryAddress, uint24 _packedVersion);
    event LatestVersionSet(uint8 _major, uint8 _minor, uint8 _patch);
    event ProtocolFactoryRemoved(string _protocolName, uint8 _major, uint8 _minor, uint8 _patch);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /////////////////////////////
    // Modifiers
    /////////////////////////////

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() internal view {
        require(msg.sender == owner(), "Only owner");
    }

    modifier onlyOwnerOrSelf() {
        require(msg.sender == owner() || msg.sender == address(this), "Only owner or self");
        _;
    }

    /////////////////////////////
    // Initialization
    /////////////////////////////

    // Constructor
    constructor(bytes32[] memory _protocolNames, address[] memory _factoryAddresses, uint8 _major, uint8 _minor, uint8 _patch) public {
        initialize(_protocolNames, _factoryAddresses, _major, _minor, _patch);
    }

    /**
     * @notice Initializes instance of STR
     * @param _protocolNames The name of the extensions to deploy
     * @param _factoryAddresses The address of factories in version
     * @param _major version
     * @param _minor version
     * @param _patch version
     */
    function initialize(
        bytes32[] memory _protocolNames,
        address[] memory _factoryAddresses,
        uint8 _major,
        uint8 _minor,
        uint8 _patch
    )
    public
    {
        require(!getBoolValue(INITIALIZE),"Initialized");
        set(OWNER, msg.sender);
        setModuleProtocolFactories(_protocolNames, _factoryAddresses, _major, _minor, _patch);
        setLatestVersion(_major, _minor, _patch);
        set(INITIALIZE, true);
    }

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
    external
    onlyOwner
    returns(address[] memory deployedModuleAddresses)
    {
        uint24 _packedVersion = VersionUtils.pack(_major, _minor, _patch);
        uint256 _protocolVersion = uint256(_packedVersion);
        if (_packedVersion == 0) {
            _protocolVersion = getUintValue(LATEST_VERSION);
        }

        address[] memory deployedExtensionContracts = new address[](_extensionProtocolNames.length);

        for (uint j = 0; j<_extensionProtocolNames.length; j++){
            deployedExtensionContracts[j] = _deployModule(bytes32ToStr(_extensionProtocolNames[j]), _packedVersion);
        }
        emit ExtensionContractsDeployed(_extensionProtocolNames, deployedExtensionContracts);
        return deployedExtensionContracts;
    }

    function _deployModule(
        string memory _extensionProtocolName,
        uint256 _packedProtocolVersion
    )
    internal
    returns(address securityTokenAddress)
    {
        require(bytes(_extensionProtocolName).length > 0 , "Bad protocol name");
        address factoryAddress = getAddressValue(Encoder.getKey(_extensionProtocolName, _packedProtocolVersion));
        // The contract that called the deployer is now the "admin" (Likely the STERegistry)
        address newSecurityTokenAddress = IModuleFactory(factoryAddress).deployModule(msg.sender);
        return newSecurityTokenAddress;
    }

    /**
     * @notice Set the implementation contract address
     * @param _getterContract Address of the contract implementation
     */
    function setGetterRegistry(address _getterContract) public onlyOwnerOrSelf {
        require(_getterContract != address(0));
        set(MODULE_GETTER, _getterContract);
    }

    function _implementation() internal view returns(address) {
        return getAddressValue(MODULE_GETTER);
    }

    /**
     * @notice Get the current STFactory Address
     * @param _protocol The protocol of which we would like the factory to deploy
     */
    function getCurrentExtensionFactoryAddress(string calldata _protocol) external view returns(address stFactoryAddress){
        uint256 _latestVersion = getUintValue(LATEST_VERSION);
        return getAddressValue(Encoder.getKey(_protocol, _latestVersion));
    }

    function bytes32ToStr(bytes32 _bytes32) public pure returns (string memory) {
        // string memory str = string(_bytes32);
        // TypeError: Explicit type conversion not allowed from "bytes32" to "string storage pointer"
        // thus we should fist convert bytes32 to bytes (to dynamically-sized byte array)
        bytes memory bytesArray = new bytes(32);
        for (uint256 i; i < 32; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }

    /**
    * @notice Changes the SecurityToken contract for a particular factory version
    * @notice Changing versions does not affect existing tokens.
    * @param _protocolNames are the extension protocol names.
    * @param _factoryAddresses is the address of the factories.
    * @param _major Major version of the proxy.
    * @param _minor Minor version of the proxy.
    * @param _patch Patch version of the proxy.
    */
    function setModuleProtocolFactories(
        bytes32[] memory _protocolNames,
        address[] memory _factoryAddresses,
        uint8 _major,
        uint8 _minor,
        uint8 _patch)
    public onlyOwner {
        uint24 _packedVersion = VersionUtils.pack(_major, _minor, _patch);
        for (uint j = 0; j<_protocolNames.length; j++){
            string memory protocolName = bytes32ToStr(_protocolNames[j]);
            require(
                bytes(protocolName).length > 0,
                "Empty protocol name"
            );
            require(
                _factoryAddresses[j] != address(0),
                "Invalid address"
            );
            // Add the protocol _protocolNames
            _setModuleProtocolFactory(protocolName, _factoryAddresses[j], _packedVersion);
        }
    }

    function _setModuleProtocolFactory(
        string memory _protocolName,
        address _factoryAddress,
        uint24 _packedVersion) internal {
        address factoryAddress = getAddressValue(Encoder.getKey(_protocolName, uint256(_packedVersion)));
        require(factoryAddress == address(0), "Already exists");
        set(Encoder.getKey(_protocolName, uint256(_packedVersion)), _factoryAddress);
        emit ProtocolFactorySet(_protocolName, _factoryAddress, _packedVersion);
    }


    /**
    * @notice Removes a STFactory
    * @param _protocol The protocol of the extension for the ST
    * @param _major Major version of the proxy.
    * @param _minor Minor version of the proxy.
    * @param _patch Patch version of the proxy.
    */
    function removeProtocolFactory(string memory _protocol, uint8 _major, uint8 _minor, uint8 _patch) public onlyOwner {
        uint24 _packedVersion = VersionUtils.pack(_major, _minor, _patch);
        require(getUintValue(LATEST_VERSION) != _packedVersion, "Cannot remove latestVersion");
        set(Encoder.getKey(_protocol, uint256(_packedVersion)), address(0));
        emit ProtocolFactoryRemoved(_protocol, _major, _minor, _patch);
    }

    /**
    * @notice Changes the default protocol version
    * @notice Changing versions does not affect existing tokens.
    * @param _major Major version of the proxy.
    * @param _minor Minor version of the proxy.
    * @param _patch Patch version of the proxy.
    */
    function setLatestVersion(uint8 _major, uint8 _minor, uint8 _patch) public onlyOwner {
        _setLatestVersion(_major, _minor, _patch);
    }

    /**
    * @notice Get factory address
    */
    function getFactoryForProtocolAndVersion(
        string memory _protocol,
        uint8 _major,
        uint8 _minor,
        uint8 _patch)
    public view onlyOwner returns (address extensionFactory) {
        uint24 _packedVersion = VersionUtils.pack(_major, _minor, _patch);
        return getAddressValue(Encoder.getKey(_protocol, _packedVersion));
    }

    /**
    * @notice Get factory address - convenience
    */
    function getFactoryForProtocolAndLatestVersion(
        string memory protocol)
    public view onlyOwner returns (address extensionFactory) {
        uint256 _latestVersion = getUintValue(LATEST_VERSION);
        return getAddressValue(Encoder.getKey(protocol, _latestVersion));
    }

    function _setLatestVersion(uint8 _major, uint8 _minor, uint8 _patch) internal {
        uint24 _packedVersion = VersionUtils.pack(_major, _minor, _patch);
        set(LATEST_VERSION, uint256(_packedVersion));
        emit LatestVersionSet(_major, _minor, _patch);
    }

    function getLatestVersion(uint8 _major, uint8 _minor, uint8 _patch) public view returns (uint256 latest) {
        return
        getUintValue(LATEST_VERSION);
    }

    /////////////////////////////
    // Ownership, lifecycle & Utility
    /////////////////////////////

    /**
    * @dev Allows the current owner to transfer control of the contract to a newOwner.
    * @param _newOwner The address to transfer ownership to.
    */
    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "Bad address");
        emit OwnershipTransferred(getAddressValue(OWNER), _newOwner);
        set(OWNER, _newOwner);
    }


    /**
    * @notice Reclaims all ERC20Basic compatible tokens
    * @param _tokenContract is the address of the token contract
    */
    function reclaimERC20(address _tokenContract) public onlyOwner {
        require(_tokenContract != address(0), "Bad address");
        IERC20 token = IERC20(_tokenContract);
        uint256 balance = token.balanceOf(address(this));
        require(token.transfer(owner(), balance), "Transfer failed");
    }

    /**
     * @notice Gets the owner of the contract
     * @return address owner
     */
    function owner() public view returns(address) {
        return getAddressValue(OWNER);
    }
}
