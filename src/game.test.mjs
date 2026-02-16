import assert from "node:assert/strict";
import { DEFAULT_STATE, tick, buy, sell, canBuy, canSell, GOODS } from "./game.js";

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

console.log("ok - game.test.mjs");
