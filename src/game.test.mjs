import assert from "node:assert/strict";
import { DEFAULT_STATE, tick, buy, sell, canBuy, canSell, GOODS } from "./game.js";
import {
  CONTRACTS,
  isValidContract,
  acceptContract,
  getActiveContract,
  abandonActiveContract
} from "./contracts.js";

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

// Basic invariants + determinism smoke tests.
{
  const a = clone(DEFAULT_STATE);
  const b = clone(DEFAULT_STATE);

  tick(a, 1);
  tick(b, 1);

  for (const g of GOODS) {
    assert.equal(a.market[g.key].price, b.market[g.key].price, "prices deterministic for same time");
  }

  // Buying reduces coins, increases inventory.
  const g0 = GOODS[0].key;
  const startCoins = a.coins;
  const price = a.market[g0].price;
  assert.ok(canBuy(a, g0, 1));
  assert.ok(buy(a, g0, 1));
  assert.equal(a.inventory[g0], 1);
  assert.equal(a.coins, +(startCoins - price).toFixed(2));

  // Selling restores coins, reduces inventory.
  assert.ok(canSell(a, g0, 1));
  const coinsBeforeSell = a.coins;
  const sellPrice = a.market[g0].price;
  assert.ok(sell(a, g0, 1));
  assert.equal(a.inventory[g0], 0);
  assert.equal(a.coins, +(coinsBeforeSell + sellPrice).toFixed(2));

  // Pressure/saturation responds to trading.
  assert.ok(Number.isFinite(a.market[g0].pressure));

  // Never go negative.
  assert.ok(a.coins >= 0);
  for (const g of GOODS) assert.ok(a.inventory[g.key] >= 0);
}

// Contract schema + single-active enforcement.
{
  assert.ok(CONTRACTS.length >= 1);
  for (const c of CONTRACTS) assert.ok(isValidContract(c), `valid contract: ${c?.id}`);

  const s = clone(DEFAULT_STATE);
  tick(s, 0);

  assert.equal(getActiveContract(s), null);
  assert.ok(acceptContract(s, CONTRACTS[0]));
  assert.equal(getActiveContract(s)?.id, CONTRACTS[0].id);
  assert.equal(acceptContract(s, CONTRACTS[1]), false, "cannot accept a second contract");

  // Abandon applies penalty and clears active.
  s.coins = 100;
  assert.ok(abandonActiveContract(s));
  assert.equal(getActiveContract(s), null);
  assert.equal(s.coins, 100 - CONTRACTS[0].penalty.coins);
}

console.log("ok - game.test.mjs");
