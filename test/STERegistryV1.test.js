const { soliditySha3 } = require('web3-utils');
import { shouldFail } from 'openzeppelin-test-helpers';

const ERC1400 = artifacts.require('ERC1400');
const ERC1400ERC20 = artifacts.require('ERC1400ERC20');
const STEFactory = artifacts.require('STEFactory');
const STERegistryV1 = artifacts.require('STERegistryV1');
const ERC1820Registry = artifacts.require('ERC1820Registry');

const ERC20_INTERFACE_NAME = 'ERC20Token';
const ERC1400_INTERFACE_NAME = 'ERC1400Token';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';

const partition1_short = '5265736572766564000000000000000000000000000000000000000000000000'; // Reserved in hex
const partition2_short = '4973737565640000000000000000000000000000000000000000000000000000'; // Issued in hex
const partition3_short = '4c6f636b65640000000000000000000000000000000000000000000000000000'; // Locked in hex
const partition1 = '0x'.concat(partition1_short);
const partition2 = '0x'.concat(partition2_short);
const partition3 = '0x'.concat(partition3_short);

const partitions = [partition1, partition2, partition3];

contract('STERegistryV1', function ([owner, operator, controller, controller_alternative1, controller_alternative2, tokenHolder, recipient, unknown]) {
  before(async function () {
    this.registry = await ERC1820Registry.at('0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24');
  });

  describe('deployment', function () {
    beforeEach(async function () {
      this.tokenFactory = await STEFactory.new();
      this.steRegistryV1 = await STERegistryV1.new(this.tokenFactory.address, 0, 0, 1);
    });

    describe('initializeReverts', function () {
      it('should revert trying to initialize again', async function () {
        await shouldFail.reverting(this.steRegistryV1.initialize(this.tokenFactory.address, 0, 0, 1))
      });
    });

    describe('generateNewSecurityToken', function () {
      it('generates new valid security token', async function () {
      const thisTokenTicker = 'DAU';
      const thisTokenName = 'ERC1400Token';

      const isTickerCurrentlyRegistered = await this.steRegistryV1.tickerAvailable(thisTokenTicker);
      assert.isTrue(isTickerCurrentlyRegistered);

      this.newSecurityToken = await this.steRegistryV1
      .generateNewSecurityToken(thisTokenName, thisTokenTicker, 1, [controller], CERTIFICATE_SIGNER, true, partitions, owner, 0);

      let log = this.newSecurityToken.logs[2];
      this.newcontractAddress = log.args._securityTokenAddress;
      assert.isTrue(this.newcontractAddress.length >= 40);

      //// Make sure the token works
      this.token = await ERC1400.at(this.newcontractAddress);
      // FOR TOKEN PROPERTIES
      const name = await this.token.name();
      assert.equal(name, thisTokenName);
      const symbol = await this.token.symbol();
      assert.equal(symbol, thisTokenTicker);
      // FOR ERC1820
       let interface1400Implementer = await this.registry.getInterfaceImplementer(this.token.address, soliditySha3(ERC1400_INTERFACE_NAME));
       assert.equal(interface1400Implementer, this.token.address);

      const isTickerCurrentlyRegisteredNow = await this.steRegistryV1.tickerAvailable(thisTokenTicker);
      assert.isFalse(isTickerCurrentlyRegisteredNow);

      // Get Security Token address from ticker
      const tickerSTAddress = await this.steRegistryV1.getSecurityTokenAddress(thisTokenTicker);
      assert.equal(tickerSTAddress, this.newcontractAddress); 
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
