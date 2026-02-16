// Core game logic for v0.1.
// Intent: deterministic tick + simple trade loop (active, no idle waiting required).

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
  time: 0, // seconds since start (sim time)
  coins: 50,
  inventory: Object.fromEntries(GOODS.map(g => [g.key, 0])),
  market: {
    // goodKey: { price }
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
  // Deterministic oscillation (no RNG): buy low, sell high.
  // Always keep price >= 1.
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
  // dt in seconds; deterministic based on state.time only.
  const safeDt = Math.max(0, Math.min(5, Number(dt) || 0));
  state.time = (Number(state.time) || 0) + safeDt;
  recomputeMarket(state);
  return state;
}

export function canBuy(state, goodKey, qty = 1) {
  const q = Math.max(0, Math.floor(qty));
  const price = getPrice(state, goodKey);
  return q > 0 && (state.coins ?? 0) >= price * q;
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

export function canSell(state, goodKey, qty = 1) {
  const q = Math.max(0, Math.floor(qty));
  return q > 0 && (state.inventory?.[goodKey] ?? 0) >= q;
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
