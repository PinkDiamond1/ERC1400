const { soliditySha3 } = require('web3-utils');

const ERC1400CertificateMock = artifacts.require('ERC1400CertificateMock');
const STEFactory = artifacts.require('STEFactory');
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

contract('STEFactory', function ([owner, operator, controller, controller_alternative1, controller_alternative2, tokenHolder, recipient, unknown]) {
  before(async function () {
    this.registry = await ERC1820Registry.at('0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24');
  });

  describe('deployment', function () {
    beforeEach(async function () {
      this.tokenFactory = await STEFactory.new();
      this.newToken = await this.tokenFactory.deployToken('ERC1400Token', 'DAU', 1, [controller],
          //CERTIFICATE_SIGNER, true,
          partitions, owner, ['0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24']); //Random addr

      // Check the event logs to get the value returned from the factory emitted
      let log = this.newToken.logs[0];
      this.newcontractAddress = log.args._newContract;
      // Create a token, a valid test will be able to access the token contract and check that it returns
      this.token = await ERC1400CertificateMock.at(this.newcontractAddress);
    });
    describe('name', function () {
      it('returns the name of the deployed token', async function () {
        const name = await this.token.name();

        assert.equal(name, 'ERC1400Token');
      });
    });

    describe('symbol', function () {
      it('returns the symbol of the deployed token', async function () {
        const symbol = await this.token.symbol();

        assert.equal(symbol, 'DAU');
      });
    });

    describe('implementer1400', function () {
      it('returns the contract address from the registry', async function () {
        let interface1400Implementer = await this.registry.getInterfaceImplementer(this.token.address, soliditySha3(ERC1400_INTERFACE_NAME));
        assert.equal(interface1400Implementer, this.token.address);
      });
    });

    describe('implementer20', function () {
      it('returns the zero address', async function () {
        let interface20Implementer = await this.registry.getInterfaceImplementer(this.token.address, soliditySha3(ERC20_INTERFACE_NAME));
        assert.equal(interface20Implementer, this.token.address);
      });
    });
  });
});
