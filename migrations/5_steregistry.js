const STERegistryV1 = artifacts.require('./STERegistryV1.sol');
const STEFactory = artifacts.require('./STEFactory.sol');
const Extension = artifacts.require('./ERC1400TokensValidator.sol');
const ERC1400 = artifacts.require('./ERC1400.sol');

const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';
const controller = '0xb5747835141b46f7C472393B31F8F5A57F74A44f';

const partition1 = '0x5265736572766564000000000000000000000000000000000000000000000000'; // Reserved in hex
const partition2 = '0x4973737565640000000000000000000000000000000000000000000000000000'; // Issued in hex
const partition3 = '0x4c6f636b65640000000000000000000000000000000000000000000000000000'; // Locked in hex
const partitions = [partition1, partition2, partition3];

module.exports = async function (deployer, network, accounts) {


  // await deployer.deploy(ERC1400, 'ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, true, partitions);
  
  // console.log('\n   > Token extension deployment: Success -->', ERC1400.address);

  // Set up the STE Factory
  /*
  await deployer.deploy(STEFactory, 'v1');
  const factoryInstance = await STEFactory.deployed();
  console.log('\n   > ERC1400 factory deployment: Success -->', STEFactory.address);
  */

  // Set up the STE Registry
  await deployer.deploy(STERegistryV1, '0x1DD521f0Af3b33729CaC8298fe1802950fa47ee0', 0, 0, 1); // Address is already existing ST Factory, or you can deploy new one above
  const registryInstance = await STERegistryV1.deployed();
  console.log('\n   > STE Registry deployment: Success -->', STERegistryV1.address);

  // Set up the simple token extension
  /*
  await deployer.deploy(Extension, true, false);
  console.log('\n   > Token extension deployment: Success -->', Extension.address);
  */

  // const newToken2 = await factoryInstance.deployToken('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, true, partitions, controller);
  // console.log('\n   > Token deployed: Transaction Success, did not revert');
};
