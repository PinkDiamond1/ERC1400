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

contract VotingModule is ERC1820Client, ERC1820Implementer, Module, IConfigurableModule {
  using SafeMath for uint256;
  uint256 internal constant e18 = uint256(10) ** uint256(18);
  string constant internal VOTING_MODULE = "ERC1400TokensVoting";
  string constant internal ERC1400_TOKENS_VALIDATOR = "ERC1400TokensValidator";
  string constant internal ERC1400_TOKENS_CHECKPOINTS = "ERC1400TokensCheckpoints";

  constructor(address factory) public
    Module(factory)
  {
    ERC1820Implementer._setInterface(VOTING_MODULE);
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
}
