/**
 * Goal ladder (v0.2.2)
 *
 * Levels are 0-indexed. When the player meets the target, they can Level Up.
 */

/** @type {{ level: number, coins: number, label: string, unlock?: { heat?: boolean, traders?: boolean, cats?: boolean, schemes?: boolean, contract?: boolean } }[]} */
export const GOALS = [
  { level: 0, coins: 100, label: "reach 100 coins (unlock Catnip)" },
  { level: 1, coins: 250, label: "reach 250 coins (unlock Shiny Things)" },
  { level: 2, coins: 500, label: "reach 500 coins", unlock: { heat: true, schemes: true } },
  { level: 3, coins: 800, label: "reach 800 coins", unlock: { traders: true } },
  { level: 4, coins: 1200, label: "reach 1200 coins", unlock: { cats: true } }
];
