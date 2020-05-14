const ERC1400 = artifacts.require('./ERC1400.sol');
const TokensCheckerFactory = artifacts.require('./TokensCheckerFactory.sol');

module.exports = async function (deployer, network, accounts) {

  const tokenInstance = await ERC1400.deployed();
  console.log('\n   > Add token extension for token deployed at address', tokenInstance.address);

  await deployer.deploy(TokensCheckerFactory);
  const factoryInstance = await TokensCheckerFactory.deployed();
  console.log('\n   > Validator Factory deployment: Success -->', TokensCheckerFactory.address);

  await factoryInstance.deployModule(accounts[0]);
}