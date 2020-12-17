pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./ISTEFactory.sol";
import "./ISTERegistry.sol";
import "./IERC1400.sol";
import "./IFetchSupplyAndHooks.sol";
import "./storage/EternalStorage.sol";
import "./libraries/Util.sol";
import "./libraries/Encoder.sol";
import "./libraries/VersionUtils.sol";
import "./libraries/DecimalMath.sol";
import "./libraries/IOwnable.sol";
import "./modules/IModulesDeployer.sol";
//import "./proxy/OwnedUpgradeabilityProxy.sol";
import "./modules/IConfigurableModule.sol";
import "./extensions/tokenExtensions/rolesSTE/AdminRole.sol";
import "erc1820/contracts/ERC1820Client.sol";

/**
 * @title Registry to keep track of registered tokens symbols and be able to deploy ERC1400 tokens from the STEFactory
 */
contract STERegistryV1 is EternalStorage {
    /**
     * @notice state variables - these are the conceptual variables stored in eternal storage now.


       bool public paused;

       address[] public activeUsers;
       mapping(address => bool) public seenUsers;

       mapping(address => bytes32[]) userToTickers;
       mapping(string => address) tickerToSecurityToken;
       mapping(string => uint) tickerIndex;
       mapping(string => TickerDetails) registeredTickers;
       mapping(address => SecurityTokenData) securityTokens;
       mapping(bytes32 => address) protocolVersionST;
       mapping(uint256 => ProtocolVersion) versionData;

       struct ProtocolVersion {
           uint8 major;
           uint8 minor;
           uint8 patch;
       }

       struct TickerDetails {
           address owner;
           uint256 registrationDate;
           string tokenName;
           bool status;
       }

       struct SecurityTokenData {
           string ticker;
           uint256 deployedAt;
       }
       */

    using SafeMath for uint256;


    bytes32 constant OWNER = 0x02016836a56b71f0d02689e69e326f4f4c1b9057164ef592671cf0d37c8040c0; //keccak256("owner")
    bytes32 constant LATEST_VERSION = 0x4c63b69b9117452b9f11af62077d0cda875fb4e2dbe07ad6f31f728de6926230; //keccak256("latestVersion")
    bytes32 constant INITIALIZE = 0x9ef7257c3339b099aacf96e55122ee78fb65a36bd2a6c19249882be9c98633bf; //keccak256("initialised")
    bytes32 constant PAUSED = 0xee35723ac350a69d2a92d3703f17439cbaadf2f093a21ba5bf5f1a53eb2a14d9; //keccak256("paused")
    bytes32 constant MODULE_DEPLOYER = 0xa2392d41e64eb031ce614d0fe6a6d6e38ffb12e97e0d9f0e9a60d298ef9c35c7; //keccak256("moduleDeployer")
    bytes32 constant STRGETTER = 0x982f24b3bd80807ec3cb227ba152e15c07d66855fa8ae6ca536e689205c0e2e9; //keccak256("STRGetter")
    bytes32 constant ACTIVE_USERS = 0x425619ce6ba8e9f80f17c0ef298b6557e321d70d7aeff2e74dd157bd87177a9e; //keccak256("activeUsers")
    bytes32 constant EXTENSION_PROTOCOLS = 0xf0daa55cefd5d55487523f6d3c3bbf9373b98a25210b2b2924ee34587e24832f; //keccak256("extensionProtocols")

    // Emit when modules deployed
    event ModulesDeployed(address[] _modules, bytes32[] _names);

    // Emit when network becomes paused
    event Pause(address account);

    // Emit when network becomes unpaused
    event Unpause(address account);

    // Emit when the ticker is removed from the registry
    event TickerRemoved(string _ticker, address _removedBy);

    // Emit when ownership gets transferred
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // Emit at the time of launching a new security token
    event NewSecurityToken(
        string _ticker,
        string _name,
        address indexed _securityTokenAddress,
        address indexed _owner,
        uint256 _addedAt,
        address _registrant,
        bool _fromAdmin,
        uint256 _protocolVersion
    );

    // Emit when registering a new ticker
    event RegisterTicker(
        address indexed _owner,
        string _ticker,
        uint256 indexed _registrationDate,
        bool _fromAdmin
    );

    event ProtocolFactorySet(address indexed _STFactory, uint8 _major, uint8 _minor, uint8 _patch);
    event LatestVersionSet(uint8 _major, uint8 _minor, uint8 _patch);
    event ProtocolFactoryRemoved(address indexed _STFactory, uint8 _major, uint8 _minor, uint8 _patch);

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

    /**
     * @notice Modifier to make a function callable only when the contract is not paused.
     */
    modifier whenNotPausedOrOwner() {
        _whenNotPausedOrOwner();
        _;
    }

    function _whenNotPausedOrOwner() internal view {
        if (msg.sender != owner()) {
            require(!isPaused(), "Paused");
        }
    }

    /**
     * @notice Modifier to make a function callable only when the contract is not paused and ignore is msg.sender is owner.
     */
    modifier whenNotPaused() {
        require(!isPaused(), "Paused");
        _;
    }

    /**
     * @notice Modifier to make a function callable only when the contract is paused.
     */
    modifier whenPaused() {
        require(isPaused(), "Not paused");
        _;
    }

    /////////////////////////////
    // Initialization
    /////////////////////////////

    // Constructor
    constructor(address _steFactoryAddress, address modulesDeployer, uint8 _major, uint8 _minor, uint8 _patch) public {
        initialize(_steFactoryAddress, modulesDeployer, _major, _minor, _patch);
    }

    /**
     * @notice Initializes instance of STR
     * @param _steFactoryAddress is the address of the STEFactory
     * @param _major version
     * @param _minor version
     * @param _patch version
     */
    function initialize(
        address _steFactoryAddress,
        address _modulesDeployer,
        uint8 _major,
        uint8 _minor,
        uint8 _patch
    )
        public
    {
        require(!getBoolValue(INITIALIZE),"Initialized");
        require(
            _steFactoryAddress != address(0),
            "Invalid address"
        );

        // We could figure out how to pass this in to contract instead..
        bytes32[] memory hookContractNames = new bytes32[](6);
        hookContractNames[0] = stringToBytes32("ERC1400MultipleIssuance");
        hookContractNames[1] = stringToBytes32("ERC1400TokensValidator");
        hookContractNames[2] = stringToBytes32("ERC1400TokensChecker");
        hookContractNames[3] = stringToBytes32("ERC1400TokensCheckpoints");
        hookContractNames[4] = stringToBytes32("ERC1400TokensDividends");
        hookContractNames[5] = stringToBytes32("ERC1400TokensVoting");

        setArray(EXTENSION_PROTOCOLS, hookContractNames);
        set(PAUSED, false);
        set(MODULE_DEPLOYER, _modulesDeployer);
        set(OWNER, msg.sender);
        setProtocolFactory(_steFactoryAddress, _major, _minor, _patch);
        setLatestVersion(_major, _minor, _patch);
        set(INITIALIZE, true);
    }

    /**
    * @notice Deploys some modules and their owner will be this registry
    * @param _protocolVersion version
    */
    function deployModules(
        uint256 _protocolVersion,
        bytes32[] memory extensionProtocolsToDeploy
    )
    public
    returns(address[] memory newlyDeployedModules)
    {
        if (_protocolVersion == 0) {
            _protocolVersion = getUintValue(LATEST_VERSION);
        }

        //bytes32[] memory extensionProtocolsToDeploy = getArrayBytes32(EXTENSION_PROTOCOLS);
        // Use current version
        uint8[] memory version = VersionUtils.unpack(uint24(_protocolVersion));
        address[] memory deployedModules = IModulesDeployer(getAddressValue(MODULE_DEPLOYER)).deployMultipleModulesFromFactories(
            extensionProtocolsToDeploy, version[0], version[1], version[2]);

        emit ModulesDeployed(deployedModules, extensionProtocolsToDeploy);

        return deployedModules;
    }


//    /**
//    * @notice Deploys an instance of a new Security Token and records it to the registry
//    * @param _name is the name of the token
//    * @param _ticker is the ticker symbol of the security token
//    * @param _granularity is the number of granularity of the Security Token
//    * @param _controllers Issuer controllers whom will be able to do force transfer, redemptions, etc
//    * @param _defaultPartitions An array of bytes32 representations of the  Whether to activate the certificates feature
//    * @param _protocolVersion Version of securityToken contract
//    * - `_protocolVersion` is the packed value of uin8[3] array (it will be calculated offchain)
//    * - if _protocolVersion == 0 then latest version of securityToken will be generated
//    * @param _deployedModules These must be MIM, Validator, Checker, and then any others
//    */
//    function generateNewSecurityToken(
//        string memory _name,
//        string memory _ticker,
//        uint8 _granularity,
//        address[] memory _controllers,
//       // address _certificateSigner,
//        // bool _certificateActivated,
//        bytes32[] memory _defaultPartitions,
//        address _owner,
//        uint256 _protocolVersion,
//        address[] memory _deployedModules
//    )
//        public
//        //whenNotPausedOrOwner
//        onlyOwner
//        returns(address securityTokenAddress)
//    {
//        require(bytes(_name).length > 0 && bytes(_ticker).length > 1 && bytes(_ticker).length <11 , "Bad ticker");
//        if (_protocolVersion == 0) {
//            _protocolVersion = getUintValue(LATEST_VERSION);
//        }
//        _ticker = Util.upper(_ticker);
//        bytes32 statusKey = Encoder.getKey("registeredTickers_status", _ticker);
//        require(!getBoolValue(statusKey), "Already deployed");
//        set(statusKey, true);
//
//        address newSecurityTokenAddress =
//            _deployToken(
//                    _name,
//                    _ticker,
//                    _granularity,
//                    _controllers,
//                    // _certificateSigner,
//                    // _certificateActivated,
//                    _defaultPartitions,
//                    _owner,
//                    _protocolVersion,
//                    _deployedModules);
//
//         emit NewSecurityToken(
//                _ticker, _name, newSecurityTokenAddress, _owner, now, msg.sender, true, _protocolVersion);
//        return newSecurityTokenAddress;
//    }
//
//    function _deployToken(
//        string memory _name,
//        string memory _ticker,
//        uint8 _granularity,
//        address[] memory _controllers,
//    // address _certificateSigner,
//    // bool _certificateActivated,
//        bytes32[] memory _defaultPartitions,
//        address _owner,
//        uint256 _protocolVersion,
//        address [] memory _deployedModules // Must include first 3 modules in ext protocols, rest are optional
//    )
//    internal
//    returns(address securityTokenAddress)
//    {
//        return ISTEFactory(getAddressValue(Encoder.getKey("protocolVersionST", _protocolVersion))).deployToken(
//            _name,
//            _ticker,
//            _granularity,
//            _controllers,
//        // _certificateSigner,
//        // _certificateActivated,
//            _defaultPartitions,
//            _owner,
//        // extensionProtocolNames,
//            _deployedModules
//        );
//    }

    function setupToken(
        address _newSecurityTokenAddress,
        string memory _ticker,
        address _owner,
        address [] memory _deployedModules // Must include first 3 modules in ext protocols, rest are optional
    )
    public
    onlyOwner
    returns(address securityTokenAddress)
    {
       bytes32[] memory extensionProtocolNames = getArrayBytes32(EXTENSION_PROTOCOLS);

        // Make sure the owner has the admin role they need on the Validator roles
        // AdminRole(_deployedModules[1]).addAdmin(_owner);

        // I set hooks on all the deployed modules with their corresponding extension names
        for (uint j = 0; j<_deployedModules.length; j++){
            // Checker and validator not compatible
            if(j != 1 && j != 2){
                IConfigurableModule(_deployedModules[j]).configure(_newSecurityTokenAddress);
            }
             IFetchSupplyAndHooks(_newSecurityTokenAddress).setTokenExtension(_deployedModules[j], bytes32ToString(extensionProtocolNames[j]), false, false, false);
        }

        IOwnable(_newSecurityTokenAddress).transferOwnership(_owner);

        /*solium-disable-next-line security/no-block-members*/
        _setTickerOwnership(_owner, _ticker);
        _storeSecurityTokenData(_newSecurityTokenAddress, _ticker, now, _owner);
        set(Encoder.getKey("tickerToSecurityToken", _ticker), _newSecurityTokenAddress);
        return _newSecurityTokenAddress;
    }

    function stringToBytes32(string memory source) public pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }
        assembly {
            result := mload(add(source, 32))
        }
    }

    /* bytes32 (fixed-size array) to string (dynamically-sized array) */
    function bytes32ToString(bytes32 _bytes32) public pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }

