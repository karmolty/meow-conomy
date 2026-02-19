/**
 * Season prestige (v0.4)
 *
 * Minimal version:
 * - End Season awards Whisker Points based on run coins.
 * - Resets run state (coins/inventory/market/contracts/heat/etc).
 * - Keeps meta state (whiskers, seasons).
 */

import { GOODS, recomputeMarket } from "./game.js";

function clamp0(n) {
  return Math.max(0, Number.isFinite(n) ? n : 0);
}

/**
 * Whisker Point award formula.
 * Keep it simple and explainable; tune later.
 * @param {number} runCoins
 */
export function whiskersForCoins(runCoins) {
  const coins = clamp0(Number(runCoins) || 0);
  return Math.floor(coins / 200);
}

/**
 * @param {any} state
 * @returns {{whiskersAwarded:number}}
 */
export function endSeason(state) {
  state.meta ||= { whiskers: 0, seasons: 0, schemeSlots: 1 };

  const coins = clamp0(Number(state.coins) || 0);
  const whiskersAwarded = whiskersForCoins(coins);
  state.meta.whiskers = clamp0((Number(state.meta.whiskers) || 0) + whiskersAwarded);
  state.meta.seasons = clamp0((Number(state.meta.seasons) || 0) + 1);

  // Carryover unlock: additional scheme slot after the first completed Season.
  // (This is a small-but-real new lever immediately after prestige.)
  state.meta.schemeSlots = clamp0(Number(state.meta.schemeSlots) || 1);
  if (state.meta.seasons >= 1) state.meta.schemeSlots = Math.max(state.meta.schemeSlots, 2);

  // Reset run resources.
  state.coins = 50;
  state.inventory = Object.fromEntries(GOODS.map(g => [g.key, 0]));
  // Reset FIFO lots (cost basis) for the new season.
  state.lots = Object.fromEntries(GOODS.map(g => [g.key, []]));
  state.lastTrade = null;
  state.heat = 0;

  // Clear contracts.
  if (state.contracts) {
    state.contracts.activeId = null;
    state.contracts.startedAtSec = null;
    state.contracts.startCoins = null;
  }

  // Reset schemes runtime (cooldowns/active effects) for a clean new run.
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

  return { whiskersAwarded };
}
