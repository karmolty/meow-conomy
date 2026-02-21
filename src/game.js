// Core game logic for v0.1.
// Intent: deterministic tick + simple trade loop (active, no idle waiting required).

import { runTraders } from "./traders.js";
import { tickSchemes } from "./schemes.js";
import { failExpiredActiveContract } from "./contracts.js";
import { DISTRICTS, normalizeDistrictKey } from "./districts.js";

/**
 * @typedef {Object} GoodDef
 * @property {string} key
 * @property {string} label
 * @property {string} desc
 * @property {number} base
 * @property {number} amp
 * @property {number} freq
 * @property {number} phase
 */

/**
 * @typedef {{ price: number, pressure: number }} MarketEntry
 */

/**
 * Single source of truth for the game.
 * @typedef {Object} GameState
 * @property {number} time Seconds since start (sim time)
 * @property {number} coins
 * @property {Record<string, number>} inventory goodKey -> qty
 * @property {Record<string, boolean>} unlocked goodKey -> unlocked
 * @property {Record<string, MarketEntry>} market goodKey -> market info
 * @property {number} heat
 * @property {Array<{id:string,name:string,job:(null|"production"|"scouting"|"negotiating"|"guarding")}>} cats
 * @property {Array<{id:string,name:string,enabled:boolean,feeBps:number,actionsPerMin:number,rules:Array<{kind:"buyBelow"|"sellAbove",goodKey:string,price:number,qty:number}>}>} traders
 */

/** @type {GoodDef[]} */
export const GOODS = [
  {
    key: "kibble",
    label: "Kibble",
    desc: "Stable, low-margin. Good for learning the rhythm.",
    base: 10,
    amp: 2,
    freq: 0.35,
    phase: 0.0,
    noiseAmp: 0.8,
    noiseFreq: 0.08
  },
  {
    key: "catnip",
    label: "Catnip",
    desc: "Volatile, higher risk/reward.",
    base: 18,
    amp: 8,
    freq: 0.65,
    phase: 1.3,
    noiseAmp: 2.8,
    noiseFreq: 0.12
  },
  {
    key: "shiny",
    label: "Shiny Things",
    desc: "Rare-ish and swingy. Great for chaotic profit.",
    base: 40,
    amp: 18,
    freq: 0.22,
    phase: 2.4,
    noiseAmp: 6.0,
    noiseFreq: 0.05
  }
];

/** @type {GameState} */
export const DEFAULT_STATE = {
  time: 0, // seconds since start (sim time)
  // Persisted seed: deterministic per-save.
  seed: 0,
  coins: 50,
  inventory: Object.fromEntries(GOODS.map(g => [g.key, 0])),
  unlocked: {
    kibble: true,
    catnip: false,
    shiny: false
  },
  market: {
    // goodKey: { price, pressure }
    // pressure is “saturation”: buying pushes it up (more expensive), selling pushes it down.
  },

  // v0.2.1 latent per-good state for price engine.
  marketLatent: {
    // goodKey: { anchor, drift, regime, regimeT, slow, fast, lastBase }
  },

  // v0.2.1: run the latent price update at ~1Hz for clearer, chunkier moves.
  _priceAcc: 0,

  // Risk meter (v0.3): currently informational only.
  heat: 0,

  // Meta progression (v0.4)
  meta: {
    whiskers: 0,
    seasons: 0,
    schemeSlots: 1,
    district: "alley",
    districtsUnlocked: ["alley"]
  },

  history: {
    // goodKey: number[] (recent prices)
    heat: [],
    coins: [],
    netWorth: []
  },

  // Cats / jobs (v0.2)
  cats: [
    { id: "miso", name: "Miso", job: null },
    { id: "beans", name: "Beans", job: null },
    { id: "toast", name: "Toast", job: null },
    { id: "pixel", name: "Pixel", job: null }
  ],

  // Schemes (v0.3 runtime)
  schemes: {
    hustle: { cooldownLeft: 0, activeLeft: 0, charges: 0 },
    pricePounce: { cooldownLeft: 0, activeLeft: 0, charges: 0 },
    nineLives: { cooldownLeft: 0, activeLeft: 0, charges: 0 },
    coolWhiskers: { cooldownLeft: 0, activeLeft: 0, charges: 0 }
  },

  // Contracts (v0.2; at most one active)
  contracts: {
    activeId: null,
    startedAtSec: null,
    startCoins: null
  },

  // Cost basis tracking (FIFO lots) for realized P/L display.
  // lots[goodKey] = [{ qty, unitCost }...]
  lots: Object.fromEntries(GOODS.map(g => [g.key, []])),

  // Last trade summary for UI (realized P/L, etc.)
  lastTrade: null,

  // Traders (assistive automation; v0.2+)
  traders: [
    {
      id: "tuna",
      name: "Tuna",
      enabled: false,
      feeBps: 50,
      actionsPerMin: 10,
      rules: [
        { kind: "buyBelow", goodKey: "kibble", price: 9.5, qty: 1 },
        { kind: "sellAbove", goodKey: "kibble", price: 10.8, qty: 1 }
      ]
    }
  ],
  traderRuntime: {
    // traderId: { budget: number }
    // budget accumulates actions based on actionsPerMin.
  }
};

