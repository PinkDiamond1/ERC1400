const { soliditySha3, fromAscii, hexToUtf8  } = require('web3-utils');
const { expectRevert } = require("@openzeppelin/test-helpers");

const ERC20 = artifacts.require('ERC20Token');
const ERC1400 = artifacts.require('ERC1400');
const STEFactory = artifacts.require('STEFactory');
const STERegistryV1 = artifacts.require('STERegistryV1');
const ERC1820Registry = artifacts.require('ERC1820Registry');
const ERC1400TokensValidator = artifacts.require('ERC1400TokensValidatorSTE');
const CheckpointsModule = artifacts.require('CheckpointsModule');
const DividendsModule = artifacts.require('DividendsModule');
const ERC1400TokensChecker = artifacts.require('ERC1400TokensCheckerSTE');
const MultipleIssuanceModule = artifacts.require('MultipleIssuanceModule');
const BokkyPooBahDateTimeLibrary = artifacts.require('BokkyPooBahsDateTimeLibrary.sol')

const ModulesDeployer = artifacts.require('ModulesDeployer');
const TokensValidatorFactory = artifacts.require('TokensValidatorFactory');
const TokensCheckerFactory = artifacts.require('TokensCheckerFactory');
const MultipleIssuanceModuleFactory = artifacts.require('MultipleIssuanceModuleFactory');
const CheckpointsModuleFactory = artifacts.require('CheckpointsModuleFactory');
const DividendsModuleFactory = artifacts.require('DividendsModuleFactory');

const ERC20_INTERFACE_NAME = 'ERC20Token';
const ERC1400_TOKENS_VALIDATOR_STRING = 'ERC1400TokensValidator';
const ERC1400_TOKENS_CHECKER_STRING = 'ERC1400TokensChecker';
const ERC1400_TOKENS_CHECKPOINTS_STRING = 'ERC1400TokensCheckpoints';
const ERC1400_TOKENS_DIVIDENDS_STRING = 'ERC1400TokensDividends';
const ERC1400_MULTIPLE_ISSUANCE_STRING = 'ERC1400MultipleIssuance';
const ERC1400_INTERFACE_NAME_STRING = 'ERC1400Token';

const ERC1400_TOKENS_VALIDATOR = '0x45524331343030546f6b656e7356616c696461746f7200000000000000000000';
const ERC1400_TOKENS_CHECKER = '0x45524331343030546f6b656e73436865636b6572000000000000000000000000';
const ERC1400_MULTIPLE_ISSUANCE = '0x455243313430304d756c7469706c6549737375616e6365000000000000000000';
const ERC1400_TOKENS_CHECKPOINTS = '0x45524331343030546f6b656e73436865636b706f696e7473a000000000000000';
const ERC1400_TOKENS_DIVIDENDS = '0x45524331343030546f6b656e73436865636b706f696e74732000000000000000';

const protocolNames =
    [ERC1400_MULTIPLE_ISSUANCE,
        ERC1400_TOKENS_VALIDATOR,
        ERC1400_TOKENS_CHECKER,
        ERC1400_TOKENS_CHECKPOINTS,
        ERC1400_TOKENS_DIVIDENDS
    ];

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

 const VALID_CERTIFICATE = '0x1000000000000000000000000000000000000000000000000000000000000000';

 const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';

const partition1 = '0x5265736572766564000000000000000000000000000000000000000000000000'; // Reserved in hex
const partition2 = '0x4973737565640000000000000000000000000000000000000000000000000000'; // Issued in hex
const partition3 = '0x4c6f636b65640000000000000000000000000000000000000000000000000000'; // Locked in hex

const defaultExemption = '0x1234500000000000000000000000000000000000000000000000000000000000';
const defaultSchedule = '0x1234560000000000000000000000000000000000000000000000000000000000';

const ZERO_BYTE = '0x';
const partitions = [partition1, partition2, partition3];

const issuanceAmount = 100000;
const approvedAmount = 50000;

const MAX_NUMBER_OF_ISSUANCES_IN_A_BATCH = 20;

async function currentTime() {
    return (await latestTime());
}

// Returns the time of the last mined block in seconds
async function latestTime() {
    let block = await latestBlock();
    return block.timestamp;
}

async function latestBlock() {
    return await web3.eth.getBlock("latest");
}

// ---------- Module to accelerate time -----------------------
const advanceTime = (time) => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send(
            {
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [time],
                id: new Date().getTime(),
            },
            (err, result) => {
                if (err) {
                    return reject(err);
                }
                return resolve(result);
            }
        );
    });
};

const advanceBlock = () => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send(
            {
                jsonrpc: "2.0",
                method: "evm_mine",
                id: new Date().getTime(),
            },
            (err, result) => {
                if (err) {
                    return reject(err);
                }
                const newBlockHash = web3.eth.getBlock("latest").hash;

                return resolve(newBlockHash);
            }
        );
    });
};

const advanceTimeAndBlock = async (time) => {
    await advanceTime(time);
    await advanceBlock();
    return Promise.resolve(web3.eth.getBlock("latest"));
};

