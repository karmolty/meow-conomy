// Districts/markets (v0.4 carryover unlock)

export const DISTRICTS = [
  {
    key: "alley",
    label: "Alley Market",
    desc: "Scrappy and familiar. Stable enough to learn the ropes.",
    mult: { base: 1.0, volSlow: 1.0, volFast: 1.0, drift: 1.0, meanRev: 1.0 }
  },
  {
    key: "uptown",
    label: "Uptown Bazaar",
    desc: "Sharper swings, bigger opportunities, less mercy.",
    mult: { base: 1.05, volSlow: 1.10, volFast: 1.20, drift: 1.15, meanRev: 0.95 }
  }
];

export function isValidDistrictKey(key) {
  return DISTRICTS.some(d => d.key === key);
}

export function normalizeDistrictKey(key) {
  return isValidDistrictKey(key) ? key : "alley";
}
