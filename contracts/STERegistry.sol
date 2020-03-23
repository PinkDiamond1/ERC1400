pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./ISTEFactory.sol";
import ".ERC1400ERC20.sol";
import "./storage/EternalStorage.sol";
import "./libraries/Util.sol";
import "./libraries/Encoder.sol";
import "./libraries/VersionUtils.sol";
import "./libraries/DecimalMath.sol";
import "./proxy/Proxy.sol";

/**
 * @title Registry to keep track of registered tokens symbols and be able to deploy ERC1400ERC20 tokens from the STEFactory
 */
contract STERegistry is EternalStorage, Proxy {
// IN PROGRESS WILL NOT COMPILE Need to modify contract
    /**
     * @notice state variables

       uint256 public expiryLimit;
       bool public paused;
       address public owner;

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
           uint256 expiryDate;
           string tokenName; //Not stored since 3.0.0
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

    // Emit when network becomes paused
    event Pause(address account);
    // Emit when network becomes unpaused
    event Unpause(address account);
    // Emit when the ticker is removed from the registry
    event TickerRemoved(string _ticker, address _removedBy);
    // Emit when the token ticker expiry is changed
    event ChangeExpiryLimit(uint256 _oldExpiry, uint256 _newExpiry);
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

    // Emit after ticker registration
    event RegisterTicker(
        address indexed _owner,
        string _ticker,
        uint256 indexed _registrationDate,
        uint256 indexed _expiryDate,
        bool _fromAdmin,
    );
    // For backwards compatibility
    event RegisterTicker(
        address indexed _owner,
        string _ticker,
        string _name,
        uint256 indexed _registrationDate,
        uint256 indexed _expiryDate,
        bool _fromAdmin,
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
    constructor() public {
        set(INITIALIZE, true);
    }

    /**
     * @notice Initializes instance of STR
     * @param _owner is the owner of the STR,
     * @param _getterContract Contract address of the contract which consists getter functions.
     */
    function initialize(
        address _owner,
    )
        public
    {
        require(!getBoolValue(INITIALIZE),"Initialized");
        require(
            _owner != address(0),
            "Invalid address"
        );
        set(EXPIRYLIMIT, uint256(60 * 1 days));
        set(PAUSED, false);
        set(OWNER, _owner);
        set(INITIALIZE, true);
    }


    /**
     * @notice Set the getter contract address
     * @param _getterContract Address of the contract
     */
    function setGetterRegistry(address _getterContract) public onlyOwnerOrSelf {
        require(_getterContract != address(0));
        set(STRGETTER, _getterContract);
    }

    function _implementation() internal view returns(address) {
        return getAddressValue(STRGETTER);
    }

    /////////////////////////////
    // Token Ticker Management
    /////////////////////////////

    /**
     * @notice Registers the token ticker to the selected owner
     * @notice Once the token ticker is registered to its owner then no other issuer can claim
     * @notice its ownership. If the ticker expires and its issuer hasn't used it, then someone else can take it.
     * @param _owner is address of the owner of the token
     * @param _ticker is unique token ticker
     */
    function registerNewTicker(address _owner, string memory _ticker) public whenNotPausedOrOwner {
        require(_owner != address(0), "Bad address");
        require(bytes(_ticker).length > 0 && bytes(_ticker).length <= 10, "Bad ticker");
        string memory ticker = Util.upper(_ticker);
        require(tickerAvailable(ticker), "Ticker reserved");
        // Check whether ticker was previously registered (and expired)
        address previousOwner = _tickerOwner(ticker);
        if (previousOwner != address(0)) {
            _deleteTickerOwnership(previousOwner, ticker);
        }
        /*solium-disable-next-line security/no-block-members*/
        _addTicker(_owner, ticker, now, now.add(getUintValue(EXPIRYLIMIT)), false, false);
    }


    /**
     * @notice Internal - Sets the details of the ticker
     */
    function _addTicker(
        address _owner,
        string memory _ticker,
        uint256 _registrationDate,
        uint256 _expiryDate,
        bool _status,
        bool _fromAdmin,
    )
        internal
    {
        _setTickerOwnership(_owner, _ticker);
        _storeTickerDetails(_ticker, _owner, _registrationDate, _expiryDate, _status);
        emit RegisterTicker(_owner, _ticker, _registrationDate, _expiryDate, _fromAdmin);
    }

    /**
     * @notice Modifies the ticker details
     * @notice Only allowed to modify the tickers which are not yet deployed.
     * @param _owner is the owner of the token
     * @param _ticker is the token ticker
     * @param _registrationDate is the date at which ticker is registered
     * @param _expiryDate is the expiry date for the ticker
     * @param _status is the token deployment status
     */
    function modifyTicker(
        address _owner,
        string memory _ticker,
        string memory _tokenName,
        uint256 _registrationDate,
        uint256 _expiryDate,
        bool _status
    )
        public
        onlyOwner
    {
        require(bytes(_ticker).length > 0 && bytes(_ticker).length <= 10, "Bad ticker");
        require(_expiryDate != 0 && _registrationDate != 0, "Bad dates");
        require(_registrationDate <= _expiryDate, "Bad dates");
        require(_owner != address(0), "Bad address");
        string memory ticker = Util.upper(_ticker);
        _modifyTicker(_owner, ticker, _registrationDate, _expiryDate, _status);
    }


    /**
     * @notice Internal -- Modifies the ticker details.
     */
    function _modifyTicker(
        address _owner,
        string memory _ticker,
        uint256 _registrationDate,
        uint256 _expiryDate,
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
        _addTicker(_owner, _ticker, _registrationDate, _expiryDate, _status, true, uint256(0), uint256(0));
    }

    function _tickerOwner(string memory _ticker) internal view returns(address) {
        return getAddressValue(Encoder.getKey("registeredTickers_owner", _ticker));
    }

    /**
     * @notice Removes the ticker details, associated ownership & security token mapping
     * @param _ticker is the token ticker
     */
    function removeTicker(string memory _ticker) public onlyOwner {
        string memory ticker = Util.upper(_ticker);
        address owner = _tickerOwner(ticker);
        require(owner != address(0), "Bad ticker");
        _deleteTickerOwnership(owner, ticker);
        set(Encoder.getKey("tickerToSecurityToken", ticker), address(0));
        _storeTickerDetails(ticker, address(0), 0, 0, false);
        /*solium-disable-next-line security/no-block-members*/
        emit TickerRemoved(ticker, msg.sender);
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
            if ((now > getUintValue(Encoder.getKey("registeredTickers_expiryDate", ticker))) && !_tickerStatus(ticker)) {
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
        uint256 _expiryDate,
        bool _status
    )
        internal
    {
        bytes32 key = Encoder.getKey("registeredTickers_owner", _ticker);
        set(key, _owner);
        key = Encoder.getKey("registeredTickers_registrationDate", _ticker);
        set(key, _registrationDate);
        key = Encoder.getKey("registeredTickers_expiryDate", _ticker);
        set(key, _expiryDate);
        key = Encoder.getKey("registeredTickers_status", _ticker);
        set(key, _status);
    }


    /**
     * @notice Changes the expiry time for the token ticker
     * @param _newExpiry is the new expiry for newly generated tickers
     */
    function changeExpiryLimit(uint256 _newExpiry) public onlyOwner {
        require(_newExpiry >= 1 days, "Bad dates");
        emit ChangeExpiryLimit(getUintValue(EXPIRYLIMIT), _newExpiry);
        set(EXPIRYLIMIT, _newExpiry);
    }

    /////////////////////////////
    // Security Token Management
    /////////////////////////////

    /**
     * @notice Deploys an instance of a new Security Token and records it to the registry
     * @param _name is the name of the token
     * @param _ticker is the ticker symbol of the security token
     * @param _divisible is whether or not the token is divisible
     * @param _treasuryWallet Ethereum address which will holds the STs.
     * @param _protocolVersion Version of securityToken contract
     * - `_protocolVersion` is the packed value of uin8[3] array (it will be calculated offchain)
     * - if _protocolVersion == 0 then latest version of securityToken will be generated
     */
    function generateNewSecurityToken(
        string memory _name,
        string memory _ticker,
        bool _divisible,
        address[] memory _controllers,
        address _certificateSigner,
        bool _certificateActivated,
        bytes32[] memory _defaultPartitions,
        address _treasuryWallet,
        uint256 _protocolVersion
    )
        public
        whenNotPausedOrOwner
    {
        require(bytes(_name).length > 0 && bytes(_ticker).length > 0, "Bad ticker");
        require(_treasuryWallet != address(0), "0x0 not allowed");
        if (_protocolVersion == 0) {
            _protocolVersion = getUintValue(LATEST_VERSION);
        }
        _ticker = Util.upper(_ticker);
        bytes32 statusKey = Encoder.getKey("registeredTickers_status", _ticker);
        require(!getBoolValue(statusKey), "Already deployed");
        set(statusKey, true);
        address issuer = msg.sender;
        require(_tickerOwner(_ticker) == issuer, "Not authorised");
        /*solium-disable-next-line security/no-block-members*/
        require(getUintValue(Encoder.getKey("registeredTickers_expiryDate", _ticker)) >= now, "Ticker expired");
        address newSecurityTokenAddress =
            _deployToken(_name, _ticker, issuer, _divisible, controllers, certificateSigner, certificateActivated, _defaultPartitions, _treasuryWallet, _protocolVersion);
        if (_protocolVersion == VersionUtils.pack(2, 0, 0)) {
            // For backwards compatibilty. Should be removed with an update when we disable st 2.0 generation.
            emit NewSecurityToken(
                _ticker, _name, newSecurityTokenAddress, issuer, now, issuer, false
            );
        } else {
            emit NewSecurityToken(
                _ticker, _name, newSecurityTokenAddress, issuer, now, issuer, false, _usdFee, _protocolVersion
            );
        }
    }


    function _deployToken(
        string memory _name,
        string memory _ticker,
        address _issuer,
        bool _divisible,
        address[] memory _controllers,
        address _certificateSigner,
        bool _certificateActivated,
        bytes32[] memory _defaultPartitions,
        address _wallet,
        uint256 _protocolVersion
    )
        internal
        returns(address newSecurityTokenAddress)
    {
        uint8[] memory upperLimit = new uint8[](3);
        upperLimit[0] = 2;
        upperLimit[1] = 99;
        upperLimit[2] = 99;

        newSecurityTokenAddress = ISTFactory(getAddressValue(Encoder.getKey("protocolVersionST", _protocolVersion))).deployToken(
            _name,
            _ticker,
            18,
            _issuer,
            _divisible,
            _controllers,
            _certificateSigner,
            _certificateActivated,
            _defaultPartitions,
            _wallet
        );

        /*solium-disable-next-line security/no-block-members*/
        _storeSecurityTokenData(newSecurityTokenAddress, _ticker, now);
        set(Encoder.getKey("tickerToSecurityToken", _ticker), newSecurityTokenAddress);
    }

    /**
     * @notice Adds a new custom Security Token and saves it to the registry. (Token should follow the ISecurityToken interface)
     * @param _ticker is the ticker symbol of the security token
     * @param _owner is the owner of the token
     * @param _securityToken is the address of the securityToken
     * @param _deployedAt is the timestamp at which the security token is deployed
     */
    function modifyExistingSecurityToken(
        string memory _ticker,
        address _owner,
        address _securityToken,
        uint256 _deployedAt
    )
        public
        onlyOwner
    {
        require(bytes(_ticker).length <= 10, "Bad ticker");
        require(_deployedAt != 0 && _owner != address(0), "Bad data");
        string memory ticker = Util.upper(_ticker);
        require(_securityToken != address(0), "Bad address");
        uint256 registrationTime = getUintValue(Encoder.getKey("registeredTickers_registrationDate", ticker));
        uint256 expiryTime = getUintValue(Encoder.getKey("registeredTickers_expiryDate", ticker));
        if (registrationTime == 0) {
            /*solium-disable-next-line security/no-block-members*/
            registrationTime = now;
            expiryTime = registrationTime.add(getUintValue(EXPIRYLIMIT));
        }
        set(Encoder.getKey("tickerToSecurityToken", ticker), _securityToken);
        _modifyTicker(_owner, ticker, registrationTime, expiryTime, true);
        _storeSecurityTokenData(_securityToken, ticker, _deployedAt);
        emit NewSecurityToken(
            ticker, ISecurityToken(_securityToken).name(), _securityToken, _owner, _deployedAt, msg.sender, true, uint256(0), uint256(0), 0
        );
    }


    /**
     * @notice Internal - Stores the security token details
     */
    function _storeSecurityTokenData(
        address _securityToken,
        string memory _ticker,
        uint256 _deployedAt
    ) internal {
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
    * @notice Changes the SecurityToken contract for a particular factory version
    * @notice Changing versions does not affect existing tokens.
    * @param _STFactoryAddress is the address of the proxy.
    * @param _major Major version of the proxy.
    * @param _minor Minor version of the proxy.
    * @param _patch Patch version of the proxy
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
    * @param _patch Patch version of the proxy
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
    * @param _patch Patch version of the proxy
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
}