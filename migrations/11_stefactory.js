
const STEFactory = artifacts.require('./STEFactory.sol');
const Extension = artifacts.require('./ERC1400TokensValidator.sol');
const ERC1400 = artifacts.require('./ERC1400.sol');

const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';
const controller = '0xb5747835141b46f7C472393B31F8F5A57F74A44f';

const partition1 = '0x7265736572766564000000000000000000000000000000000000000000000000'; // reserved in hex
const partition2 = '0x6973737565640000000000000000000000000000000000000000000000000000'; // issued in hex
const partition3 = '0x6c6f636b65640000000000000000000000000000000000000000000000000000'; // locked in hex
const partitions = [partition1, partition2, partition3];

module.exports = async function (deployer, network, accounts) {

  // await deployer.deploy(STEFactory, 'v1');
  // const factoryInstance = await STEFactory.deployed();
  // console.log('\n   > ERC1400 factory deployment: Success -->', STEFactory.address);

};
