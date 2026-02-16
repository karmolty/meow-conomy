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
    phase: 0.0
  },
  {
    key: "catnip",
    label: "Catnip",
    desc: "Volatile, higher risk/reward.",
    base: 18,
    amp: 8,
    freq: 0.65,
    phase: 1.3
  }
];

/** @type {GameState} */
export const DEFAULT_STATE = {
  time: 0, // seconds since start (sim time)
  coins: 50,
  inventory: Object.fromEntries(GOODS.map(g => [g.key, 0])),
  unlocked: {
    kibble: true,
    catnip: false
  },
  market: {
    // goodKey: { price, pressure }
    // pressure is “saturation”: buying pushes it up (more expensive), selling pushes it down.
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

function basePriceAtTime(good, t) {
  // Deterministic oscillation (no RNG): buy low, sell high.
  // Always keep price >= 1.
  const raw = good.base + good.amp * Math.sin(good.freq * t + good.phase);
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

  // Staged unlocks (v0.1): start with Kibble; unlock Catnip at 100 coins.
  state.unlocked ||= {};
  if (state.unlocked.kibble === undefined) state.unlocked.kibble = true;
  if (state.unlocked.catnip === undefined) state.unlocked.catnip = false;
  if (!state.unlocked.catnip && (state.coins ?? 0) >= 100) {
    state.unlocked.catnip = true;
  }

  decayPressure(state, safeDt);
  recomputeMarket(state);
  return state;
}

export function canBuy(state, goodKey, qty = 1) {
  const q = Math.max(0, Math.floor(qty));
  const price = getPrice(state, goodKey);
  const unlocked = state.unlocked?.[goodKey] ?? true;
  return unlocked && q > 0 && (state.coins ?? 0) >= price * q;
}

export function buy(state, goodKey, qty = 1) {
  const q = Math.max(0, Math.floor(qty));
  const price = getPrice(state, goodKey);
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
  const price = getPrice(state, goodKey);
  if (q <= 0) return false;
  if ((state.inventory?.[goodKey] ?? 0) < q) return false;

  state.inventory[goodKey] = clamp0((state.inventory?.[goodKey] ?? 0) - q);
  state.coins = round2((state.coins ?? 0) + price * q);

  // Selling pushes pressure down (you’re adding supply).
  applyPressure(state, goodKey, -q);
  recomputeMarket(state);

  return true;
}
