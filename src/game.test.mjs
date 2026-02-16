import assert from "node:assert/strict";
import { DEFAULT_STATE, tick, buy, sell, canBuy, canSell, GOODS } from "./game.js";
import {
  CONTRACTS,
  isValidContract,
  acceptContract,
  acceptContractById,
  getAvailableContracts,
  getActiveContract,
  abandonActiveContract
} from "./contracts.js";
import { JOB_DEFS, JOB_CAPS, STARTER_CATS, isValidCat, assignCatJob } from "./cats.js";
import { STARTER_TRADERS, isValidTrader } from "./traders.js";

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

  // Negotiating job gives a small edge.
  const n = clone(DEFAULT_STATE);
  tick(n, 1);
  n.cats[0].job = "negotiating";
  const pBuy = n.market[g0].price;
  const buyCost = +(pBuy * 0.98).toFixed(2);
  const coins0 = n.coins;
  assert.ok(buy(n, g0, 1));
  assert.equal(n.coins, +(coins0 - buyCost).toFixed(2));

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
  assert.deepEqual(getAvailableContracts(s).map(c => c.id), CONTRACTS.map(c => c.id));

  assert.ok(acceptContractById(s, CONTRACTS[0].id));
  assert.equal(getActiveContract(s)?.id, CONTRACTS[0].id);
  assert.equal(getAvailableContracts(s).length, 0, "no available contracts while one is active");

  assert.equal(acceptContract(s, CONTRACTS[1]), false, "cannot accept a second contract");

  // Abandon applies penalty and clears active.
  s.coins = 100;
  assert.ok(abandonActiveContract(s));
  assert.equal(getActiveContract(s), null);
  assert.equal(s.coins, 100 - CONTRACTS[0].penalty.coins);
}

// Cats / jobs schema sanity + allocation caps.
{
  assert.ok(JOB_DEFS.length >= 1);
  assert.ok(STARTER_CATS.length >= 1);
  for (const c of STARTER_CATS) assert.ok(isValidCat(c));

  // caps exist
  for (const j of JOB_DEFS) assert.ok(Number.isFinite(JOB_CAPS[j.key]));

  const s = clone(DEFAULT_STATE);
  assert.ok(Array.isArray(s.cats));
  assert.ok(s.cats.length >= 1);
  for (const c of s.cats) assert.ok(isValidCat(c));

  // Allocation enforces 1 slot per job (current caps).
  const [c0, c1] = s.cats;
  assert.ok(assignCatJob(s, c0.id, "production"));
  assert.equal(assignCatJob(s, c1.id, "production"), false);
  assert.ok(assignCatJob(s, c0.id, null));
  assert.ok(assignCatJob(s, c1.id, "production"));
}

// Trader schema sanity.
{
  assert.ok(STARTER_TRADERS.length >= 1);
  for (const t of STARTER_TRADERS) assert.ok(isValidTrader(t));

  const s = clone(DEFAULT_STATE);
  assert.ok(Array.isArray(s.traders));
  assert.ok(s.traders.length >= 1);
  for (const t of s.traders) assert.ok(isValidTrader(t));
}

console.log("ok - game.test.mjs");
