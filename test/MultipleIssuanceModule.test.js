const { soliditySha3, fromAscii, hexToUtf8  } = require('web3-utils');
const { shouldFail } = require('openzeppelin-test-helpers');

const ERC1400CertificateMock = artifacts.require('ERC1400CertificateMock');
const STEFactory = artifacts.require('STEFactory');
const STERegistryV1 = artifacts.require('STERegistryV1');
const ERC1820Registry = artifacts.require('ERC1820Registry');
const ERC1400TokensValidator = artifacts.require('ERC1400TokensValidatorSTE');
const ERC1400TokensChecker = artifacts.require('ERC1400TokensChecker');
const MultipleIssuanceModule = artifacts.require('MultipleIssuanceModule');

const ERC1400_TOKENS_VALIDATOR = 'ERC1400TokensValidator';
const ERC1400_TOKENS_CHECKER = 'ERC1400TokensChecker';
const ERC1400_MULTIPLE_ISSUANCE = 'ERC1400MultipleIssuance';
const ERC1400_INTERFACE_NAME = 'ERC1400Token';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const VALID_CERTIFICATE = '0x1000000000000000000000000000000000000000000000000000000000000000';

const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';

const partition1 = '0x5265736572766564000000000000000000000000000000000000000000000000'; // Reserved in hex
const partition2 = '0x4973737565640000000000000000000000000000000000000000000000000000'; // Issued in hex
const partition3 = '0x4c6f636b65640000000000000000000000000000000000000000000000000000'; // Locked in hex
const ZERO_BYTE = '0x';
const partitions = [partition1, partition2, partition3];

const issuanceAmount = 100000;
const approvedAmount = 50000;

const MAX_NUMBER_OF_ISSUANCES_IN_A_BATCH = 150;


contract('STERegistryV1', function ([owner, operator, controller, controller_alternative1, tokenHolder, recipient, randomTokenHolder, randomTokenHolder2, unknown, blacklisted]) {
  before(async function () {
    this.registry = await ERC1820Registry.at('0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24');
  });

  describe('deployment', function () {
    beforeEach(async function () {
      this.tokenFactory = await STEFactory.new();
      this.steRegistryV1 = await STERegistryV1.new(this.tokenFactory.address, 0, 0, 1);
      this.validatorContract = await ERC1400TokensValidator.new(true, false, { from: owner });
      this.checkerContract = await ERC1400TokensChecker.new( { from: owner });

        const thisTokenTicker = 'DAU';
        const thisTokenName = 'ERC1400Token';

        this.newSecurityToken = await this.steRegistryV1
            .generateNewSecurityToken(thisTokenName, thisTokenTicker, 1, [controller], controller, true, partitions, owner, 0);
        let log = this.newSecurityToken.logs[2];
        this.newcontractAddress = log.args._securityTokenAddress;

        // ***Multiple Issuance Module Created
        this.multiIssuanceModule = await MultipleIssuanceModule.new(this.newcontractAddress, {from: owner});
        this.token = await ERC1400CertificateMock.at(this.newcontractAddress);

        // ControllersByPartition interesting method
        // console.log(await this.token.controllersByPartition(partition1));
        await this.token.setControllers([this.multiIssuanceModule.address, controller], {from: owner});
        await this.token.setPartitionControllers(partition1, [this.multiIssuanceModule.address, controller], {from: owner});
        // Important for a controller minter
        await this.token.addMinter(controller);
        await this.token.addMinter(this.multiIssuanceModule.address);
        await this.token.setHookContract(this.validatorContract.address, ERC1400_TOKENS_VALIDATOR, { from: owner });
        await this.token.setHookContract(this.checkerContract.address, ERC1400_TOKENS_CHECKER, { from: owner });
        await this.token.setHookContract(this.multiIssuanceModule.address, ERC1400_MULTIPLE_ISSUANCE, { from: owner });

        // Setup KYC Roles
        const whitelistBytes = 0b1;
        const blacklistBytes = 0b1 << 1;
        const friendsFamilyBytes = 0b1 << 2;
        const accreditedBytes = 0b1 << 3;
        const eligibleBytes = 0b1 << 4;
        const dealerAdvised = 0b1 << 5;

        const currentTime = Math.floor(Date.now() / 1000);
        const futureTime = Math.round(new Date(2040,0).getTime()/1000);

        // Using bitwise OR to send what roles I want to the contract
        await this.validatorContract.addRolesMulti(
            [tokenHolder, recipient, randomTokenHolder, randomTokenHolder2, controller, blacklisted],
            [whitelistBytes | eligibleBytes,
                whitelistBytes | friendsFamilyBytes,
                whitelistBytes | accreditedBytes,
                whitelistBytes | dealerAdvised,
                whitelistBytes,
                blacklistBytes | friendsFamilyBytes],
            Array(6).fill(currentTime),
            Array(6).fill(currentTime),
            Array(6).fill(futureTime),
            {from: owner});
    });

    describe('multiple issuance module', function () {
      it('runs a valid integration test scenario for multiple issuance', async function () {
          this.issuancePartitions = [];
          this.tokenHolders = [];
          this.values = [];
          for(let index=0; index < MAX_NUMBER_OF_ISSUANCES_IN_A_BATCH; index++) {

              this.issuancePartitions.push(partition1);
              this.tokenHolders.push(tokenHolder);
              this.values.push(index);
          }
          // Issue multiple owner for max amount of times
          await this.multiIssuanceModule.issueByPartitionMultiple(this.issuancePartitions, this.tokenHolders, this.values, VALID_CERTIFICATE, {from: owner});

         // Issue multiple controller
         await this.multiIssuanceModule.issueByPartitionMultiple([partition1, partition1], [recipient, tokenHolder], [issuanceAmount, issuanceAmount], VALID_CERTIFICATE, {from: controller});
          // Issue multiple from random does not work
          await shouldFail.reverting(this.multiIssuanceModule.issueByPartitionMultiple([partition1, partition1], [recipient, tokenHolder], [issuanceAmount, issuanceAmount], VALID_CERTIFICATE, {from: unknown}))

          // Force transfer multiple owner
          await this.multiIssuanceModule.operatorTransferByPartitionMultiple(
              [partition1, partition1],
              [recipient, tokenHolder],
              [randomTokenHolder, randomTokenHolder],
              [1, 1],
              ZERO_BYTE,
              VALID_CERTIFICATE,
              {from: owner});

          // Force transfer multiple controller
          await this.multiIssuanceModule.operatorTransferByPartitionMultiple(
              [partition1, partition1],
              [recipient, tokenHolder],
              [randomTokenHolder, randomTokenHolder],
              [1, 1],
              ZERO_BYTE,
              VALID_CERTIFICATE,
              {from: controller});

          // Force transfer multiple from unknown does not work
          await shouldFail.reverting(this.multiIssuanceModule.operatorTransferByPartitionMultiple(
              [partition1, partition1],
              [recipient, tokenHolder],
              [randomTokenHolder, randomTokenHolder],
              [issuanceAmount, issuanceAmount],
              ZERO_BYTE,
              VALID_CERTIFICATE,
              {from: unknown}));
      });
    });
  });
});
