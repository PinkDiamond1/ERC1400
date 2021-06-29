import {StableCoin, SecurityToken, UserWallet} from '../generated/schema'
import {AddUserWallet} from "../generated/UserWallets/UserWallets";

export function handleAddUserWallet(event: AddUserWallet): void {
  let userWallet = new UserWallet(event.params.user.toHexString());
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
