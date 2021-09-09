import {
  PartitionBalance,
  StableCoin,
  SCTransactionHistory,
  UserStableCoinBalance,
  UserWallet
} from '../generated/schema'
import {
  Transfer,
  ERC20HoldableToken as ERC20HoldableTokenContract
} from "../generated/templates/ERC20HoldableToken/ERC20HoldableToken";

import {ERC20HoldableToken} from "../generated/templates";
import {log} from "@graphprotocol/graph-ts/index";

export function handleTransfer(event: Transfer): void {
  let fromWallet = UserWallet.load(event.params.from.toHexString());
  let toWallet = UserWallet.load(event.params.to.toHexString());
  // Mint
  if(event.params.from.toHexString() == '0x0000000000000000000000000000000000000000') {

    log.info('entering mint now', []);
    const stableCoinBalanceTo = UserStableCoinBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if(stableCoinBalanceTo !== null){
      stableCoinBalanceTo.amount = stableCoinBalanceTo.amount.plus(event.params.value);
      stableCoinBalanceTo.save();

      const txHistory = new SCTransactionHistory(event.transaction.hash.toHexString());
      txHistory.from = event.params.from.toHexString();
      txHistory.to = event.params.to.toHexString();
      txHistory.balance = stableCoinBalanceTo.amount;
      txHistory.amount = event.params.value;
      txHistory.transactionReferenceType = "Mint";
      txHistory.timestamp = event.block.timestamp;
      txHistory.stableCoin = stableCoinBalanceTo.stableCoin;
      txHistory.save();

      toWallet.scTransactionHistories = toWallet.scTransactionHistories.concat([txHistory.id]);
      toWallet.save();

    }
  }
  // Burn
  else if(event.params.to.toHexString() == '0x0000000000000000000000000000000000000000') {

    log.info('entering burn now', []);
    const stableCoinBalanceFrom = UserStableCoinBalance.load(event.address.toHexString().concat("-").concat(event.params.from.toHexString()));
    if(stableCoinBalanceFrom !== null){
      stableCoinBalanceFrom.amount = stableCoinBalanceFrom.amount.minus(event.params.value);
      stableCoinBalanceFrom.save();

      const txHistory = new SCTransactionHistory(event.transaction.hash.toHexString());
      txHistory.from = event.params.from.toHexString();
      txHistory.to = event.params.to.toHexString();
      txHistory.balance = stableCoinBalanceFrom.amount;
      txHistory.amount = event.params.value;
      txHistory.transactionReferenceType = "Burn";
      txHistory.timestamp = event.block.timestamp;
      txHistory.stableCoin = stableCoinBalanceFrom.stableCoin;
      txHistory.save();

      fromWallet.scTransactionHistories = fromWallet.scTransactionHistories.concat([txHistory.id]);
      fromWallet.save();

    }
  }
  // Or It is a normal transfer
  else {
    const stableCoinBalanceFrom = UserStableCoinBalance.load(event.address.toHexString().concat("-").concat(event.params.from.toHexString()));
    if(stableCoinBalanceFrom !== null){
      stableCoinBalanceFrom.amount = stableCoinBalanceFrom.amount.minus(event.params.value);
      stableCoinBalanceFrom.save();

      const txHistory = new SCTransactionHistory(event.transaction.hash.toHexString());
      txHistory.from = event.params.from.toHexString();
      txHistory.to = event.params.to.toHexString();
      txHistory.balance = stableCoinBalanceFrom.amount;
      txHistory.amount = event.params.value;
      txHistory.transactionReferenceType = "Transfer";
      txHistory.timestamp = event.block.timestamp;
      txHistory.stableCoin = stableCoinBalanceFrom.stableCoin;
      txHistory.save();

      fromWallet.scTransactionHistories = fromWallet.scTransactionHistories.concat([txHistory.id]);
      fromWallet.save();

    }

    const stableCoinBalanceTo = UserStableCoinBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if(stableCoinBalanceTo !== null){
      stableCoinBalanceTo.amount = stableCoinBalanceTo.amount.plus(event.params.value);
      stableCoinBalanceTo.save();

      const txHistory = new SCTransactionHistory(event.transaction.hash.toHexString());
      txHistory.from = event.params.from.toHexString();
      txHistory.to = event.params.to.toHexString();
      txHistory.balance = stableCoinBalanceTo.amount;
      txHistory.amount = event.params.value;
      txHistory.transactionReferenceType = "Transfer";
      txHistory.timestamp = event.block.timestamp;
      txHistory.stableCoin = stableCoinBalanceTo.stableCoin;
      txHistory.save();

      toWallet.scTransactionHistories = toWallet.scTransactionHistories.concat([txHistory.id]);
      toWallet.save();
    }
  }


}
