// Formatting helpers shared by core logic + tests.
// Keep this file dependency-free so it can be imported from Node tests.

export function fmt(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return "0";

  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(2) + "K";

  const rounded = Math.round(n * 100) / 100;
  if (Math.abs(rounded) < 1e-9) return "0";

  // Keep small numbers readable: show integers without a trailing ".00".
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return rounded.toFixed(2);
}

export function fmtPct(pct, digits = 1) {
  pct = Number(pct);
  if (!Number.isFinite(pct)) return "0%";
  const d = Math.max(0, Math.min(3, Math.floor(Number(digits) || 0)));
  const rounded = Math.round(pct * Math.pow(10, d)) / Math.pow(10, d);
  // Avoid "-0.0%".
  const val = Math.abs(rounded) < 1e-9 ? 0 : rounded;
  return `${val.toFixed(d)}%`;
}
