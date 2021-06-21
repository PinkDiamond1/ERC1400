const { soliditySha3, fromAscii, hexToUtf8  } = require('web3-utils');
const { expectRevert } = require("@openzeppelin/test-helpers");

const UserWallets = artifacts.require('UserWallets');


const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const MAX_NUMBER_OF_ISSUANCES_IN_A_BATCH = 20;


contract('UserWallets', function ([owner, operator, controller, controller_alternative1, tokenHolder, recipient, stableCoin, stableCoin2, securityToken, securityToken2]) {

  describe('deployment', function () {
    beforeEach(async function () {
      this.userWallets = await UserWallets.new({from: owner})
    });

    describe('create new wallet', function () {
      it('should add a new wallet', async function () {
          await this.userWallets.addUserWallet(tokenHolder, [stableCoin, stableCoin2], [securityToken, securityToken2], {from: owner});
          console.log(await this.userWallets.getUserWallet(tokenHolder));
      });
    });
  });
});
