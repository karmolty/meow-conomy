/**
 * Schemes (active abilities) — v0.3
 *
 * Minimal system:
 * - Definitions for scheme cards.
 * - Per-scheme cooldown + (optional) duration.
 * - Deterministic time-based ticking.
 */

/**
 * @typedef {"hustle"|"pricePounce"|"nineLives"|"coolWhiskers"|"marketNap"} SchemeId
 */

/**
 * @typedef {Object} SchemeDef
 * @property {SchemeId} id
 * @property {string} name
 * @property {string} desc
 * @property {number} cooldownSec
 * @property {number} durationSec
 */

/** @type {SchemeDef[]} */
export const SCHEMES = [
  {
    id: "hustle",
    name: "Hustle",
    desc: "Short burst: extra income / output (hooked up later).",
    cooldownSec: 30,
    durationSec: 10
  },
  {
    id: "pricePounce",
    name: "Price Pounce",
    desc: "Briefly improves your buy/sell prices.",
    cooldownSec: 45,
    durationSec: 8
  },
  {
    id: "nineLives",
    name: "Nine Lives",
    desc: "Negate one bad event (hooked up later).",
    cooldownSec: 60,
    durationSec: 0
  },
  {
    id: "coolWhiskers",
    name: "Cool Whiskers",
    desc: "Shed attention fast: reduce Heat immediately.",
    cooldownSec: 40,
    durationSec: 0
  },
  {
    id: "marketNap",
    name: "Market Nap",
    desc: "Let the market breathe: immediately reduces saturation (pressure) across all goods.",
    cooldownSec: 55,
    durationSec: 0
  }
];

/**
 * Initialize scheme runtime state on the game state.
 * @param {any} state
 */
export function ensureSchemes(state) {
  state.schemes ||= {};
  for (const s of SCHEMES) {
    state.schemes[s.id] ||= { cooldownLeft: 0, activeLeft: 0, charges: 0 };
  }
}

/**
 * Tick down cooldowns/durations.
 * @param {any} state
 * @param {number} dt sec
 */
export function tickSchemes(state, dt) {
  ensureSchemes(state);
  const safeDt = Math.max(0, Math.min(5, Number(dt) || 0));
  for (const s of SCHEMES) {
    const rt = state.schemes[s.id];
    rt.cooldownLeft = Math.max(0, (rt.cooldownLeft ?? 0) - safeDt);
    rt.activeLeft = Math.max(0, (rt.activeLeft ?? 0) - safeDt);
  }
}

/**
 * Attempt to activate a scheme.
 * @param {any} state
 * @param {SchemeId} schemeId
 * @returns {boolean}
 */
export function activateScheme(state, schemeId) {
  ensureSchemes(state);
  const def = SCHEMES.find(s => s.id === schemeId);
  if (!def) return false;
  const rt = state.schemes[schemeId];
  if ((rt.cooldownLeft ?? 0) > 0) return false;

  rt.cooldownLeft = def.cooldownSec;
  rt.activeLeft = def.durationSec;

  // For Nine Lives, treat it as a single-use “shield” charge.
  if (schemeId === "nineLives") {
    rt.charges = (rt.charges ?? 0) + 1;
  }

  // Cool Whiskers: immediate Heat reduction (only once Heat exists as a mechanic).
  if (schemeId === "coolWhiskers" && (state?.unlocked?.heat ?? false)) {
    const cur = Number(state.heat) || 0;
    state.heat = Math.max(0, cur - 25);
  }

  // Market Nap: reduce pressure (saturation) on all goods immediately.
  // This is intentionally simple + deterministic.
  if (schemeId === "marketNap") {
    state.market ||= {};
    for (const k of Object.keys(state.market)) {
      const p = Number(state.market[k]?.pressure) || 0;
      state.market[k].pressure = Math.round(p * 0.5 * 100) / 100;
    }
  }

  return true;
}
