pragma solidity 0.5.10;

import "../../../extensions/userExtensions/IERC1400TokensRecipient.sol";
import "../../../interface/ERC1820Implementer.sol";
import "../../../IFetchSupply.sol";
import "../../IConfigurableModule.sol";
import "../../Module.sol";
import "../ICheckpointsModule.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract DividendsModule is ERC1820Implementer, Module, IConfigurableModule {

  string constant internal DIVIDENDS_MODULE = "ERC1400TokensDividends";

  event DividendCreated(uint256 indexed _checkpointId);
  event DividendDistributed(uint256 indexed _checkpointId);

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

  // Create dividend

  // Cancel dividend

  // Push dividend

  // Claim dividend
}
