const { soliditySha3, fromAscii, hexToUtf8  } = require('web3-utils');
const { expectRevert } = require("@openzeppelin/test-helpers");

const ERC1400 = artifacts.require('ERC1400');
const STEFactory = artifacts.require('STEFactory');
const STERegistryV1 = artifacts.require('STERegistryV1');
const ERC1820Registry = artifacts.require('ERC1820Registry');
const BatchBalanceReader = artifacts.require('BatchBalanceReader');
const ERC1400TokensValidator = artifacts.require('ERC1400TokensValidatorSTE');
const CheckpointsModule = artifacts.require('CheckpointsModule');
const DividendsModule = artifacts.require('DividendsModule');
const VotingModule = artifacts.require('VotingModule');
const ERC1400TokensChecker = artifacts.require('ERC1400TokensCheckerSTE');
const MultipleIssuanceModule = artifacts.require('MultipleIssuanceModule');

const ModulesDeployer = artifacts.require('ModulesDeployer');
const TokensValidatorFactory = artifacts.require('TokensValidatorFactory');
const TokensCheckerFactory = artifacts.require('TokensCheckerFactory');
const MultipleIssuanceModuleFactory = artifacts.require('MultipleIssuanceModuleFactory');
const CheckpointsModuleFactory = artifacts.require('CheckpointsModuleFactory');
const DividendsModuleFactory = artifacts.require('DividendsModuleFactory');
const VotingModuleFactory = artifacts.require('VotingModuleFactory');

const ERC20_INTERFACE_NAME = 'ERC20Token';
const ERC1400_TOKENS_VALIDATOR_STRING = 'ERC1400TokensValidator';
const ERC1400_TOKENS_CHECKER_STRING = 'ERC1400TokensChecker';
const ERC1400_TOKENS_CHECKPOINTS_STRING = 'ERC1400TokensCheckpoints';
const ERC1400_TOKENS_DIVIDENDS_STRING = 'ERC1400TokensDividends';
const ERC1400_TOKENS_VOTING_STRING = 'ERC1400TokensVoting';
const ERC1400_MULTIPLE_ISSUANCE_STRING = 'ERC1400MultipleIssuance';
const ERC1400_INTERFACE_NAME_STRING = 'ERC1400Token';

const ERC1400_TOKENS_VALIDATOR = '0x45524331343030546f6b656e7356616c696461746f7200000000000000000000';
const ERC1400_TOKENS_CHECKER = '0x45524331343030546f6b656e73436865636b6572000000000000000000000000';
const ERC1400_MULTIPLE_ISSUANCE = '0x455243313430304d756c7469706c6549737375616e6365000000000000000000';
const ERC1400_TOKENS_CHECKPOINTS = '0x45524331343030546f6b656e73436865636b706f696e7473a000000000000000';
const ERC1400_TOKENS_DIVIDENDS = '0x45524331343030546f6b656e73436865636b706f696e74732000000000000000';
const ERC1400_TOKENS_VOTING = '0x45524331343030546f6b656e73566f74696e6700000000000000000000000000';

