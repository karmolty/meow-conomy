export const DEFAULT_STATE = {
  resources: {
    purr: 0,
    kibble: 0,
    cardboard: 0
  },
  upgrades: {
    purrInterns: 0
  },
  tech: {
    // techId: true
  },
  _lastTickMs: null
};

export const RESOURCE_DEFS = [
  { key: "purr", label: "Purrs", desc: "The fundamental unit of cat progress." },
  { key: "kibble", label: "Kibble", desc: "A surprisingly strategic resource." },
  { key: "cardboard", label: "Cardboard", desc: "Homes, hats, and corporate office space." }
];

export const TECH_TREE = [
  {
    id: "kibbleBasics",
    name: "Kibble Economics",
    desc: "Establish a stable kibble-backed currency.",
    cost: { purr: 50 }
  },
  {
    id: "boxTheory",
    name: "Box Theory",
    desc: "Prove that every box is simultaneously too small and perfect.",
    cost: { purr: 120 }
  },
  {
    id: "unionizeInterns",
    name: "Intern Unionization",
    desc: "A tiny step for interns, a huge step for nap quotas.",
    cost: { purr: 250 }
  }
];

export function clamp0(n) {
  return Math.max(0, Number.isFinite(n) ? n : 0);
}

export function canAfford(resources, cost) {
  return Object.entries(cost).every(([k, v]) => (resources[k] ?? 0) >= v);
}

export function payCost(resources, cost) {
  for (const [k, v] of Object.entries(cost)) {
    resources[k] = clamp0((resources[k] ?? 0) - v);
  }
}
