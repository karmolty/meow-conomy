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

/**
 * Slot caps per job. Kept tiny for v0.2.
 * @type {Record<CatJob, number>}
 */
export const JOB_CAPS = {
  production: 1,
  scouting: 1,
  negotiating: 1,
  guarding: 1
};

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

/**
 * Count how many cats are currently assigned to each job.
 * @param {any} state
 */
export function jobCounts(state) {
  const counts = { production: 0, scouting: 0, negotiating: 0, guarding: 0 };
  const cats = state?.cats || [];
  for (const c of cats) {
    if (c?.job && counts[c.job] !== undefined) counts[c.job] += 1;
  }
  return counts;
}

/**
 * Assign/unassign a cat to a job, enforcing slot caps.
 * @param {any} state
 * @param {string} catId
 * @param {CatJob|null} job
 * @returns {boolean}
 */
export function assignCatJob(state, catId, job) {
  const cats = state?.cats;
  if (!Array.isArray(cats)) return false;

  const cat = cats.find(c => c.id === catId);
  if (!cat) return false;

  // Unassign always allowed.
  if (job === null) {
    cat.job = null;
    return true;
  }

  if (!JOB_DEFS.some(j => j.key === job)) return false;

  const counts = jobCounts(state);
  const cap = JOB_CAPS[job] ?? 0;

  // If already assigned to same job, no-op success.
  if (cat.job === job) return true;

  // Free a slot if moving from another job.
  if (cat.job && counts[cat.job] !== undefined) counts[cat.job] -= 1;

  if (counts[job] >= cap) return false;

  cat.job = job;
  return true;
}
