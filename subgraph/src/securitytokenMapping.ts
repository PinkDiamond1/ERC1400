import {PartitionBalance, SecurityToken, UserSecurityTokenBalance} from '../generated/schema'
import {
  TransferByPartition,
  ERC1400 as ERC1400Contract
} from "../generated/templates/ERC1400/ERC1400";

import {ERC20HoldableToken} from "../generated/templates";

export function handleTransferByPartition(event: TransferByPartition): void {
  const partitionIdentifier = event.address.toHexString().concat("-").concat(event.params.fromPartition.toHexString())
  // Mint
  if(event.params.from.toHexString() === '0x0000000000000000000000000000000000000000') {
    const securityTokenBalanceTo = UserSecurityTokenBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if(securityTokenBalanceTo !== null){
      for (let i = 0; i < securityTokenBalanceTo.partitions.length; i += 1) {
        if (securityTokenBalanceTo.partitions.includes(partitionIdentifier)) {
            const partitionBalance = PartitionBalance.load(partitionIdentifier);
            partitionBalance.amount = partitionBalance.amount.plus(event.params.value);
            partitionBalance.save();
        } else {
          const partitionBalance = new PartitionBalance(partitionIdentifier);
          partitionBalance.amount = event.params.value;
          partitionBalance.save();
          securityTokenBalanceTo.partitions.push(partitionBalance.id);
          securityTokenBalanceTo.save();
        }
      }
      securityTokenBalanceTo.save();
    }
  }
  // Burn
  else if(event.params.to.toHexString() === '0x0000000000000000000000000000000000000000') {
    const securityTokenBalanceFrom = UserSecurityTokenBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if(securityTokenBalanceFrom !== null){
      for (let i = 0; i < securityTokenBalanceFrom.partitions.length; i += 1) {
        if (securityTokenBalanceFrom.partitions.includes(partitionIdentifier)) {
          const partitionBalance = PartitionBalance.load(partitionIdentifier);
          partitionBalance.amount = partitionBalance.amount.minus(event.params.value);
          partitionBalance.save();
        } else {
          const partitionBalance = new PartitionBalance(partitionIdentifier);
          partitionBalance.amount = event.params.value;
          partitionBalance.save();
          securityTokenBalanceFrom.partitions.push(partitionBalance.id);
          securityTokenBalanceFrom.save();
        }
      }
      securityTokenBalanceFrom.save();
    }
  }
  // Or It is a normal transfer
  else {
    const securityTokenBalanceFrom = UserSecurityTokenBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if(securityTokenBalanceFrom !== null){
      for (let i = 0; i < securityTokenBalanceFrom.partitions.length; i += 1) {
        if (securityTokenBalanceFrom.partitions.includes(partitionIdentifier)) {
          const partitionBalance = PartitionBalance.load(partitionIdentifier);
          partitionBalance.amount = partitionBalance.amount.minus(event.params.value);
          partitionBalance.save();
        } else {
          const partitionBalance = new PartitionBalance(partitionIdentifier);
          partitionBalance.amount = event.params.value;
          partitionBalance.save();
          securityTokenBalanceFrom.partitions.push(partitionBalance.id);
          securityTokenBalanceFrom.save();
        }
      }
      securityTokenBalanceFrom.save();
    }

    const securityTokenBalanceTo = UserSecurityTokenBalance.load(event.address.toHexString().concat("-").concat(event.params.to.toHexString()));
    if(securityTokenBalanceTo !== null){
      for (let i = 0; i < securityTokenBalanceTo.partitions.length; i += 1) {
        if (securityTokenBalanceTo.partitions.includes(partitionIdentifier)) {
          const partitionBalance = PartitionBalance.load(partitionIdentifier);
          partitionBalance.amount = partitionBalance.amount.plus(event.params.value);
          partitionBalance.save();
        } else {
          const partitionBalance = new PartitionBalance(partitionIdentifier);
          partitionBalance.amount = event.params.value;
          partitionBalance.save();
          securityTokenBalanceTo.partitions.push(partitionBalance.id);
          securityTokenBalanceTo.save();
        }
      }
      securityTokenBalanceTo.save();
    }
  }

}
