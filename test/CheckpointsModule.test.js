const { soliditySha3, fromAscii, hexToUtf8  } = require('web3-utils');
const { shouldFail } = require('openzeppelin-test-helpers');

const ERC1400 = artifacts.require('ERC1400');
const STEFactory = artifacts.require('STEFactory');
const STERegistryV1 = artifacts.require('STERegistryV1');
const ERC1820Registry = artifacts.require('ERC1820Registry');
const ERC1400TokensValidator = artifacts.require('ERC1400TokensValidatorSTE');
const CheckpointsModule = artifacts.require('CheckpointsModule');
const ERC1400TokensChecker = artifacts.require('ERC1400TokensCheckerSTE');
const MultipleIssuanceModule = artifacts.require('MultipleIssuanceModule');

const ModulesDeployer = artifacts.require('ModulesDeployer');
const TokensValidatorFactory = artifacts.require('TokensValidatorFactory');
const TokensCheckerFactory = artifacts.require('TokensCheckerFactory');
const MultipleIssuanceModuleFactory = artifacts.require('MultipleIssuanceModuleFactory');
const CheckpointsModuleFactory = artifacts.require('CheckpointsModuleFactory');

const ERC20_INTERFACE_NAME = 'ERC20Token';
const ERC1400_TOKENS_VALIDATOR_STRING = 'ERC1400TokensValidator';
const ERC1400_TOKENS_CHECKER_STRING = 'ERC1400TokensChecker';
const ERC1400_TOKENS_CHECKPOINTS_STRING = 'ERC1400TokensCheckpoints';
const ERC1400_MULTIPLE_ISSUANCE_STRING = 'ERC1400MultipleIssuance';
const ERC1400_INTERFACE_NAME_STRING = 'ERC1400Token';

const ERC1400_TOKENS_VALIDATOR = '0x45524331343030546f6b656e7356616c696461746f7200000000000000000000';
const ERC1400_TOKENS_CHECKER = '0x45524331343030546f6b656e73436865636b6572000000000000000000000000';
const ERC1400_MULTIPLE_ISSUANCE = '0x455243313430304d756c7469706c6549737375616e6365000000000000000000';
const ERC1400_TOKENS_CHECKPOINTS = '0x45524331343030546f6b656e73436865636b706f696e7473a000000000000000';

const protocolNames =
    [ERC1400_MULTIPLE_ISSUANCE,
        ERC1400_TOKENS_VALIDATOR,
        ERC1400_TOKENS_CHECKER,
        ERC1400_TOKENS_CHECKPOINTS
    ];

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

 const VALID_CERTIFICATE = '0x1000000000000000000000000000000000000000000000000000000000000000';

 const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';

const partition1 = '0x5265736572766564000000000000000000000000000000000000000000000000'; // Reserved in hex
const partition2 = '0x4973737565640000000000000000000000000000000000000000000000000000'; // Issued in hex
const partition3 = '0x4c6f636b65640000000000000000000000000000000000000000000000000000'; // Locked in hex

const defaultExemption = '0x1234500000000000000000000000000000000000000000000000000000000000';

const ZERO_BYTE = '0x';
const partitions = [partition1, partition2, partition3];

const issuanceAmount = 100000;
const approvedAmount = 50000;

const MAX_NUMBER_OF_ISSUANCES_IN_A_BATCH = 20;

