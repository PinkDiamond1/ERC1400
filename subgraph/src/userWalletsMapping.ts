import {StableCoin, SecurityToken, UserWallet} from '../generated/schema'

import {log, BigInt} from "@graphprotocol/graph-ts/index";
import {
  AddUserTokens,
  AddUserWallet,
  RemoveUserTokens,
  RemoveUserWallet,
  UserWallets as UserWalletsContract
} from "../generated/UserWallets/UserWallets";

import {ERC20HoldableToken, ERC1400} from "../generated/templates";
import {ERC20HoldableToken as ERC20HoldableTokenContract} from "../generated/templates/ERC20HoldableToken/ERC20HoldableToken";
import {ERC1400 as ERC1400Contract} from "../generated/templates/ERC1400/ERC1400";
import {ZERO} from "./constants";



export function handleAddUserWallet(event: AddUserWallet): void {
  if("0x9934567890123456789012345678901234567890" === event.params.user.toHexString()) {
    return;
  }
  const st1 = "0x1234567890123456789012345678901234567890";
  const st2 = "0x9234567890123456789012345678901234567890";
  const sc1 = "0x0123456789012345678901234567890123456789";
  const sc2 = "0x8123456789012345678901234567890123456789";
  let userWallet = UserWallet.load(event.params.user.toHexString());
  if(userWallet == null){
    userWallet = new UserWallet(event.params.user.toHexString());
  }
  let st = event.params.securityTokens;
  let sc = event.params.stableCoins;

  let securityTokenArray = new Array<string>();
  let stableCoinArray = new Array<string>();

  for (let i = 0; i < event.params.securityTokens.length; i += 1) {

    ERC1400.create(st[i]);


    const securityTokenEntity = new SecurityToken(st[i].toHexString());

    securityTokenEntity.symbol = ' ';
    securityTokenEntity.name = ' ';
    securityTokenEntity.decimals = ZERO;
     securityTokenEntity.balances = new Array<string>();

      let stContract = ERC1400Contract.bind(st[i]);
      let callResult = stContract.try_name();
      if (callResult.reverted) {
        log.info('get name reverted', []);
      } else {
        securityTokenEntity.name = callResult.value;
        securityTokenEntity.symbol = stContract.try_symbol().value;
        securityTokenEntity.decimals = BigInt.fromI32(stContract.try_decimals().value);
      }
   // console.log(stContract.try_name());
    securityTokenEntity.save();
    securityTokenArray.push(securityTokenEntity.id);
  }

  for (let i = 0; i < event.params.stableCoins.length; i += 1) {

    ERC20HoldableToken.create(sc[i]);

    const stableCoinEntity = new StableCoin(sc[i].toHexString());

    stableCoinEntity.symbol = ' ';
    stableCoinEntity.name = ' ';
    stableCoinEntity.decimals = ZERO;
    stableCoinEntity.balances = new Array<string>();


      let scContract = ERC20HoldableTokenContract.bind(sc[i]);

      let callResult = scContract.try_name();
      if (callResult.reverted) {
        log.info('get name reverted', []);
      } else {
        stableCoinEntity.name = callResult.value;
        stableCoinEntity.symbol = scContract.try_symbol().value;
        stableCoinEntity.decimals = BigInt.fromI32(scContract.try_decimals().value);
      }

    stableCoinEntity.save();
    stableCoinArray.push(stableCoinEntity.id);
  }

  userWallet.stableCoins = stableCoinArray;
  userWallet.securityTokens = securityTokenArray;
  userWallet.save()
}

export function handleAddUserTokens(event: AddUserTokens): void {
  if("0x9934567890123456789012345678901234567890" === event.params.user.toHexString()) {
    return;
  }

  const st1 = "0x1234567890123456789012345678901234567890";
  const st2 = "0x9234567890123456789012345678901234567890";
  const sc1 = "0x0123456789012345678901234567890123456789";
  const sc2 = "0x8123456789012345678901234567890123456789";

  let userWallet = UserWallet.load(event.params.user.toHexString());
  let st = event.params.securityTokens;
  let sc = event.params.stableCoins;

  let securityTokenArray = userWallet.securityTokens;
  let stableCoinArray = userWallet.stableCoins;

  for (let i = 0; i < event.params.securityTokens.length; i += 1) {
    ERC1400.create(st[i]);

    const securityTokenEntity = new SecurityToken(st[i].toHexString());
    securityTokenEntity.symbol = ' ';
    securityTokenEntity.name = ' ';
    securityTokenEntity.decimals = ZERO;
    securityTokenEntity.balances = new Array<string>();

      let stContract = ERC1400Contract.bind(st[i]);

      let callResult = stContract.try_name();
      if (callResult.reverted) {
        log.info('get name reverted', []);
      } else {
        securityTokenEntity.name = callResult.value;
        securityTokenEntity.symbol = stContract.try_symbol().value;
        securityTokenEntity.decimals = BigInt.fromI32(stContract.try_decimals().value);
      }

    securityTokenEntity.save();
    securityTokenArray.push(securityTokenEntity.id);
  }

  for (let i = 0; i < event.params.stableCoins.length; i += 1) {
    ERC20HoldableToken.create(sc[i]);
    const stableCoinEntity = new StableCoin(st[i].toHexString());
    stableCoinEntity.symbol = ' ';
    stableCoinEntity.name = ' ';
    stableCoinEntity.decimals = ZERO;
    stableCoinEntity.balances = new Array<string>();

      let scContract = ERC20HoldableTokenContract.bind(sc[i]);

      let callResult = scContract.try_name();
      if (callResult.reverted) {
        log.info('get name reverted', []);
      } else {
        stableCoinEntity.name = callResult.value;
        stableCoinEntity.symbol = scContract.try_symbol().value;
        stableCoinEntity.decimals = BigInt.fromI32(scContract.try_decimals().value);
      }

    stableCoinEntity.save();
    stableCoinArray.push(stableCoinEntity.id);
  }

  userWallet.stableCoins = stableCoinArray;
  userWallet.securityTokens = securityTokenArray;
  userWallet.save()
}

export function handleRemoveUserTokens(event: RemoveUserTokens): void {
  if("0x9934567890123456789012345678901234567890" === event.params.user.toHexString()) {
    return;
  }
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
