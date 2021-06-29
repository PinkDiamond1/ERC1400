import {UserWallet} from '../generated/schema'
import {AddUserWallet} from "../generated/UserWallets/UserWallets";

export function handleAddUserWallet(event: AddUserWallet): void {
  let userWallet = new UserWallet(event.params.user.toHexString());
  let st = event.params.securityTokens;
  let sc = event.params.stableCoins;

  let securityTokenArray = new Array<string>();
  let stableCoinArray = new Array<string>();

  for (let i = 0; i < event.params.securityTokens.length; i += 1) {
    securityTokenArray.push(st[i].toHexString());
  }

  for (let i = 0; i < event.params.stableCoins.length; i += 1) {
    stableCoinArray.push(sc[i].toHexString());
  }

  userWallet.stableCoins = stableCoinArray;
  userWallet.securityTokens = securityTokenArray;
  userWallet.save()
}
