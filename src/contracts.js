/**
 * Contracts are timed objectives.
 * v0.2: schema + helpers (generation/selection comes next).
 */

/**
 * @typedef {Object} ContractRequirement
 * @property {string} kind
 * @property {string} [goodKey]
 * @property {number} [qty]
 * @property {number} [coins]
 */

/**
 * @typedef {Object} ContractReward
 * @property {number} coins
 */

/**
 * @typedef {Object} ContractPenalty
 * @property {number} coins
 */

/**
 * @typedef {Object} Contract
 * @property {string} id
 * @property {string} title
 * @property {string} desc
 * @property {ContractRequirement[]} requirements
 * @property {number} deadlineSec
 * @property {ContractReward} reward
 * @property {ContractPenalty} penalty
 * @property {string[]} tags
 */

/**
 * Starter contract set. These are intentionally simple and deterministic.
 * Later: generate variants based on market/heat/difficulty.
 * @type {Contract[]}
 */
export const CONTRACTS = [
  {
    id: "starter-profit-60",
    title: "Quick Flip",
    desc: "Make some clean profit and keep your paws looking innocent.",
    requirements: [{ kind: "earnCoins", coins: 60 }],
    deadlineSec: 180,
    reward: { coins: 25 },
    penalty: { coins: 10 },
    tags: ["starter", "trade", "safe"]
  },
  {
    id: "starter-kibble-8",
    title: "Kibble Delivery",
    desc: "Deliver kibble fast. Don’t ask why.",
    requirements: [{ kind: "deliverGood", goodKey: "kibble", qty: 8 }],
    deadlineSec: 220,
    reward: { coins: 35 },
    penalty: { coins: 12 },
    tags: ["starter", "production", "safe"]
  }
];

/**
 * Best-effort validation (kept tiny; no deps).
 * @param {any} c
 * @returns {c is Contract}
 */
export function isValidContract(c) {
  if (!c || typeof c !== "object") return false;
  if (typeof c.id !== "string" || !c.id) return false;
  if (typeof c.title !== "string" || !c.title) return false;
  if (typeof c.desc !== "string") return false;
  if (!Array.isArray(c.requirements) || c.requirements.length < 1) return false;
  if (!Number.isFinite(c.deadlineSec) || c.deadlineSec <= 0) return false;
  if (!c.reward || !Number.isFinite(c.reward.coins) || c.reward.coins < 0) return false;
  if (!c.penalty || !Number.isFinite(c.penalty.coins) || c.penalty.coins < 0) return false;
  if (!Array.isArray(c.tags)) return false;

  for (const r of c.requirements) {
    if (!r || typeof r !== "object") return false;
    if (typeof r.kind !== "string" || !r.kind) return false;
    if (r.kind === "deliverGood") {
      if (typeof r.goodKey !== "string" || !r.goodKey) return false;
      if (!Number.isFinite(r.qty) || r.qty <= 0) return false;
    } else if (r.kind === "earnCoins") {
      if (!Number.isFinite(r.coins) || r.coins <= 0) return false;
    }
  }

  return true;
}
