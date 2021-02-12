const ERC20Holdable = artifacts.require('./ERC20HoldableToken.sol');

module.exports = async function (deployer, network, accounts) {
  if (network == "test") return; // test maintains own contracts
  
  await deployer.deploy(ERC20Holdable, 'CAD', 'CAD', 2);
  console.log('\n   > ERC20Holdable token deployment: Success -->', ERC20Holdable.address);
};
