const ERC1400 = artifacts.require('./ERC1400.sol');
const TokensValidatorFactory = artifacts.require('./TokensValidatorFactory.sol');

module.exports = async function (deployer, network, accounts) {
  if (network == "test") return; // test maintains own contracts
  const tokenInstance = await ERC1400.deployed();
  console.log('\n   > Add token extension for token deployed at address', tokenInstance.address);

  await deployer.deploy(TokensValidatorFactory);
  const factoryInstance = await TokensValidatorFactory.deployed();
  console.log('\n   > Validator Factory deployment: Success -->', TokensValidatorFactory.address);

  await factoryInstance.deployModule(accounts[0]);

};
