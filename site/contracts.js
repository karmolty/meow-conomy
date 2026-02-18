/**
 * Contracts are timed objectives.
 * v0.2: schema + helpers.
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
  },
  {
    id: "prestige-heat-hedge",
    title: "Back-Alley Hedge",
    desc: "You’ve got a reputation now. Make profit, but keep Heat under control.",
    requirements: [{ kind: "earnCoins", coins: 120 }],
    deadlineSec: 240,
    reward: { coins: 70 },
    penalty: { coins: 25 },
    tags: ["prestige", "trade", "risky"]
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

/**
 * Returns contracts that are currently eligible to be accepted.
 * For now, we only enforce: no active contract.
 * Later: filter by unlocks/heat/difficulty.
 * @param {any} state
 * @returns {Contract[]}
 */
export function getAvailableContracts(state) {
  if (state?.contracts?.activeId) return [];

  // Heat gating (v0.2.2 / v0.3): at high Heat, nobody wants to work with you.
  // This gives Heat an immediate, visible gameplay effect without hard-failing.
  const heatEnabled = Boolean(state?.unlocked?.heat);
  const heat = Number(state?.heat) || 0;
  if (heatEnabled && heat >= 70) return [];

  const seasons = Number(state?.meta?.seasons) || 0;
  return CONTRACTS.filter(c => {
    // Prestige-gated contracts only appear after at least 1 completed Season.
    const isPrestige = (c.tags || []).includes("prestige");
    if (isPrestige) return seasons >= 1;
    return true;
  });
}

/**
 * Attempt to accept a contract by id.
 * Enforces: at most 1 active contract.
 * @param {any} state
 * @param {string} contractId
 * @returns {boolean}
 */
export function acceptContractById(state, contractId) {
  const c = CONTRACTS.find(x => x.id === contractId);
  if (!c) return false;
  return acceptContract(state, c);
}

/**
 * Attempt to start a contract.
 * Enforces: at most 1 active contract.
 * @param {any} state
 * @param {Contract} contract
 * @returns {boolean} true if accepted
 */
export function acceptContract(state, contract) {
  state.contracts ||= { activeId: null, startedAtSec: null, startCoins: null };
  if (state.contracts.activeId) return false;
  state.contracts.activeId = contract.id;
  state.contracts.startedAtSec = Number.isFinite(state.time) ? state.time : 0;
  state.contracts.startCoins = Number.isFinite(state.coins) ? state.coins : 0;
  return true;
}

/**
 * @param {any} state
 * @returns {Contract | null}
 */
export function getActiveContract(state) {
  const id = state.contracts?.activeId;
  if (!id) return null;
  return CONTRACTS.find(c => c.id === id) || null;
}

/**
 * Abandon the currently active contract.
 * Applies penalty (coins) and clears active.
 * @param {any} state
 * @returns {boolean} true if abandoned
 */
export function abandonActiveContract(state) {
  const c = getActiveContract(state);
  if (!c) return false;

  const penalty = c.penalty?.coins ?? 0;
  state.coins = Math.max(0, (Number(state.coins) || 0) - penalty);

  state.contracts.activeId = null;
  state.contracts.startedAtSec = null;
  state.contracts.startCoins = null;

  return true;
}

/**
 * If the active contract is expired, apply penalty and clear it.
 * Intended to be called from the main tick loop.
 * @param {any} state
 * @returns {boolean} true if a contract was failed
 */
export function failExpiredActiveContract(state) {
  const c = getActiveContract(state);
  if (!c) return false;
  if (!isActiveContractExpired(state)) return false;

  const penalty = c.penalty?.coins ?? 0;
  state.coins = Math.max(0, (Number(state.coins) || 0) - penalty);

  state.contracts.activeId = null;
  state.contracts.startedAtSec = null;
  state.contracts.startCoins = null;

  return true;
}

/**
 * Whether the active contract deadline has passed.
 * @param {any} state
 * @returns {boolean}
 */
export function isActiveContractExpired(state) {
  const c = getActiveContract(state);
  if (!c) return false;
  const started = Number(state.contracts?.startedAtSec);
  const now = Number(state.time);
  if (!Number.isFinite(started) || !Number.isFinite(now)) return false;
  return now - started > c.deadlineSec;
}

/**
 * Check whether the active contract's requirements are currently satisfied.
 * (Does not consider deadline; UI should still show remaining time.)
 * @param {any} state
 * @returns {boolean}
 */
export function isActiveContractComplete(state) {
  const c = getActiveContract(state);
  if (!c) return false;

  for (const r of c.requirements || []) {
    if (r.kind === "earnCoins") {
      const startCoins = Number(state.contracts?.startCoins) || 0;
      const earned = Math.max(0, (Number(state.coins) || 0) - startCoins);
      if (earned < (r.coins ?? 0)) return false;
    } else if (r.kind === "deliverGood") {
      const have = Number(state.inventory?.[r.goodKey] ?? 0) || 0;
      if (have < (r.qty ?? 0)) return false;
    } else {
      // Unknown requirement type → treat as incomplete.
      return false;
    }
  }

  return true;
}

/**
 * Redeem the active contract if complete: grants reward and clears active.
 * @param {any} state
 * @returns {boolean} true if redeemed
 */
export function redeemActiveContract(state) {
  const c = getActiveContract(state);
  if (!c) return false;
  if (!isActiveContractComplete(state)) return false;

  // Apply requirement side-effects (e.g., consume delivered goods).
  for (const r of c.requirements || []) {
    if (r.kind === "deliverGood") {
      const key = r.goodKey;
      const qty = Number(r.qty) || 0;
      if (key) {
        const have = Number(state.inventory?.[key] ?? 0) || 0;
        state.inventory[key] = Math.max(0, have - qty);
      }
    }
  }

  const reward = c.reward?.coins ?? 0;
  state.coins = (Number(state.coins) || 0) + reward;

  state.contracts.activeId = null;
  state.contracts.startedAtSec = null;
  state.contracts.startCoins = null;

  return true;
}
