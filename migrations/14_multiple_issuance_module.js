const MultipleIssuanceModule = artifacts.require('./MultipleIssuanceModule.sol');
const ERC1400 = artifacts.require('./ERC1400.sol');

module.exports = async function (deployer, network, accounts) {

  const tokenInstance = await ERC1400.deployed();
  console.log('\n   > Add token extension for token deployed at address', tokenInstance.address);

  await deployer.deploy(MultipleIssuanceModule, tokenInstance.address);
  console.log('\n   > Multiple Issuance deployment: Success -->', MultipleIssuanceModule.address);

};
