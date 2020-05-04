const ERC1400 = artifacts.require('./ERC1400.sol');
const Extension = artifacts.require('./ERC1400TokensValidatorSTE.sol');

module.exports = async function (deployer, network, accounts) {

  const tokenInstance = await ERC1400.deployed();
  console.log('\n   > Add token extension for token deployed at address', tokenInstance.address);

  await deployer.deploy(Extension, true, false);
  console.log('\n   > Token extension deployment: Success -->', Extension.address);

};
