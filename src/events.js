/**
 * Heat-driven events (v0.3)
 *
 * Goals:
 * - Deterministic given starting state (seed).
 * - No hard-fail death spirals; events are setbacks, not game-enders.
 */

/**
 * @typedef {"tax"|"rival"|"confiscation"} EventKind
 */

/**
 * @typedef {Object} GameEvent
 * @property {EventKind} kind
 * @property {string} title
 * @property {string} desc
 */

/** @type {Record<EventKind, {title:string, desc:string}>} */
export const EVENT_DEFS = {
  tax: {
    title: "Cat Tax Audit",
    desc: "A suspiciously polite auditor demands a cut."
  },
  rival: {
    title: "Rival Crew",
    desc: "A rival crew undercuts you and swipes some goods."
  },
  confiscation: {
    title: "Confiscation",
    desc: "Someone important decides your inventory looks illegal."
  }
};

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : 0));
}

function hasJob(state, jobKey) {
  const cats = state?.cats || [];
  return cats.some(c => c?.job === jobKey);
}

/**
 * Event probability per second based on Heat.
 * Guarding reduces probability.
 * @param {number} heat
 * @param {boolean} guarding
 */
export function eventProb(heat, guarding) {
  const h = clamp(heat, 0, 100);
  const base = clamp((h - 20) / 400, 0, 0.18); // 0% under 20 heat; up to 18%/sec at 100 heat
  const mult = guarding ? 0.7 : 1;
  return clamp(base * mult, 0, 0.18);
}

/**
 * xorshift32 in-place RNG.
 * @param {number} u32
 */
export function nextU32(u32) {
  let x = (u32 >>> 0) || 1;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x >>>= 0;
  x ^= x << 5;
  x >>>= 0;
  return x >>> 0;
}

export function rand01(state) {
  state.rng = nextU32(state.rng);
  return (state.rng >>> 0) / 4294967296;
}

/**
 * @param {any} state
 * @param {EventKind} kind
 * @returns {GameEvent}
 */
export function applyEvent(state, kind) {
  const def = EVENT_DEFS[kind];

  if (kind === "tax") {
    // Take a small % of coins; scale gently with heat.
    const pct = clamp(0.04 + (state.heat ?? 0) / 2000, 0.04, 0.10);
    const loss = Math.floor((state.coins ?? 0) * pct);
    state.coins = Math.max(0, (state.coins ?? 0) - loss);
    state.heat = clamp((state.heat ?? 0) - 6, 0, 100); // cools off a bit after attention
  }

  if (kind === "rival") {
    // Remove up to 1 unit of the highest-price good you have.
    const inv = state.inventory || {};
    let best = null;
    let bestPrice = -Infinity;
    for (const [k, qty] of Object.entries(inv)) {
      if ((qty ?? 0) <= 0) continue;
      const p = state.market?.[k]?.price ?? 0;
      if (p > bestPrice) {
        bestPrice = p;
        best = k;
      }
    }
    if (best) inv[best] = Math.max(0, (inv[best] ?? 0) - 1);
    state.heat = clamp((state.heat ?? 0) + 3, 0, 100);
  }

  if (kind === "confiscation") {
    // Lose a couple random units (bounded).
    const inv = state.inventory || {};
    const keys = Object.keys(inv);
    if (keys.length) {
      const k = keys[Math.floor(rand01(state) * keys.length)];
      inv[k] = Math.max(0, (inv[k] ?? 0) - 2);
    }
    state.heat = clamp((state.heat ?? 0) - 10, 0, 100);
  }

  return { kind, title: def.title, desc: def.desc };
}

/**
 * Possibly trigger an event.
 * Rate increases with Heat; at most one event per second.
 * @param {any} state
 */
export function maybeTriggerEvent(state) {
  const sec = Math.floor(Number(state.time) || 0);
  state._lastEventSec ??= -1;
  if (sec === state._lastEventSec) return null;
  state._lastEventSec = sec;

  const p = eventProb(state.heat ?? 0, hasJob(state, "guarding"));
  if (p <= 0) return null;

  if (rand01(state) >= p) return null;

  const roll = rand01(state);
  const kind = roll < 0.5 ? "tax" : roll < 0.8 ? "rival" : "confiscation";
  state.events ||= [];
  const ev = applyEvent(state, kind);
  state.events.unshift({ ...ev, atSec: sec });
  state.events = state.events.slice(0, 10);
  return ev;
}