const protocolNames =
    [ERC1400_MULTIPLE_ISSUANCE,
        ERC1400_TOKENS_VALIDATOR,
        ERC1400_TOKENS_CHECKER,
        ERC1400_TOKENS_CHECKPOINTS,
        ERC1400_TOKENS_DIVIDENDS,
        ERC1400_TOKENS_VOTING
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


contract('STERegistryV1', function ([owner, operator, controller, controller_alternative1, tokenHolder, recipient, randomTokenHolder, randomTokenHolder2, unknown, blacklisted]) {
  before(async function () {
    this.registry = await ERC1820Registry.at('0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24');
  });

  describe('deployment', function () {
    beforeEach(async function () {
      this.tokenFactory = await STEFactory.new();

      this.balanceReader = await BatchBalanceReader.new({from: owner});

      this.mimContractFactory = await MultipleIssuanceModuleFactory.new({ from: owner });
      this.checkpointsContractFactory = await CheckpointsModuleFactory.new({ from: owner });
        this.dividendsContractFactory = await DividendsModuleFactory.new({ from: owner });
        this.votingContractFactory = await VotingModuleFactory.new({ from: owner });
      this.validatorContractFactory = await TokensValidatorFactory.new({ from: owner });
      this.checkerContractFactory = await TokensCheckerFactory.new({ from: owner });

      const factories = [this.mimContractFactory.address,
          this.validatorContractFactory.address, this.checkerContractFactory.address, this.checkpointsContractFactory.address, this.dividendsContractFactory.address, this.votingContractFactory.address];

      this.modulesDeployer = await ModulesDeployer.new(protocolNames, factories, 0, 0, 1, {from:owner});

      this.steRegistryV1 = await STERegistryV1.new(this.tokenFactory.address, this.modulesDeployer.address, 0, 0, 1, {from: owner});

      // this.validatorContract = await ERC1400TokensValidator.new(true, false, { from: owner });
      // this.checkerContract = await ERC1400TokensChecker.new( { from: owner });
    });

    describe('initializeReverts', function () {
      it('should revert trying to initialize again', async function () {
        await expectRevert.unspecified(this.steRegistryV1.initialize(this.tokenFactory.address, this.modulesDeployer.address, 0, 0, 1))
      });
    });

    describe('generateNewSecurityToken', function () {
      it('generates new valid security token and runs a integration test scenario', async function () {
      const thisTokenTicker = 'DAU';
      const thisTokenName = 'ERC1400Token';

      const isTickerCurrentlyRegistered = await this.steRegistryV1.tickerAvailable(thisTokenTicker);
      assert.isTrue(isTickerCurrentlyRegistered);

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

          // Deploy dividend related module
          const moduleDeploymentFromRegistry3 = await this.steRegistryV1.deployModules
          (0,
              [protocolNames[4]]);

          this.deployedModules.push(moduleDeploymentFromRegistry3.logs[0].args._modules[0]);
          this.dividendModule = await DividendsModule.at(this.deployedModules[4]);

          // Deploy voting module
          const moduleDeploymentFromRegistry4 = await this.steRegistryV1.deployModules
          (0,
              [protocolNames[5]]);

          this.deployedModules.push(moduleDeploymentFromRegistry4.logs[0].args._modules[0]);
          this.votingModule = await VotingModule.at(this.deployedModules[5]);

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

      // Check module
     // this.multiIssuanceModule = await MultipleIssuanceModule.new(this.newcontractAddress, {from: owner});

      //// Make sure the token works
      this.token = await ERC1400.at(this.newcontractAddress);
      // FOR TOKEN PROPERTIES
      const name = await this.token.name();
      assert.equal(name, thisTokenName);
      const symbol = await this.token.symbol();
      assert.equal(symbol, thisTokenTicker);

     // ControllersByPartition interesting method
     //  await this.token.setControllers([this.multiIssuanceModule.address, controller], {from: owner});
     //  await this.token.setPartitionControllers(partition1, [this.multiIssuanceModule.address, controller], {from: owner});
     //  // Important for a controller minter
     //  await this.token.addMinter(controller);
     //  await this.token.addMinter(this.multiIssuanceModule.address);


      // FOR ERC1820
       let interface1400Implementer = await this.registry.getInterfaceImplementer(this.token.address, soliditySha3(ERC1400_INTERFACE_NAME_STRING));
       assert.equal(interface1400Implementer, this.token.address);

      const isTickerCurrentlyRegisteredNow = await this.steRegistryV1.tickerAvailable(thisTokenTicker);
      assert.isFalse(isTickerCurrentlyRegisteredNow);

      // Try issuing
      await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, {from: owner});


      await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, {from: controller});


      await this.token.issueByPartition(partition1, controller, issuanceAmount, VALID_CERTIFICATE, {from: controller});

      const newCheckpoint1 = await this.checkpointModule.createCheckpoint();
      assert.equal(1, newCheckpoint1.logs[0].args._checkpointId);

          let hookImplementer = await this.registry.getInterfaceImplementer(this.token.address, soliditySha3(ERC1400_TOKENS_VALIDATOR_STRING));
          assert.equal(hookImplementer, this.validatorContract.address);
           let hookImplementer2 = await this.registry.getInterfaceImplementer(this.token.address, soliditySha3(ERC1400_TOKENS_CHECKER_STRING));
           assert.equal(hookImplementer2, this.checkerContract.address);
           let hookImplementer3 = await this.registry.getInterfaceImplementer(this.token.address, soliditySha3(ERC1400_MULTIPLE_ISSUANCE_STRING));
           assert.equal(hookImplementer3, this.multiIssuanceModule.address);
           let hookImplementer4 = await this.registry.getInterfaceImplementer(this.token.address, soliditySha3(ERC1400_TOKENS_CHECKPOINTS_STRING));
           assert.equal(hookImplementer4, this.checkpointModule.address);
           let hookImplementer5 = await this.registry.getInterfaceImplementer(this.token.address, soliditySha3(ERC1400_TOKENS_DIVIDENDS_STRING));
           assert.equal(hookImplementer5, this.dividendModule.address);
           let hookImplementer6 = await this.registry.getInterfaceImplementer(this.token.address, soliditySha3(ERC1400_TOKENS_VOTING_STRING));
           assert.equal(hookImplementer6, this.votingModule.address);

          const whitelistBytes = 0b1;
          const blacklistBytes = 0b1 << 1;
          const friendsFamilyBytes = 0b1 << 2;
          const accreditedBytes = 0b1 << 3;
          const eligibleBytes = 0b1 << 4;
          const employeeBytes = 0b1 << 5;
          const corporateBytes = 0b1 << 6;

          const currentTime = Math.floor(Date.now() / 1000);
          const futureTime = Math.round(new Date(2040,0).getTime()/1000);

          // Using bitwise OR to send what roles I want to the contract
         await this.validatorContract.addRolesMulti(
             [tokenHolder, recipient, randomTokenHolder, randomTokenHolder2, controller, blacklisted],
                [whitelistBytes | eligibleBytes,
                 whitelistBytes | friendsFamilyBytes,
                 whitelistBytes | accreditedBytes,
                 whitelistBytes | employeeBytes,
                 whitelistBytes | corporateBytes,
                blacklistBytes | friendsFamilyBytes],
                Array(6).fill(currentTime),
                Array(6).fill(currentTime),
                Array(6).fill(futureTime),
             {from: owner});

          assert.equal(await this.validatorContract.isAllowlisted(tokenHolder), true);
          assert.equal(await this.validatorContract.isAllowlisted(randomTokenHolder), true);
          assert.equal(await this.validatorContract.isAllowlisted(recipient), true);
          assert.equal(await this.validatorContract.isBlocklisted(tokenHolder), false);
          assert.equal(await this.validatorContract.isBlocklisted(randomTokenHolder), false);
          assert.equal(await this.validatorContract.isBlocklisted(recipient), false);
          assert.equal(await this.validatorContract.isBlocklisted(blacklisted), true);

          assert.equal(await this.validatorContract.isEligibleInvestor(tokenHolder), true);
          assert.equal(await this.validatorContract.isFriendsFamilyInvestor(recipient), true);
          assert.equal(await this.validatorContract.isAccreditedInvestor(randomTokenHolder), true);
          assert.equal(await this.validatorContract.isEmployeeInvestor(randomTokenHolder), false);
          assert.equal(await this.validatorContract.isEmployeeInvestor(randomTokenHolder2), true);
          assert.equal(await this.validatorContract.isFriendsFamilyInvestor(blacklisted), true);
          assert.equal(await this.validatorContract.isCorporateInvestor(controller), true);

          // By Transferring by operator (controller) and then just a normal transferByPartition with a valid certificate
          await this.token.operatorTransferByPartition(partition1, tokenHolder, recipient, approvedAmount, ZERO_BYTE, ZERO_BYTE, { from: controller });
          await this.token.transferByPartition(partition1, tokenHolder, approvedAmount, VALID_CERTIFICATE, {from: recipient});
          await this.token.transferWithData(recipient, approvedAmount, ZERO_BYTE, {from: controller}); // Invalid bytecode with non controller
          await this.token.transferFromWithData(tokenHolder, recipient, approvedAmount, ZERO_BYTE, {from: controller}); // Invalid bytecode issues with non controller
          // Mint even more tokens!
          await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, {from: controller});

          const balancesOfByPartition = await this.balanceReader.balancesOfByPartition(
              [tokenHolder],
              [this.token.address],
              [partition1],
              { from: unknown }
          );

          console.log(balancesOfByPartition);

          const balancesOf = await this.balanceReader.balancesOf(
              [tokenHolder],
              [this.token.address],
              { from: unknown }
          );

          console.log(balancesOf);

          const totalSuppliesByPartition = await this.balanceReader.totalSuppliesByPartition(
              [partition1],
              [this.token.address],
              { from: unknown }
          );

          console.log('totalSuppliesByPartition');
          console.log(totalSuppliesByPartition);

          this.issuancePartitions = [];
          this.tokenHolders = [];
          this.values = [];
          this.exemptions= [];

          for(let index=0; index < MAX_NUMBER_OF_ISSUANCES_IN_A_BATCH; index++) {

              this.issuancePartitions.push(partition1);
              this.tokenHolders.push(tokenHolder);
              this.values.push(index);
              this.exemptions.push(defaultExemption);
          }
          // Issue multiple owner for max amount of times
          await this.multiIssuanceModule.issueByPartitionMultiple(this.exemptions, this.issuancePartitions, this.tokenHolders, this.values, VALID_CERTIFICATE, {from: owner});

         // Issue multiple controller
         await this.multiIssuanceModule.issueByPartitionMultiple([defaultExemption, defaultExemption], [partition1, partition1], [recipient, tokenHolder], [issuanceAmount, issuanceAmount], VALID_CERTIFICATE, {from: controller});
          // Issue multiple from random does not work
          await expectRevert.unspecified(this.multiIssuanceModule.issueByPartitionMultiple([defaultExemption, defaultExemption], [partition1, partition1], [recipient, tokenHolder], [issuanceAmount, issuanceAmount], VALID_CERTIFICATE, {from: unknown}))

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
          await expectRevert.unspecified(this.multiIssuanceModule.operatorTransferByPartitionMultiple(
              [partition1, partition1],
              [recipient, tokenHolder],
              [randomTokenHolder, randomTokenHolder],
              [issuanceAmount, issuanceAmount],
              ZERO_BYTE,
              VALID_CERTIFICATE,
              {from: unknown}));
      });
    });

    describe('addLongTickerReverts', function () {
      it('should revert trying to add a token with long ticker symbol', async function () {
      const thisTokenTicker = 'DAUUUUUUUUUU';
      const thisTokenName = 'ERC1400Token';
      const moduleDeploymentFromRegistry = await this.steRegistryV1.deployModules
          (0,
              [protocolNames[0],
                  protocolNames[1],
                  protocolNames[2]]);

      this.deployedModules = moduleDeploymentFromRegistry.logs[1].args._modules;
        await expectRevert.unspecified(this.steRegistryV1
      .generateNewSecurityToken(
          thisTokenName,
          thisTokenTicker,
          1,
          [controller],
         // CERTIFICATE_SIGNER,
         // true,
          partitions,
          owner,
          0,
          this.deployedModules))
      });
    });

    describe('addExistingSecurityTokenToRegistry', function () {
      it('Add Existing Security Token To Registry with certificate controller feature', async function () {
      const thisTokenTicker = 'DAU2';
      this.existingSecurityToken = await ERC1400.new('ERC1400Token2', thisTokenTicker, 1, [controller],
          // CERTIFICATE_SIGNER, true,
          partitions);

      //// Call appropriate function
       this.newExistingSecurityToken = await this.steRegistryV1
      .addExistingSecurityTokenToRegistry(thisTokenTicker, owner, this.existingSecurityToken.address, 0);

      // Emits register ticker event
      let registerTickerLog = this.newExistingSecurityToken.logs[0];
      this.tickerRegistered = registerTickerLog.args._ticker;
      assert.equal(this.tickerRegistered, thisTokenTicker);

      // Emits new security token event
      let securityTokenLog = this.newExistingSecurityToken.logs[1];
      this.tickerNew = securityTokenLog.args._ticker;
      assert.equal(this.tickerNew, thisTokenTicker);
      this.securityTokenAddress = securityTokenLog.args._securityTokenAddress;
      assert.equal(this.securityTokenAddress, this.existingSecurityToken.address);
      });
    });

    describe('addExistingCompatibleSecurityTokenToRegistry', function () {
      it('Add Existing Security Token ERC1400 To Registry', async function () {
      const thisTokenTicker = 'DAU3';
      this.existingSecurityToken = await ERC1400.new('ERC1400Token3', thisTokenTicker, 1,
          [controller],
          //CERTIFICATE_SIGNER,
          //true,
          partitions);

      // Existing token can make an issuance
      await this.existingSecurityToken.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, { from: owner });

      //// Call appropriate function
       this.newExistingSecurityToken = await this.steRegistryV1
      .addExistingSecurityTokenToRegistry(thisTokenTicker, owner, this.existingSecurityToken.address, 0);

      // Emits register ticker event
      let registerTickerLog = this.newExistingSecurityToken.logs[0];
      this.tickerRegistered = registerTickerLog.args._ticker;
      assert.equal(this.tickerRegistered, thisTokenTicker);

      // Emits new security token event
      let securityTokenLog = this.newExistingSecurityToken.logs[1];
      this.tickerNew = securityTokenLog.args._ticker;
      assert.equal(this.tickerNew, thisTokenTicker);
      this.securityTokenAddress = securityTokenLog.args._securityTokenAddress;
      assert.equal(this.securityTokenAddress, this.existingSecurityToken.address);
      });
    });

    describe('tickerAndProtocolTests', function () {
      beforeEach(async function () {
        this.thisTokenTicker5 = 'DAU5';
        this.thisTokenName5 = 'ERC1400Token5';
          const moduleDeploymentFromRegistry = await this.steRegistryV1.deployModules
          (0,
              [protocolNames[0],
                  protocolNames[1],
                  protocolNames[2]]);

          this.deployedModules = moduleDeploymentFromRegistry.logs[1].args._modules;
        this.newSecurityToken = await this.steRegistryV1
        .generateNewSecurityToken(
            this.thisTokenName5,
            this.thisTokenTicker5,
            1,
            [controller],
            // CERTIFICATE_SIGNER,
            // true,
            partitions,
            owner,
            0,
            this.deployedModules);
        let log = this.newSecurityToken.logs[3];
        this.newcontractAddress5 = log.args._securityTokenAddress;

        this.updatedTokenFactory = await STEFactory.new();
       });

     describe('getTokensForOwner', function () {
      it('gets tokens for a specific owner', async function () {
        // Make a second token
        this.thisTokenTicker6 = 'DAU6';
          const moduleDeploymentFromRegistry = await this.steRegistryV1.deployModules
          (0,
              [protocolNames[0],
                  protocolNames[1],
                  protocolNames[2]]);

          this.deployedModules = moduleDeploymentFromRegistry.logs[1].args._modules;
        this.newSecurityToken = await this.steRegistryV1
        .generateNewSecurityToken(
            'ERC1400Token6',
            this.thisTokenTicker6 ,
            1,
            [controller],
            // CERTIFICATE_SIGNER,
            // true,
            partitions,
            owner,
            0,
            this.deployedModules);

        let log = this.newSecurityToken.logs[3];
        this.newcontractAddress6 = log.args._securityTokenAddress;

        const tickerOwner6 = await this.steRegistryV1.getTickerOwner(this.thisTokenTicker6);
        assert.equal(tickerOwner6, owner);
        const allTickersForOwner = await this.steRegistryV1.getTickersByOwner(owner);
        const utf8Tickers = allTickersForOwner.map((ticker) => {return hexToUtf8(ticker)});
        assert.equal(utf8Tickers[0], this.thisTokenTicker5);
        assert.equal(utf8Tickers[1], this.thisTokenTicker6);

        const allTokensForOwner = await this.steRegistryV1.getTokensForOwner(owner);
        assert.equal(allTokensForOwner[0], this.newcontractAddress5);
        assert.equal(allTokensForOwner[1], this.newcontractAddress6);
        });
       });

     describe('removeTicker', function () {
      it('gets ticker owner and removesTicker', async function () {
        const tickerOwner = await this.steRegistryV1.getTickerOwner(this.thisTokenTicker5);
        assert.equal(tickerOwner, owner);

        await this.steRegistryV1.removeTicker(this.thisTokenTicker5);

        const tickerOwnerNew = await this.steRegistryV1.getTickerOwner(this.thisTokenTicker5);
        assert.equal(tickerOwnerNew, 0);
        });
       });

     describe('getSecurityTokenData', function () {
      it('gets appropriate security token data information', async function () {
        const securityTokenData = await this.steRegistryV1.getSecurityTokenData(this.newcontractAddress5);
        assert.equal(securityTokenData.tokenSymbol, this.thisTokenTicker5);
        assert.equal(securityTokenData.tokenAddress, this.newcontractAddress5);
        assert.equal(securityTokenData.tokenTime.toNumber(), 0);
        });
       });

     describe('getSTFactoryAddress', function () {
      it('gets the st factory address', async function () {
        const stFactoryAddress = await this.steRegistryV1.getSTFactoryAddress();
        assert.equal(this.tokenFactory.address, stFactoryAddress);
        });
       });

     describe('addNewSTEFactoryAndUpdateToLatestVersionRemovingOldVersionAsWell', function () {
      it('adds new ste factory, updates the version, removes the old version', async function () {
        await this.steRegistryV1.setProtocolFactory(this.updatedTokenFactory.address, 0, 0, 2);
        await this.steRegistryV1.setLatestVersion(0, 0, 2);
        const stFactoryAddress = await this.steRegistryV1.getSTFactoryAddress();
        assert.equal(this.updatedTokenFactory.address, stFactoryAddress);
        await this.steRegistryV1.removeProtocolFactory(0, 0, 1)
        });
       });

     describe('canPauseAndUnpause', function () {
      it('pause and unpause', async function () {
        assert.isFalse(await this.steRegistryV1.isPaused());
        await this.steRegistryV1.pause();
        assert.isTrue(await this.steRegistryV1.isPaused());
        await this.steRegistryV1.unpause();
        assert.isFalse(await this.steRegistryV1.isPaused());
        });
       });

     describe('getOwner', function () {
      it('gets the owner', async function () {
        const steRegistryOwner = await this.steRegistryV1.owner();
        assert.equal(owner, steRegistryOwner);
        });
       });

     describe('canTransferOwnership', function () {
      it('transfers ownership', async function () {
        await this.steRegistryV1.transferOwnership(unknown);
        const steRegistryOwner = await this.steRegistryV1.owner();
        assert.equal(unknown, steRegistryOwner);
        });
       });
    });

    //// Upgradeability tests, leave at the end.
    describe('setNewGetterRegistry(implementation)', function () {
      it('set getter contract (implementation, upgradeability?)', async function () {
      this.newTokenFactory = await STEFactory.new();
      this.newSteRegistryV1 = await STERegistryV1.new(this.tokenFactory.address, this.modulesDeployer.address, 0, 0, 2);
      await this.steRegistryV1.setGetterRegistry(this.newSteRegistryV1.address);
      });
    });
  });
});
