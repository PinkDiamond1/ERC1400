import {log} from "@graphprotocol/graph-ts/index";
import {PartitionBalance, SecurityToken, UserSecurityTokenBalance} from '../generated/schema'
import {
  TransferByPartition, IssuedByPartition,
  ERC1400 as ERC1400Contract
} from "../generated/templates/ERC1400/ERC1400";

import {ERC20HoldableToken} from "../generated/templates";

export function handleTransferByPartition(event: TransferByPartition): void {
  const partitionIdentifier = event.address.toHexString().concat("-").concat(event.params.fromPartition.toHexString()).concat("-").concat(event.params.to.toHexString());

  // Mint
  if(event.params.from.toHexString() === '0x0000000000000000000000000000000000000000') {
    const securityTokenBalanceTo = UserSecurityTokenBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if(securityTokenBalanceTo !== null){
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
      securityTokenBalanceTo.save();
    }
  }
  // Burn
  else if(event.params.to.toHexString() === '0x0000000000000000000000000000000000000000') {
    const securityTokenBalanceFrom = UserSecurityTokenBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if(securityTokenBalanceFrom !== null){
        if (securityTokenBalanceFrom.partitions.includes(partitionIdentifier)) {
          const partitionBalance = PartitionBalance.load(partitionIdentifier);
          partitionBalance.amount = partitionBalance.amount.minus(event.params.value);
          partitionBalance.save();
        } else {
          const allPartitions = securityTokenBalanceFrom.partitions;
          const partitionBalance = new PartitionBalance(partitionIdentifier);
          partitionBalance.amount = event.params.value;
          partitionBalance.save();
          allPartitions.push(partitionBalance.id);
          securityTokenBalanceFrom.partitions = allPartitions;
          securityTokenBalanceFrom.save();
        }
      securityTokenBalanceFrom.save();
    }
  }
  // Or It is a normal transfer
  else {
    const securityTokenBalanceFrom = UserSecurityTokenBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if(securityTokenBalanceFrom !== null){
        if (securityTokenBalanceFrom.partitions.includes(partitionIdentifier)) {
          const partitionBalance = PartitionBalance.load(partitionIdentifier);
          partitionBalance.amount = partitionBalance.amount.minus(event.params.value);
          partitionBalance.save();
        } else {
          const allPartitions = securityTokenBalanceFrom.partitions;
          const partitionBalance = new PartitionBalance(partitionIdentifier);
          partitionBalance.amount = event.params.value;
          partitionBalance.save();
          allPartitions.push(partitionBalance.id);
          securityTokenBalanceFrom.partitions = allPartitions;
          securityTokenBalanceFrom.save();
        }
      securityTokenBalanceFrom.save();
    }

    const securityTokenBalanceTo = UserSecurityTokenBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if(securityTokenBalanceTo !== null){
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
      securityTokenBalanceTo.save();
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
      }
}
