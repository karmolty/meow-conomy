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