export function clamp0(n) {
  return Math.max(0, Number.isFinite(n) ? n : 0);
}

export function clamp(n, lo, hi) {
  const x = Number.isFinite(n) ? n : 0;
  return Math.max(lo, Math.min(hi, x));
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function getPrice(state, goodKey) {
  return state.market?.[goodKey]?.price ?? 0;
}

function hashU32(str) {
  // FNV-1a 32-bit
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function u32ToUnitFloat(u) {
  // [0,1)
  return (u >>> 0) / 4294967296;
}

function rand01(seedU32) {
  // xorshift32 -> [0,1)
  let x = seedU32 >>> 0;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x >>>= 0;
  x ^= x << 5;
  x >>>= 0;
  return u32ToUnitFloat(x);
}

// --- v0.2.1 Price Engine v1 ---

function xorshift32Step(x) {
  // returns next u32
  let y = x >>> 0;
  y ^= y << 13;
  y >>>= 0;
  y ^= y >>> 17;
  y >>>= 0;
  y ^= y << 5;
  y >>>= 0;
  return y >>> 0;
}

function prngNext01(state, streamKey) {
  // streamKey ensures different deterministic streams per good.
  state.seed = (state.seed >>> 0) || 0;
  const sk = hashU32(`stream:${streamKey}`);
  const mixed = (state.seed ^ sk) >>> 0;
  const next = xorshift32Step(mixed);
  // fold back into base seed so actions affect future prices deterministically.
  state.seed = xorshift32Step(state.seed ^ next);
  return u32ToUnitFloat(next);
}

function prngNormish(state, streamKey) {
  // Cheap gaussian-ish: sum of uniforms.
  let t = 0;
  for (let i = 0; i < 6; i++) t += prngNext01(state, `${streamKey}:${i}`);
  return (t / 6 - 0.5) * 2; // roughly [-1,1]
}

function districtMult(state) {
  const key = normalizeDistrictKey(state?.meta?.district);
  const d = DISTRICTS.find(x => x.key === key) || DISTRICTS[0];
  return d?.mult || { base: 1, volSlow: 1, volFast: 1, drift: 1, meanRev: 1 };
}

function goodParams(state, goodKey) {
  // Keep kibble calmer; shiny wild. Districts nudge these knobs.
  const m = districtMult(state);

  if (goodKey === "kibble") {
    return {
      base: 10 * m.base,
      volSlow: 0.55 * m.volSlow,
      volFast: 1.35 * m.volFast,
      drift: 0.02 * m.drift,
      meanRev: 0.20 * m.meanRev,
      regimeMin: 26,
      regimeMax: 70
    };
  }
  if (goodKey === "catnip") {
    return {
      base: 18 * m.base,
      volSlow: 0.75 * m.volSlow,
      volFast: 1.45 * m.volFast,
      drift: 0.04 * m.drift,
      meanRev: 0.14 * m.meanRev,
      regimeMin: 20,
      regimeMax: 55
    };
  }
  return {
    base: 40 * m.base,
    volSlow: 1.45 * m.volSlow,
    volFast: 2.95 * m.volFast,
    drift: 0.06 * m.drift,
    meanRev: 0.09 * m.meanRev,
    regimeMin: 16,
    regimeMax: 50
  };
}

function initLatentForGood(state, goodKey) {
  state.marketLatent ||= {};
  if (state.marketLatent[goodKey]) return;
  const p = goodParams(state, goodKey);

  // Deterministic per-save initial anchor.
  const jitter = prngNormish(state, `init:${goodKey}`) * 0.8;
  const anchor = Math.max(1, round2(p.base + jitter));
  state.marketLatent[goodKey] = {
    anchor,
    drift: 0,
    regime: "calm",
    regimeT: 0,
    slow: 0,
    fast: 0
  };
}

function maybeSwitchRegime(state, goodKey, dt) {
  const l = state.marketLatent[goodKey];
  const p = goodParams(state, goodKey);
  l.regimeT -= dt;
  if (l.regimeT > 0) return;

  // Switch regime deterministically using PRNG.
  const r = prngNext01(state, `regime:${goodKey}`);
  l.regime = r < 0.62 ? "calm" : r < 0.9 ? "choppy" : "hype";
  const dur = p.regimeMin + Math.floor(prngNext01(state, `regimeDur:${goodKey}`) * (p.regimeMax - p.regimeMin));
  l.regimeT = dur;
}

function updateLatent(state, goodKey, dt) {
  initLatentForGood(state, goodKey);
  const l = state.marketLatent[goodKey];
  const p = goodParams(state, goodKey);

  maybeSwitchRegime(state, goodKey, dt);

  const regimeVol = l.regime === "calm" ? 0.75 : l.regime === "choppy" ? 1.05 : 1.55;
  const driftKick = prngNormish(state, `drift:${goodKey}`) * p.drift * regimeVol;
  l.drift = clamp(l.drift * 0.92 + driftKick, -0.6, 0.6);

  // Two-timescale components (OU-ish).
  const slowKick = prngNormish(state, `slow:${goodKey}`) * p.volSlow * regimeVol;
  const fastKick = prngNormish(state, `fast:${goodKey}`) * p.volFast * regimeVol;

  l.slow = l.slow * 0.985 + slowKick * (dt ** 0.5);
  l.fast = l.fast * 0.90 + fastKick * (dt ** 0.5);

  // Anchor mean-reverts toward base and nudges with drift.
  const target = p.base + l.drift * 2;
  l.anchor = round2(l.anchor + (target - l.anchor) * (p.meanRev * dt));
}

function basePriceAtTime(state, goodKey, dt) {
  // Stateful, seeded, multi-timescale; deterministic per save + action sequence.
  updateLatent(state, goodKey, dt);
  const l = state.marketLatent[goodKey];
  const raw = (l.anchor ?? 1) + (l.slow ?? 0) + (l.fast ?? 0);
  return Math.max(1, round2(raw));
}


// (v0.2.1 price engine replaced old sine+noise)

function withPressure(basePrice, pressure = 0) {
  // Pressure is a lightweight “saturation” mechanic:
  // - pressure > 0 => prices drift up (you’re crowding the buy side)
  // - pressure < 0 => prices drift down (you’re flooding the sell side)
  // Keep it gentle so v0.1 still feels learnable.
  const p = Number.isFinite(pressure) ? pressure : 0;
  const mult = 1 + 0.02 * p;
  return Math.max(1, round2(basePrice * mult));
}

export function recomputeMarket(state, { doUpdate = true, dtStep = 1 } = {}) {
  state.market ||= {};
  for (const g of GOODS) {
    const prev = state.market[g.key] || {};
    const pressure = Number.isFinite(prev.pressure) ? prev.pressure : 0;

    // Update latent only at ~1Hz (doUpdate true). Otherwise reuse last base.
    if (doUpdate) {
      const base = basePriceAtTime(state, g.key, dtStep);
      state.marketLatent ||= {};
      state.marketLatent[g.key] ||= {};
      state.marketLatent[g.key].lastBase = base;
    }

    const base = state.marketLatent?.[g.key]?.lastBase ?? basePriceAtTime(state, g.key, dtStep);
    state.market[g.key] = { price: withPressure(base, pressure), pressure };
  }
}

export function applyPressure(state, goodKey, delta) {
  state.market ||= {};
  state.market[goodKey] ||= { price: 0, pressure: 0 };
  const cur = Number.isFinite(state.market[goodKey].pressure) ? state.market[goodKey].pressure : 0;
  // Clamp so it can’t explode.
  state.market[goodKey].pressure = Math.max(-25, Math.min(25, round2(cur + delta)));
}

export function decayPressure(state, dt) {
  // Drift pressure back toward 0 over time so markets “recover”.
  // Deterministic, continuous-ish, and stable at small dt.
  const safeDt = Math.max(0, Math.min(5, Number(dt) || 0));
  const decayPerSec = 0.35; // higher = faster recovery
  const k = Math.exp(-decayPerSec * safeDt);

  state.market ||= {};
  for (const g of GOODS) {
    state.market[g.key] ||= { price: 0, pressure: 0 };
    const p = Number.isFinite(state.market[g.key].pressure) ? state.market[g.key].pressure : 0;
    state.market[g.key].pressure = round2(p * k);
  }
}

export function tick(state, dt) {
  // dt in seconds; deterministic update.
  const safeDt = Math.max(0, Math.min(5, Number(dt) || 0));
  state.time = (Number(state.time) || 0) + safeDt;

  // Seed init (persisted). If absent/0, derive from deterministic sim time.
  if (!Number.isFinite(state.seed) || (state.seed >>> 0) === 0) {
    state.seed = hashU32(`seed:${Math.floor(state.time * 1000)}`) || 123456789;
  }

  // Staged unlocks (v0.1+): start with Kibble; unlock Catnip at 100 coins.
  // v0.2 adds a third good (Shiny Things) unlocked a bit later.
  state.unlocked ||= {};
  if (state.unlocked.kibble === undefined) state.unlocked.kibble = true;
  if (state.unlocked.catnip === undefined) state.unlocked.catnip = false;
  if (state.unlocked.shiny === undefined) state.unlocked.shiny = false;
  if (state.unlocked.contract === undefined) state.unlocked.contract = false;
  if (state.unlocked.heat === undefined) state.unlocked.heat = false;
  if (state.unlocked.traders === undefined) state.unlocked.traders = false;
  if (state.unlocked.cats === undefined) state.unlocked.cats = false;
  if (state.unlocked.schemes === undefined) state.unlocked.schemes = false;

  if (!state.unlocked.catnip && (state.coins ?? 0) >= 100) state.unlocked.catnip = true;
  if (!state.unlocked.shiny && (state.coins ?? 0) >= 250) state.unlocked.shiny = true;
  if (!state.unlocked.contract && (state.coins ?? 0) >= 250) state.unlocked.contract = true;
  if (!state.unlocked.heat && (state.coins ?? 0) >= 500) state.unlocked.heat = true;
  if (!state.unlocked.traders && (state.coins ?? 0) >= 800) state.unlocked.traders = true;
  if (!state.unlocked.cats && (state.coins ?? 0) >= 1200) state.unlocked.cats = true;

  decayPressure(state, safeDt);

  // Update latent price engine at ~1Hz for clearer moves.
  state._priceAcc = (Number(state._priceAcc) || 0) + safeDt;
  let doUpdate = false;
  while (state._priceAcc >= 1) {
    state._priceAcc -= 1;
    doUpdate = true;
  }
  recomputeMarket(state, { doUpdate, dtStep: 1 });

  // Record history for UI sparklines.
  state.history ||= { heat: [], coins: [], netWorth: [] };
  const maxPoints = 30;
  for (const g of GOODS) {
    state.history[g.key] ||= [];
    const arr = state.history[g.key];
    if (doUpdate) {
      arr.push(state.market?.[g.key]?.price ?? 0);
      if (arr.length > maxPoints) arr.splice(0, arr.length - maxPoints);
    }
  }
  // Heat history too (only when Heat is unlocked so early UI stays clean).
  state.history.heat ||= [];
  if (doUpdate && (state.unlocked?.heat ?? false)) {
    state.history.heat.push(Number(state.heat ?? 0));
    if (state.history.heat.length > maxPoints) state.history.heat.splice(0, state.history.heat.length - maxPoints);
  }

  // Coins history (always; small quality-of-life trend indicator).
  state.history.coins ||= [];
  if (doUpdate) {
    state.history.coins.push(Number(state.coins ?? 0));
    if (state.history.coins.length > maxPoints) state.history.coins.splice(0, state.history.coins.length - maxPoints);
  }

  // Net worth history (coins + inventory at current prices).
  state.history.netWorth ||= [];
  if (doUpdate) {
    let nw = Number(state.coins ?? 0);
    for (const g of GOODS) {
      const qty = Number(state.inventory?.[g.key] ?? 0);
      if (qty > 0) nw += qty * (state.market?.[g.key]?.price ?? 0);
    }
    state.history.netWorth.push(round2(nw));
    if (state.history.netWorth.length > maxPoints) {
      state.history.netWorth.splice(0, state.history.netWorth.length - maxPoints);
    }
  }

  // Traders (assistive automation).
  runTraders(state, safeDt);

  // Schemes (v0.3)
  tickSchemes(state, safeDt);

  // Heat (v0.3): baseline decay; guarding increases decay a bit.
  const decay = hasJob(state, "guarding") ? 0.035 : 0.02;
  state.heat = clamp((state.heat ?? 0) - decay * safeDt, 0, 100);

  // Contracts: if the deadline passes, fail it and apply penalty.
  const failed = failExpiredActiveContract(state);
  if (failed && state?.meta?.challenge === "ironContracts") {
    // Opt-in fail state: in this challenge, letting a contract expire busts your run.
    // (No Whiskers awarded; meta progression stays.)
    bustRun(state);
  }

  // Challenge: Heat reaching 100 busts your run.
  if (state?.meta?.challenge === "heatDeath" && (state.heat ?? 0) >= 100) {
    bustRun(state);
  }

  return state;
}

function bustRun(state) {
  // Reset run resources (similar to End Season, but without awarding meta currency).
  state.coins = 50;
  state.inventory = Object.fromEntries(GOODS.map(g => [g.key, 0]));
  state.lots = Object.fromEntries(GOODS.map(g => [g.key, []]));
  state.lastTrade = null;
  state.heat = 0;

  // Clear contracts.
  state.contracts ||= { activeId: null, startedAtSec: null, startCoins: null };
  state.contracts.activeId = null;
  state.contracts.startedAtSec = null;
  state.contracts.startCoins = null;

  // Reset schemes runtime.
  if (state.schemes) {
    for (const k of Object.keys(state.schemes)) {
      if (!state.schemes[k]) continue;
      state.schemes[k].cooldownLeft = 0;
      state.schemes[k].activeLeft = 0;
    }
  }

  // Reset cat allocations.
  if (Array.isArray(state.cats)) {
    for (const c of state.cats) c.job = null;
  }

  // Reset trader runtime budgets.
  state.traderRuntime = {};

  // Reset market pressure/latent; keep seed so it stays deterministic per save.
  state.market = {};
  state.marketLatent = {};
  recomputeMarket(state);
}

function hasJob(state, jobKey) {
  const cats = state?.cats || [];
  return cats.some(c => c?.job === jobKey);
}

function buyPrice(state, goodKey) {
  const p = getPrice(state, goodKey);
  // Negotiating gives a tiny edge.
  return hasJob(state, "negotiating") ? round2(p * 0.98) : p;
}

function heatMult(state) {
  // Guarding reduces how much Heat you generate.
  return hasJob(state, "guarding") ? 0.7 : 1;
}

function heatForTrade(goodKey, qty) {
  // Heat is a risk meter (v0.3): trading creates attention.
  // Riskier goods generate more Heat.
  const q = Math.max(0, Math.floor(qty));
  const base = goodKey === "kibble" ? 0.05 : goodKey === "catnip" ? 0.12 : 0.18;
  return base * q;
}

function sellPrice(state, goodKey) {
  const p = getPrice(state, goodKey);
  return hasJob(state, "negotiating") ? round2(p * 1.02) : p;
}

function ensureLots(state, goodKey) {
  state.lots ||= {};
  if (!Array.isArray(state.lots[goodKey])) state.lots[goodKey] = [];
  return state.lots[goodKey];
}

function fifoAddLot(state, goodKey, qty, unitCost) {
  const q = Math.max(0, Math.floor(qty));
  if (q <= 0) return;
  const u = Number.isFinite(unitCost) ? unitCost : 0;
  const lots = ensureLots(state, goodKey);
  lots.push({ qty: q, unitCost: round2(u) });
}

function fifoConsumeCost(state, goodKey, qty) {
  // Consume FIFO lots and return total cost basis.
  const q = Math.max(0, Math.floor(qty));
  if (q <= 0) return 0;

  const lots = ensureLots(state, goodKey);
  let left = q;
  let cost = 0;

  while (left > 0 && lots.length > 0) {
    const lot = lots[0];
    const take = Math.min(left, Math.max(0, Math.floor(lot.qty || 0)));
    const unit = Number.isFinite(lot.unitCost) ? lot.unitCost : 0;
    cost += unit * take;
    lot.qty -= take;
    left -= take;
    if (lot.qty <= 0) lots.shift();
  }

  // If we somehow had less lots than inventory (e.g., old save), assume 0 basis for remainder.
  return round2(cost);
}

export function canBuy(state, goodKey, qty = 1) {
  const q = Math.max(0, Math.floor(qty));
  const price = buyPrice(state, goodKey);
  const unlocked = state.unlocked?.[goodKey] ?? true;
  return unlocked && q > 0 && (state.coins ?? 0) >= price * q;
}

export function buy(state, goodKey, qty = 1) {
  const q = Math.max(0, Math.floor(qty));
  const unlocked = state.unlocked?.[goodKey] ?? true;
  const price = buyPrice(state, goodKey);
  const cost = price * q;
  if (!unlocked) return false;
  if (q <= 0) return false;
  if ((state.coins ?? 0) < cost) return false;

  state.coins = round2((state.coins ?? 0) - cost);
  state.inventory[goodKey] = clamp0((state.inventory?.[goodKey] ?? 0) + q);

  // FIFO cost basis: buying adds a lot.
  fifoAddLot(state, goodKey, q, price);

  // Last trade summary for UI.
  state.lastTrade = {
    kind: "buy",
    goodKey,
    qty: q,
    unitPrice: price,
    cost: round2(cost)
  };

  // Heat: buying creates attention.
  state.heat = clamp((state.heat ?? 0) + heatMult(state) * heatForTrade(goodKey, q), 0, 100);

  // Buying pushes pressure up (future buys are a bit pricier).
  applyPressure(state, goodKey, +q);
  // Recompute price with new pressure but do not advance latent time.
  recomputeMarket(state, { doUpdate: false, dtStep: 0 });

  return true;
}

export function canSell(state, goodKey, qty = 1) {
  const q = Math.max(0, Math.floor(qty));
  const unlocked = state.unlocked?.[goodKey] ?? true;
  return unlocked && q > 0 && (state.inventory?.[goodKey] ?? 0) >= q;
}

export function sell(state, goodKey, qty = 1) {
  const q = Math.max(0, Math.floor(qty));
  const unlocked = state.unlocked?.[goodKey] ?? true;
  const price = sellPrice(state, goodKey);
  if (!unlocked) return false;
  if (q <= 0) return false;
  if ((state.inventory?.[goodKey] ?? 0) < q) return false;

  // FIFO realized P/L.
  const proceeds = round2(price * q);
  const costBasis = fifoConsumeCost(state, goodKey, q);
  const pnl = round2(proceeds - costBasis);

  state.inventory[goodKey] = clamp0((state.inventory?.[goodKey] ?? 0) - q);
  state.coins = round2((state.coins ?? 0) + proceeds);

  // Last trade summary for UI.
  state.lastTrade = {
    kind: "sell",
    goodKey,
    qty: q,
    unitPrice: price,
    proceeds,
    costBasis,
    pnl
  };

  // Heat: selling creates attention.
  state.heat = clamp((state.heat ?? 0) + heatMult(state) * heatForTrade(goodKey, q), 0, 100);

  // Selling pushes pressure down (you’re adding supply).
  applyPressure(state, goodKey, -q);
  // Recompute price with new pressure but do not advance latent time.
  recomputeMarket(state, { doUpdate: false, dtStep: 0 });

  return true;
}
