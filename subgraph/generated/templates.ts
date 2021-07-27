// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

import {
  Address,
  DataSourceTemplate,
  DataSourceContext
} from "@graphprotocol/graph-ts";

export class ERC20HoldableToken extends DataSourceTemplate {
  static create(address: Address): void {
    DataSourceTemplate.create("ERC20HoldableToken", [address.toHex()]);
  }

  static createWithContext(address: Address, context: DataSourceContext): void {
    DataSourceTemplate.createWithContext(
      "ERC20HoldableToken",
      [address.toHex()],
      context
    );
  }
}

export class ERC1400 extends DataSourceTemplate {
  static create(address: Address): void {
    DataSourceTemplate.create("ERC1400", [address.toHex()]);
  }

  static createWithContext(address: Address, context: DataSourceContext): void {
    DataSourceTemplate.createWithContext("ERC1400", [address.toHex()], context);
  }
}
