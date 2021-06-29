// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

import {
  TypedMap,
  Entity,
  Value,
  ValueKind,
  store,
  Address,
  Bytes,
  BigInt,
  BigDecimal
} from "@graphprotocol/graph-ts";

export class UserWallet extends Entity {
  constructor(id: string) {
    super();
    this.set("id", Value.fromString(id));
  }

  save(): void {
    let id = this.get("id");
    assert(id !== null, "Cannot save UserWallet entity without an ID");
    assert(
      id.kind == ValueKind.STRING,
      "Cannot save UserWallet entity with non-string ID. " +
        'Considering using .toHex() to convert the "id" to a string.'
    );
    store.set("UserWallet", id.toString(), this);
  }

  static load(id: string): UserWallet | null {
    return store.get("UserWallet", id) as UserWallet | null;
  }

  get id(): string {
    let value = this.get("id");
    return value.toString();
  }

  set id(value: string) {
    this.set("id", Value.fromString(value));
  }

  get stableCoins(): Array<string> {
    let value = this.get("stableCoins");
    return value.toStringArray();
  }

  set stableCoins(value: Array<string>) {
    this.set("stableCoins", Value.fromStringArray(value));
  }

  get securityTokens(): Array<string> {
    let value = this.get("securityTokens");
    return value.toStringArray();
  }

  set securityTokens(value: Array<string>) {
    this.set("securityTokens", Value.fromStringArray(value));
  }
}