//    /**
//     * @notice Adds a new custom Security Token and saves it to the registry. (Token should follow the IERC1400 interface)
//     * @param _ticker is the ticker symbol of the security token
//     * @param _owner is the owner of the token
//     * @param _securityToken is the address of the securityToken
//     * @param _deployedAt is the timestamp at which the security token is deployed
//     */
//    function addExistingSecurityTokenToRegistry(
//        string memory _ticker,
//        address _owner,
//        address _securityToken,
//        uint256 _deployedAt
//    )
//        public
//        onlyOwner
//    {
//        require(bytes(_ticker).length <= 10, "Bad ticker");
//        require(_owner != address(0), "Bad owner");
//        string memory ticker = Util.upper(_ticker);
//        require(_securityToken != address(0), "Bad address");
//        if(_deployedAt == 0) {
//            _deployedAt = now;
//        }
//        uint256 registrationTime = getUintValue(Encoder.getKey("registeredTickers_registrationDate", ticker));
//        if (registrationTime == 0) {
//            registrationTime = now;
//        }
//        set(Encoder.getKey("tickerToSecurityToken", ticker), _securityToken);
//        _modifyTicker(_owner, ticker, registrationTime, true);
//        _storeSecurityTokenData(_securityToken, ticker, _deployedAt, _owner);
//        // Emit event with Protocol version of 0 for external security tokens.
//        emit NewSecurityToken(
//            ticker, IERC1400(_securityToken).name(), _securityToken, _owner, _deployedAt, msg.sender, true, uint256(0));
//    }


    /**
     * @notice Internal -- Modifies the ticker details.
     */
    function _modifyTicker(
        address _owner,
        string memory _ticker,
        uint256 _registrationDate,
        bool _status
    )
        internal
    {
        address currentOwner = _tickerOwner(_ticker);
        if (currentOwner != address(0)) {
            _deleteTickerOwnership(currentOwner, _ticker);
        }
        if (_tickerStatus(_ticker) && !_status) {
            set(Encoder.getKey("tickerToSecurityToken", _ticker), address(0));
        }
        // If status is true, there must be a security token linked to the ticker already
        if (_status) {
            require(getAddressValue(Encoder.getKey("tickerToSecurityToken", _ticker)) != address(0), "Not registered");
        }
        _addTicker(_owner, _ticker, _registrationDate, _status, true);
    }

    function _tickerOwner(string memory _ticker) internal view returns(address) {
        return getAddressValue(Encoder.getKey("registeredTickers_owner", _ticker));
    }


    /**
     * @notice Internal - Stores the security token details
     */
    function _storeSecurityTokenData(
        address _securityToken,
        string memory _ticker,
        uint256 _deployedAt,
        address _owner
    ) internal {
        set(Encoder.getKey("registeredTickers_status", _ticker), true);
        set(Encoder.getKey("registeredTickers_owner", _ticker), _owner);
        set(Encoder.getKey("securityTokens_ticker", _securityToken), _ticker);
        set(Encoder.getKey("securityTokens_deployedAt", _securityToken), _deployedAt);
    }

    /**
    * @notice Checks that Security Token is registered
    * @param _securityToken is the address of the security token
    * @return bool
    */
    function isSecurityToken(address _securityToken) external view returns(bool) {
        return (keccak256(bytes(getStringValue(Encoder.getKey("securityTokens_ticker", _securityToken)))) != keccak256(""));
    }


    /**
     * @notice Set the implementation contract address
     * @param _getterContract Address of the contract implementation
     */
    function setGetterRegistry(address _getterContract) public onlyOwnerOrSelf {
        require(_getterContract != address(0));
        set(STRGETTER, _getterContract);
    }

    function _implementation() internal view returns(address) {
        return getAddressValue(STRGETTER);
    }

    /**
     * @notice Internal - Sets the details of the ticker
     */
    function _addTicker(
        address _owner,
        string memory _ticker,
        uint256 _registrationDate,
        bool _status,
        bool _fromAdmin
    )
        internal
    {
        _setTickerOwnership(_owner, _ticker);
        _storeTickerDetails(_ticker, _owner, _registrationDate, _status);
        emit RegisterTicker(_owner, _ticker, _registrationDate, _fromAdmin);
    }

    /**
     * @notice Internal - Sets the ticker owner
     * @param _owner is the address of the owner of the ticker
     * @param _ticker is the ticker symbol
     */
    function _setTickerOwnership(address _owner, string memory _ticker) internal {
        bytes32 _ownerKey = Encoder.getKey("userToTickers", _owner);
        uint256 length = uint256(getArrayBytes32(_ownerKey).length);
        pushArray(_ownerKey, Util.stringToBytes32(_ticker));
        set(Encoder.getKey("tickerIndex", _ticker), length);
        bytes32 seenKey = Encoder.getKey("seenUsers", _owner);
        if (!getBoolValue(seenKey)) {
            pushArray(ACTIVE_USERS, _owner);
            set(seenKey, true);
        }
    }


    /**
     * @notice Removes the ticker details, associated ownership & security token mapping
     * @param _ticker is the token ticker
     */
    function removeTicker(string memory _ticker) public onlyOwner {
        string memory ticker = Util.upper(_ticker);
        address ownerAddress = _tickerOwner(ticker);
        require(ownerAddress != address(0), "Bad ticker");
        _deleteTickerOwnership(ownerAddress, ticker);
        set(Encoder.getKey("tickerToSecurityToken", ticker), address(0));
        _storeTickerDetails(ticker, address(0), 0, false);
        /*solium-disable-next-line security/no-block-members*/
        emit TickerRemoved(ticker, msg.sender);
    }


    /**
     * @notice Internal - Removes the owner of a ticker
     */
    function _deleteTickerOwnership(address _owner, string memory _ticker) internal {
        uint256 index = uint256(getUintValue(Encoder.getKey("tickerIndex", _ticker)));
        bytes32 ownerKey = Encoder.getKey("userToTickers", _owner);
        bytes32[] memory tickers = getArrayBytes32(ownerKey);
        assert(index < tickers.length);
        assert(_tickerOwner(_ticker) == _owner);
        deleteArrayBytes32(ownerKey, index);
        if (getArrayBytes32(ownerKey).length > index) {
            bytes32 switchedTicker = getArrayBytes32(ownerKey)[index];
            set(Encoder.getKey("tickerIndex", Util.bytes32ToString(switchedTicker)), index);
        }
    }


    /**
     * @notice Checks if the entered ticker is registered and has not expired
     * @param _ticker is the token ticker
     * @return bool
     */
    function tickerAvailable(string memory _ticker) public view returns(bool) {
        // Validate ticker to avoid confusions where a ticker IS available YET cannot be registered.
        require(bytes(_ticker).length > 0 && bytes(_ticker).length <= 10, "Bad ticker");
        string memory ticker = Util.upper(_ticker);
        if (_tickerOwner(ticker) != address(0)) {
            /*solium-disable-next-line security/no-block-members*/
            if (!_tickerStatus(ticker)) {
                return true;
            } else return false;
        }
        return true;
    }

    function _tickerStatus(string memory _ticker) internal view returns(bool) {
        return getBoolValue(Encoder.getKey("registeredTickers_status", _ticker));
    }


    /**
     * @notice Internal - Stores the ticker details
     */
    function _storeTickerDetails(
        string memory _ticker,
        address _owner,
        uint256 _registrationDate,
        bool _status
    )
        internal
    {
        bytes32 key = Encoder.getKey("registeredTickers_owner", _ticker);
        set(key, _owner);
        key = Encoder.getKey("registeredTickers_registrationDate", _ticker);
        set(key, _registrationDate);
        key = Encoder.getKey("registeredTickers_status", _ticker);
        set(key, _status);
    }


    /**
     * @notice Get security token address by ticker name
     * @param _ticker Symbol of the Scurity token
     * @return address
     */
    function getSecurityTokenAddress(string calldata _ticker) external view returns(address tokenAddress){
        string memory ticker = Util.upper(_ticker);
        return getAddressValue(Encoder.getKey("tickerToSecurityToken", ticker));
    }

    /**
    * @notice Returns the security token data by address
    * @param _securityToken is the address of the security token.
    * @return string is the ticker of the security Token.
    * @return uint256 is the timestamp at which security Token was deployed.
    */
    function getSecurityTokenData(address _securityToken) external view returns (
        string memory tokenSymbol,
        address tokenAddress,
        uint256 tokenTime
    ){
        return (getStringValue(Encoder.getKey("securityTokens_ticker", _securityToken)), _securityToken, getUintValue(Encoder.getKey("securityTokens_deployedAt")));
    }


    /**
     * @notice Get the current STFactory Address
     */
    function getSTFactoryAddress() external view returns(address stFactoryAddress){
            uint256 _latestVersion = getUintValue(LATEST_VERSION);
            return getAddressValue(Encoder.getKey("protocolVersionST", _latestVersion));
    }


    /**
    * @notice Changes the SecurityToken contract for a particular factory version
    * @notice Changing versions does not affect existing tokens.
    * @param _STFactoryAddress is the address of the proxy.
    * @param _major Major version of the proxy.
    * @param _minor Minor version of the proxy.
    * @param _patch Patch version of the proxy.
    */
    function setProtocolFactory(address _STFactoryAddress, uint8 _major, uint8 _minor, uint8 _patch) public onlyOwner {
        _setProtocolFactory(_STFactoryAddress, _major, _minor, _patch);
    }

    function _setProtocolFactory(address _STFactoryAddress, uint8 _major, uint8 _minor, uint8 _patch) internal {
        require(_STFactoryAddress != address(0), "Bad address");
        uint24 _packedVersion = VersionUtils.pack(_major, _minor, _patch);
        address stFactoryAddress = getAddressValue(Encoder.getKey("protocolVersionST", uint256(_packedVersion)));
        require(stFactoryAddress == address(0), "Already exists");
        set(Encoder.getKey("protocolVersionST", uint256(_packedVersion)), _STFactoryAddress);
        emit ProtocolFactorySet(_STFactoryAddress, _major, _minor, _patch);
    }

    /**
    * @notice Removes a STFactory
    * @param _major Major version of the proxy.
    * @param _minor Minor version of the proxy.
    * @param _patch Patch version of the proxy.
    */
    function removeProtocolFactory(uint8 _major, uint8 _minor, uint8 _patch) public onlyOwner {
        uint24 _packedVersion = VersionUtils.pack(_major, _minor, _patch);
        require(getUintValue(LATEST_VERSION) != _packedVersion, "Cannot remove latestVersion");
        emit ProtocolFactoryRemoved(getAddressValue(Encoder.getKey("protocolVersionST", _packedVersion)), _major, _minor, _patch);
        set(Encoder.getKey("protocolVersionST", uint256(_packedVersion)), address(0));
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

    function _setLatestVersion(uint8 _major, uint8 _minor, uint8 _patch) internal {
        uint24 _packedVersion = VersionUtils.pack(_major, _minor, _patch);
        require(getAddressValue(Encoder.getKey("protocolVersionST", _packedVersion)) != address(0), "No factory");
        set(LATEST_VERSION, uint256(_packedVersion));
        emit LatestVersionSet(_major, _minor, _patch);
    }

    /**
     * @notice Returns the list of tickers owned by the selected address
     * @param _owner is the address which owns the list of tickers
     */
    function getTickersByOwner(address _owner) external view returns(bytes32[] memory) {
        uint256 count = 0;
        // accessing the data structure userTotickers[_owner].length
        bytes32[] memory tickersb32 = getArrayBytes32(Encoder.getKey("userToTickers", _owner));
        uint i;
        for (i = 0; i < tickersb32.length; i++) {
            if (_ownerInTicker(tickersb32[i])) {
                count++;
            }
        }
        bytes32[] memory result = new bytes32[](count);
        count = 0;
        for (i = 0; i < tickersb32.length; i++) {
            if (_ownerInTicker(tickersb32[i])) {
                result[count] = tickersb32[i];
                count++;
            }
        }
        return result;
    }

    function _ownerInTicker(bytes32 _ticker) internal view returns (bool) {
        string memory ticker = Util.bytes32ToString(_ticker);
        /*solium-disable-next-line security/no-block-members*/
        if (getBoolValue(Encoder.getKey("registeredTickers_status", ticker))) {
            return true;
        }
        return false;
    }


    /**
     * @notice Returns the list of all tokens for a specific owner
     */
    function getTokensForOwner(address _owner) public view returns(address[] memory) {
               uint256 count = 0;
        // accessing the data structure userTotickers[_owner].length
        bytes32[] memory tickers = getArrayBytes32(Encoder.getKey("userToTickers", _owner));
        uint i;
        for (i = 0; i < tickers.length; i++) {
            if (_ownerInTicker(tickers[i])) {
                count++;
            }
        }
        address[] memory result = new address[](count);
        count = 0;
        for (i = 0; i < tickers.length; i++) {
            if (_ownerInTicker(tickers[i])) {
                result[count] = getAddressValue(Encoder.getKey("tickerToSecurityToken", Util.bytes32ToString(tickers[i])));
                count++;
            }
        }
        return result;
    }

       /**
     * @notice Gets the owner of the ticker
     * @param _ticker Ticker whose owner need to determine
     * @return address Address of the owner
     */
    function getTickerOwner(string calldata _ticker) external view returns(address tickerOwner){
        return _tickerOwner(_ticker);
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
    * @dev Set the module that will deploy
    * @param _newModuleDeployer The address to use for module deployment
    */
    function setModuleDeployer(address _newModuleDeployer) public onlyOwner {
        set(MODULE_DEPLOYER, _newModuleDeployer);
    }
    /**
    * @notice Called by the owner to pause, triggers stopped state
    */
    function pause() external whenNotPaused onlyOwner {
        set(PAUSED, true);
        /*solium-disable-next-line security/no-block-members*/
        emit Pause(msg.sender);
    }

    /**
    * @notice Called by the owner to unpause, returns to normal state
    */
    function unpause() external whenPaused onlyOwner {
        set(PAUSED, false);
        /*solium-disable-next-line security/no-block-members*/
        emit Unpause(msg.sender);
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
     * @notice Check whether the registry is paused or not
     * @return bool
     */
    function isPaused() public view returns(bool) {
        return getBoolValue(PAUSED);
    }

    /**
     * @notice Gets the owner of the contract
     * @return address owner
     */
    function owner() public view returns(address) {
        return getAddressValue(OWNER);
    }

    /**
     * @notice Gets the module deployer
     * @return address moduleDeployer
     */
    function moduleDeployer() public view returns(address) {
        return getAddressValue(MODULE_DEPLOYER);
    }
}
