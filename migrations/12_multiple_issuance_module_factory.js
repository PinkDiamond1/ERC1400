const MultipleIssuanceModuleFactory = artifacts.require('./MultipleIssuanceModuleFactory.sol');
const MultipleIssuanceModule = artifacts.require('./MultipleIssuanceModule.sol');
const ERC1400 = artifacts.require('./ERC1400.sol');

module.exports = async function (deployer, network, accounts) {
  if (network == "test") return; // test maintains own contracts
  const tokenInstance = await ERC1400.deployed();
  console.log('\n   > Add token extension for token deployed at address', tokenInstance.address);

  await deployer.deploy(MultipleIssuanceModuleFactory);
  const factoryInstance = await MultipleIssuanceModuleFactory.deployed();
  console.log('\n   > Multiple Issuance Factory deployment: Success -->', MultipleIssuanceModuleFactory.address);

  const moduleDeployed = await factoryInstance.deployModule(accounts[0]);
  const module = await MultipleIssuanceModule.at(moduleDeployed.logs[0].args._newContract);

  await module.configure(tokenInstance.address);
};
