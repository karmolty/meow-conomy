/**
 * Cats / jobs (v0.2).
 * For now this is just schema + starter roster; the allocation mechanics come next.
 */

/**
 * @typedef {"production"|"scouting"|"negotiating"|"guarding"} CatJob
 */

/**
 * @typedef {Object} Cat
 * @property {string} id
 * @property {string} name
 * @property {CatJob|null} job
 */

/** @type {{ key: CatJob, label: string, desc: string }[]} */
export const JOB_DEFS = [
  { key: "production", label: "Production", desc: "Generate goods (or help you source them)." },
  { key: "scouting", label: "Scouting", desc: "Find opportunities; improves market intel." },
  { key: "negotiating", label: "Negotiating", desc: "Better trade execution (tiny price edge)." },
  { key: "guarding", label: "Guarding", desc: "Reduce risk / Heat impacts (later)." }
];

/** @type {Cat[]} */
export const STARTER_CATS = [
  { id: "miso", name: "Miso", job: null },
  { id: "beans", name: "Beans", job: null }
];

/**
 * @param {any} c
 * @returns {c is Cat}
 */
export function isValidCat(c) {
  if (!c || typeof c !== "object") return false;
  if (typeof c.id !== "string" || !c.id) return false;
  if (typeof c.name !== "string" || !c.name) return false;
  if (c.job !== null && !JOB_DEFS.some(j => j.key === c.job)) return false;
  return true;
}
