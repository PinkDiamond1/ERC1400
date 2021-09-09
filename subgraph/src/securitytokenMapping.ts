import {log} from "@graphprotocol/graph-ts/index";
import {
  PartitionBalance,
  SecurityToken,
  STTransactionHistory,
  UserSecurityTokenBalance,
  UserWallet
} from '../generated/schema'
import {
  TransferByPartition, IssuedByPartition,
  ERC1400 as ERC1400Contract
} from "../generated/templates/ERC1400/ERC1400";

import {ERC20HoldableToken} from "../generated/templates";

export function handleTransferByPartition(event: TransferByPartition): void {
  const partitionIdentifierFrom = event.address.toHexString().concat("-").concat(event.params.fromPartition.toHexString()).concat("-").concat(event.params.from.toHexString());
  const partitionIdentifierTo = event.address.toHexString().concat("-").concat(event.params.fromPartition.toHexString()).concat("-").concat(event.params.to.toHexString());

  let fromWallet = UserWallet.load(event.params.from.toHexString());
  let toWallet = UserWallet.load(event.params.to.toHexString());

  // Mint
  if(event.params.from.toHexString() == '0x0000000000000000000000000000000000000000') {
    log.info('entering mint now', []);

    const securityTokenBalanceTo = UserSecurityTokenBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if(securityTokenBalanceTo !== null){
        if (securityTokenBalanceTo.partitions.includes(partitionIdentifierTo)) {
            const partitionBalance = PartitionBalance.load(partitionIdentifierTo);
            partitionBalance.amount = partitionBalance.amount.plus(event.params.value);
            partitionBalance.save();
        } else {
          const allPartitions = securityTokenBalanceTo.partitions;
          const partitionBalance = new PartitionBalance(partitionIdentifierTo);
          partitionBalance.amount = event.params.value;
          partitionBalance.save();
          allPartitions.push(partitionBalance.id);
          securityTokenBalanceTo.partitions = allPartitions;
          securityTokenBalanceTo.save();
        }
      securityTokenBalanceTo.save();

        const txHistory = new STTransactionHistory(event.transaction.hash.toHexString());
        txHistory.from = event.params.from.toHexString();
        txHistory.to = event.params.to.toHexString();
        txHistory.amount = event.params.value;
        const partitionBalance = PartitionBalance.load(partitionIdentifierTo);
        txHistory.balance = partitionBalance.amount;
        txHistory.transactionReferenceType = "Mint";
        txHistory.timestamp = event.block.timestamp;
        txHistory.partition = partitionIdentifierTo;
        txHistory.securityToken = securityTokenBalanceTo.securityToken;
        txHistory.save();

        toWallet.stTransactionHistories = toWallet.stTransactionHistories.concat([txHistory.id]);
        toWallet.save();
    }


  }
  // Burn
  else if(event.params.to.toHexString() == '0x0000000000000000000000000000000000000000') {

    log.info('entering burn now', []);
    const securityTokenBalanceFrom = UserSecurityTokenBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if(securityTokenBalanceFrom !== null){
        if (securityTokenBalanceFrom.partitions.includes(partitionIdentifierFrom)) {
          const partitionBalance = PartitionBalance.load(partitionIdentifierFrom);
          partitionBalance.amount = partitionBalance.amount.minus(event.params.value);
          partitionBalance.save();
        } else {
          const allPartitions = securityTokenBalanceFrom.partitions;
          const partitionBalance = new PartitionBalance(partitionIdentifierFrom);
          partitionBalance.amount = event.params.value;
          partitionBalance.save();
          allPartitions.push(partitionBalance.id);
          securityTokenBalanceFrom.partitions = allPartitions;
          securityTokenBalanceFrom.save();
        }
      securityTokenBalanceFrom.save();

      const txHistory = new STTransactionHistory(event.transaction.hash.toHexString());
      txHistory.from = event.params.from.toHexString();
      txHistory.to = event.params.to.toHexString();
      const partitionBalance = PartitionBalance.load(partitionIdentifierFrom);
      txHistory.balance = partitionBalance.amount;
      txHistory.amount = event.params.value;
      txHistory.transactionReferenceType = "Burn";
      txHistory.timestamp = event.block.timestamp;
      txHistory.partition = partitionIdentifierFrom;
      txHistory.securityToken = securityTokenBalanceFrom.securityToken;
      txHistory.save();


      fromWallet.stTransactionHistories = fromWallet.stTransactionHistories.concat([txHistory.id]);
      fromWallet.save();
    }
  }
  // Or It is a normal transfer
  else {
    const securityTokenBalanceFrom = UserSecurityTokenBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));

    if(securityTokenBalanceFrom !== null){
        if (securityTokenBalanceFrom.partitions.includes(partitionIdentifierFrom)) {
          const partitionBalance = PartitionBalance.load(partitionIdentifierFrom);
          partitionBalance.amount = partitionBalance.amount.minus(event.params.value);
          partitionBalance.save();
        } else {
          const allPartitions = securityTokenBalanceFrom.partitions;
          const partitionBalance = new PartitionBalance(partitionIdentifierFrom);
          partitionBalance.amount = event.params.value;
          partitionBalance.save();
          allPartitions.push(partitionBalance.id);
          securityTokenBalanceFrom.partitions = allPartitions;
          securityTokenBalanceFrom.save();
        }
      securityTokenBalanceFrom.save();

      const txHistory = new STTransactionHistory(event.transaction.hash.toHexString());
      txHistory.from = event.params.from.toHexString();
      txHistory.to = event.params.to.toHexString();
      txHistory.amount = event.params.value;
      const partitionBalance = PartitionBalance.load(partitionIdentifierFrom);
      txHistory.balance = partitionBalance.amount;
      txHistory.transactionReferenceType = "Transfer";
      txHistory.timestamp = event.block.timestamp;
      txHistory.partition = partitionIdentifierFrom;
      txHistory.securityToken = securityTokenBalanceFrom.securityToken;
      txHistory.save();
      fromWallet.stTransactionHistories = fromWallet.stTransactionHistories.concat([txHistory.id]);
      fromWallet.save();
    }

    const securityTokenBalanceTo = UserSecurityTokenBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if(securityTokenBalanceTo !== null){
        if (securityTokenBalanceTo.partitions.includes(partitionIdentifierTo)) {
          const partitionBalance = PartitionBalance.load(partitionIdentifierTo);
          partitionBalance.amount = partitionBalance.amount.plus(event.params.value);
          partitionBalance.save();
        } else {
          const allPartitions = securityTokenBalanceTo.partitions;
          const partitionBalance = new PartitionBalance(partitionIdentifierTo);
          partitionBalance.amount = event.params.value;
          partitionBalance.save();
          allPartitions.push(partitionBalance.id);
          securityTokenBalanceTo.partitions = allPartitions;
          securityTokenBalanceTo.save();
        }
      securityTokenBalanceTo.save();
      const txHistory = new STTransactionHistory(event.transaction.hash.toHexString());
      txHistory.from = event.params.from.toHexString();
      txHistory.to = event.params.to.toHexString();
      txHistory.amount = event.params.value;
      const partitionBalance = PartitionBalance.load(partitionIdentifierTo);
      txHistory.balance = partitionBalance.amount;
      txHistory.transactionReferenceType = "Transfer";
      txHistory.timestamp = event.block.timestamp;
      txHistory.partition = partitionIdentifierTo;
      txHistory.securityToken = securityTokenBalanceTo.securityToken;
      txHistory.save();
      toWallet.stTransactionHistories = toWallet.stTransactionHistories.concat([txHistory.id]);
      toWallet.save();
    }
  }}