contract('DividendsModule', function ([owner, treasuryWallet, controller, controller_alternative1, tokenHolder, recipient, randomTokenHolder, randomTokenHolder2, unknown, blacklisted]) {
  before(async function () {
    this.registry = await ERC1820Registry.at('0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24');
  });

  describe('deployment', function () {
    before(async function () {
      this.tokenFactory = await STEFactory.new();

      this.mimContractFactory = await MultipleIssuanceModuleFactory.new({ from: owner });
      const bokkyPooBahDateTimeLibrary = await BokkyPooBahDateTimeLibrary.new();
      await CheckpointsModuleFactory.link("BokkyPooBahDateTimeLibrary", bokkyPooBahDateTimeLibrary.address);
      this.checkpointsContractFactory = await CheckpointsModuleFactory.new({ from: owner });
      this.dividendsContractFactory = await DividendsModuleFactory.new({ from: owner });
      this.validatorContractFactory = await TokensValidatorFactory.new({ from: owner });
      this.checkerContractFactory = await TokensCheckerFactory.new({ from: owner });

      const factories = [this.mimContractFactory.address,
          this.validatorContractFactory.address, this.checkerContractFactory.address, this.checkpointsContractFactory.address, this.dividendsContractFactory.address];

      this.modulesDeployer = await ModulesDeployer.new(protocolNames, factories, 0, 0, 1, {from:owner});

      this.steRegistryV1 = await STERegistryV1.new(this.tokenFactory.address, this.modulesDeployer.address, 0, 0, 1, {from: owner});
      const thisTokenTicker = 'DAU';
      const thisTokenName = 'ERC1400Token';
        // Deploy multiple issuance related module
        const moduleDeploymentFromRegistry0 = await this.steRegistryV1.deployModules(0, [protocolNames[0]]);
        this.deployedModules = moduleDeploymentFromRegistry0.logs[0].args._modules;
        this.multiIssuanceModule = await MultipleIssuanceModule.at(this.deployedModules[0]);

        // Deploy checker related module
        const moduleDeploymentFromRegistry1 = await this.steRegistryV1.deployModules(0, [protocolNames[1]]);
        console.log(moduleDeploymentFromRegistry1.logs[1]);
        this.deployedModules.push(moduleDeploymentFromRegistry1.logs[1].args._modules[0]);
        this.checkerContract = await ERC1400TokensChecker.at(this.deployedModules[1]);

        // Deploy validator related module
        const moduleDeploymentFromRegistry2 = await this.steRegistryV1.deployModules(0, [protocolNames[2]]);
        this.deployedModules.push(moduleDeploymentFromRegistry2.logs[0].args._modules[0]);
        this.validatorContract = await ERC1400TokensValidator.at(this.deployedModules[2]);

        // Deploy checkpoint related module
        const moduleDeploymentFromRegistry3 = await this.steRegistryV1.deployModules(0, [protocolNames[3]]);
        this.deployedModules.push(moduleDeploymentFromRegistry3.logs[0].args._modules[0]);
        this.checkpointModule = await CheckpointsModule.at(this.deployedModules[3]);

        // Deploy dividend related module
        const moduleDeploymentFromRegistry4 = await this.steRegistryV1.deployModules(0, [protocolNames[4]]);
        this.deployedModules.push(moduleDeploymentFromRegistry4.logs[0].args._modules[0]);
        this.dividendModule = await DividendsModule.at(this.deployedModules[4]);


        this.erc20Token = await ERC20.new('ERC20Token', 'DAU', 18, {from: controller});
        await this.erc20Token.mint(controller, issuanceAmount, {from: controller});
        await this.erc20Token.approve(this.dividendModule.address, issuanceAmount, {from: controller});

        this.newSecurityToken = await this.steRegistryV1
            .generateNewSecurityToken(
                thisTokenName,
                thisTokenTicker,
                1,
                [controller, this.dividendModule.address], // Dividend module needs to be included as controller as wells
                //controller,
                //true,
                partitions,
                owner,
                0,
                this.deployedModules);


        let log = this.newSecurityToken.logs[3];
        this.newcontractAddress = log.args._securityTokenAddress;
        assert.isTrue(this.newcontractAddress.length >= 40);

        console.log('here2');
        // First make sure the validator contract is hooked in
        await this.validatorContract.registerTokenSetup(this.newcontractAddress, 0, true, true, false, false, [controller, owner],{from: owner});

        console.log('here3');
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
        const employeeBytes = 0b1 << 5;
        const corporateBytes = 0b1 << 6;
        const currentTime = Math.floor(Date.now() / 1000);
        const futureTime = Math.round(new Date(2040,0).getTime()/1000);
        // Using bitwise OR to send what roles I want to the contract
        await this.validatorContract.addRolesMulti(
            [tokenHolder, recipient, randomTokenHolder, randomTokenHolder2, controller, blacklisted, treasuryWallet, this.dividendModule.address],
            [whitelistBytes | eligibleBytes,
                whitelistBytes | friendsFamilyBytes,
                whitelistBytes | accreditedBytes,
                whitelistBytes | employeeBytes,
                whitelistBytes,
                blacklistBytes | friendsFamilyBytes,
                whitelistBytes,
                whitelistBytes],
            Array(8).fill(currentTime),
            Array(8).fill(currentTime),
            Array(8).fill(futureTime),
            {from: owner});

    });

    describe('zero balances', function () {
      it('checks the first checkpoint and receives 0 balances, there have been no transfers', async function () {
          const tokenholderPartitionedValueAt0 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 0);
          assert.equal(tokenholderPartitionedValueAt0, 0);
          const tokenholderPartitionedValueAt1 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 1);
          assert.equal(tokenholderPartitionedValueAt1, 0);

          const partition1ValueAt0 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 0);
          assert.equal(partition1ValueAt0, 0);
          const partition1ValueAt1 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 1);
          assert.equal(partition1ValueAt1, 0);

          const totalSupplyValueAt0 = await this.checkpointModule.getTotalSupplyAt(0);
          assert.equal(totalSupplyValueAt0, 0);
          const totalSupplyValueAt1 = await this.checkpointModule.getTotalSupplyAt(1);
          assert.equal(totalSupplyValueAt1, 0);
      });

        it('can set and check the default excluded users', async function () {
            const defaultExcluded = await this.dividendModule.setDefaultExcluded([this.dividendModule.address], {from: controller});
            const getExcluded = await this.dividendModule.getDefaultExcluded();
            assert.equal(getExcluded[0], this.dividendModule.address);
        });

        it('can set withholding', async function () {
            await this.dividendModule.setWithholding([randomTokenHolder], [web3.utils.toBN('50000000000000000')], {from: controller});
        });

        it('can set and change wallet, get treasury wallet', async function () {
            const defaultExcluded = await this.dividendModule.changeWallet(treasuryWallet, {from: controller});
            const getTreasury = await this.dividendModule.getTreasuryWallet();
            assert.equal(getTreasury, treasuryWallet);
        });

        it('can find extension contracts', async function () {
            const getValidatorModule = await this.dividendModule.getValidatorModule();
            const getCheckpointsModule = await this.dividendModule.getCheckpointsModule();
            assert.equal(getValidatorModule, this.validatorContract.address);
            assert.equal(getCheckpointsModule, this.checkpointModule.address);
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

          // Partition supply
          const partition1ValueAt0 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 0);
          assert.equal(partition1ValueAt0, 0);
          const partition1ValueAt1 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 1);
          assert.equal(partition1ValueAt1, issuanceAmount * 4);
          const partition1ValueAt2 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 2);
          assert.equal(partition1ValueAt2, issuanceAmount * 4);

          const partition2ValueAt0 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 0);
          assert.equal(partition2ValueAt0, 0);
          const partition2ValueAt1 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 1);
          assert.equal(partition2ValueAt1, issuanceAmount * 4);
          const partition2ValueAt2 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 2);
          assert.equal(partition2ValueAt2, issuanceAmount * 4);

          // Total supply
          const totalSupplyValueAt0 = await this.checkpointModule.getTotalSupplyAt(0);
          assert.equal(totalSupplyValueAt0, 0);
          const totalSupplyValueAt1 = await this.checkpointModule.getTotalSupplyAt(1);
          assert.equal(totalSupplyValueAt1, issuanceAmount * 8);
          const totalSupplyValueAt2 = await this.checkpointModule.getTotalSupplyAt(2);
          assert.equal(totalSupplyValueAt2, issuanceAmount * 8);
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

             // Partition supply
             const partition1ValueAt1 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 1);
             assert.equal(partition1ValueAt1, issuanceAmount * 4);
             const partition1ValueAt2 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 2);
             assert.equal(partition1ValueAt2, issuanceAmount * 6);
             const partition1ValueAt3 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 3);
             assert.equal(partition1ValueAt3, issuanceAmount * 6);

             const partition2ValueAt1 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 1);
             assert.equal(partition2ValueAt1, issuanceAmount * 4);
             const partition2ValueAt2 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 2);
             assert.equal(partition2ValueAt2, issuanceAmount * 6);
             const partition2ValueAt3 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 3);
             assert.equal(partition2ValueAt3, issuanceAmount * 6);

             // Total supply
             const totalSupplyValueAt1 = await this.checkpointModule.getTotalSupplyAt(1);
             assert.equal(totalSupplyValueAt1, issuanceAmount * 8);
             const totalSupplyValueAt2 = await this.checkpointModule.getTotalSupplyAt(2);
             assert.equal(totalSupplyValueAt2, issuanceAmount * 12);
             const totalSupplyValueAt3 = await this.checkpointModule.getTotalSupplyAt(3);
             assert.equal(totalSupplyValueAt3, issuanceAmount * 12);
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

             // No change to supply
             const totalSupplyValueAt3 = await this.checkpointModule.getTotalSupplyAt(3);
             assert.equal(totalSupplyValueAt3, issuanceAmount * 12);
             const totalSupplyValueAt4 = await this.checkpointModule.getTotalSupplyAt(4);
             assert.equal(totalSupplyValueAt4, issuanceAmount * 12);
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

             // Partition supply
             const partition1ValueAt1 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 1);
             assert.equal(partition1ValueAt1, issuanceAmount * 4);
             const partition1ValueAt2 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 2);
             assert.equal(partition1ValueAt2, issuanceAmount * 6);
             const partition1ValueAt3 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 3);
             assert.equal(partition1ValueAt3, issuanceAmount * 6);
             const partition1ValueAt4 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 4);
             assert.equal(partition1ValueAt4, issuanceAmount * 8);

             const partition2ValueAt1 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 1);
             assert.equal(partition2ValueAt1, issuanceAmount * 4);
             const partition2ValueAt2 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 2);
             assert.equal(partition2ValueAt2, issuanceAmount * 6);
             const partition2ValueAt3 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 3);
             assert.equal(partition2ValueAt3, issuanceAmount * 6);
             const partition2ValueAt4 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 4);
             assert.equal(partition2ValueAt4, issuanceAmount * 8);

             // Total supply
             const totalSupplyValueAt0 = await this.checkpointModule.getTotalSupplyAt(0);
             assert.equal(totalSupplyValueAt0, 0);
             const totalSupplyValueAt1 = await this.checkpointModule.getTotalSupplyAt(1);
             assert.equal(totalSupplyValueAt1, issuanceAmount * 8);
             const totalSupplyValueAt2 = await this.checkpointModule.getTotalSupplyAt(2);
             assert.equal(totalSupplyValueAt2, issuanceAmount * 12);
             const totalSupplyValueAt3 = await this.checkpointModule.getTotalSupplyAt(3);
             assert.equal(totalSupplyValueAt3, issuanceAmount * 12);
             const totalSupplyValueAt4 = await this.checkpointModule.getTotalSupplyAt(4);
             assert.equal(totalSupplyValueAt4, issuanceAmount * 16);
             const totalSupplyValueAt5 = await this.checkpointModule.getTotalSupplyAt(5);
             assert.equal(totalSupplyValueAt5, issuanceAmount * 16);
         });

         it(' distributes erc20 token dividend payment on the fourth checkpoint with tax withholdings', async function () {
             this.dividendMaturityTime = (await currentTime());
             this.dividendExpiryTime = (await currentTime()) + (60 * 60 * 150); // Should stop after 150 hours

             // Can create a dividend in an erc20 token
             assert.equal(await this.erc20Token.balanceOf(controller), issuanceAmount);
             assert.equal(await this.erc20Token.balanceOf(this.dividendModule.address), 0);
             const createDivERC20Partition1 = await this.dividendModule.createDividendWithCheckpointAndExclusions(
                 partition1, this.dividendMaturityTime, this.dividendExpiryTime, this.erc20Token.address, issuanceAmount, 4, [], {from: controller});

             this.divIndexPartition1Checkpoint4WithERC20 = createDivERC20Partition1.logs[0].args._dividendIndex;

             // Check the erc20 payment token was transferred to appropriate users
             assert.equal(await this.erc20Token.balanceOf(controller), 0);
             assert.equal(await this.erc20Token.balanceOf(randomTokenHolder), 0);
             assert.equal(await this.erc20Token.balanceOf(this.dividendModule.address), issuanceAmount);

             // Push erc20 payment token to randomtokenholder
             await this.dividendModule.pushDividendPaymentToAddresses(this.divIndexPartition1Checkpoint4WithERC20, [randomTokenHolder], {from: controller});
             assert.equal(await this.erc20Token.balanceOf(randomTokenHolder), (issuanceAmount / 2)  * 0.95);
             assert.equal(await this.erc20Token.balanceOf(this.dividendModule.address), (issuanceAmount / 2) * 1.05);

             // Withdraw tax withholding in erc20 token left over by the randomtokenholder and to treasury
             await this.dividendModule.withdrawWithholding(this.divIndexPartition1Checkpoint4WithERC20);
             assert.equal(await this.erc20Token.balanceOf(this.dividendModule.address), (issuanceAmount / 2));
             assert.equal(await this.erc20Token.balanceOf(treasuryWallet), (issuanceAmount / 2) * 0.05);

             // Withholding has been tested, lets leave it out for other tests
             await this.dividendModule.setWithholding([randomTokenHolder], [0], {from: controller});
         });

         it('can create a scheduled checkpoint and move to checkpoint 5 and 6', async function () {
             let name = defaultSchedule;
             let startTime = (await currentTime() + 1000);
             let frequency = 24*60*60; // Should make a checkpoint once per day
             let endTime = (await currentTime()) + (60 * 60 * 120); // Should stop after 120 hours (5 days)
             const SECONDS = 0;
             let frequencyUnit = SECONDS;
             let addSchedule = await this.checkpointModule.addSchedule(
                 name,
                 startTime,
                 endTime,
                 frequency,
                 frequencyUnit,
                 {from: owner}
             );
             assert.equal((addSchedule.logs[0].args._startTime).toString(), startTime.toString());
             assert.equal((addSchedule.logs[0].args._endTime).toString(), endTime.toString());
             assert.equal((addSchedule.logs[0].args._frequency).toString(), frequency.toString());
             assert.equal(addSchedule.logs[0].args._frequencyUnit, 0);

             // Make sure get schedule working normally
             const defaultScheduleDetails = await this.checkpointModule.getSchedule(defaultSchedule);
             assert.equal(defaultScheduleDetails.name.toString(), defaultSchedule);
             assert.equal(defaultScheduleDetails.startTime.toString(), startTime.toString());
             assert.equal(defaultScheduleDetails.endTime.toString(), endTime.toString());
             assert.equal(defaultScheduleDetails.frequency.toString(), frequency.toString());

             const oldCheckpointId = await this.checkpointModule.currentCheckpointId();
             await advanceTimeAndBlock(60 * 60 * 25); // Go 25 hours into the future

             assert.equal(oldCheckpointId, 4); // No transaction has updated checkpoint time yet

             // Make the first transfer of checkpoint 5 ( Will be logged after checkpoint 5 created)
             await this.multiIssuanceModule.issueByPartitionMultiple(
                 [defaultExemption, defaultExemption, defaultExemption],
                 [partition1, partition1, partition2],
                 [tokenHolder, randomTokenHolder, randomTokenHolder2],
                 [issuanceAmount, issuanceAmount, issuanceAmount * 2],
                 VALID_CERTIFICATE,
                 {from: controller});

             const newCheckpointId5 = await this.checkpointModule.currentCheckpointId();
             assert.equal(newCheckpointId5, 5);

             const tokenholderPartitionedValueAt4x = await this.checkpointModule.getValueAt(partition1, tokenHolder, 4);
             assert.equal(tokenholderPartitionedValueAt4x, issuanceAmount * 4);
             const tokenholderPartitionedValueAt5x = await this.checkpointModule.getValueAt(partition1, tokenHolder, 5);
             assert.equal(tokenholderPartitionedValueAt5x, issuanceAmount * 5);
             const tokenholderPartitionedValueAt6x = await this.checkpointModule.getValueAt(partition1, tokenHolder, 6);
             assert.equal(tokenholderPartitionedValueAt6x, issuanceAmount * 5);

             await advanceTimeAndBlock(60 * 60 * 24); // Go 24 hours into the future

             // Make the first transfer of checkpoint 6 (will be logged after checkpoint 6 created)
             await this.multiIssuanceModule.issueByPartitionMultiple(
                 [defaultExemption, defaultExemption, defaultExemption],
                 [partition1, partition1, partition2],
                 [tokenHolder, randomTokenHolder, randomTokenHolder2],
                 [issuanceAmount, issuanceAmount, issuanceAmount * 2],
                 VALID_CERTIFICATE,
                 {from: controller});

             const newCheckpointId6 = await this.checkpointModule.currentCheckpointId();
             assert.equal(newCheckpointId6, 6);

             const tokenholderPartitionedValueAt4 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 4);
             assert.equal(tokenholderPartitionedValueAt4, issuanceAmount * 4);
             const tokenholderPartitionedValueAt5 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 5);
             assert.equal(tokenholderPartitionedValueAt5, issuanceAmount * 5);
             const tokenholderPartitionedValueAt6 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 6);
             assert.equal(tokenholderPartitionedValueAt6, issuanceAmount * 5);
             const tokenholderPartitionedValueAt7 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 7);
             assert.equal(tokenholderPartitionedValueAt7, issuanceAmount * 6);

             const randomTokenholderPartitionedValueAt4 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 4);
             assert.equal(randomTokenholderPartitionedValueAt4, issuanceAmount * 4);
             const randomTokenholderPartitionedValueAt5 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 5);
             assert.equal(randomTokenholderPartitionedValueAt5, issuanceAmount * 5);
             const randomTokenholderPartitionedValueAt6 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 6);
             assert.equal(randomTokenholderPartitionedValueAt6, issuanceAmount * 5);
             const randomTokenholderPartitionedValueAt7 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 7);
             assert.equal(randomTokenholderPartitionedValueAt7, issuanceAmount * 6);

             const randomTokenholder2PartitionedValueAt4 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 4);
             assert.equal(randomTokenholder2PartitionedValueAt4, issuanceAmount * 8);
             const randomTokenholder2PartitionedValueAt5 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 5);
             assert.equal(randomTokenholder2PartitionedValueAt5, issuanceAmount * 10);
             const randomTokenholder2PartitionedValueAt6 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 6);
             assert.equal(randomTokenholder2PartitionedValueAt6, issuanceAmount * 10);
             const randomTokenholder2PartitionedValueAt7 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 7);
             assert.equal(randomTokenholder2PartitionedValueAt7, issuanceAmount * 12);

             // Partition supply
             const partition1ValueAt4 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 4);
             assert.equal(partition1ValueAt4, issuanceAmount * 8);
             const partition1ValueAt5 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 5);
             assert.equal(partition1ValueAt5, issuanceAmount * 8);
             const partition1ValueAt6 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 6);
             assert.equal(partition1ValueAt6, issuanceAmount * 10);
             const partition1ValueAt7 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 7);
             assert.equal(partition1ValueAt7, issuanceAmount * 10);

             const partition2ValueAt4 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 4);
             assert.equal(partition2ValueAt4, issuanceAmount * 8);
             const partition2ValueAt5 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 5);
             assert.equal(partition2ValueAt5, issuanceAmount * 8);
             const partition2ValueAt6 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 6);
             assert.equal(partition2ValueAt6, issuanceAmount * 10);
             const partition2ValueAt7 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 7);
             assert.equal(partition2ValueAt7, issuanceAmount * 10);

             // Total supply
             const totalSupplyValueAt4 = await this.checkpointModule.getTotalSupplyAt(4);
             assert.equal(totalSupplyValueAt4, issuanceAmount * 16);
             const totalSupplyValueAt5 = await this.checkpointModule.getTotalSupplyAt(5);
             assert.equal(totalSupplyValueAt5, issuanceAmount * 16);
             const totalSupplyValueAt6 = await this.checkpointModule.getTotalSupplyAt(6);
             assert.equal(totalSupplyValueAt6, issuanceAmount * 20);
             const totalSupplyValueAt7 = await this.checkpointModule.getTotalSupplyAt(7);
             assert.equal(totalSupplyValueAt7, issuanceAmount * 20);
         });

         it(' distributes an off chain dividend payment on the sixth checkpoint', async function () {
             // Can create a dividend off chain
             const createDivERC20Partition1 = await this.dividendModule.createDividendWithCheckpointAndExclusions(
                 partition1, this.dividendMaturityTime, this.dividendExpiryTime, '0x0000000000000000000000000000000000000000', issuanceAmount, 6, [], {from: controller});

             this.divIndexPartition1Checkpoint6WithERC20 = createDivERC20Partition1.logs[0].args._dividendIndex;

             const divProgress = await this.dividendModule.getDividendProgress(this.divIndexPartition1Checkpoint6WithERC20);
             divProgress.resultClaimed.map((x) => {
                 assert.equal(x, false)
             });

             // Around here the payment gets made off chain

             // "Push" the payment to the token holder after a payment has been made off chain
             await this.dividendModule.pushDividendPaymentToAddresses(this.divIndexPartition1Checkpoint6WithERC20, [randomTokenHolder], {from: controller});

             // RandomTokenHolder was paid, but token holder was not paid yet. Check that rth is claimed.
             const divProgress2 = await this.dividendModule.getDividendProgress(this.divIndexPartition1Checkpoint6WithERC20);
             assert.equal(divProgress2.resultClaimed[0], false)
             assert.equal(divProgress2.resultClaimed[1], true)
         });

         it('can create a scheduled checkpoint 7', async function () {
             await advanceTimeAndBlock(60 * 60 * 24); // Go 24 hours into the future

             // Update the checkpoint manually instead of relying on a user transfer
             await this.checkpointModule.updateAll({from: controller});

             const newCheckpointId7 = await this.checkpointModule.currentCheckpointId();
             assert.equal(newCheckpointId7, 7);

             const tokenholderPartitionedValueAt4 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 4);
             assert.equal(tokenholderPartitionedValueAt4, issuanceAmount * 4);
             const tokenholderPartitionedValueAt5 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 5);
             assert.equal(tokenholderPartitionedValueAt5, issuanceAmount * 5);
             const tokenholderPartitionedValueAt6 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 6);
             assert.equal(tokenholderPartitionedValueAt6, issuanceAmount * 5);
             const tokenholderPartitionedValueAt7 = await this.checkpointModule.getValueAt(partition1, tokenHolder, 7);
             assert.equal(tokenholderPartitionedValueAt7, issuanceAmount * 6);

             const randomTokenholderPartitionedValueAt4 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 4);
             assert.equal(randomTokenholderPartitionedValueAt4, issuanceAmount * 4);
             const randomTokenholderPartitionedValueAt5 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 5);
             assert.equal(randomTokenholderPartitionedValueAt5, issuanceAmount * 5);
             const randomTokenholderPartitionedValueAt6 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 6);
             assert.equal(randomTokenholderPartitionedValueAt6, issuanceAmount * 5);
             const randomTokenholderPartitionedValueAt7 = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 7);
             assert.equal(randomTokenholderPartitionedValueAt7, issuanceAmount * 6);

             const randomTokenholder2PartitionedValueAt4 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 4);
             assert.equal(randomTokenholder2PartitionedValueAt4, issuanceAmount * 8);
             const randomTokenholder2PartitionedValueAt5 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 5);
             assert.equal(randomTokenholder2PartitionedValueAt5, issuanceAmount * 10);
             const randomTokenholder2PartitionedValueAt6 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 6);
             assert.equal(randomTokenholder2PartitionedValueAt6, issuanceAmount * 10);
             const randomTokenholder2PartitionedValueAt7 = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 7);
             assert.equal(randomTokenholder2PartitionedValueAt7, issuanceAmount * 12);

             // Partition supply
             const partition1ValueAt4 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 4);
             assert.equal(partition1ValueAt4, issuanceAmount * 8);
             const partition1ValueAt5 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 5);
             assert.equal(partition1ValueAt5, issuanceAmount * 8);
             const partition1ValueAt6 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 6);
             assert.equal(partition1ValueAt6, issuanceAmount * 10);
             const partition1ValueAt7 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 7);
             assert.equal(partition1ValueAt7, issuanceAmount * 12);

             const partition2ValueAt4 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 4);
             assert.equal(partition2ValueAt4, issuanceAmount * 8);
             const partition2ValueAt5 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 5);
             assert.equal(partition2ValueAt5, issuanceAmount * 8);
             const partition2ValueAt6 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 6);
             assert.equal(partition2ValueAt6, issuanceAmount * 10);
             const partition2ValueAt7 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 7);
             assert.equal(partition2ValueAt7, issuanceAmount * 12);

             // Total supply
             const totalSupplyValueAt4 = await this.checkpointModule.getTotalSupplyAt(4);
             assert.equal(totalSupplyValueAt4, issuanceAmount * 16);
             const totalSupplyValueAt5 = await this.checkpointModule.getTotalSupplyAt(5);
             assert.equal(totalSupplyValueAt5, issuanceAmount * 16);
             const totalSupplyValueAt6 = await this.checkpointModule.getTotalSupplyAt(6);
             assert.equal(totalSupplyValueAt6, issuanceAmount * 20);
             const totalSupplyValueAt7 = await this.checkpointModule.getTotalSupplyAt(7);
             assert.equal(totalSupplyValueAt7, issuanceAmount * 24);
         });

         it('can create a scheduled checkpoint 8 specific to the default schedule', async function () {
             await advanceTimeAndBlock(60 * 60 * 24); // Go 24 hours into the future

             // Update the checkpoint manually instead of relying on a user transfer
             await this.checkpointModule.update(defaultSchedule, {from: controller});

             const newCheckpointId8 = await this.checkpointModule.currentCheckpointId();
             assert.equal(newCheckpointId8, 8);
         });

         it('can create a scheduled checkpoint 9 after changing the end time to indefinite', async function () {
             await this.checkpointModule.modifyScheduleEndTime(defaultSchedule, 0, {from: controller});

             await advanceTimeAndBlock(60 * 60 * 24); // Go 24 hours into the future

             // Update the checkpoint manually instead of relying on a user transfer
             await this.checkpointModule.updateAll({from: controller});

             const newCheckpointId9 = await this.checkpointModule.currentCheckpointId();
             assert.equal(newCheckpointId9, 9);
         });

         it('can issue some controller tokens, create checkpoint 10', async function () {
             await this.multiIssuanceModule.issueByPartitionMultiple(
                 [defaultExemption, defaultExemption, defaultExemption],
                 [partition1, partition2, partition2],
                 [controller, controller, recipient],
                 [issuanceAmount, issuanceAmount, issuanceAmount],
                 VALID_CERTIFICATE,
                 {from: controller});

             await advanceTimeAndBlock(60 * 60 * 24); // Go 24 hours into the future

             // Update the checkpoint manually instead of relying on a user transfer
             await this.checkpointModule.updateAll({from: controller});

             const newCheckpointId10 = await this.checkpointModule.currentCheckpointId();
             assert.equal(newCheckpointId10, 10);

         });

         it('can create a partition1 dividend', async function () {
             const partition1ValueAt10 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition1, 10);
             const partition1SupplyValueAt10Value = issuanceAmount * 13;
             assert.equal(partition1ValueAt10, partition1SupplyValueAt10Value);

             assert.equal(await this.token.balanceOfByPartition(partition1, controller), issuanceAmount);
             assert.equal(await this.token.balanceOfByPartition(partition1, this.dividendModule.address), 0);

             const createDivPartition1 = await this.dividendModule.createDividendWithCheckpointAndExclusions(
                 partition1, this.dividendMaturityTime, this.dividendExpiryTime, this.newcontractAddress, issuanceAmount, 10, [], {from: controller});

             this.divIndexPartition1Checkpoint10 = createDivPartition1.logs[0].args._dividendIndex;

             // Tokens were moved to the module
             assert.equal(await this.token.balanceOfByPartition(partition1, controller), 0);
             assert.equal(await this.token.balanceOfByPartition(partition1, this.dividendModule.address), issuanceAmount);

             // Get back dividends information and check all dividends code
             const checkpointData = await this.dividendModule.getCheckpointData(partition1, 10);
             const holdersPartition1 = [tokenHolder, randomTokenHolder, this.dividendModule.address];
             assert.equal(checkpointData.investors.toString(), holdersPartition1.toString());
             const issuanceAmounts = [issuanceAmount * 6, issuanceAmount * 6, issuanceAmount];
             checkpointData.balances.map((x, index) => {
                 assert.equal(x.toNumber(), issuanceAmounts[index])
             });

             // Get data about a dividend index in question
             const divProgress = await this.dividendModule.getDividendProgress(this.divIndexPartition1Checkpoint10);
             assert.equal(divProgress.investors.toString(), holdersPartition1.toString());
             divProgress.resultClaimed.map((x) => {
                 assert.equal(x, false)
             });
             divProgress.resultExcluded.map((x, index) => {
                 assert.equal(x, holdersPartition1[index] == this.dividendModule.address ? true : false)
             });
             divProgress.resultWithheld.map((x) => {
                 assert.equal(x, 0)
             });
             divProgress.resultAmount.map((x, index) => {
                 assert.equal(x, holdersPartition1[index] == this.dividendModule.address ? 0 :
                     Math.floor(((issuanceAmounts[index] / (partition1SupplyValueAt10Value - issuanceAmount)) * issuanceAmount), 0)
                 )
             });
             divProgress.resultBalance.map((x, index) => {
                 assert.equal(x,
                     issuanceAmounts[index]
                 )
             });

             // Is dividend claimed?
             await holdersPartition1.map(async x => {
                 assert.equal(await this.dividendModule.isClaimed(x, this.divIndexPartition1Checkpoint10), false)
             })
         });

         it('can create a partition2 dividend', async function () {
             const partition2ValueAt10 = await this.checkpointModule.getPartitionedTotalSupplyAt(partition2, 10);
             const partition2SupplyValueAt10Value = issuanceAmount * 14;
             assert.equal(partition2ValueAt10, partition2SupplyValueAt10Value);

             assert.equal(await this.token.balanceOfByPartition(partition2, controller), issuanceAmount);
             assert.equal(await this.token.balanceOfByPartition(partition2, this.dividendModule.address), 0);

             const createDivPartition2 = await this.dividendModule.createDividendWithCheckpointAndExclusions(
                 partition2, this.dividendMaturityTime, this.dividendExpiryTime, this.newcontractAddress, issuanceAmount, 10, [], {from: controller});

             this.divIndexPartition2Checkpoint10 = createDivPartition2.logs[0].args._dividendIndex;

             // Tokens were moved to the module
             assert.equal(await this.token.balanceOfByPartition(partition2, controller), 0);
             assert.equal(await this.token.balanceOfByPartition(partition2, this.dividendModule.address), issuanceAmount);


             // Get back dividends information and check all dividends code
             const checkpointData = await this.dividendModule.getCheckpointData(partition2, 10);
             const holdersPartition2 = [recipient,  randomTokenHolder2, this.dividendModule.address];
             assert.equal(checkpointData.investors.toString(), holdersPartition2.toString());
             const issuanceAmounts = [issuanceAmount, issuanceAmount * 12, issuanceAmount];
             checkpointData.balances.map((x, index) => {
                 assert.equal(x.toNumber(), issuanceAmounts[index])
             });

             // Get data about a dividend index in question
             const divProgress = await this.dividendModule.getDividendProgress(this.divIndexPartition2Checkpoint10);
             assert.equal(divProgress.investors.toString(), holdersPartition2.toString());
             divProgress.resultClaimed.map((x) => {
                 assert.equal(x, false)
             });
             divProgress.resultExcluded.map((x, index) => {
                 assert.equal(x, holdersPartition2[index] == this.dividendModule.address ? true : false)
             });
             divProgress.resultWithheld.map((x) => {
                 assert.equal(x, 0)
             });
             divProgress.resultAmount.map((x, index) => {
                 assert.equal(x, holdersPartition2[index] == this.dividendModule.address ? 0 :
                     Math.floor(((issuanceAmounts[index] / (partition2SupplyValueAt10Value - issuanceAmount)) * issuanceAmount), 0)
                 )
             });
             divProgress.resultBalance.map((x, index) => {
                 assert.equal(x,
                     issuanceAmounts[index]
                 )
             });

             // Is dividend claimed?
             await holdersPartition2.map(async x => {
                 assert.equal(await this.dividendModule.isClaimed(x, this.divIndexPartition2Checkpoint10), false)
             })
         });

         it('can check info about the active dividends', async function () {
             // Get data about all dividends
             const divInfo = await this.dividendModule.getDividendsData();
             divInfo.maturitys.map((x) => {
                 assert.equal(x.toNumber(), this.dividendMaturityTime)
             });
             divInfo.amounts.map((x) => {
                 assert.equal(x.toNumber(), issuanceAmount)
             });
             divInfo.claimedAmounts.map((x, index) => {
                 if(index == 0 || index == 1){
                     assert.equal(x.toNumber(), issuanceAmount / 2);
                 } else {
                     assert.equal(x.toNumber(), 0)
                 }
             });
             assert.equal(divInfo.partitions[0], partition1);
             assert.equal(divInfo.partitions[1], partition1);
             assert.equal(divInfo.partitions[2], partition1);
             assert.equal(divInfo.partitions[3], partition2);

         });

         it('can push or pull the dividend out to investors once maturity is reached for partition 1', async function () {
             const partition1SupplyValueAt10Value = issuanceAmount * 13;

             await advanceTimeAndBlock(1000); // Move 1000 seconds into the future where dividends will reach maturity

             await this.dividendModule.pullDividendPayment(this.divIndexPartition1Checkpoint10, {from: tokenHolder});
             await this.dividendModule.pushDividendPaymentToAddresses(this.divIndexPartition1Checkpoint10, [randomTokenHolder], {from: controller});

             // Check token holder and random token holder for the next checkpoint value (11)
             const tokenholderPartitionedValueAfterDividend = await this.checkpointModule.getValueAt(partition1, tokenHolder, 11);
             assert.equal(tokenholderPartitionedValueAfterDividend, (issuanceAmount * 6) +
                 Math.floor(((issuanceAmount * 6)/(partition1SupplyValueAt10Value - issuanceAmount)) * issuanceAmount), 0); // Now dividend added
             const randomTokenholderPartitionedValueAfterDividend = await this.checkpointModule.getValueAt(partition1, randomTokenHolder, 11);
             assert.equal(randomTokenholderPartitionedValueAfterDividend, (issuanceAmount * 6) +
                 Math.floor(((issuanceAmount * 6)/(partition1SupplyValueAt10Value - issuanceAmount)) * issuanceAmount), 0); // Now dividend added

             assert.equal(await this.dividendModule.isClaimed(tokenHolder, this.divIndexPartition1Checkpoint10), true)
             assert.equal(await this.dividendModule.isClaimed(randomTokenHolder, this.divIndexPartition1Checkpoint10), true)
         });

         it('can push the dividend out to investors once maturity is reached for partition 2', async function () {
             this.partition2SupplyValueAt10Value = issuanceAmount * 14;

            await this.dividendModule.pushDividendPayment(this.divIndexPartition2Checkpoint10, 1, 1, {from: controller}); // Push to randomtokenholder2 index
             const randomTokenholder2PartitionedValueAfterDividend = await this.checkpointModule.getValueAt(partition2, randomTokenHolder2, 11);
             assert.equal(randomTokenholder2PartitionedValueAfterDividend, (issuanceAmount * 12) +
                 Math.floor(((issuanceAmount * 12)/(this.partition2SupplyValueAt10Value - issuanceAmount)) * issuanceAmount), 0); // Now dividend added

            assert.equal(await this.dividendModule.isClaimed(randomTokenHolder2, this.divIndexPartition2Checkpoint10), true)
            assert.equal(await this.dividendModule.isClaimed(recipient, this.divIndexPartition2Checkpoint10), false)
            assert.equal(await this.dividendModule.isClaimed(controller, this.divIndexPartition2Checkpoint10), false)
            assert.equal(await this.dividendModule.isClaimed(this.dividendModule.address, this.divIndexPartition2Checkpoint10), false)
         });

         it('should revert without proper permissions (withControllerPermission)', async function () {
             await expectRevert.unspecified(this.dividendModule.createDividendWithCheckpointAndExclusions(
                 partition1, await currentTime(), (await currentTime())+10000, this.newcontractAddress, issuanceAmount, 9, [], {from: unknown}));

             await expectRevert.unspecified(this.dividendModule
                 .pushDividendPaymentToAddresses(this.divIndexPartition1Checkpoint10, [controller], {from: unknown}));

             await expectRevert.unspecified(this.dividendModule.changeWallet(controller, {from: unknown}));
          });

         it('should successfully modify dividend dates and then revert as it is expired)', async function () {
            await this.dividendModule.updateDividendDates(this.divIndexPartition2Checkpoint10, await currentTime(), await currentTime()+1);

             await advanceTimeAndBlock(2); // Move 2 seconds into the future where dividend will now expire

             await expectRevert.unspecified(this.dividendModule
                 .pushDividendPaymentToAddresses(this.divIndexPartition2Checkpoint10, [controller], {from: controller}));

             // Dividend expired, we can now withdraw balance that was not distributed (recipient did not claim dividend)
             assert.equal(await this.token.balanceOfByPartition(partition2, treasuryWallet), 0);
             await this.dividendModule.reclaimDividend(this.divIndexPartition2Checkpoint10, {from: controller});
             const treasuryValueAfterReclaim= await this.token.balanceOfByPartition(partition2, treasuryWallet)
             assert.equal(treasuryValueAfterReclaim,
                 Math.floor(((issuanceAmount /(this.partition2SupplyValueAt10Value - issuanceAmount)) * issuanceAmount), 0) +1 );
          });


         it('can create checkpoint 11', async function () {
             await advanceTimeAndBlock(60 * 60 * 24); // Go 24 hours into the future

             // Update the checkpoint manually instead of relying on a user transfer
             await this.checkpointModule.updateAll({from: controller});

             const newCheckpointId11 = await this.checkpointModule.currentCheckpointId();
             assert.equal(newCheckpointId11, 11);
         });

         it('can remove the scheduled checkpoint, such that there will be no checkpoint 12 created by updating', async function () {
             await this.checkpointModule.removeSchedule(defaultSchedule, {from: controller});

             await advanceTimeAndBlock(60 * 60 * 24); // Go 24 hours into the future

             // Update the checkpoint manually - but there will be no change with schedules
             await this.checkpointModule.updateAll({from: controller});

             const newCheckpointIdStill11 = await this.checkpointModule.currentCheckpointId();
             assert.equal(newCheckpointIdStill11, 11);
         });
     });
    });
  });
});
