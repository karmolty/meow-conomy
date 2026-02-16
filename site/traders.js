/**
 * Hire Traders (assistive automation)
 *
 * Design goals:
 * - Player-configured rules (thresholds, caps).
 * - Constrained (fees, action rate, future Heat) so it supports play.
 * - Deterministic and testable.
 */

/**
 * @typedef {"buyBelow"|"sellAbove"} TraderRuleKind
 */

/**
 * @typedef {Object} TraderRule
 * @property {TraderRuleKind} kind
 * @property {string} goodKey
 * @property {number} price
 * @property {number} qty
 */

/**
 * @typedef {Object} Trader
 * @property {string} id
 * @property {string} name
 * @property {boolean} enabled
 * @property {number} feeBps Fee in basis points (e.g., 50 = 0.50%)
 * @property {number} actionsPerMin Rate limit
 * @property {TraderRule[]} rules
 */

/** @type {Trader[]} */
export const STARTER_TRADERS = [
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
];

/**
 * @param {any} r
 * @returns {r is TraderRule}
 */
export function isValidTraderRule(r) {
  if (!r || typeof r !== "object") return false;
  if (r.kind !== "buyBelow" && r.kind !== "sellAbove") return false;
  if (typeof r.goodKey !== "string" || !r.goodKey) return false;
  if (!Number.isFinite(r.price) || r.price <= 0) return false;
  if (!Number.isFinite(r.qty) || r.qty <= 0) return false;
  return true;
}

/**
 * @param {any} t
 * @returns {t is Trader}
 */
export function isValidTrader(t) {
  if (!t || typeof t !== "object") return false;
  if (typeof t.id !== "string" || !t.id) return false;
  if (typeof t.name !== "string" || !t.name) return false;
  if (typeof t.enabled !== "boolean") return false;
  if (!Number.isFinite(t.feeBps) || t.feeBps < 0) return false;
  if (!Number.isFinite(t.actionsPerMin) || t.actionsPerMin <= 0) return false;
  if (!Array.isArray(t.rules)) return false;
  for (const r of t.rules) if (!isValidTraderRule(r)) return false;
  return true;
}

function feeMultBuy(feeBps) {
  return 1 + (Number(feeBps) || 0) / 10000;
}

function feeMultSell(feeBps) {
  return 1 - (Number(feeBps) || 0) / 10000;
}

/**
 * Execute enabled traders.
 * v0.2: simple, deterministic rule eval + rate limiting.
 * - Each trader accrues `budget` actions over time: actionsPerMin * dt/60.
 * - When budget >= 1, it can perform one rule action (then budget -= 1).
 * @param {any} state
 * @param {number} dt seconds
 */
export function runTraders(state, dt) {
  const safeDt = Math.max(0, Math.min(5, Number(dt) || 0));
  if (!safeDt) return;

  const traders = state?.traders;
  if (!Array.isArray(traders) || traders.length === 0) return;

  state.traderRuntime ||= {};

  for (const t of traders) {
    if (!t?.enabled) continue;
    if (!isValidTrader(t)) continue;

    const rt = (state.traderRuntime[t.id] ||= { budget: 0 });
    rt.budget += (t.actionsPerMin * safeDt) / 60;

    // Hard cap per tick so a long dt doesn't spam.
    let steps = 0;
    while (rt.budget >= 1 && steps < 3) {
      steps += 1;
      rt.budget -= 1;

      for (const r of t.rules) {
        if (!isValidTraderRule(r)) continue;

        const price = state.market?.[r.goodKey]?.price;
        if (!Number.isFinite(price) || price <= 0) continue;

        if (r.kind === "buyBelow") {
          if (price >= r.price) continue;

          const unit = price * feeMultBuy(t.feeBps);
          const qty = Math.max(0, Math.floor(r.qty));
          const cost = unit * qty;
          if (qty <= 0) continue;
          if ((state.coins ?? 0) < cost) continue;

          state.coins = Math.round((state.coins - cost) * 100) / 100;
          state.inventory[r.goodKey] = (state.inventory?.[r.goodKey] ?? 0) + qty;
          break;
        }

        if (r.kind === "sellAbove") {
          if (price <= r.price) continue;

          const qty = Math.max(0, Math.floor(r.qty));
          if (qty <= 0) continue;
          if ((state.inventory?.[r.goodKey] ?? 0) < qty) continue;

          const unit = price * feeMultSell(t.feeBps);
          const proceeds = unit * qty;

          state.inventory[r.goodKey] = (state.inventory?.[r.goodKey] ?? 0) - qty;
          state.coins = Math.round((state.coins + proceeds) * 100) / 100;
          break;
        }
      }
    }
  }
}