export function handleIssuedByPartition(event: IssuedByPartition): void {
  const partitionIdentifier = event.address.toHexString().concat("-").concat(event.params.partition.toHexString()).concat("-").concat(event.params.to.toHexString());
  log.info("handleIssuedByPartition {}", [event.params.partition.toHexString()]);
  log.info("handleIssuedByPartition {}", [event.params.value.toString()]);
  log.info("handleIssuedByPartition {}", [event.params.to.toHexString()]);
    const securityTokenBalanceTo = UserSecurityTokenBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if (securityTokenBalanceTo !== null) {
        if (securityTokenBalanceTo.partitions.includes(partitionIdentifier)) {
          const partitionBalance = PartitionBalance.load(partitionIdentifier);
          partitionBalance.amount = partitionBalance.amount.plus(event.params.value);
          partitionBalance.save();
        } else {
          const allPartitions = securityTokenBalanceTo.partitions;
          const partitionBalance = new PartitionBalance(partitionIdentifier);
          partitionBalance.amount = event.params.value;
          partitionBalance.save();
          allPartitions.push(partitionBalance.id);
          securityTokenBalanceTo.partitions = allPartitions;
          securityTokenBalanceTo.save();
        }


      log.info("handling the issuance at this log", [event.params.to.toHexString()]);
      log.info("handling the issuance", [event.params.value.toString()]);
      log.info("handling the issuance", [event.block.timestamp.toString()]);
      log.info("handling the issuance", [partitionIdentifier]);
      log.info("handling the issuance", [securityTokenBalanceTo.securityToken]);
      const txHistory = new STTransactionHistory(event.transaction.hash.toHexString());
      txHistory.from = "0x0000000000000000000000000000000000000000";
      txHistory.to = event.params.to.toHexString();
      txHistory.amount = event.params.value;
      const partitionBalance = PartitionBalance.load(partitionIdentifier);
      txHistory.balance = partitionBalance.amount;
      txHistory.transactionReferenceType = "Issue";
      txHistory.timestamp = event.block.timestamp;
      txHistory.partition = partitionIdentifier;
      txHistory.securityToken = securityTokenBalanceTo.securityToken;
      txHistory.save();

      let toWallet = UserWallet.load(event.params.to.toHexString());

      toWallet.stTransactionHistories = toWallet.stTransactionHistories.concat([txHistory.id]);
      toWallet.save();


      log.info("handleIssuedByPartition {} to wallet is complete", [event.params.to.toHexString()]);
      }
}