contract('CheckpointsModule', function ([owner, operator, controller, controller_alternative1, tokenHolder, recipient, randomTokenHolder, randomTokenHolder2, unknown, blacklisted]) {
  before(async function () {
    this.registry = await ERC1820Registry.at('0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24');
  });

  describe('deployment', function () {
    before(async function () {
      this.tokenFactory = await STEFactory.new();

      this.mimContractFactory = await MultipleIssuanceModuleFactory.new({ from: owner });
      this.checkpointsContractFactory = await CheckpointsModuleFactory.new({ from: owner });
      this.validatorContractFactory = await TokensValidatorFactory.new({ from: owner });
      this.checkerContractFactory = await TokensCheckerFactory.new({ from: owner });

      const factories = [this.mimContractFactory.address,
          this.validatorContractFactory.address, this.checkerContractFactory.address, this.checkpointsContractFactory.address];

      this.modulesDeployer = await ModulesDeployer.new(protocolNames, factories, 0, 0, 1, {from:owner});

      this.steRegistryV1 = await STERegistryV1.new(this.tokenFactory.address, this.modulesDeployer.address, 0, 0, 1, {from: owner});
      const thisTokenTicker = 'DAU';
      const thisTokenName = 'ERC1400Token';

        const moduleDeploymentFromRegistry = await this.steRegistryV1.deployModules
        (0,
            [protocolNames[0],
                protocolNames[1],
                protocolNames[2]]);

        this.deployedModules = moduleDeploymentFromRegistry.logs[1].args._modules;
        this.multiIssuanceModule = await MultipleIssuanceModule.at(this.deployedModules[0]);
        this.validatorContract = await ERC1400TokensValidator.at(this.deployedModules[1]);
        this.checkerContract = await ERC1400TokensChecker.at(this.deployedModules[2]);

        // Deploy checkpoint related module
        const moduleDeploymentFromRegistry2 = await this.steRegistryV1.deployModules
        (0,
            [protocolNames[3]]);

        this.deployedModules.push(moduleDeploymentFromRegistry2.logs[0].args._modules[0]);
        this.checkpointModule = await CheckpointsModule.at(this.deployedModules[3]);


        this.newSecurityToken = await this.steRegistryV1
            .generateNewSecurityToken(
                thisTokenName,
                thisTokenTicker,
                1,
                [controller],
                //controller,
                //true,
                partitions,
                owner,
                0,
                this.deployedModules);

        let log = this.newSecurityToken.logs[3];
        this.newcontractAddress = log.args._securityTokenAddress;
        assert.isTrue(this.newcontractAddress.length >= 40);

        // Get Security Token address from ticker
        const tickerSTAddress = await this.steRegistryV1.getSecurityTokenAddress(thisTokenTicker);
        assert.equal(tickerSTAddress, this.newcontractAddress);

        //// Make sure the token works
        this.token = await ERC1400.at(this.newcontractAddress);

        const isTickerCurrentlyRegisteredNow = await this.steRegistryV1.tickerAvailable(thisTokenTicker);
        assert.isFalse(isTickerCurrentlyRegisteredNow);

        // Setup whitelisting rules for the scenario
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

    describe('zero balances', function () {
      it('checks the first checkpoint and receives 0 balances, there have been no transfers', async function () {
          const tokenholderPartitionedValueAt0 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 0);
          assert.equal(tokenholderPartitionedValueAt0, 0);
          const tokenholderPartitionedValueAt1 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 1);
          assert.equal(tokenholderPartitionedValueAt1, 0);
      });
    });

    describe('checkpointtests', function () {
      beforeEach(async function () {
        // Any extra setup we might find useful
       });

     describe('issue and create checkpoints', function () {
      it('can issue tokens and get through to the first checkpoint', async function () {
          // There are three things that affect a checkpoint
          // Creating checkpoints, making a transfer, and time

          // Try primary issuance
          await this.multiIssuanceModule.issueByPartitionMultiple(
              [defaultExemption, defaultExemption, defaultExemption, defaultExemption, defaultExemption],
              [partition1, partition2, partition1, partition1, partition2],
              [recipient, recipient, tokenHolder, randomTokenHolder, randomTokenHolder2],
              [issuanceAmount * 2, issuanceAmount * 2, issuanceAmount, issuanceAmount, issuanceAmount * 2],
              VALID_CERTIFICATE,
              {from: controller});

          const tokenholderPartitionedValueAt0 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 0);
          assert.equal(tokenholderPartitionedValueAt0, 0);
          const tokenholderPartitionedValueAt1 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 1);
          assert.equal(tokenholderPartitionedValueAt1, issuanceAmount);

          const randomTokenholderPartitionedValueAt0 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 0);
          assert.equal(randomTokenholderPartitionedValueAt0, 0);
          const randomTokenholderPartitionedValueAt1 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 1);
          assert.equal(randomTokenholderPartitionedValueAt1, issuanceAmount);

          const randomTokenholder2PartitionedValueAt0 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 0);
          assert.equal(randomTokenholderPartitionedValueAt0, 0);
          const randomTokenholder2PartitionedValueAt1 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 1);
          assert.equal(randomTokenholder2PartitionedValueAt1, issuanceAmount * 2);

          const newCheckpoint1 = await this.checkpointModule.createCheckpoint();
          assert.equal(1, newCheckpoint1.logs[0].args._checkpointId);

          const tokenholderPartitionedValueAt0Check = await this.checkpointModule.getValueAt(partition1, tokenHolder, 0);
          assert.equal(tokenholderPartitionedValueAt0Check, 0);
          const tokenholderPartitionedValueAt1Check = await this.checkpointModule.getValueAt(partition1, tokenHolder, 1);
          assert.equal(tokenholderPartitionedValueAt1Check, issuanceAmount);
        });

         it('can transfer tokens and get through to the second checkpoint', async function () {
             await this.multiIssuanceModule.issueByPartitionMultiple(
                 [defaultExemption, defaultExemption, defaultExemption],
                 [partition1, partition1, partition2],
                 [tokenHolder, randomTokenHolder, randomTokenHolder2],
                 [issuanceAmount, issuanceAmount, issuanceAmount * 2],
                 VALID_CERTIFICATE,
                 {from: controller});

             const tokenholderPartitionedValueAt0 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 0);
             assert.equal(tokenholderPartitionedValueAt0, 0);
             const tokenholderPartitionedValueAt1 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 1);
             assert.equal(tokenholderPartitionedValueAt1, issuanceAmount);
             const tokenholderPartitionedValueAt2 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 2);
             assert.equal(tokenholderPartitionedValueAt2, issuanceAmount * 2);

             const randomTokenholderPartitionedValueAt0 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 0);
             assert.equal(randomTokenholderPartitionedValueAt0, 0);
             const randomTokenholderPartitionedValueAt1 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 1);
             assert.equal(randomTokenholderPartitionedValueAt1, issuanceAmount);
             const randomTokenholderPartitionedValueAt2 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 2);
             assert.equal(randomTokenholderPartitionedValueAt2, issuanceAmount * 2);

             const randomTokenholder2PartitionedValueAt0 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 0);
             assert.equal(randomTokenholder2PartitionedValueAt0, 0);
             const randomTokenholder2PartitionedValueAt1 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 1);
             assert.equal(randomTokenholder2PartitionedValueAt1, issuanceAmount * 2);
             const randomTokenholder2PartitionedValueAt2 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 2);
             assert.equal(randomTokenholder2PartitionedValueAt2, issuanceAmount * 4);

             const newCheckpoint1 = await this.checkpointModule.createCheckpoint();
             assert.equal(2, newCheckpoint1.logs[0].args._checkpointId);

             const tokenholderPartitionedValueAt0Check = await this.checkpointModule.getValueAt(partition1, tokenHolder, 0);
             assert.equal(tokenholderPartitionedValueAt0Check, 0);
             const tokenholderPartitionedValueAt1Check = await this.checkpointModule.getValueAt(partition1, tokenHolder, 1);
             assert.equal(tokenholderPartitionedValueAt1Check, issuanceAmount);
             const tokenholderPartitionedValueAt2Check = await this.checkpointModule.getValueAt(partition1, tokenHolder, 2);
             assert.equal(tokenholderPartitionedValueAt2Check, issuanceAmount * 2);

         });

         it('can force transfer tokens multiple times and get through to the third checkpoint', async function () {
             // The recipients tokens from the primary issuance are going to be force transferred to these token holders over two transactions
             await this.multiIssuanceModule.operatorTransferByPartitionMultiple(
                 [partition1, partition1, partition2],
                 [recipient, recipient, recipient],
                 [tokenHolder, randomTokenHolder, randomTokenHolder2],
                 [issuanceAmount / 2, issuanceAmount / 2, issuanceAmount],
                 ZERO_BYTE,
                 VALID_CERTIFICATE,
                 {from: controller});

             await this.multiIssuanceModule.operatorTransferByPartitionMultiple(
                 [partition1, partition1, partition2],
                 [recipient, recipient, recipient],
                 [tokenHolder, randomTokenHolder, randomTokenHolder2],
                 [issuanceAmount / 2, issuanceAmount / 2, issuanceAmount],
                 ZERO_BYTE,
                 VALID_CERTIFICATE,
                 {from: controller});

             const tokenholderPartitionedValueAt1 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 1);
             assert.equal(tokenholderPartitionedValueAt1, issuanceAmount);
             const tokenholderPartitionedValueAt2 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 2);
             assert.equal(tokenholderPartitionedValueAt2, issuanceAmount * 2);
             const tokenholderPartitionedValueAt3 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 3);
             assert.equal(tokenholderPartitionedValueAt3, issuanceAmount * 3);

             const randomTokenholderPartitionedValueAt1 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 1);
             assert.equal(randomTokenholderPartitionedValueAt1, issuanceAmount);
             const randomTokenholderPartitionedValueAt2 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 2);
             assert.equal(randomTokenholderPartitionedValueAt2, issuanceAmount * 2);
             const randomTokenholderPartitionedValueAt3 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 3);
             assert.equal(randomTokenholderPartitionedValueAt3, issuanceAmount * 3);

             const randomTokenholder2PartitionedValueAt1 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 1);
             assert.equal(randomTokenholder2PartitionedValueAt1, issuanceAmount * 2);
             const randomTokenholder2PartitionedValueAt2 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 2);
             assert.equal(randomTokenholder2PartitionedValueAt2, issuanceAmount * 4);
             const randomTokenholder2PartitionedValueAt3 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 3);
             assert.equal(randomTokenholder2PartitionedValueAt3, issuanceAmount * 6);

             const newCheckpoint1 = await this.checkpointModule.createCheckpoint();
             assert.equal(3, newCheckpoint1.logs[0].args._checkpointId);

             const tokenholderPartitionedValueAt1Check = await this.checkpointModule.getValueAt(partition1, tokenHolder, 1);
             assert.equal(tokenholderPartitionedValueAt1Check, issuanceAmount);
             const tokenholderPartitionedValueAt2Check = await this.checkpointModule.getValueAt(partition1, tokenHolder, 2);
             assert.equal(tokenholderPartitionedValueAt2Check, issuanceAmount * 2);
             const tokenholderPartitionedValueAt3Check = await this.checkpointModule.getValueAt(partition1, tokenHolder, 3);
             assert.equal(tokenholderPartitionedValueAt3Check, issuanceAmount * 3);
        });

         it('can force transfer tokens multiple times and get through to the fourth checkpoint', async function () {
             await this.multiIssuanceModule.issueByPartitionMultiple(
                 [defaultExemption, defaultExemption, defaultExemption],
                 [partition1, partition1, partition2],
                 [tokenHolder, randomTokenHolder, randomTokenHolder2],
                 [issuanceAmount, issuanceAmount, issuanceAmount * 2],
                 VALID_CERTIFICATE,
                 {from: controller});

             const tokenholderPartitionedValueAt2 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 2);
             assert.equal(tokenholderPartitionedValueAt2, issuanceAmount * 2);
             const tokenholderPartitionedValueAt3 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 3);
             assert.equal(tokenholderPartitionedValueAt3, issuanceAmount * 3);
             const tokenholderPartitionedValueAt4 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 4);
             assert.equal(tokenholderPartitionedValueAt4, issuanceAmount * 4);

             const randomTokenholderPartitionedValueAt2 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 2);
             assert.equal(randomTokenholderPartitionedValueAt2, issuanceAmount * 2);
             const randomTokenholderPartitionedValueAt3 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 3);
             assert.equal(randomTokenholderPartitionedValueAt3, issuanceAmount * 3);
             const randomTokenholderPartitionedValueAt4 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 4);
             assert.equal(randomTokenholderPartitionedValueAt4, issuanceAmount * 4);

             const randomTokenholder2PartitionedValueAt2 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 2);
             assert.equal(randomTokenholder2PartitionedValueAt2, issuanceAmount * 4);
             const randomTokenholder2PartitionedValueAt3 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 3);
             assert.equal(randomTokenholder2PartitionedValueAt3, issuanceAmount * 6);
             const randomTokenholder2PartitionedValueAt4 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 4);
             assert.equal(randomTokenholder2PartitionedValueAt4, issuanceAmount * 8);

             const newCheckpoint1 = await this.checkpointModule.createCheckpoint();
             assert.equal(4, newCheckpoint1.logs[0].args._checkpointId);

             const tokenholderPartitionedValueAt0Check = await this.checkpointModule.getValueAt(partition1, tokenHolder, 0);
             assert.equal(tokenholderPartitionedValueAt0Check, 0);
             const tokenholderPartitionedValueAt1Check = await this.checkpointModule.getValueAt(partition1, tokenHolder, 1);
             assert.equal(tokenholderPartitionedValueAt1Check, issuanceAmount);
             const tokenholderPartitionedValueAt2Check = await this.checkpointModule.getValueAt(partition1, tokenHolder, 2);
             assert.equal(tokenholderPartitionedValueAt2Check, issuanceAmount * 2);
             const tokenholderPartitionedValueAt3Check = await this.checkpointModule.getValueAt(partition1, tokenHolder, 3);
             assert.equal(tokenholderPartitionedValueAt3Check, issuanceAmount * 3);
             const tokenholderPartitionedValueAt4Check = await this.checkpointModule.getValueAt(partition1, tokenHolder, 4);
             assert.equal(tokenholderPartitionedValueAt4Check, issuanceAmount * 4);
         });
     });
    });
  });
});
