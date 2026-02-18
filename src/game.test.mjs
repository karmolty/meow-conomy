import assert from "node:assert/strict";
import { DEFAULT_STATE, tick, buy, sell, canBuy, canSell, GOODS } from "./game.js";
import {
  CONTRACTS,
  isValidContract,
  acceptContract,
  acceptContractById,
  getAvailableContracts,
  getActiveContract,
  abandonActiveContract,
  isActiveContractExpired,
  isActiveContractComplete,
  redeemActiveContract
} from "./contracts.js";
import { JOB_DEFS, JOB_CAPS, STARTER_CATS, isValidCat, assignCatJob } from "./cats.js";
import { STARTER_TRADERS, isValidTrader, runTraders } from "./traders.js";
import { EVENT_DEFS, maybeTriggerEvent, eventProb } from "./events.js";
import { SCHEMES, activateScheme } from "./schemes.js";
import { endSeason, whiskersForCoins } from "./prestige.js";
import { createRng } from "./rng.js";

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

// Basic invariants + determinism smoke tests.
{
  // PRNG determinism (seeded).
  {
    const r1 = createRng(123);
    const r2 = createRng(123);
    for (let i = 0; i < 10; i++) {
      assert.equal(r1.nextU32(), r2.nextU32(), "rng: nextU32 deterministic");
    }
  }

  const a = clone(DEFAULT_STATE);
  const b = clone(DEFAULT_STATE);

  tick(a, 1);
  tick(b, 1);

  for (const g of GOODS) {
    assert.equal(a.market[g.key].price, b.market[g.key].price, "prices deterministic for same time");
    assert.ok(a.market[g.key].price >= 1, "price bounded >= 1");
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

  // Heat increases on trades; guarding reduces it.
  const h1 = clone(DEFAULT_STATE);
  tick(h1, 1);
  h1.market.kibble.price = 10;
  assert.equal(h1.heat, 0);
  buy(h1, "kibble", 2);
  assert.ok(h1.heat > 0);

  const h2 = clone(DEFAULT_STATE);
  tick(h2, 1);
  h2.cats[0].job = "guarding";
  h2.market.kibble.price = 10;
  buy(h2, "kibble", 2);
  assert.ok(h2.heat > 0);
  assert.ok(h2.heat < h1.heat);

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

// Price engine: determinism across runs + no obvious short periodic loop.
{
  const dt = 0.25;
  const steps = Math.round(180 / dt); // 3 minutes

  const s1 = clone(DEFAULT_STATE);
  const s2 = clone(DEFAULT_STATE);
  s1.seed = 123;
  s2.seed = 123;

  const series = {};
  for (const g of GOODS) series[g.key] = [];

  for (let i = 0; i < steps; i++) {
    tick(s1, dt);
    tick(s2, dt);
    for (const g of GOODS) {
      const p1 = s1.market[g.key].price;
      const p2 = s2.market[g.key].price;
      assert.equal(p1, p2, "seeded series deterministic across runs");
      assert.ok(p1 >= 1);
      series[g.key].push(p1);
    }
  }

  // Reject exact repeating loops with short periods (super obvious cycles).
  // We only check exact equality since prices are rounded to cents.
  function hasExactPeriod(arr, period) {
    for (let i = period; i < arr.length; i++) {
      if (arr[i] !== arr[i - period]) return false;
    }
    return true;
  }

  for (const g of GOODS) {
    const arr = series[g.key];
    // Periods from 1s..30s (4..120 steps)
    for (let period = 4; period <= 120; period++) {
      assert.equal(
        hasExactPeriod(arr, period),
        false,
        `no exact repeating loop: ${g.key} period=${(period * dt).toFixed(2)}s`
      );
    }
  }
}

// Price engine: no runaway drift in a 10-minute idle sim.
{
  const dt = 0.25;
  const steps = Math.round(600 / dt); // 10 minutes

  const s = clone(DEFAULT_STATE);
  s.seed = 123;

  const maxByGood = Object.fromEntries(GOODS.map(g => [g.key, 0]));

  for (let i = 0; i < steps; i++) {
    tick(s, dt);
    for (const g of GOODS) {
      const p = s.market[g.key].price;
      assert.ok(Number.isFinite(p), "price finite");
      assert.ok(p >= 1, "price bounded >= 1");
      maxByGood[g.key] = Math.max(maxByGood[g.key], p);
    }
  }

  // Loose sanity bounds; tune later, but this should prevent explosive drift.
  assert.ok(maxByGood.kibble < 50);
  assert.ok(maxByGood.catnip < 150);
  assert.ok(maxByGood.shiny < 500);
}

// Contract schema + single-active enforcement.
{ 
  assert.ok(CONTRACTS.length >= 1);
  for (const c of CONTRACTS) assert.ok(isValidContract(c), `valid contract: ${c?.id}`);

  const s = clone(DEFAULT_STATE);
  tick(s, 0);

  assert.equal(getActiveContract(s), null);
  // By default, prestige-gated contracts are hidden.
  assert.deepEqual(
    getAvailableContracts(s).map(c => c.id),
    CONTRACTS.filter(c => !(c.tags || []).includes("prestige")).map(c => c.id)
  );

  // After at least one season, prestige contracts appear.
  s.meta ||= { whiskers: 0, seasons: 0 };
  s.meta.seasons = 1;
  assert.ok(getAvailableContracts(s).some(c => (c.tags || []).includes("prestige")));

  // Heat gating: when heat is unlocked and high, no contracts are offered.
  s.unlocked.heat = true;
  s.heat = 75;
  assert.equal(getAvailableContracts(s).length, 0);
  s.heat = 0;

  assert.ok(acceptContractById(s, CONTRACTS[0].id));
  assert.equal(getActiveContract(s)?.id, CONTRACTS[0].id);
  assert.equal(getAvailableContracts(s).length, 0, "no available contracts while one is active");

  assert.equal(acceptContract(s, CONTRACTS[1]), false, "cannot accept a second contract");

  // Abandon applies penalty and clears active.
  s.coins = 100;
  assert.ok(abandonActiveContract(s));
  assert.equal(getActiveContract(s), null);
  assert.equal(s.coins, 100 - CONTRACTS[0].penalty.coins);

  // No-op cases.
  assert.equal(abandonActiveContract(s), false, "cannot abandon when no active contract");
  assert.equal(acceptContractById(s, "__nope__"), false, "unknown contract id is rejected");

  // Redeem: only succeeds when complete, grants reward, and consumes deliverables.
  const delivery = CONTRACTS.find(c => c.id === "starter-kibble-8");
  assert.ok(delivery);
  s.coins = 50;
  s.time = 0;
  s.inventory.kibble = 7;
  assert.ok(acceptContract(s, delivery));
  assert.equal(isActiveContractComplete(s), false);
  assert.equal(redeemActiveContract(s), false);

  // Deadline helper.
  s.time = s.contracts.startedAtSec + delivery.deadlineSec - 0.01;
  assert.equal(isActiveContractExpired(s), false);
  s.time = s.contracts.startedAtSec + delivery.deadlineSec + 0.01;
  assert.equal(isActiveContractExpired(s), true);

  // Completion and redemption.
  s.time = 0;
  s.inventory.kibble = 8;
  assert.equal(isActiveContractComplete(s), true);
  assert.ok(redeemActiveContract(s));
  assert.equal(s.inventory.kibble, 0, "delivered goods are consumed");
  assert.equal(s.coins, 50 + delivery.reward.coins, "reward coins granted");
  assert.equal(getActiveContract(s), null);
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

// Trader schema sanity + execution.
{
  assert.ok(STARTER_TRADERS.length >= 1);
  for (const t of STARTER_TRADERS) assert.ok(isValidTrader(t));

  const s = clone(DEFAULT_STATE);
  assert.ok(Array.isArray(s.traders));
  assert.ok(s.traders.length >= 1);
  for (const t of s.traders) assert.ok(isValidTrader(t));

  // Execute one buy when rule matches.
  tick(s, 1);
  s.traders[0].enabled = true;
  // Force the market price below the buy threshold.
  s.market.kibble.price = 9;
  const coins0 = s.coins;
  // dt is capped internally, so accrue budget across a couple calls.
  runTraders(s, 5);
  runTraders(s, 5);
  assert.ok(s.inventory.kibble >= 1);
  assert.ok(s.coins < coins0);

  // Heat constraint reduces trader action rate.
  const hot = clone(DEFAULT_STATE);
  tick(hot, 1);
  hot.unlocked.heat = true;
  hot.heat = 100;
  hot.traders[0].enabled = true;
  hot.market.kibble.price = 9;
  runTraders(hot, 5);
  // With heat=100 and clamp to 0.2, budget should accrue slower.
  // (We just sanity-check the runtime budget is small.)
  assert.ok((hot.traderRuntime?.tuna?.budget ?? 0) < 1);
}

// Heat events: defs exist + deterministic trigger path + mitigation.
{
  assert.ok(Object.keys(EVENT_DEFS).length >= 3);

  // Guarding reduces event probability.
  assert.ok(eventProb(100, true) < eventProb(100, false));

  const s = clone(DEFAULT_STATE);
  tick(s, 1);
  s.heat = 100;

  // Determinism: same rng/time/heat produces same outcome.
  const a = clone(s);
  const b = clone(s);
  const ea = maybeTriggerEvent(a);
  const eb = maybeTriggerEvent(b);
  assert.deepEqual(ea, eb);
}

// Schemes: can activate and cooldown starts.
{
  assert.ok(SCHEMES.length >= 3);
  const s = clone(DEFAULT_STATE);
  tick(s, 0);
  assert.ok(activateScheme(s, SCHEMES[0].id));
  assert.ok((s.schemes?.[SCHEMES[0].id]?.cooldownLeft ?? 0) > 0);
}

// Prestige: end season awards whiskers and resets run state.
{
  const s = clone(DEFAULT_STATE);
  tick(s, 1);
  s.coins = 450;
  s.inventory.kibble = 3;
  s.heat = 80;
  s.contracts.activeId = CONTRACTS[0].id;
  s.cats[0].job = "production";
  s.schemes.hustle.cooldownLeft = 12;
  s.schemes.hustle.activeLeft = 3;
  s.traderRuntime = { tuna: { budget: 0.8 } };

  const w0 = s.meta?.whiskers ?? 0;
  assert.equal(whiskersForCoins(450), Math.floor(450 / 200));
  const { whiskersAwarded } = endSeason(s);
  assert.equal(whiskersAwarded, whiskersForCoins(450));
  assert.equal(s.meta.whiskers, w0 + whiskersAwarded);

  // Run reset.
  assert.equal(s.coins, 50);
  assert.equal(s.inventory.kibble, 0);
  assert.equal(s.heat, 0);
  assert.equal(s.contracts.activeId, null);
  assert.equal(s.cats[0].job, null);
  assert.equal(s.schemes.hustle.cooldownLeft, 0);
  assert.equal(s.schemes.hustle.activeLeft, 0);
  assert.deepEqual(s.traderRuntime, {});
}

console.log("ok - game.test.mjs");
