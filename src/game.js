// Core game logic for v0.1.
// Intent: deterministic tick + simple trade loop (active, no idle waiting required).

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
 * @property {Array<{id:string,name:string,job:(null|"production"|"scouting"|"negotiating"|"guarding")}>} cats
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
  history: {
    // goodKey: number[] (recent prices)
  },

  // Cats / jobs (v0.2)
  cats: [
    { id: "miso", name: "Miso", job: null },
    { id: "beans", name: "Beans", job: null }
  ],

  // Contracts (v0.2; at most one active)
  contracts: {
    activeId: null,
    startedAtSec: null,
    startCoins: null
  }
};

export function clamp0(n) {
  return Math.max(0, Number.isFinite(n) ? n : 0);
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

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise1D(key, x) {
  // Deterministic, continuous-ish noise in [-1, 1].
  const x0 = Math.floor(x);
  const x1 = x0 + 1;
  const t = x - x0;

  const h0 = hashU32(`${key}:${x0}`);
  const h1 = hashU32(`${key}:${x1}`);
  const v0 = rand01(h0) * 2 - 1;
  const v1 = rand01(h1) * 2 - 1;

  const s = smoothstep(Math.max(0, Math.min(1, t)));
  return v0 * (1 - s) + v1 * s;
}

function basePriceAtTime(good, t) {
  // Deterministic oscillation + deterministic noise:
  // keeps patterns learnable, but avoids an overly-obvious perfect sine.
  // Always keep price >= 1.

  const cyc = good.base + good.amp * Math.sin(good.freq * t + good.phase);

  // Add gentle, smoothed “market mood” noise.
  const noiseAmp = good.noiseAmp ?? 0;
  const noiseFreq = good.noiseFreq ?? 0;
  const mood = noiseAmp ? noiseAmp * valueNoise1D(good.key, t * noiseFreq) : 0;

  const raw = cyc + mood;
  return Math.max(1, round2(raw));
}

function withPressure(basePrice, pressure = 0) {
  // Pressure is a lightweight “saturation” mechanic:
  // - pressure > 0 => prices drift up (you’re crowding the buy side)
  // - pressure < 0 => prices drift down (you’re flooding the sell side)
  // Keep it gentle so v0.1 still feels learnable.
  const p = Number.isFinite(pressure) ? pressure : 0;
  const mult = 1 + 0.02 * p;
  return Math.max(1, round2(basePrice * mult));
}

export function recomputeMarket(state) {
  state.market ||= {};
  for (const g of GOODS) {
    const prev = state.market[g.key] || {};
    const pressure = Number.isFinite(prev.pressure) ? prev.pressure : 0;
    const base = basePriceAtTime(g, state.time);
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

  // Staged unlocks (v0.1+): start with Kibble; unlock Catnip at 100 coins.
  // v0.2 adds a third good (Shiny Things) unlocked a bit later.
  state.unlocked ||= {};
  if (state.unlocked.kibble === undefined) state.unlocked.kibble = true;
  if (state.unlocked.catnip === undefined) state.unlocked.catnip = false;
  if (state.unlocked.shiny === undefined) state.unlocked.shiny = false;

  if (!state.unlocked.catnip && (state.coins ?? 0) >= 100) state.unlocked.catnip = true;
  if (!state.unlocked.shiny && (state.coins ?? 0) >= 250) state.unlocked.shiny = true;

  decayPressure(state, safeDt);
  recomputeMarket(state);

  // Record price history for UI sparklines.
  state.history ||= {};
  const maxPoints = 30;
  for (const g of GOODS) {
    state.history[g.key] ||= [];
    const arr = state.history[g.key];
    arr.push(state.market?.[g.key]?.price ?? 0);
    if (arr.length > maxPoints) arr.splice(0, arr.length - maxPoints);
  }

  return state;
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

function sellPrice(state, goodKey) {
  const p = getPrice(state, goodKey);
  return hasJob(state, "negotiating") ? round2(p * 1.02) : p;
}

export function canBuy(state, goodKey, qty = 1) {
  const q = Math.max(0, Math.floor(qty));
  const price = buyPrice(state, goodKey);
  const unlocked = state.unlocked?.[goodKey] ?? true;
  return unlocked && q > 0 && (state.coins ?? 0) >= price * q;
}

export function buy(state, goodKey, qty = 1) {
  const q = Math.max(0, Math.floor(qty));
  const price = buyPrice(state, goodKey);
  const cost = price * q;
  if (q <= 0) return false;
  if ((state.coins ?? 0) < cost) return false;

  state.coins = round2((state.coins ?? 0) - cost);
  state.inventory[goodKey] = clamp0((state.inventory?.[goodKey] ?? 0) + q);

  // Buying pushes pressure up (future buys are a bit pricier).
  applyPressure(state, goodKey, +q);
  recomputeMarket(state);

  return true;
}

export function canSell(state, goodKey, qty = 1) {
  const q = Math.max(0, Math.floor(qty));
  const unlocked = state.unlocked?.[goodKey] ?? true;
  return unlocked && q > 0 && (state.inventory?.[goodKey] ?? 0) >= q;
}

export function sell(state, goodKey, qty = 1) {
  const q = Math.max(0, Math.floor(qty));
  const price = sellPrice(state, goodKey);
  if (q <= 0) return false;
  if ((state.inventory?.[goodKey] ?? 0) < q) return false;

  state.inventory[goodKey] = clamp0((state.inventory?.[goodKey] ?? 0) - q);
  state.coins = round2((state.coins ?? 0) + price * q);

  // Selling pushes pressure down (you’re adding supply).
  applyPressure(state, goodKey, -q);
  recomputeMarket(state);

  return true;
}
