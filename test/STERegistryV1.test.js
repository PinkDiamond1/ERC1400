const { soliditySha3, fromAscii, hexToUtf8  } = require('web3-utils');
const { shouldFail } = require('openzeppelin-test-helpers');

const ERC1400 = artifacts.require('ERC1400');
const ERC1400ERC20 = artifacts.require('ERC1400ERC20');
const STEFactory = artifacts.require('STEFactory');
const STERegistryV1 = artifacts.require('STERegistryV1');
const ERC1820Registry = artifacts.require('ERC1820Registry');
const ERC1400TokensValidator = artifacts.require('ERC1400TokensValidatorSTE');
const ERC1400TokensChecker = artifacts.require('ERC1400TokensChecker');
const MultipleIssuanceModule = artifacts.require('MultipleIssuanceModule');

const ERC20_INTERFACE_NAME = 'ERC20Token';
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


contract('STERegistryV1', function ([owner, operator, controller, controller_alternative1, controller_alternative2, tokenHolder, recipient, randomTokenHolder, unknown]) {
  before(async function () {
    this.registry = await ERC1820Registry.at('0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24');
  });

  describe('deployment', function () {
    beforeEach(async function () {
      this.tokenFactory = await STEFactory.new();
      this.steRegistryV1 = await STERegistryV1.new(this.tokenFactory.address, 0, 0, 1);
      this.validatorContract = await ERC1400TokensValidator.new(true, false, { from: owner });
      this.checkerContract = await ERC1400TokensChecker.new( { from: owner });
    });

    describe('initializeReverts', function () {
      it('should revert trying to initialize again', async function () {
        await shouldFail.reverting(this.steRegistryV1.initialize(this.tokenFactory.address, 0, 0, 1))
      });
    });

    describe('generateNewSecurityToken', function () {
      it('generates new valid security token and runs a scenario', async function () {
      const thisTokenTicker = 'DAU';
      const thisTokenName = 'ERC1400Token';

      const isTickerCurrentlyRegistered = await this.steRegistryV1.tickerAvailable(thisTokenTicker);
      assert.isTrue(isTickerCurrentlyRegistered);

      this.newSecurityToken = await this.steRegistryV1
      .generateNewSecurityToken(thisTokenName, thisTokenTicker, 1, [controller], controller, true, partitions, owner, 0);

      let log = this.newSecurityToken.logs[2];
      this.newcontractAddress = log.args._securityTokenAddress;
      assert.isTrue(this.newcontractAddress.length >= 40);

      // Get Security Token address from ticker
      const tickerSTAddress = await this.steRegistryV1.getSecurityTokenAddress(thisTokenTicker);
      assert.equal(tickerSTAddress, this.newcontractAddress);

      // Check module
      this.multiIssuanceModule = await MultipleIssuanceModule.new(this.newcontractAddress, {from: owner});


      //// Make sure the token works
      this.token = await ERC1400.at(this.newcontractAddress);
      // FOR TOKEN PROPERTIES
      const name = await this.token.name();
      assert.equal(name, thisTokenName);
      const symbol = await this.token.symbol();
      assert.equal(symbol, thisTokenTicker);

     // ControllersByPartition interesting method
     // console.log(await this.token.controllersByPartition(partition1));
      await this.token.setControllers([this.multiIssuanceModule.address, controller], {from: owner});
      await this.token.setPartitionControllers(partition1, [this.multiIssuanceModule.address, controller], {from: owner});
      // Important for a controller minter
      await this.token.addMinter(controller);
      await this.token.addMinter(this.multiIssuanceModule.address);

      // FOR ERC1820
       let interface1400Implementer = await this.registry.getInterfaceImplementer(this.token.address, soliditySha3(ERC1400_INTERFACE_NAME));
       assert.equal(interface1400Implementer, this.token.address);

      const isTickerCurrentlyRegisteredNow = await this.steRegistryV1.tickerAvailable(thisTokenTicker);
      assert.isFalse(isTickerCurrentlyRegisteredNow);

      // Try issuing
      await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, {from: owner});

      await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, {from: controller});
      await this.token.issueByPartition(partition1, controller, issuanceAmount, VALID_CERTIFICATE, {from: controller});

       await this.token.setHookContract(this.validatorContract.address, ERC1400_TOKENS_VALIDATOR, { from: owner });
       await this.token.setHookContract(this.checkerContract.address, ERC1400_TOKENS_CHECKER, { from: owner });
       await this.token.setHookContract(this.multiIssuanceModule.address, ERC1400_MULTIPLE_ISSUANCE, { from: owner });

          let hookImplementer = await this.registry.getInterfaceImplementer(this.token.address, soliditySha3(ERC1400_TOKENS_VALIDATOR));
          assert.equal(hookImplementer, this.validatorContract.address);
          let hookImplementer2 = await this.registry.getInterfaceImplementer(this.token.address, soliditySha3(ERC1400_TOKENS_CHECKER));
          assert.equal(hookImplementer2, this.checkerContract.address);
          let hookImplementer3 = await this.registry.getInterfaceImplementer(this.token.address, soliditySha3(ERC1400_MULTIPLE_ISSUANCE));
          assert.equal(hookImplementer3, this.multiIssuanceModule.address);

        // Try transfer without whitelisting
        await shouldFail.reverting(this.token.operatorTransferByPartition(partition1, tokenHolder, recipient, approvedAmount, ZERO_BYTE, ZERO_BYTE, { from: controller }));

        // await this.validatorContract.addWhitelisted(tokenHolder, { from: owner });
        // await this.validatorContract.addWhitelisted(recipient, { from: owner });
         await this.validatorContract.addWhitelistedMulti([tokenHolder, recipient, randomTokenHolder, controller], {from: owner});

         assert.equal(await this.validatorContract.isWhitelisted(tokenHolder), true);
         assert.equal(await this.validatorContract.isWhitelisted(randomTokenHolder), true);
         assert.equal(await this.validatorContract.isWhitelisted(recipient), true);

          // By Transferring by operator (controller) and then just a normal transferByPartition with a valid certificate
          await this.token.operatorTransferByPartition(partition1, tokenHolder, recipient, approvedAmount, ZERO_BYTE, ZERO_BYTE, { from: controller });
          await this.token.transferByPartition(partition1, tokenHolder, approvedAmount, VALID_CERTIFICATE, {from: recipient});
          await this.token.transferWithData(recipient, approvedAmount, ZERO_BYTE, {from: controller}); // Invalid bytecode with non controller
          await this.token.transferFromWithData(tokenHolder, recipient, approvedAmount, ZERO_BYTE, ZERO_BYTE, {from: controller}); // Invalid bytecode issues with non controller
          // Mint even more tokens!
          await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, {from: controller});

          // Issue multiple owner
          await this.multiIssuanceModule.issueByPartitionMultiple([partition1, partition1], [recipient, tokenHolder], [issuanceAmount, issuanceAmount], VALID_CERTIFICATE, {from: owner});
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

    describe('addLongTickerReverts', function () {
      it('should revert trying to add a token with long ticker symbol', async function () {
      const thisTokenTicker = 'DAUUUUUUUUUU';
      const thisTokenName = 'ERC1400Token';
        await shouldFail.reverting(this.steRegistryV1
      .generateNewSecurityToken(thisTokenName, thisTokenTicker, 1, [controller], CERTIFICATE_SIGNER, true, partitions, owner, 0))
      });
    });

    describe('addExistingSecurityTokenToRegistry', function () {
      it('Add Existing Security Token To Registry', async function () {
      const thisTokenTicker = 'DAU2';
      this.existingSecurityToken = await ERC1400.new('ERC1400Token2', thisTokenTicker, 1, [controller], CERTIFICATE_SIGNER, true, partitions);

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

    describe('addExistingErc20CompatibleSecurityTokenToRegistry', function () {
      it('Add Existing Security Token ERC1400ERC20 To Registry', async function () {
      const thisTokenTicker = 'DAU3';
      this.existingSecurityToken = await ERC1400ERC20.new('ERC1400Token3', thisTokenTicker, 1, [controller], CERTIFICATE_SIGNER, true, partitions);

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

        this.newSecurityToken = await this.steRegistryV1
        .generateNewSecurityToken(this.thisTokenName5, this.thisTokenTicker5 , 1, [controller], CERTIFICATE_SIGNER, true, partitions, owner, 0);
        let log = this.newSecurityToken.logs[2];
        this.newcontractAddress5 = log.args._securityTokenAddress;

        this.updatedTokenFactory = await STEFactory.new();
       });

     describe('getTokensForOwner', function () {
      it('gets tokens for a specific owner', async function () {
        // Make a second token
        this.thisTokenTicker6 = 'DAU6';
        this.newSecurityToken = await this.steRegistryV1
        .generateNewSecurityToken('ERC1400Token6', this.thisTokenTicker6 , 1, [controller], CERTIFICATE_SIGNER, true, partitions, owner, 0);
        let log = this.newSecurityToken.logs[2];
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
      this.newSteRegistryV1 = await STERegistryV1.new(this.tokenFactory.address, 0, 0, 2);
      await this.steRegistryV1.setGetterRegistry(this.newSteRegistryV1.address);
      });
    });
  });
});
