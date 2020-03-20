pragma solidity 0.5.8;

/**
 * @title Interface for security token proxy deployment
 */
interface ISTFactory {
// IN PROGRESS WILL NOT COMPILE Need to modify contract
    event LogicContractSet(string _version, address _logicContract, bytes _upgradeData);
    event TokenUpgraded(
        address indexed _securityToken,
        uint256 indexed _version
    );

    event DefaultDataStoreUpdated(address indexed _oldDataStoreFactory, address indexed _newDataStoreFactory);

    /**
     * @notice Deploys the token and adds default modules like permission manager and transfer manager.
     * Future versions of the proxy can attach different modules or pass some other paramters.
     * @param _name is the name of the Security token
     * @param _symbol is the symbol of the Security Token
     * @param _granularity is the number of granularity of the Security Token
     * @param _divisible whether the token is divisible or not
     * @param _treasuryWallet Ethereum address which will holds the STs.
     */
    function deployToken(
        string calldata _name,
        string calldata _symbol,
        uint8 _granularity,
        address _issuer,
        bool _divisible,
        address _treasuryWallet 
    )
    external
    returns(address tokenAddress);

    /**
     * @notice Used to set a new token logic contract
     * @param _version Version of upgraded module
     * @param _logicContract Address of deployed module logic contract referenced from proxy
     * @param _initializationData Initialization data that used to intialize value in the securityToken
     * @param _upgradeData Data to be passed in call to upgradeToAndCall when a token upgrades its module
     */
    function setLogicContract(string calldata _version, address _logicContract, bytes calldata _initializationData, bytes calldata _upgradeData) external;

    /**
     * @notice Used to upgrade a token
     * @param _maxModuleType maximum module type enumeration
     */
    function upgradeToken(uint8 _maxModuleType) external;

    /**
     * @notice Used to set a new default data store
     * @dev Setting this to address(0) means don't deploy a default data store
     * @param _dataStoreFactory Address of new default data store factory
     */
    function updateDefaultDataStore(address _dataStoreFactory) external;
}
