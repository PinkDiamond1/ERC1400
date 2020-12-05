const { soliditySha3, fromAscii, hexToUtf8  } = require('web3-utils');
const { expectRevert } = require("@openzeppelin/test-helpers");

const ModulesDeployer = artifacts.require('ModulesDeployer');
const STERegistryV1 = artifacts.require('STERegistryV1');
const ERC1820Registry = artifacts.require('ERC1820Registry');
const ERC1400TokensValidator = artifacts.require('ERC1400TokensValidatorSTE');
const ERC1400TokensChecker = artifacts.require('ERC1400TokensChecker');
const MultipleIssuanceModule = artifacts.require('MultipleIssuanceModule');

const TokensValidatorFactory = artifacts.require('TokensValidatorFactory');
const TokensCheckerFactory = artifacts.require('TokensCheckerFactory');
const MultipleIssuanceModuleFactory = artifacts.require('MultipleIssuanceModuleFactory');
const ERC1400_INTERFACE_NAME = 'ERC1400Token';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const VALID_CERTIFICATE = '0x1000000000000000000000000000000000000000000000000000000000000000';

const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';

const partition1 = '0x5265736572766564000000000000000000000000000000000000000000000000'; // Reserved in hex
const partition2 = '0x4973737565640000000000000000000000000000000000000000000000000000'; // Issued in hex
const partition3 = '0x4c6f636b65640000000000000000000000000000000000000000000000000000'; // Locked in hex

const defaultExemption = '0x1234500000000000000000000000000000000000000000000000000000000000';
const exemption2 = '0x1234560000000000000000000000000000000000000000000000000000000000';
const exemption3 = '0x1234567000000000000000000000000000000000000000000000000000000000';

const ERC1400_TOKENS_VALIDATOR = '0x45524331343030546f6b656e7356616c696461746f7200000000000000000000';
const ERC1400_TOKENS_CHECKER = '0x45524331343030546f6b656e73436865636b6572000000000000000000000000';
const ERC1400_MULTIPLE_ISSUANCE = '0x455243313430304d756c7469706c6549737375616e6365000000000000000000';

const ZERO_BYTE = '0x';
const partitions = [partition1, partition2, partition3];

const issuanceAmount = 100000;
const approvedAmount = 50000;

const MAX_NUMBER_OF_ISSUANCES_IN_A_BATCH = 20;
const protocolNames = [ERC1400_MULTIPLE_ISSUANCE, ERC1400_TOKENS_VALIDATOR, ERC1400_TOKENS_CHECKER];


contract('ModulesDeployer', function ([owner, operator, controller, controller_alternative1, tokenHolder, recipient, randomTokenHolder, randomTokenHolder2, unknown, blacklisted]) {
  before(async function () {
    this.registry = await ERC1820Registry.at('0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24');
  });

  describe('deployment', function () {
    beforeEach(async function () {
      this.mimContractFactory = await MultipleIssuanceModuleFactory.new({ from: owner });
      this.validatorContractFactory = await TokensValidatorFactory.new({ from: owner });
      this.checkerContractFactory = await TokensCheckerFactory.new({ from: owner });

      const factories = [this.mimContractFactory.address, this.validatorContractFactory.address, this.checkerContractFactory.address];

      this.modulesDeployer = await ModulesDeployer.new(protocolNames, factories, 0, 0, 1, {from:owner});

       // this.multiIssuanceModule = await MultipleIssuanceModule.new(this.newcontractAddress, {from: owner});
    });

      describe('modules deployer', function () {
          it('can deploy the modules', async function () {
              // Can deploy the multiple issuance module and the checker together
              await this.modulesDeployer.deployMultipleModulesFromFactories([protocolNames[0], protocolNames[2]], 0, 0, 1, {from:owner});
              // Deploy the validator on its own
              await this.modulesDeployer.deployMultipleModulesFromFactories([protocolNames[1]], 0, 0, 1, {from:owner});
          });
      });
      
      describe('multiple issuance module', function () {
          it('cannot be initialized again', async function () {
              const factories = [this.mimContractFactory.address, this.validatorContractFactory.address, this.checkerContractFactory.address];
              await expectRevert.unspecified(this.modulesDeployer.initialize(protocolNames, factories, 0, 0, 1));
          });
      });

      describe('modules deployer', function () {
          it('can get current factory address and change module protocols', async function () {
              const currrentMimFactory = await this.modulesDeployer.getCurrentExtensionFactoryAddress(ERC1400_MULTIPLE_ISSUANCE);
              assert.equal(currrentMimFactory, this.mimContractFactory.address);

              const randomAddress = '0x5555555555555555555555555555555555555555';
              await this.modulesDeployer.setModuleProtocolFactories(protocolNames,
                  [randomAddress, this.validatorContractFactory.address, this.checkerContractFactory.address], 0, 0, 2);

              await this.modulesDeployer.setLatestVersion(0, 0, 2);
              const newMimFactory = await this.modulesDeployer.getCurrentExtensionFactoryAddress(ERC1400_MULTIPLE_ISSUANCE);
              assert.equal(newMimFactory, randomAddress);

              const latestVersion = await this.modulesDeployer.getLatestVersion();
              assert.equal(latestVersion, 2);

              await this.modulesDeployer.setLatestVersion(0, 0, 1);

              const latestVersionNew = await this.modulesDeployer.getLatestVersion();
              assert.equal(latestVersionNew, 1);

              const currentVersionMimFactory = await this.modulesDeployer.getCurrentExtensionFactoryAddress(ERC1400_MULTIPLE_ISSUANCE);
              assert.equal(currentVersionMimFactory, this.mimContractFactory.address);

              const newFactoryForVersion = await this.modulesDeployer.getFactoryForProtocolAndVersion(ERC1400_MULTIPLE_ISSUANCE, 0, 0, 2);
              assert.equal(newFactoryForVersion, randomAddress);

              await this.modulesDeployer.removeProtocolFactory(ERC1400_MULTIPLE_ISSUANCE, 0, 0, 2);

              const factoryRemoved = await this.modulesDeployer.getFactoryForProtocolAndVersion(ERC1400_MULTIPLE_ISSUANCE, 0, 0, 2);
              assert.equal(factoryRemoved, '0x0000000000000000000000000000000000000000');
          });
      });
  });
});
