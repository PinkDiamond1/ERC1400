const ModulesDeployer = artifacts.require('./ModulesDeployer.sol');

const Extension = artifacts.require('./ERC1400TokensValidatorSTE.sol');
const TokensChecker = artifacts.require('./ERC1400TokensChecker.sol');
const MultipleIssuanceModule = artifacts.require('./MultipleIssuanceModule.sol');
const ERC1400 = artifacts.require('./ERC1400.sol');
const MultipleIssuanceModuleFactory = artifacts.require('./MultipleIssuanceModuleFactory.sol');
const TokensValidatorFactory = artifacts.require('./TokensValidatorFactory.sol');
const TokensCheckerFactory = artifacts.require('./TokensCheckerFactory.sol');

// const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';
// const controller = '0xb5747835141b46f7C472393B31F8F5A57F74A44f';
//
// const partition1 = '0x5265736572766564000000000000000000000000000000000000000000000000'; // Reserved in hex
// const partition2 = '0x4973737565640000000000000000000000000000000000000000000000000000'; // Issued in hex
// const partition3 = '0x4c6f636b65640000000000000000000000000000000000000000000000000000'; // Locked in hex
// const partitions = [partition1, partition2, partition3];
const ERC1400_TOKENS_VALIDATOR = '0x45524331343030546f6b656e7356616c696461746f7200000000000000000000'; // 'ERC1400TokensValidator';
const ERC1400_TOKENS_CHECKER = '0x45524331343030546f6b656e73436865636b6572000000000000000000000000'; // 'ERC1400TokensChecker';
const ERC1400_MULTIPLE_ISSUANCE = '0x455243313430304d756c7469706c6549737375616e6365000000000000000000'; // 'ERC1400MultipleIssuance';


module.exports = async function (deployer, network, accounts) {
  if (network == "test") return; // test maintains own contracts
  // Set up the STE Factory
  //bytes32[] memory _protocolNames, address[] memory _factoryAddresses, uint8 _major, uint8 _minor, uint8 _patch
  const mimFactory = await MultipleIssuanceModuleFactory.deployed();
  const validatorFactory = await TokensValidatorFactory.deployed();
  const checkerFactory = await TokensCheckerFactory.deployed();
  const factories = [mimFactory.address, validatorFactory.address, checkerFactory.address];

  const protocolNames = [ERC1400_MULTIPLE_ISSUANCE, ERC1400_TOKENS_VALIDATOR, ERC1400_TOKENS_CHECKER];

  //  Set up the STE Registry
  await deployer.deploy(ModulesDeployer, protocolNames, factories, 0, 0, 1); // Address is already existing ST Factory, or you can deploy new one above
  const modulesDeployerInstance = await ModulesDeployer.deployed();
  console.log('\n   > Modules Deployer deployment: Success -->', modulesDeployerInstance.address);
};
