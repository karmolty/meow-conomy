import fs from "node:fs";

const path = new URL("../TODO.md", import.meta.url);
const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);

const items = lines.filter((l) => /^\s*- \[[ xX]\]/.test(l));
const checked = items.filter((l) => /- \[[xX]\]/.test(l));
const remaining = items.length - checked.length;
const pct = items.length ? Math.round((checked.length / items.length) * 1000) / 10 : 0;

console.log(`TODO checklist: ${items.length} total, ${checked.length} completed, ${remaining} remaining (${pct}%)`);
