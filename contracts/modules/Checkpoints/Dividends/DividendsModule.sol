pragma solidity 0.5.10;

import "../../../extensions/userExtensions/IERC1400TokensRecipient.sol";
import "../../../extensions/tokenExtensions/rolesSTE/IKycAddedUsers.sol";
import "../../../interface/ERC1820Implementer.sol";
import "../../../IFetchSupply.sol";
import "../../IConfigurableModule.sol";
import "../../Module.sol";
import "../../../IERC1400.sol";
import "../ICheckpointsModule.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/math/Math.sol";
import "erc1820/contracts/ERC1820Client.sol";

contract DividendsModule is ERC1820Client, ERC1820Implementer, Module, IConfigurableModule {
  using SafeMath for uint256;
  uint256 internal constant e18 = uint256(10) ** uint256(18);
  string constant internal DIVIDENDS_MODULE = "ERC1400TokensDividends";
  string constant internal ERC1400_TOKENS_VALIDATOR = "ERC1400TokensValidator";
  string constant internal ERC1400_TOKENS_CHECKPOINTS = "ERC1400TokensCheckpoints";

  event SetDefaultExcludedAddresses(address[] _excluded);
  event SetWithholding(address[] _investors, uint256[] _withholding);
  event SetWithholdingFixed(address[] _investors, uint256 _withholding);
  event SetWallet(address indexed _oldWallet, address indexed _newWallet);
  event UpdateDividendDates(uint256 indexed _dividendIndex, uint256 _maturity, uint256 _expiry);

  event ERC20DividendDeposited(
    address indexed _depositor,
    uint256 _checkpointId,
    uint256 _maturity,
    uint256 _expiry,
    address indexed _token,
    uint256 _amount,
    uint256 _totalSupply,
    uint256 _dividendIndex
  );
  event ERC20DividendClaimed(address indexed _payee, uint256 indexed _dividendIndex, address indexed _token, uint256 _amount, uint256 _withheld);
  event ERC20DividendReclaimed(address indexed _claimer, uint256 indexed _dividendIndex, address indexed _token, uint256 _claimedAmount);
  event ERC20DividendWithholdingWithdrawn(
    address indexed _claimer,
    uint256 indexed _dividendIndex,
    address indexed _token,
    uint256 _withheldAmount
  );

  // Address to which reclaimed dividends and withholding tax is sent
  address payable public wallet;
  uint256 public EXCLUDED_ADDRESS_LIMIT = 150;

  struct Dividend {
    uint256 checkpointId;
    uint256 created; // Time at which the dividend was created
    uint256 maturity; // Time after which dividend can be claimed - set to 0 to bypass
    uint256 expiry;  // Time until which dividend can be claimed - after this time any remaining amount can be withdrawn by issuer -
    // set to very high value to bypass
    uint256 amount; // Dividend amount in WEI
    uint256 claimedAmount; // Amount of dividend claimed so far
    uint256 totalSupply; // Total supply at the associated checkpoint (avoids recalculating this)
    bool reclaimed;  // True if expiry has passed and issuer has reclaimed remaining dividend
    uint256 totalWithheld;
    uint256 totalWithheldWithdrawn;
    mapping (address => bool) claimed; // List of addresses which have claimed dividend
    mapping (address => bool) dividendExcluded; // List of addresses which cannot claim dividends
    mapping (address => uint256) withheld; // Amount of tax withheld from claim
    bytes32 partition; // Used for identification of partition
  }

  // List of all dividends
  Dividend[] public dividends;

  // List of addresses which cannot claim dividends
  address[] public excluded;

  // Mapping from address to withholding tax as a percentage * 10**16
  mapping (address => uint256) public withholdingTax;

  // Total amount of ETH withheld per investor
  mapping(address => uint256) public investorWithheld;

  // ERC20 Div storage
  // Mapping to token address for each dividend
  mapping(uint256 => address) public dividendTokens;

  constructor(address factory) public
    Module(factory)
  {
    ERC1820Implementer._setInterface(DIVIDENDS_MODULE);
  }

  /**
* @notice This function returns the signature of configure function
*/
  function getInitFunction() public pure returns (bytes4) {
    return this.configure.selector;
  }

  /**
  * @notice Function used to initialize the contract variables
  */
  function configure(
    address _securityToken
  )
  external
  onlyFactory
  {
    securityToken = _securityToken;
  }


  function _validDividendIndex(uint256 _dividendIndex) internal view {
    require(_dividendIndex < dividends.length, "Invalid dividend");
    require(!dividends[_dividendIndex].reclaimed, "Dividend reclaimed");
    /*solium-disable-next-line security/no-block-members*/
    require(now >= dividends[_dividendIndex].maturity, "Dividend maturity in future");
    /*solium-disable-next-line security/no-block-members*/
    require(now < dividends[_dividendIndex].expiry, "Dividend expiry in past");
  }

  /**
     * @notice Return the default excluded addresses
     * @return List of excluded addresses
     */
  function getDefaultExcluded() external view returns(address[] memory) {
    return excluded;
  }

  /**
 * @notice Function used to change wallet address
 * @param _wallet Ethereum account address to receive reclaimed dividends and tax
 */
  function changeWallet(address payable _wallet) withControllerPermission external {
    _setWallet(_wallet);
  }

  function _setWallet(address payable _wallet) internal {
    emit SetWallet(wallet, _wallet);
    wallet = _wallet;
  }

  /**
   * @notice Returns the treasury wallet address
   */
  function getTreasuryWallet() public view returns(address payable) {
    // This is just the regular wallet for now
      return wallet;
  }

  /**
  * @notice get 1820 address validator
  */
  function getValidatorModule() public view returns(address) {
      return interfaceAddr(securityToken, ERC1400_TOKENS_VALIDATOR);
  }

  /**
  * @notice get 1820 address checkpoints
  */
  function getCheckpointsModule() public view returns(address) {
      return interfaceAddr(securityToken, ERC1400_TOKENS_CHECKPOINTS);
  }

  /**
 * @notice returns an array of investors with non zero balance at a given checkpoint
 * @param _partition
 * @param _checkpointId Checkpoint id at which investor list is to be populated
 * @return list of investors
 */
  function getInvestorsAt(bytes32 _partition, uint256 _checkpointId) public view returns (address[] memory holdingInvestors) {
    uint256 count;
    uint256 i;
    address[] memory investors = IKycAddedUsers(getValidatorModule()).getKycAddedUsers();
    for (i = 0; i < investors.length; i++) {
      if (ICheckpointsModule(getCheckpointsModule()).getValueAt(_partition, investors[i], _checkpointId) > 0) {
        count++;
      } else {
        investors[i] = address(0);
      }
    }
    address[] memory holders = new address[](count);
    count = 0;
    for (i = 0; i < investors.length; i++) {
      if (investors[i] != address(0)) {
        holders[count] = investors[i];
        count++;
      }
    }
    return holders;
  }

  function getAddressArrayElements(address[] memory addressArray, uint256 _startIndex, uint256 _endIndex) public view returns(address[] memory array) {
    uint256 size = addressArray.length;
    if (_endIndex >= size) {
      size = size - _startIndex;
    } else {
      size = _endIndex - _startIndex + 1;
    }
    array = new address[](size);
    for(uint256 i; i < size; i++)
      array[i] = addressArray[i + _startIndex];
  }

  /**
       * @notice returns an array of investors with non zero balance at a given checkpoint
        * @param _partition
       * @param _checkpointId Checkpoint id at which investor list is to be populated
       * @param _start Position of investor to start iteration from
       * @param _end Position of investor to stop iteration at
       * @return list of investors
       */
  function getInvestorsSubsetAt(bytes32 _partition, uint256 _checkpointId, uint256 _start, uint256 _end) internal view returns(address[] memory holdingInvestorsInSubset) {
    uint256 count;
    uint256 i;
    address[] memory investors = IKycAddedUsers(getValidatorModule()).getKycAddedUsers();
    for (i = 0; i < investors.length; i++) {
      if (ICheckpointsModule(getCheckpointsModule()).getValueAt(_partition, investors[i], _checkpointId) > 0) {
        count++;
      } else {
        investors[i] = address(0);
      }
    }
    address[] memory holders = new address[](count);
    count = 0;
    for (i = 0; i < investors.length; i++) {
      if (investors[i] != address(0)) {
        holders[count] = investors[i];
        count++;
      }
    }
    return getAddressArrayElements(holders, _start, _end);
  }

  /**
   * @notice Function to clear and set list of excluded addresses used for future dividends
   * @param _excluded Addresses of investors
   */
  function setDefaultExcluded(address[] memory _excluded) public withControllerPermission {
    require(_excluded.length <= EXCLUDED_ADDRESS_LIMIT, "Too many excluded addresses");
    for (uint256 j = 0; j < _excluded.length; j++) {
      require(_excluded[j] != address(0), "Invalid address");
      for (uint256 i = j + 1; i < _excluded.length; i++) {
        require(_excluded[j] != _excluded[i], "Duplicate exclude address");
      }
    }
    excluded = _excluded;
    /*solium-disable-next-line security/no-block-members*/
    emit SetDefaultExcludedAddresses(excluded);
  }

  /**
   * @notice Function to set withholding tax rates for investors
   * @param _investors Addresses of investors
   * @param _withholding Withholding tax for individual investors (multiplied by 10**16)
   */
  function setWithholding(address[] memory _investors, uint256[] memory _withholding) public withControllerPermission {
    require(_investors.length == _withholding.length, "Mismatched input lengths");
    /*solium-disable-next-line security/no-block-members*/
    emit SetWithholding(_investors, _withholding);
    for (uint256 i = 0; i < _investors.length; i++) {
      require(_withholding[i] <= e18, "Incorrect withholding tax");
      withholdingTax[_investors[i]] = _withholding[i];
    }
  }

  /**
   * @notice Function to set withholding tax rates for investors
   * @param _investors Addresses of investor
   * @param _withholding Withholding tax for all investors (multiplied by 10**16)
   */
  function setWithholdingFixed(address[] memory _investors, uint256 _withholding) public withControllerPermission {
    require(_withholding <= e18, "Incorrect withholding tax");
    /*solium-disable-next-line security/no-block-members*/
    emit SetWithholdingFixed(_investors, _withholding);
    for (uint256 i = 0; i < _investors.length; i++) {
      withholdingTax[_investors[i]] = _withholding;
    }
  }

  /**
   * @notice Issuer can push dividends to provided addresses
   * @param _dividendIndex Dividend to push
   * @param _payees Addresses to which to push the dividend
   */
  function pushDividendPaymentToAddresses(
    uint256 _dividendIndex,
    address payable[] memory _payees
  )
  public
  withControllerPermission
  {
    _validDividendIndex(_dividendIndex);
    Dividend storage dividend = dividends[_dividendIndex];
    for (uint256 i = 0; i < _payees.length; i++) {
      if ((!dividend.claimed[_payees[i]]) && (!dividend.dividendExcluded[_payees[i]])) {
        _payDividend(_payees[i], dividend, _dividendIndex);
      }
    }
  }

  /**
   * @notice Issuer can push dividends using the investor list from the security token
   * @param _dividendIndex Dividend to push
   * @param _start Index in investor list at which to start pushing dividends
   * @param _end Index in investor list at which to stop pushing dividends
   */
  function pushDividendPayment(
    uint256 _dividendIndex,
    uint256 _start,
    uint256 _end
  )
  public
  withControllerPermission
  {
    //NB If possible, please use pushDividendPaymentToAddresses as it is cheaper than this function
    _validDividendIndex(_dividendIndex);
    Dividend storage dividend = dividends[_dividendIndex];
    uint256 checkpointId = dividend.checkpointId;

    address[] memory investors = getInvestorsSubsetAt(dividend.partition, checkpointId + 1, _start, _end);

    // The investors list maybe smaller than _end - _start becuase it only contains addresses that had a positive balance
    // the _start and _end used here are for the address list stored in the dataStore
    for (uint256 i = 0; i < investors.length; i++) {
      address payable payee = address(uint160(investors[i]));
      if ((!dividend.claimed[payee]) && (!dividend.dividendExcluded[payee])) {
        _payDividend(payee, dividend, _dividendIndex);
      }
    }
  }

  /**
   * @notice Investors can pull their own dividends
   * @param _dividendIndex Dividend to pull
   */
  function pullDividendPayment(uint256 _dividendIndex) public whenNotPaused {
    _validDividendIndex(_dividendIndex);
    Dividend storage dividend = dividends[_dividendIndex];
    require(!dividend.claimed[msg.sender], "Dividend already claimed");
    require(!dividend.dividendExcluded[msg.sender], "msg.sender excluded from Dividend");
    _payDividend(msg.sender, dividend, _dividendIndex);
  }

  /**
   * @notice Calculate amount of dividends claimable
   * @param _dividendIndex Dividend to calculate
   * @param _payee Affected investor address
   * @return claim, withheld amounts
   */
  function calculateDividend(uint256 _dividendIndex, address _payee) public view returns(uint256, uint256) {
    require(_dividendIndex < dividends.length, "Invalid dividend");
    Dividend storage dividend = dividends[_dividendIndex];
    if (dividend.claimed[_payee] || dividend.dividendExcluded[_payee]) {
      return (0, 0);
    }
    uint256 balance = ICheckpointsModule(getCheckpointsModule()).getValueAt(dividend.partition, _payee, dividend.checkpointId);
    // TODO Value is rounded on the blockchain, could lose significant figures without float, need to figure that out.
    uint256 claim = balance.mul(dividend.amount).div(dividend.totalSupply); // Subtract the dividend amount from total supply, as the amount is inside the module itself.
    uint256 withheld = claim.mul(withholdingTax[_payee]).div(e18);
    return (claim, withheld);
  }

  /**
   * @notice Get the index according to the checkpoint id
   * @param _checkpointId Checkpoint id to query
   * @return uint256[]
   */
  function getDividendIndex(uint256 _checkpointId) public view returns(uint256[] memory) {
    uint256 counter = 0;
    for (uint256 i = 0; i < dividends.length; i++) {
      if (dividends[i].checkpointId == _checkpointId) {
        counter++;
      }
    }

    uint256[] memory index = new uint256[](counter);
    counter = 0;
    for (uint256 j = 0; j < dividends.length; j++) {
      if (dividends[j].checkpointId == _checkpointId) {
        index[counter] = j;
        counter++;
      }
    }
    return index;
  }

  /**
   * @notice Allows issuer to change maturity / expiry dates for dividends
   * @dev NB - setting the maturity of a currently matured dividend to a future date
   * @dev will effectively refreeze claims on that dividend until the new maturity date passes
   * @ dev NB - setting the expiry date to a past date will mean no more payments can be pulled
   * @dev or pushed out of a dividend
   * @param _dividendIndex Dividend to withdraw from
   * @param _maturity updated maturity date
   * @param _expiry updated expiry date
   */
  function updateDividendDates(uint256 _dividendIndex, uint256 _maturity, uint256 _expiry) external withControllerPermission {
    require(_dividendIndex < dividends.length, "Invalid dividend");
    require(_expiry > _maturity, "Expiry before maturity");
    Dividend storage dividend = dividends[_dividendIndex];
    require(dividend.expiry > now, "Dividend already expired");
    dividend.expiry = _expiry;
    dividend.maturity = _maturity;
    emit UpdateDividendDates(_dividendIndex, _maturity, _expiry);
  }

  /**
   * @notice Get static dividend data
   * @return uint256[] timestamp of dividends creation
   * @return uint256[] timestamp of dividends maturity
   * @return uint256[] timestamp of dividends expiry
   * @return uint256[] amount of dividends
   * @return uint256[] claimed amount of dividends
   */
  function getDividendsData() external view returns (
    uint256[] memory createds,
    uint256[] memory maturitys,
    uint256[] memory expirys,
    uint256[] memory amounts,
    uint256[] memory claimedAmounts,
    bytes32[] memory partitions)
  {
    createds = new uint256[](dividends.length);
    maturitys = new uint256[](dividends.length);
    expirys = new uint256[](dividends.length);
    amounts = new uint256[](dividends.length);
    claimedAmounts = new uint256[](dividends.length);
    partitions = new bytes32[](dividends.length);
    for (uint256 i = 0; i < dividends.length; i++) {
      (createds[i], maturitys[i], expirys[i], amounts[i], claimedAmounts[i], partitions[i]) = getDividendData(i);
    }
  }

  /**
   * @notice Get static dividend data
   * @return uint256 timestamp of dividend creation
   * @return uint256 timestamp of dividend maturity
   * @return uint256 timestamp of dividend expiry
   * @return uint256 amount of dividend
   * @return uint256 claimed amount of dividend
   * @return bytes32 partition of dividend
   */
  function getDividendData(uint256 _dividendIndex) public view returns (
    uint256 created,
    uint256 maturity,
    uint256 expiry,
    uint256 amount,
    uint256 claimedAmount,
    bytes32 partition)
  {
    created = dividends[_dividendIndex].created;
    maturity = dividends[_dividendIndex].maturity;
    expiry = dividends[_dividendIndex].expiry;
    amount = dividends[_dividendIndex].amount;
    claimedAmount = dividends[_dividendIndex].claimedAmount;
    partition = dividends[_dividendIndex].partition;
  }

  /**
   * @notice Retrieves list of investors, their claim status and whether they are excluded
   * @param _dividendIndex Dividend to withdraw from
   * @return address[] list of investors
   * @return bool[] whether investor has claimed
   * @return bool[] whether investor is excluded
   * @return uint256[] amount of withheld tax (estimate if not claimed)
   * @return uint256[] amount of claim (estimate if not claimeed)
   * @return uint256[] investor balance
   */
  function getDividendProgress(uint256 _dividendIndex) external view returns (
    bytes32 partition,
    address[] memory investors,
    bool[] memory resultClaimed,
    bool[] memory resultExcluded,
    uint256[] memory resultWithheld,
    uint256[] memory resultAmount,
    uint256[] memory resultBalance)
  {
    require(_dividendIndex < dividends.length, "Invalid dividend");
    //Get list of Investors
    Dividend storage dividend = dividends[_dividendIndex];
    uint256 checkpointId = dividend.checkpointId;
    partition = dividend.partition;
    investors = getInvestorsAt(partition, checkpointId + 1);
    resultClaimed = new bool[](investors.length);
    resultExcluded = new bool[](investors.length);
    resultWithheld = new uint256[](investors.length);
    resultAmount = new uint256[](investors.length);
    resultBalance = new uint256[](investors.length);
    for (uint256 i; i < investors.length; i++) {
      resultClaimed[i] = dividend.claimed[investors[i]];
      resultExcluded[i] = dividend.dividendExcluded[investors[i]];
      resultBalance[i] = ICheckpointsModule(getCheckpointsModule()).getValueAt(partition, investors[i], dividend.checkpointId);
      if (!resultExcluded[i]) {
        if (resultClaimed[i]) {
          resultWithheld[i] = dividend.withheld[investors[i]];
          resultAmount[i] = resultBalance[i].mul(dividend.amount).div(dividend.totalSupply).sub(resultWithheld[i]);
        } else {
          (uint256 claim, uint256 withheld) = calculateDividend(_dividendIndex, investors[i]);
          resultWithheld[i] = withheld;
          resultAmount[i] = claim.sub(withheld);
        }
      }
    }
  }

  /**
   * @notice Retrieves list of investors, their balances, and their current withholding tax percentage
   * @param _partition
   * @param _checkpointId Checkpoint Id to query for
   * @return address[] list of investors
   * @return uint256[] investor balances
   * @return uint256[] investor withheld percentages
   */
  function getCheckpointData(bytes32 _partition, uint256 _checkpointId) external view returns (address[] memory investors, uint256[] memory balances, uint256[] memory withholdings) {
    require(_checkpointId <= ICheckpointsModule(getCheckpointsModule()).getCurrentCheckpointId(), "Invalid checkpoint");

     investors = getInvestorsAt(_partition, _checkpointId + 1);

    balances = new uint256[](investors.length);
    withholdings = new uint256[](investors.length);
    for (uint256 i; i < investors.length; i++) {
      balances[i] = ICheckpointsModule(getCheckpointsModule()).getValueAt(_partition, investors[i], _checkpointId);
      withholdings[i] = withholdingTax[investors[i]];
    }
  }

  /**
   * @notice Checks whether an address is excluded from claiming a dividend
   * @param _investor Investor address being checked
   * @param _dividendIndex Dividend to withdraw from
   * @return bool whether the address is excluded
   */
  function isExcluded(address _investor, uint256 _dividendIndex) external view returns (bool) {
    require(_dividendIndex < dividends.length, "Invalid dividend");
    return dividends[_dividendIndex].dividendExcluded[_investor];
  }

  /**
   * @notice Checks whether an address has claimed a dividend
   * @param _investor Investor address being checked
   * @param _dividendIndex Dividend to withdraw from
   * @return bool whether the address has claimed
   */
  function isClaimed(address _investor, uint256 _dividendIndex) external view returns (bool) {
    require(_dividendIndex < dividends.length, "Invalid dividend");
    return dividends[_dividendIndex].claimed[_investor];
  }

  /**
   * @notice Creates a dividend with a provided checkpoint
    * @param _partition
   * @param _maturity Time from which dividend can be paid
   * @param _expiry Time until dividend can no longer be paid, and can be reclaimed by issuer
   * @param _token Address of ERC20 token in which dividend is to be denominated
   * @param _amount Amount of specified token for dividend
   * @param _checkpointId Checkpoint id from which to create dividends
   * @param _excluded List of addresses to exclude
   */
  function createDividendWithCheckpointAndExclusions(
    bytes32 _partition,
    uint256 _maturity,
    uint256 _expiry,
    address _token,
    uint256 _amount,
    uint256 _checkpointId,
    address[] memory _excluded
  )
  public
  withControllerPermission
  {
    _createDividendWithCheckpointAndExclusions(_partition, _maturity, _expiry, _token, _amount, _checkpointId, _excluded);
  }

  /**
   * @notice Creates a dividend with a provided checkpoint
   * @param _partition
   * @param _maturity Time from which dividend can be paid
   * @param _expiry Time until dividend can no longer be paid, and can be reclaimed by issuer
   * @param _token Address of ERC20 token in which dividend is to be denominated
   * @param _amount Amount of specified token for dividend
   * @param _checkpointId Checkpoint id from which to create dividends
   * @param _excluded List of addresses to exclude
   */
  function _createDividendWithCheckpointAndExclusions(
    bytes32 _partition,
    uint256 _maturity,
    uint256 _expiry,
    address _token,
    uint256 _amount,
    uint256 _checkpointId,
    address[] memory _excluded
  )
  internal
  {
    require(_excluded.length <= EXCLUDED_ADDRESS_LIMIT, "Too many addresses excluded");
    if(_excluded.length == 0){
      _excluded = excluded;
    }
    require(_expiry > _maturity, "Expiry before maturity");
    /*solium-disable-next-line security/no-block-members*/
    require(_expiry > now, "Expiry in past");
    require(_amount > 0, "No dividend sent");
    //require(_token != address(0), "Invalid token");
    require(_checkpointId <= ICheckpointsModule(getCheckpointsModule()).getCurrentCheckpointId(), "Invalid checkpoint");
    if(_token == securityToken){
    IERC1400(_token).operatorTransferByPartition(_partition, msg.sender, address(this), _amount, "", "");
    }  else if (_token != address(0)) {
      require(IERC20(_token).transferFrom(msg.sender, address(this), _amount), "insufficent allowance");
    }
    require(_partition != bytes32(0));
    uint256 dividendIndex = dividends.length;
    uint256 currentSupply = ICheckpointsModule(getCheckpointsModule()).getPartitionedTotalSupplyAt(_partition, _checkpointId);

    require(currentSupply > 0, "Invalid supply");
    // Can add fee for creating dividends in this spot if wanted
    uint256 excludedSupply = 0;
    dividends.push(
      Dividend(
        _checkpointId,
        now, /*solium-disable-line security/no-block-members*/
        _maturity,
        _expiry,
        _amount,
        0,
        0,
        false,
        0,
        0,
        _partition
      )
    );

    for (uint256 j = 0; j < _excluded.length; j++) {
      require(_excluded[j] != address(0), "Invalid address");
      require(!dividends[dividendIndex].dividendExcluded[_excluded[j]], "duped exclude address");
      excludedSupply = excludedSupply.add(ICheckpointsModule(getCheckpointsModule()).getValueAt(_partition, _excluded[j], _checkpointId));
      dividends[dividendIndex].dividendExcluded[_excluded[j]] = true;
    }
    require(currentSupply > excludedSupply, "Invalid supply");
    uint256 supplyForDividend = currentSupply - excludedSupply;
    dividends[dividendIndex].totalSupply = supplyForDividend;
    dividendTokens[dividendIndex] = _token;
    _emitERC20DividendDepositedEvent(_checkpointId, _maturity, _expiry, _token, _amount, supplyForDividend, dividendIndex);
  }

  /**
   * @notice Emits the ERC20DividendDeposited event.
   * Seperated into a different function as a workaround for stack too deep error
   */
  function _emitERC20DividendDepositedEvent(
    uint256 _checkpointId,
    uint256 _maturity,
    uint256 _expiry,
    address _token,
    uint256 _amount,
    uint256 currentSupply,
    uint256 dividendIndex
  )
  internal
  {
    /*solium-disable-next-line security/no-block-members*/
    emit ERC20DividendDeposited(
      msg.sender,
      _checkpointId,
      _maturity,
      _expiry,
      _token,
      _amount,
      currentSupply,
      dividendIndex
    );
  }

  /**
   * @notice Internal function for paying dividends
   * @param _payee Address of investor
   * @param _dividend Storage with previously issued dividends
   * @param _dividendIndex Dividend to pay
   */
  function _payDividend(address payable _payee, Dividend storage _dividend, uint256 _dividendIndex) internal {
    (uint256 claim, uint256 withheld) = calculateDividend(_dividendIndex, _payee);
    _dividend.claimed[_payee] = true;
    _dividend.claimedAmount = claim.add(_dividend.claimedAmount);
    uint256 claimAfterWithheld = claim.sub(withheld);
    if (claimAfterWithheld > 0) {
      // This contract is the owner of some tokens
      if(dividendTokens[_dividendIndex] == securityToken){
        IERC1400(dividendTokens[_dividendIndex]).operatorTransferByPartition(_dividend.partition, address(this), _payee, claimAfterWithheld, "", "");
      }  else if (dividendTokens[_dividendIndex] != address(0)) {
        require(IERC20(dividendTokens[_dividendIndex]).transfer(_payee, claimAfterWithheld), "transfer failed");
      }
       }
    if (withheld > 0) {
      _dividend.totalWithheld = _dividend.totalWithheld.add(withheld);
      _dividend.withheld[_payee] = withheld;
    }
    emit ERC20DividendClaimed(_payee, _dividendIndex, dividendTokens[_dividendIndex], claim, withheld);
  }

  /**
   * @notice Issuer can reclaim remaining unclaimed dividend amounts, for expired dividends
   * @param _dividendIndex Dividend to reclaim
   */
  function reclaimDividend(uint256 _dividendIndex) external withControllerPermission {
    require(_dividendIndex < dividends.length, "Invalid dividend");
    /*solium-disable-next-line security/no-block-members*/
    require(now >= dividends[_dividendIndex].expiry, "Dividend expiry in future");
    require(!dividends[_dividendIndex].reclaimed, "already claimed");
    dividends[_dividendIndex].reclaimed = true;
    Dividend storage dividend = dividends[_dividendIndex];
    uint256 remainingAmount = dividend.amount.sub(dividend.claimedAmount);
    if(dividendTokens[_dividendIndex] == securityToken){
      IERC1400(dividendTokens[_dividendIndex]).operatorTransferByPartition(dividend.partition, address(this), getTreasuryWallet(), remainingAmount, "", "");
    }  else if (dividendTokens[_dividendIndex] != address(0)) {
      require(IERC20(dividendTokens[_dividendIndex]).transfer(getTreasuryWallet(), remainingAmount), "transfer failed");
    }

    emit ERC20DividendReclaimed(wallet, _dividendIndex, dividendTokens[_dividendIndex], remainingAmount);
  }

  /**
   * @notice Allows issuer to withdraw withheld tax
   * @param _dividendIndex Dividend to withdraw from
   */
  function withdrawWithholding(uint256 _dividendIndex) external withControllerPermission {
    require(_dividendIndex < dividends.length, "Invalid dividend");
    Dividend storage dividend = dividends[_dividendIndex];
    uint256 remainingWithheld = dividend.totalWithheld.sub(dividend.totalWithheldWithdrawn);
    dividend.totalWithheldWithdrawn = dividend.totalWithheld;
    if(dividendTokens[_dividendIndex] == securityToken){
    IERC1400(dividendTokens[_dividendIndex]).operatorTransferByPartition(dividend.partition, address(this), getTreasuryWallet(), remainingWithheld, "", "");
    }  else if (dividendTokens[_dividendIndex] != address(0)) {
      require(IERC20(dividendTokens[_dividendIndex]).transfer(getTreasuryWallet(), remainingWithheld), "transfer failed");
    }
      emit ERC20DividendWithholdingWithdrawn(wallet, _dividendIndex, dividendTokens[_dividendIndex], remainingWithheld);
  }
}
