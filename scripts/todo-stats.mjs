import fs from "node:fs";

const path = new URL("../TODO.md", import.meta.url);
const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);

const items = lines.filter((l) => /^\s*- \[[ xX]\]/.test(l));
const checked = items.filter((l) => /- \[[xX]\]/.test(l));
const unchecked = items.filter((l) => /- \[ \]/.test(l));

const remaining = items.length - checked.length;
const pct = items.length ? Math.round((checked.length / items.length) * 1000) / 10 : 0;

console.log(
  `TODO checklist: ${items.length} total, ${checked.length} completed, ${remaining} remaining (${pct}%)`
);

if (unchecked.length) {
  const max = Number.parseInt(process.env.TODO_STATS_MAX || "10", 10);
  const n = Number.isFinite(max) && max > 0 ? max : 10;

  console.log(`\nRemaining (first ${Math.min(n, unchecked.length)}):`);
  for (const l of unchecked.slice(0, n)) {
    console.log("- " + l.replace(/^\s*- \[ \]\s*/, "").trim());
  }
} else {
  console.log("\nRemaining: none (all checklist items are checked)");
}
