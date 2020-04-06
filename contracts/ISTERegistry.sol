pragma solidity 0.5.10;

/**
 * @title Interface for the STE Registry
 */
interface ISTERegistry {
    // Emit when network becomes paused
    event Pause(address account);

    // Emit when network becomes unpaused
    event Unpause(address account);

    // Emit when the ticker is removed from the registry
    event TickerRemoved(string _ticker, address _removedBy);

    // Emit if ticker ownership is transferred
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
        string _name,
        uint256 indexed _registrationDate,
        bool _fromAdmin
    );

    event ProtocolFactorySet(address indexed _STFactory, uint8 _major, uint8 _minor, uint8 _patch);
    event LatestVersionSet(uint8 _major, uint8 _minor, uint8 _patch);
    event ProtocolFactoryRemoved(address indexed _STFactory, uint8 _major, uint8 _minor, uint8 _patch);

    /**
     * @notice Deploys an instance of a new Security Token and records it to the registry
     * @param _name is the name of the token
     * @param _ticker is the ticker symbol of the security token
     * @param _granularity is the number of granularity of the Security Token
     * @param _controllers Issuer controllers whom will be able to do force transfer, redemptions, etc
     * @param _certificateSigner Valid Eth address which can sign certificates while that feature is active
     * @param _certificateActivated Whether to activate the certificates feature
     * @param _defaultPartitions An array of bytes32 representations of the  Whether to activate the certificates feature
     * @param _protocolVersion Version of securityToken contract
     * - `_protocolVersion` is the packed value of uint8[3] array (it will be calculated offchain)
     * - if _protocolVersion == 0 then latest version of securityToken will be generated
     */
    function generateNewSecurityToken(
        string calldata _name,
        string calldata _ticker,
        uint8 _granularity,
        address[] calldata _controllers,
        address _certificateSigner,
        bool _certificateActivated,
        bytes32[] calldata _defaultPartitions,
        uint256 _protocolVersion
    )
        external 
        returns(address securityTokenAddress);

    /**
    * @notice Adds a new custom Security Token and saves it to the registry. (Token should follow the IERC1400 interface)
     * @param _ticker is the ticker symbol of the security token
    * @param _owner is the owner of the token
     * @param _securityToken is the address of the securityToken
     * @param _deployedAt is the timestamp at which the security token is deployed
     */
    function addExistingSecurityTokenToRegistry(
        string calldata _ticker,
        address _owner,
        address _securityToken,
        uint256 _deployedAt
    )
        external;

    /**
    * @notice Check that Security Token is registered
    * @param _securityToken Address of the Scurity token
    * @return bool
    */
    function isSecurityToken(address _securityToken) external view returns(bool isValid);

    /**
     * @notice Removes the ticker details and associated ownership & security token mapping
     * @param _ticker Token ticker
     */
    function removeTicker(string calldata _ticker) external;


    /**
     * @notice Checks if the entered ticker is registered and has not expired
     * @param _ticker is the token ticker
     * @return bool
     */
    function tickerAvailable(string calldata _ticker) external view returns(bool);

    /**
     * @notice Get security token address by ticker name
     * @param _ticker Symbol of the Scurity token
     * @return address
     */
    function getSecurityTokenAddress(string calldata _ticker) external view returns(address tokenAddress);

    /**
    * @notice Returns the security token data by address
    * @param _securityToken is the address of the security token.
    * @return string is the ticker of the security Token.
    * @return address is the issuer of the security Token.
    * @return string is the details of the security token.
    * @return uint256 is the timestamp at which security Token was deployed.
    */
    function getSecurityTokenData(address _securityToken) external view returns (
        string memory tokenSymbol,
        address tokenAddress,
        uint256 tokenTime
    );

    /**
     * @notice Get the current STFactory Address
     */
    function getSTFactoryAddress() external view returns(address stFactoryAddress);


    /**
     * @notice Returns the list of all tokens owned by a particular owner
     * @param _owner the security token (likely us)
     * @dev Intention is that this is called off-chain so block gas limit is not relevant
     */
    function getTokens(address _owner) external view returns(address[] memory tokens);


    /**
    * @notice Changes the SecurityToken contract for a particular factory version
    * @notice Changing versions does not affect existing tokens.
    * @param _STFactoryAddress is the address of the proxy.
    * @param _major Major version of the proxy.
    * @param _minor Minor version of the proxy.
    * @param _patch Patch version of the proxy
    */
    function setProtocolFactory(address _STFactoryAddress, uint8 _major, uint8 _minor, uint8 _patch) external;

    /**
    * @notice Removes a STFactory
    * @param _major Major version of the proxy.
    * @param _minor Minor version of the proxy.
    * @param _patch Patch version of the proxy
    */
    function removeProtocolFactory(uint8 _major, uint8 _minor, uint8 _patch) external;

    /**
    * @notice Changes the default protocol version
    * @notice Changing versions does not affect existing tokens.
    * @param _major Major version of the proxy.
    * @param _minor Minor version of the proxy.
    * @param _patch Patch version of the proxy
    */
    function setLatestVersion(uint8 _major, uint8 _minor, uint8 _patch) external;

    /**
     * @notice Gets the owner of the ticker
     * @param _ticker Ticker whose owner need to determine
     * @return address Address of the owner
     */
    function getTickerOwner(string calldata _ticker) external view returns(address owner);

    /**
    * @dev Allows the current owner to transfer control of the contract to a newOwner.
    * @param _newOwner The address to transfer ownership to.
    */
    function transferOwnership(address _newOwner) external;

    /**
     * @notice Checks whether the registry is paused or not
     * @return bool
     */
    function isPaused() external view returns(bool paused);

    /**
    * @notice Called by the owner to pause, triggers stopped state
    */
    function pause() external;

    /**
     * @notice Called by the owner to unpause, returns to normal state
     */
    function unpause() external;

    /**
     * @notice Reclaims all ERC20Basic compatible tokens
     * @param _tokenContract is the address of the token contract
     */
    function reclaimERC20(address _tokenContract) external;

    /**
     * @notice Gets the owner of the contract
     * @return address owner
     */
    function owner() external view returns(address ownerAddress);
}