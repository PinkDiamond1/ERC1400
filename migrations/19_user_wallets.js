const UserWallets = artifacts.require('./UserWallets.sol');

module.exports = async function (deployer, network, accounts) {
 // if (network == "test") return; // test maintains own contracts

  await deployer.deploy(UserWallets);
  console.log('\n   > User wallets deployment: Success -->', UserWallets.address);
  const walletsInstance = await UserWallets.deployed();
  const st = "0x1234567890123456789012345678901234567890";
  const sc = "0x0123456789012345678901234567890123456789";

  // test information
  await walletsInstance.addUserWallet(accounts[0], [st], [sc]);
  console.log('user wallet added');
  console.log(await walletsInstance.getUserWallet(accounts[0]));
};
