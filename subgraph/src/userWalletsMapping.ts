import {StableCoin, SecurityToken, UserWallet} from '../generated/schema'
import {
  AddUserTokens,
  AddUserWallet,
  RemoveUserTokens,
  RemoveUserWallet,
  UserWallets as UserWalletsContract
} from "../generated/UserWallets/UserWallets";

export function handleAddUserWallet(event: AddUserWallet): void {
  let userWallet = UserWallet.load(event.params.user.toHexString());
  if(userWallet == null){
    userWallet = new UserWallet(event.params.user.toHexString());
  }
  let st = event.params.securityTokens;
  let sc = event.params.stableCoins;

  let securityTokenArray = new Array<string>();
  let stableCoinArray = new Array<string>();

  for (let i = 0; i < event.params.securityTokens.length; i += 1) {
    const securityTokenEntity = new SecurityToken(st[i].toHexString());
    securityTokenEntity.save();
    securityTokenArray.push(securityTokenEntity.id);
  }

  for (let i = 0; i < event.params.stableCoins.length; i += 1) {
    const stableCoinEntity = new StableCoin(st[i].toHexString());
    stableCoinEntity.save();
    stableCoinArray.push(stableCoinEntity.id);
  }

  userWallet.stableCoins = stableCoinArray;
  userWallet.securityTokens = securityTokenArray;
  userWallet.save()
}

export function handleAddUserTokens(event: AddUserTokens): void {
  let userWallet = UserWallet.load(event.params.user.toHexString());
  let st = event.params.securityTokens;
  let sc = event.params.stableCoins;

  let securityTokenArray = userWallet.securityTokens;
  let stableCoinArray = userWallet.stableCoins;

  for (let i = 0; i < event.params.securityTokens.length; i += 1) {
    const securityTokenEntity = new SecurityToken(st[i].toHexString());
    securityTokenEntity.save();
    securityTokenArray.push(securityTokenEntity.id);
  }

  for (let i = 0; i < event.params.stableCoins.length; i += 1) {
    const stableCoinEntity = new StableCoin(st[i].toHexString());
    stableCoinEntity.save();
    stableCoinArray.push(stableCoinEntity.id);
  }

  userWallet.stableCoins = stableCoinArray;
  userWallet.securityTokens = securityTokenArray;
  userWallet.save()
}

export function handleRemoveUserTokens(event: RemoveUserTokens): void {
  let contract = UserWalletsContract.bind(event.address);
  let userWallet = UserWallet.load(event.params.user.toHexString());
  let st = event.params.securityTokens;
  let sc = event.params.stableCoins;

  let arrayData = contract.getUserWallet(event.params.user);
  let contractST = arrayData.value0;
  let contractSC = arrayData.value1;

  let securityTokenArray = new Array<string>();
  let stableCoinArray = new Array<string>();

  for (let i = 0; i < contractST.length; i += 1) {
    const securityTokenEntity = new SecurityToken(contractST[i].toHexString());
    securityTokenEntity.save();
    securityTokenArray.push(securityTokenEntity.id);
  }

  for (let i = 0; i < contractSC.length; i += 1) {
    const stableCoinEntity = new StableCoin(contractSC[i].toHexString());
    stableCoinEntity.save();
    stableCoinArray.push(stableCoinEntity.id);
  }

  userWallet.stableCoins = stableCoinArray;
  userWallet.securityTokens = securityTokenArray;
  userWallet.save()
}

export function handleRemoveUserWallet(event: RemoveUserWallet): void {
  let userWallet = UserWallet.load(event.params.user.toHexString());

  userWallet.stableCoins = null;
  userWallet.securityTokens = null;
  userWallet.save()
}
