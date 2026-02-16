// NOTE: This file is intentionally duplicated into /site so GitHub Pages (which deploys only /site)
// can import it directly. Source-of-truth also exists at /src/game.js.

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

export const DEFAULT_STATE = {
  time: 0,
  level: 0,
  coins: 50,
  inventory: Object.fromEntries(GOODS.map(g => [g.key, 0])),
  market: {},

  // Recent price history per good (for UI sparklines).
  history: {},

  unlocked: {
    kibble: true,
    catnip: false,
    contract: false,
    cats: false,
    traders: false,
    heat: false
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

function priceAtTime(good, t) {
  const raw = good.base + good.amp * Math.sin(good.freq * t + good.phase);
  return Math.max(1, round2(raw));
}

export function recomputeMarket(state) {
  state.market ||= {};
  for (const g of GOODS) {
    state.market[g.key] = { price: priceAtTime(g, state.time) };
  }
}

export function tick(state, dt) {
  const safeDt = Math.max(0, Math.min(5, Number(dt) || 0));
  state.time = (Number(state.time) || 0) + safeDt;
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

export function buy(state, goodKey, qty = 1) {
  const q = Math.max(0, Math.floor(qty));
  const price = getPrice(state, goodKey);
  const cost = price * q;
  if (q <= 0) return false;
  if ((state.coins ?? 0) < cost) return false;

  state.coins = round2((state.coins ?? 0) - cost);
  state.inventory[goodKey] = clamp0((state.inventory?.[goodKey] ?? 0) + q);
  return true;
}

export function sell(state, goodKey, qty = 1) {
  const q = Math.max(0, Math.floor(qty));
  const price = getPrice(state, goodKey);
  if (q <= 0) return false;
  if ((state.inventory?.[goodKey] ?? 0) < q) return false;

  state.inventory[goodKey] = clamp0((state.inventory?.[goodKey] ?? 0) - q);
  state.coins = round2((state.coins ?? 0) + price * q);
  return true;
}
