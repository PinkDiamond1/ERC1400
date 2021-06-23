const { soliditySha3, fromAscii, hexToUtf8  } = require('web3-utils');
const { expectRevert } = require("@openzeppelin/test-helpers");

const UserWallets = artifacts.require('UserWallets');


const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const MAX_NUMBER_OF_ISSUANCES_IN_A_BATCH = 20;

function arraysEqual(a1,a2) {
    /* WARNING: arrays must not contain {objects} or behavior may be undefined */
    console.log(JSON.stringify(a1));
    console.log(JSON.stringify(a2));
    return JSON.stringify(a1)==JSON.stringify(a2);
}


contract('UserWallets', function ([owner, operator, tokenHolder, recipient, stableCoin, stableCoin2, stableCoin3, securityToken, securityToken2, securityToken3]) {

  describe('deployment', function () {
    beforeEach(async function () {
      this.userWallets = await UserWallets.new({from: owner})
    });

    describe('create new wallet', function () {
      it('should add a new wallet', async function () {
          await this.userWallets.addUserWallet(tokenHolder,  [securityToken, securityToken2], [stableCoin, stableCoin2], {from: owner});
        const walletContents = await this.userWallets.getUserWallet(tokenHolder);
          assert.equal(true, arraysEqual(walletContents.securityTokens,[securityToken, securityToken2]));
          assert.equal(true, arraysEqual(walletContents.stableCoins,[stableCoin, stableCoin2]));
      });
    });
    describe('create new wallet, add tokens and remove the same tokens', function () {
      it('should add a new wallet, remove same tokens', async function () {
          await this.userWallets.addUserWallet(tokenHolder, [securityToken], [stableCoin], {from: owner});
          let walletContents = await this.userWallets.getUserWallet(tokenHolder);
          assert.equal(true, arraysEqual(walletContents.securityTokens, [securityToken]));
          assert.equal(true, arraysEqual(walletContents.stableCoins, [stableCoin]));

          await this.userWallets.addUserTokens(tokenHolder, [securityToken2, securityToken3], [stableCoin2, stableCoin3]);


          walletContents = await this.userWallets.getUserWallet(tokenHolder);
          assert.equal(true, arraysEqual(walletContents.stableCoins, [stableCoin, stableCoin2, stableCoin3]));
          assert.equal(true, arraysEqual(walletContents.securityTokens, [securityToken, securityToken2, securityToken3]));

          walletContents = await this.userWallets.getUserWallet(tokenHolder);
          console.log('walletContents');
          console.log(walletContents);
          assert.equal(true, await this.userWallets.checkInSecurityTokenWallet(tokenHolder, securityToken));
          assert.equal(true, await this.userWallets.checkInSecurityTokenWallet(tokenHolder, securityToken2));
          assert.equal(true, await this.userWallets.checkInSecurityTokenWallet(tokenHolder, securityToken3));
          assert.equal(true, await this.userWallets.checkInStableCoinWallet(tokenHolder, stableCoin));
          assert.equal(true, await this.userWallets.checkInStableCoinWallet(tokenHolder, stableCoin2));
          assert.equal(true, await this.userWallets.checkInStableCoinWallet(tokenHolder, stableCoin3));

          await this.userWallets.removeUserTokens(tokenHolder, [securityToken, securityToken2], [stableCoin, stableCoin2]);

          walletContents = await this.userWallets.getUserWallet(tokenHolder);
          console.log('wallet contents 2')
          console.log(walletContents);
          assert.equal(true, arraysEqual(walletContents.stableCoins, [stableCoin3]));
          assert.equal(true, arraysEqual(walletContents.securityTokens, [securityToken3]));
      });
    });
    describe('create new wallet, add tokens and remove the user', function () {
      it('should add a new wallet, then remove user', async function () {
          await this.userWallets.addUserWallet(tokenHolder, [securityToken], [stableCoin], {from: owner});
          let walletContents = await this.userWallets.getUserWallet(tokenHolder);
          assert.equal(true, arraysEqual(walletContents.securityTokens, [securityToken]));
          assert.equal(true, arraysEqual(walletContents.stableCoins, [stableCoin]));

          await this.userWallets.addUserTokens(tokenHolder, [securityToken2, securityToken3], [stableCoin2, stableCoin3]);

          const boolCheck = await this.userWallets.checkWalletsForTokens(tokenHolder, [securityToken, securityToken2, securityToken3], [stableCoin, stableCoin2, stableCoin3]);

          assert.equal(true, arraysEqual(boolCheck.stableCoins, [true, true, true]));
          assert.equal(true, arraysEqual(boolCheck.securityTokens, [true, true, true]));

          await this.userWallets.removeUserWallet(tokenHolder, {from: tokenHolder});
          walletContents = await this.userWallets.getUserWallet(tokenHolder);
          assert.equal(true, arraysEqual(walletContents.stableCoins, []));
          assert.equal(true, arraysEqual(walletContents.securityTokens, []));
      });
    });
  });
});
