import {StableCoin, UserStableCoinBalance} from '../generated/schema'
import {
  Transfer,
  ERC20HoldableToken as ERC20HoldableTokenContract
} from "../generated/templates/ERC20HoldableToken/ERC20HoldableToken";

import {ERC20HoldableToken} from "../generated/templates";

export function handleTransfer(event: Transfer): void {
  // Mint
  if(event.params.from.toHexString() === '0x0000000000000000000000000000000000000000') {
    const stableCoinBalanceTo = UserStableCoinBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if(stableCoinBalanceTo !== null){
      stableCoinBalanceTo.amount = stableCoinBalanceTo.amount.plus(event.params.value);
    }
  }
  // Burn
  else if(event.params.to.toHexString() === '0x0000000000000000000000000000000000000000') {
    const stableCoinBalanceFrom = UserStableCoinBalance.load(event.address.toHexString().concat("-").concat(event.params.from.toHexString()));
    if(stableCoinBalanceFrom !== null){
      stableCoinBalanceFrom.amount = stableCoinBalanceFrom.amount.minus(event.params.value);
    }
  }
  // Or It is a normal transfer
  else {
    const stableCoinBalanceFrom = UserStableCoinBalance.load(event.address.toHexString().concat("-").concat(event.params.from.toHexString()));
    if(stableCoinBalanceFrom !== null){
      stableCoinBalanceFrom.amount = stableCoinBalanceFrom.amount.minus(event.params.value);
    }

    const stableCoinBalanceTo = UserStableCoinBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if(stableCoinBalanceTo !== null){
      stableCoinBalanceTo.amount = stableCoinBalanceTo.amount.plus(event.params.value);
    }
  }


}
