import { DEFAULT_STATE, GOODS, tick, buy, sell, getPrice } from "./game.js";
import { fmt } from "./format.js";
import {
  getAvailableContracts,
  getActiveContract,
  acceptContractById,
  abandonActiveContract,
  isActiveContractComplete,
  redeemActiveContract
} from "./contracts.js";

import { JOB_DEFS, JOB_CAPS, assignCatJob, jobCounts } from "./cats.js";
import { SCHEMES, activateScheme } from "./schemes.js";
import { GOALS } from "./goals.js";
import { endSeason, whiskersForCoins } from "./prestige.js";
import { DISTRICTS, normalizeDistrictKey } from "./districts.js";

const STORAGE_KEY = "meowconomy.save.v0.2.1";
const STORAGE_PREFIX = "meowconomy.save.";
const FLASH_KEY = "meowconomy.flash";

function nowMs() { return Date.now(); }

// Mobile browsers (notably iOS Safari) may fire a synthetic "click" after a touch.
// We bind both for responsiveness, but ignore click events that arrive right after a touch.
let lastTouchEndMs = 0;
function ignoreGhostClick(e) {
  if (e?.type === "touchend") lastTouchEndMs = nowMs();
  if (e?.type === "click" && nowMs() - lastTouchEndMs < 650) return true;
  return false;
}

// iOS Safari compatibility: structuredClone shipped relatively late.
// If it doesn't exist, fall back to a JSON deep-clone (safe for our plain data state).
function clone(obj) {
  if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

function normalizeLoadedState(s) {
  // Keep old saves working as we add new fields.
  s = s && typeof s === "object" ? s : {};

  s.unlocked = s.unlocked && typeof s.unlocked === "object" ? s.unlocked : {};

  // Coerce seed to uint32 if present (but preserve null/undefined as "missing").
  if (s.seed != null) s.seed = (Number(s.seed) >>> 0);

  s.level = Math.max(0, Math.floor(Number(s.level) || 0));

  s.meta ||= {};
  s.meta.whiskers = Number(s.meta.whiskers) || 0;
  s.meta.seasons = Number(s.meta.seasons) || 0;
  s.meta.schemeSlots = Math.max(1, Math.floor(Number(s.meta.schemeSlots) || 1));
  s.meta.district = normalizeDistrictKey(s.meta.district || "alley");
  {
    const arr = Array.isArray(s.meta.districtsUnlocked) ? s.meta.districtsUnlocked : [];
    const norm = arr.map(normalizeDistrictKey).filter(Boolean);
    const set = new Set(norm.length ? norm : ["alley"]);
    // Ensure current district is always selectable (even if old saves missed it).
    set.add(s.meta.district);
    s.meta.districtsUnlocked = [...set];
  }
  if (!s.meta.challenge) s.meta.challenge = "none";

  // Back-compat: older saves may have stored challenge flags as booleans.
  // Prefer an explicit mode if present.
  if (s.meta.challenge === "none") {
    if (s.meta.ironContracts === true) s.meta.challenge = "ironContracts";
    else if (s.meta.heatDeath === true) s.meta.challenge = "heatDeath";
  }

  s.inventory = s.inventory && typeof s.inventory === "object" ? s.inventory : {};
  s.market = s.market && typeof s.market === "object" ? s.market : {};
  s.marketLatent = s.marketLatent && typeof s.marketLatent === "object" ? s.marketLatent : {};

  s.cats = Array.isArray(s.cats) ? s.cats : [];
  s.traders = Array.isArray(s.traders) ? s.traders : [];

  s.contracts = s.contracts && typeof s.contracts === "object" ? s.contracts : {};

  s.history = s.history && typeof s.history === "object" ? s.history : {};
  if (!Array.isArray(s.history.coins)) s.history.coins = [];
  if (!Array.isArray(s.history.netWorth)) s.history.netWorth = [];
  if (!Array.isArray(s.history.heat)) s.history.heat = [];
  // Per-good price history used by sparklines (older saves may not have it).
  for (const g of GOODS) {
    if (!Array.isArray(s.history[g.key])) s.history[g.key] = [];
  }

  return s;
}

function load() {
  try {
    const base = clone(DEFAULT_STATE);

    // Prefer current key.
    let loadedKey = STORAGE_KEY;
    let raw = localStorage.getItem(STORAGE_KEY);

    // Back-compat: if we ever bump STORAGE_KEY, try to find the newest legacy save
    // by prefix and migrate it forward.
    if (!raw) {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
      }
      // Sort by numeric version segments if present, else fallback to lexicographic.
      function verParts(k) {
        const rest = k.slice(STORAGE_PREFIX.length);
        const nums = rest.match(/\d+/g);
        if (!nums) return null;
        return nums.map(n => Number(n) || 0);
      }
      function cmpVer(a, b) {
        const av = verParts(a);
        const bv = verParts(b);
        if (!av && !bv) return a < b ? -1 : a > b ? 1 : 0;
        if (!av) return -1;
        if (!bv) return 1;
        const n = Math.max(av.length, bv.length);
        for (let i = 0; i < n; i++) {
          const ai = av[i] ?? 0;
          const bi = bv[i] ?? 0;
          if (ai !== bi) return ai - bi;
        }
        return a < b ? -1 : a > b ? 1 : 0;
      }

      keys.sort(cmpVer);
      const legacyKey = keys.length ? keys[keys.length - 1] : null;
      if (legacyKey && legacyKey !== STORAGE_KEY) {
        raw = localStorage.getItem(legacyKey);
        if (raw) {
          loadedKey = legacyKey;
          // Migrate on successful parse below.
        }
      }
    }

    if (!raw) return normalizeLoadedState(base);

    const parsed = JSON.parse(raw);
    const merged = { ...base, ...parsed };
    const norm = normalizeLoadedState(merged);

    // If we loaded something other than the current key, persist it forward.
    // (Best-effort; ignore quota errors.)
    if (loadedKey !== STORAGE_KEY) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(norm));
        localStorage.removeItem(loadedKey);
      } catch {}
    }

    return norm;
  } catch {
    return normalizeLoadedState(clone(DEFAULT_STATE));
  }
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota errors (or blocked storage) should not crash the game loop.
    // Best-effort: surface a tiny status message if the UI is ready.
    try { flashStatus?.("save failed", 2200); } catch {}
  }
}

// (fmt moved to ./format.js)

const els = {
  app: document.getElementById("app"),
  coins: document.getElementById("statCoins"),
  coinsSpark: document.getElementById("coinsSpark"),
  netWorth: document.getElementById("statNetWorth"),
  nwRate: document.getElementById("statNwRate"),
  nwSpark: document.getElementById("nwSpark"),
  incomeRate: document.getElementById("statIncomeRate"),
  incomeSpark: document.getElementById("incomeSpark"),
  heat: document.getElementById("statHeat"),
  heatLine: document.getElementById("heatLine"),
  heatSpark: document.getElementById("heatSpark"),
  whiskers: document.getElementById("statWhiskers"),
  seasons: document.getElementById("statSeasons"),
  seed: document.getElementById("statSeed"),
  seedLine: document.getElementById("seedLine"),
  districtRow: document.getElementById("districtRow"),
  districtSelect: document.getElementById("districtSelect"),
  progressBar: document.getElementById("progressBar"),
  progressFill: document.getElementById("progressFill"),
  progressLabel: document.getElementById("progressLabel"),
  goalText: document.getElementById("goalText"),
  coreHint: document.getElementById("coreHint"),
  btnLevelUp: document.getElementById("btnLevelUp"),
  market: document.getElementById("market"),
  inventory: document.getElementById("inventory"),
  contract: document.getElementById("contract"),
  cats: document.getElementById("cats"),
  traders: document.getElementById("traders"),
  schemes: document.getElementById("schemes"),
  saveStatus: document.getElementById("saveStatus"),
  btnHardReset: document.getElementById("btnHardReset"),
  btnExportSave: document.getElementById("btnExportSave"),
  btnImportSave: document.getElementById("btnImportSave"),
  btnImportFile: document.getElementById("btnImportFile"),
  fileImport: document.getElementById("fileImport"),
  btnEndSeason: document.getElementById("btnEndSeason"),
  prestigeExplainer: document.getElementById("prestigeExplainer"),
  challengeRow: document.getElementById("challengeRow"),
  ironChallenge: document.getElementById("ironChallenge"),
  chkIronContracts: document.getElementById("chkIronContracts"),
  heatChallenge: document.getElementById("heatChallenge"),
  chkHeatDeath: document.getElementById("chkHeatDeath"),
  repoLink: document.getElementById("repoLink"),
  gameTitle: document.getElementById("gameTitle"),
  helpDetails: document.getElementById("helpDetails"),
  versionLine: document.getElementById("versionLine"),
  appVersion: document.getElementById("appVersion")
};

function getAppVersion() {
  const meta = document.querySelector('meta[name="meow-conomy-version"]');
  return (meta?.getAttribute("content") || "dev").trim() || "dev";
}

if (els.appVersion) {
  els.appVersion.textContent = getAppVersion();
}
if (els.versionLine) {
  // Avoid a brief "dev" flash before JS initializes the version label.
  els.versionLine.style.display = "";
}

const state = load();
// Seed should be initialized once per new save so price evolution can be deterministic per-save.
// Note: 0 is a valid uint32 seed; only treat null/undefined as missing.
if (state.seed == null) {
  state.seed = (Math.random() * 2 ** 32) >>> 0;
  save(state);
}
state._lastTickMs ??= nowMs();

// District selector: swap market behavior (prestige unlock).
if (els.districtSelect) {
  els.districtSelect.addEventListener("change", () => {
    state.meta ||= { whiskers: 0, seasons: 0, schemeSlots: 1, district: "alley", districtsUnlocked: ["alley"] };
    state.meta.district = normalizeDistrictKey(els.districtSelect.value);
    // Nuke latent so the new district "feels" immediate and deterministic.
    state.marketLatent = {};
    tick(state, 0);
    save(state);
    render();
  });
}

let _statusTimer = null;
function setSaveStatus(text) {
  els.saveStatus.textContent = text;
  els.saveStatus.style.borderColor = text === "saved" ? "var(--line)" : "rgba(43,122,120,.35)";
}

function flashStatus(text, ms = 1200) {
  if (_statusTimer) clearTimeout(_statusTimer);
  setSaveStatus(text);
  _statusTimer = setTimeout(() => setSaveStatus("saved"), ms);
}

// Show a one-shot status message after a full page reload (e.g. after importing a save).
try {
  const msg = sessionStorage.getItem(FLASH_KEY);
  if (msg) {
    sessionStorage.removeItem(FLASH_KEY);
    setTimeout(() => flashStatus(msg, 1600), 30);
  }
} catch {
  // ignore
}

function maybeHaptic() {
  // Android only; iOS Safari generally does not support navigator.vibrate.
  try { navigator.vibrate?.(10); } catch {}
}

function pulse(btn, kind = "green") {
  if (!btn) return;
  const cls = kind === "red" ? "pulseRed" : "pulse";
  btn.classList.remove(cls);
  // force reflow so re-adding restarts the animation
  void btn.offsetWidth;
  btn.classList.add(cls);
  setTimeout(() => btn.classList.remove(cls), 260);
}

function spawnFloater(text, { x, y, kind = "gain" } = {}) {
  const layer = document.getElementById("floaties");
  if (!layer) return;

  // Default to a nice spot near the bottom-right quadrant.
  const px = Number.isFinite(x) ? x : Math.round(window.innerWidth * 0.70);
  const py = Number.isFinite(y) ? y : Math.round(window.innerHeight * 0.55);

  const el = document.createElement("div");
  el.className = "floater" + (kind === "lose" ? " lose" : "");
  el.textContent = text;
  el.style.left = px + "px";
  el.style.top = py + "px";

  layer.appendChild(el);
  // remove after animation
  setTimeout(() => el.remove(), 1100);
}


function sparkline(values, width = 14) {
  const valsAll = (values || []).filter(n => Number.isFinite(n));
  if (valsAll.length < 2) return "";

  // Keep it a fixed, small width to avoid UI reshuffles.
  const vals = valsAll.slice(-width);

  let min = Infinity;
  let max = -Infinity;
  for (const v of vals) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return "";

  const blocks = "▁▂▃▄▅▆▇█";
  const span = max - min;
  const s = vals
    .map(v => {
      const t = (v - min) / span;
      const i = Math.max(0, Math.min(blocks.length - 1, Math.round(t * (blocks.length - 1))));
      return blocks[i];
    })
    .join("");

  // Pad to fixed width so it doesn’t jitter as history grows.
  return s.padStart(width, " ");
}

function renderMarket() {
  els.market.innerHTML = "";

  for (const g of GOODS) {
    if (!(state.unlocked?.[g.key] ?? true)) continue;
    const price = getPrice(state, g.key);

    const div = document.createElement("div");
    div.className = "item";

    const top = document.createElement("div");
    top.className = "row";

    const left = document.createElement("div");
    left.innerHTML = `<strong>${g.label}</strong>`;

    const right = document.createElement("div");
    const pressure = state.market?.[g.key]?.pressure ?? 0;
    const hist = state.history?.[g.key] ?? [];
    const spark = sparkline(hist, 14);
    const sparkSpan = spark
      ? ` <span class="muted" aria-hidden="true" title="recent trend" style="display:inline-block;width:14ch;white-space:pre;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;line-height:1;">${spark}</span>`
      : "";
    right.innerHTML = `<strong class="num">${fmt(price)}</strong> <span class="muted">coins</span> <span class="muted" title="Saturation (price pressure): repeated buying raises it and makes future buys pricier; repeated selling lowers it; it decays back toward 0 over time.">(sat ${fmt(pressure)})</span>${sparkSpan}`;

    top.append(left, right);

    const bottom = document.createElement("div");
    bottom.className = "row";
    bottom.style.marginTop = "10px";

    const desc = document.createElement("div");
    desc.className = "muted";
    desc.style.maxWidth = "360px";
    desc.textContent = g.desc;

    const btnRow = document.createElement("div");
    btnRow.className = "row";
    btnRow.style.justifyContent = "flex-end";

    const buyBtn = document.createElement("button");
    buyBtn.className = "primary square";
    buyBtn.textContent = "Buy";
    buyBtn.setAttribute("aria-label", `Buy 1 ${g.label}`);
    buyBtn.disabled = state.coins < price;
    function doBuyOne(e) {
      if (ignoreGhostClick(e)) return;
      // iOS Safari: prevent touch gestures (double-tap zoom) from winning.
      if (e?.cancelable) e.preventDefault();
      const before = state.coins;
      if (!buy(state, g.key, 1)) {
        pulse(buyBtn, "red");
        return;
      }
      const spent = Math.max(0, (before ?? 0) - (state.coins ?? 0));
      if (spent > 0) spawnFloater(`-$${fmt(spent)}`, { kind: "lose" });
      maybeHaptic();
      pulse(buyBtn, "green");
      save(state);
      render();
    }

    buyBtn.addEventListener("click", doBuyOne);
    buyBtn.addEventListener("touchend", doBuyOne, { passive: false });

    const sellBtn = document.createElement("button");
    sellBtn.className = "square";
    sellBtn.textContent = "Sell";
    sellBtn.setAttribute("aria-label", `Sell 1 ${g.label}`);
    sellBtn.disabled = (state.inventory?.[g.key] ?? 0) < 1;
    function doSellOne(e) {
      if (ignoreGhostClick(e)) return;
      if (e?.cancelable) e.preventDefault();
      if (!sell(state, g.key, 1)) {
        pulse(sellBtn, "red");
        return;
      }
      // Show realized P/L (FIFO), not gross proceeds.
      const pnl = Number(state.lastTrade?.kind === "sell" ? state.lastTrade?.pnl : NaN);
      if (Number.isFinite(pnl) && pnl !== 0) {
        spawnFloater(`${pnl >= 0 ? "+" : "-"}$${fmt(Math.abs(pnl))}`, { kind: pnl >= 0 ? "gain" : "lose" });
      }
      maybeHaptic();
      pulse(sellBtn, "green");
      save(state);
      render();
    }

    sellBtn.addEventListener("click", doSellOne);
    sellBtn.addEventListener("touchend", doSellOne, { passive: false });

    btnRow.append(buyBtn, sellBtn);
    bottom.append(desc, btnRow);

    div.append(top, bottom);
    els.market.appendChild(div);
  }
}

function renderInventory() {
  els.inventory.innerHTML = "";
  for (const g of GOODS) {
    if (!(state.unlocked?.[g.key] ?? true)) continue;
    const qty = state.inventory?.[g.key] ?? 0;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div class="row"><div><strong>${g.label}</strong></div><div>${qty}</div></div>`;
    els.inventory.appendChild(div);
  }
}

function renderCats() {
  if (!els.cats) return;
  els.cats.innerHTML = "";

  const cats = state.cats || [];
  const counts = jobCounts(state);

  for (const c of cats) {
    const div = document.createElement("div");
    div.className = "item";

    const top = document.createElement("div");
    top.className = "row";

    const name = document.createElement("div");
    name.innerHTML = `<strong>${c.name}</strong> <span class="muted">(${c.id})</span>`;

    const select = document.createElement("select");
    select.setAttribute("aria-label", `Job for ${c.name}`);
    select.style.minHeight = "48px";
    select.style.border = "1px solid var(--line)";
    select.style.borderRadius = "12px";
    select.style.padding = "10px 12px";
    select.style.fontWeight = "800";
    select.style.background = "#fff";

    const optNone = document.createElement("option");
    optNone.value = "";
    optNone.textContent = "Unassigned";
    select.appendChild(optNone);

    for (const j of JOB_DEFS) {
      const opt = document.createElement("option");
      opt.value = j.key;
      const cap = JOB_CAPS[j.key] ?? 0;
      const used = counts[j.key] ?? 0;
      const isThis = c.job === j.key;
      const full = used >= cap && !isThis;
      opt.disabled = full;
      opt.textContent = `${j.label}${cap ? ` (${used}/${cap})` : ""}`;
      select.appendChild(opt);
    }

    select.value = c.job ?? "";
    select.addEventListener("change", () => {
      const v = select.value || null;
      const ok = assignCatJob(state, c.id, v);
      if (!ok) {
        // revert
        select.value = c.job ?? "";
        pulse(select, "red");
        return;
      }
      save(state);
      render();
    });

    top.append(name, select);

    const desc = document.createElement("div");
    desc.className = "muted";
    desc.style.marginTop = "8px";
    const jobDef = JOB_DEFS.find(j => j.key === c.job);
    desc.textContent = jobDef ? jobDef.desc : "Pick a job for bonuses later.";

    div.append(top, desc);
    els.cats.appendChild(div);
  }
}

function renderSchemes() {
  if (!els.schemes) return;
  els.schemes.innerHTML = "";

  state.meta ||= { whiskers: 0, seasons: 0, schemeSlots: 1 };
  const slots = Math.max(1, Math.floor(Number(state.meta.schemeSlots) || 1));

  SCHEMES.forEach((s, i) => {
    const rt = state.schemes?.[s.id] || { cooldownLeft: 0, activeLeft: 0, charges: 0 };
    const cd = Math.ceil(rt.cooldownLeft ?? 0);
    const active = Math.ceil(rt.activeLeft ?? 0);

    const locked = i >= slots;

    const div = document.createElement("div");
    div.className = "item";

    const top = document.createElement("div");
    top.className = "row";

    const left = document.createElement("div");
    const charges = Math.max(0, Math.floor(rt.charges ?? 0));
    const chargeLabel = (!locked && s.id === "nineLives" && charges > 0) ? ` · shield ${charges}x` : "";
    left.innerHTML = `<strong>${s.name}</strong> <span class="muted">${locked ? "locked" : cd > 0 ? `CD ${cd}s` : "ready"}${!locked && active > 0 ? ` · active ${active}s` : ""}${chargeLabel}</span>`;

    const btn = document.createElement("button");
    const needsHeat = s.id === "coolWhiskers" && !(state.unlocked?.heat ?? false);
    btn.className = (!locked && cd <= 0 && !needsHeat) ? "primary" : "";
    btn.disabled = locked || cd > 0 || needsHeat;
    btn.textContent = locked ? "Locked" : needsHeat ? "Need Heat" : (cd > 0 ? "Cooling" : "Use");
    btn.setAttribute(
      "aria-label",
      locked ? `${s.name} (locked)` : needsHeat ? `${s.name} (requires Heat unlock)` : `Use scheme: ${s.name}`
    );
    // A11y: expose the keyboard shortcut (1–5) to assistive tech.
    btn.setAttribute("aria-keyshortcuts", String(i + 1));
    btn.title = locked ? "Unlock more scheme slots by ending seasons." : needsHeat ? "Unlock Heat to use Cool Whiskers." : "";
    btn.addEventListener("click", () => {
      if (locked) return;
      if (!activateScheme(state, s.id)) {
        pulse(btn, "red");
        return;
      }
      save(state);
      render();
    });

    top.append(left, btn);

    const desc = document.createElement("div");
    desc.className = "muted";
    desc.style.marginTop = "8px";
    desc.textContent = s.desc;

    if (locked) {
      const hint = document.createElement("div");
      hint.className = "muted";
      hint.style.marginTop = "8px";
      hint.textContent = "End a Season to unlock more scheme slots.";
      div.append(top, desc, hint);
    } else {
      div.append(top, desc);
    }

    els.schemes.appendChild(div);
  });
}

function renderTraders() {
  if (!els.traders) return;
  els.traders.innerHTML = "";

  const traders = state.traders || [];
  if (!traders.length) {
    els.traders.innerHTML = `<div class="muted">No traders yet.</div>`;
    return;
  }

  for (const t of traders) {
    const div = document.createElement("div");
    div.className = "item";

    const top = document.createElement("div");
    top.className = "row";

    const left = document.createElement("div");
    left.innerHTML = `<strong>${t.name}</strong> <span class="muted">(fee ${fmt(t.feeBps / 100)}%)</span>`;

    const toggle = document.createElement("button");
    toggle.className = t.enabled ? "primary" : "";
    toggle.textContent = t.enabled ? "Enabled" : "Disabled";
    toggle.setAttribute("aria-label", `Toggle trader ${t.name}`);
    toggle.addEventListener("click", () => {
      t.enabled = !t.enabled;
      save(state);
      render();
    });

    top.append(left, toggle);

    const rulesWrap = document.createElement("div");
    rulesWrap.className = "list";
    rulesWrap.style.marginTop = "10px";

    for (const r of t.rules || []) {
      const row = document.createElement("div");
      row.className = "row";

      const label = document.createElement("div");
      label.className = "muted";
      label.textContent = `${r.kind} ${r.goodKey}`;

      const price = document.createElement("input");
      price.type = "number";
      price.step = "0.1";
      price.value = String(r.price ?? 0);
      price.setAttribute("aria-label", `Trader rule price for ${r.kind} ${r.goodKey}`);
      price.style.width = "90px";
      price.style.minHeight = "48px";
      price.style.border = "1px solid var(--line)";
      price.style.borderRadius = "12px";
      price.style.padding = "10px 12px";
      price.addEventListener("change", () => {
        r.price = Number(price.value) || 0;
        save(state);
        setSaveStatus("saved");
      });

      const qty = document.createElement("input");
      qty.type = "number";
      qty.step = "1";
      qty.min = "1";
      qty.value = String(r.qty ?? 1);
      qty.setAttribute("aria-label", `Trader rule quantity for ${r.kind} ${r.goodKey}`);
      qty.style.width = "70px";
      qty.style.minHeight = "48px";
      qty.style.border = "1px solid var(--line)";
      qty.style.borderRadius = "12px";
      qty.style.padding = "10px 12px";
      qty.addEventListener("change", () => {
        r.qty = Math.max(1, Math.floor(Number(qty.value) || 1));
        qty.value = String(r.qty);
        save(state);
        setSaveStatus("saved");
      });

      row.append(label, price, qty);
      rulesWrap.appendChild(row);
    }

    div.append(top, rulesWrap);
    els.traders.appendChild(div);
  }
}

function renderContract() {
  if (!els.contract) return;
  els.contract.innerHTML = "";

  const active = getActiveContract(state);
  if (active) {
    const div = document.createElement("div");
    div.className = "item";

    const startedAt = state.contracts?.startedAtSec ?? state.time ?? 0;
    const elapsed = Math.max(0, (state.time ?? 0) - startedAt);
    const remaining = Math.max(0, Math.ceil(active.deadlineSec - elapsed));

    function fmtTime(sec) {
      const s = Math.max(0, Math.floor(sec));
      const m = Math.floor(s / 60);
      const r = s % 60;
      return `${m}:${String(r).padStart(2, "0")}`;
    }

    const top = document.createElement("div");
    top.className = "row";
    const urgentStyle = remaining <= 10 ? "color:#b91c1c;font-weight:900;" : "";
    top.innerHTML = `<div><strong>${active.title}</strong></div><div class="muted" style="${urgentStyle}">${fmtTime(remaining)} left</div>`;

    const desc = document.createElement("div");
    desc.className = "muted";
    desc.style.marginTop = "8px";
    desc.textContent = active.desc;

    const reqWrap = document.createElement("div");
    reqWrap.className = "list";
    reqWrap.style.marginTop = "12px";

    for (const r of active.requirements) {
      const row = document.createElement("div");
      row.className = "muted";

      let label = "";
      let cur = 0;
      let goal = 0;

      if (r.kind === "earnCoins") {
        const startCoins = state.contracts?.startCoins ?? 0;
        cur = Math.max(0, (state.coins ?? 0) - startCoins);
        goal = r.coins ?? 0;
        label = `Earn coins: ${fmt(cur)} / ${fmt(goal)}`;
      } else if (r.kind === "deliverGood") {
        cur = state.inventory?.[r.goodKey] ?? 0;
        goal = r.qty ?? 0;
        label = `Deliver ${r.goodKey}: ${cur} / ${goal}`;
      } else {
        label = `${r.kind}`;
      }

      const text = document.createElement("div");
      text.textContent = label;

      const p = goal > 0 ? Math.max(0, Math.min(1, cur / goal)) : 0;
      const bar = document.createElement("div");
      bar.className = "progress";
      bar.style.height = "10px";
      bar.style.marginTop = "6px";
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-label", label);
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", String(goal));
      bar.setAttribute("aria-valuenow", String(cur));
      bar.setAttribute("aria-valuetext", `${fmt(cur)} / ${fmt(goal)}`);

      const fill = document.createElement("div");
      fill.className = "progressFill";
      fill.style.width = `${Math.round(p * 100)}%`;
      bar.appendChild(fill);

      row.append(text, bar);
      reqWrap.appendChild(row);
    }

    const rewards = document.createElement("div");
    rewards.className = "muted";
    rewards.style.marginTop = "10px";
    rewards.textContent = `Reward: +${active.reward.coins} coins · Penalty: -${active.penalty.coins} coins`;

    const btnRow = document.createElement("div");
    btnRow.className = "row";
    btnRow.style.justifyContent = "flex-end";
    btnRow.style.marginTop = "10px";

    const complete = isActiveContractComplete(state);

    if (complete) {
      const redeem = document.createElement("button");
      redeem.className = "primary";
      redeem.textContent = "Redeem";
      redeem.setAttribute("aria-label", `Redeem contract: ${active.title}`);
      redeem.addEventListener("click", () => {
        redeemActiveContract(state);
        save(state);
        render();
      });
      btnRow.append(redeem);
    }

    const abandon = document.createElement("button");
    abandon.textContent = `Abandon (-${active.penalty.coins} coins)`;
    abandon.setAttribute("aria-label", `Abandon contract: ${active.title}`);
    abandon.addEventListener("click", () => {
      abandonActiveContract(state);
      save(state);
      render();
    });

    btnRow.append(abandon);
    div.append(top, desc, reqWrap, rewards, btnRow);
    els.contract.appendChild(div);
    return;
  }

  const available = getAvailableContracts(state);
  if (!available.length) {
    const heatBlocked = (state.unlocked?.heat && (state.heat ?? 0) >= 70);
    els.contract.innerHTML = heatBlocked
      ? `<div class="muted">Too much Heat. Lay low to get contracts again.</div>`
      : `<div class="muted">No contracts available.</div>`;
    return;
  }

  for (const c of available) {
    const div = document.createElement("div");
    div.className = "item";

    const top = document.createElement("div");
    top.className = "row";
    top.innerHTML = `<div><strong>${c.title}</strong></div><div class="muted">+${c.reward.coins} coins</div>`;

    const desc = document.createElement("div");
    desc.className = "muted";
    desc.style.marginTop = "8px";
    desc.textContent = c.desc;

    const btnRow = document.createElement("div");
    btnRow.className = "row";
    btnRow.style.justifyContent = "flex-end";
    btnRow.style.marginTop = "10px";

    const accept = document.createElement("button");
    accept.className = "primary";
    accept.textContent = "Accept";
    accept.setAttribute("aria-label", `Accept contract: ${c.title}`);
    accept.addEventListener("click", () => {
      acceptContractById(state, c.id);
      save(state);
      render();
    });

    btnRow.append(accept);
    div.append(top, desc, btnRow);
    els.contract.appendChild(div);
  }
}

function setPanelVisible(listEl, visible) {
  const panel = listEl?.closest?.("section.panel");
  if (!panel) return;
  panel.style.display = visible ? "" : "none";
}

function render() {
  const coins = state.coins ?? 0;
  els.coins.textContent = fmt(coins);
  if (els.coinsSpark) {
    const spark = sparkline(state.history?.coins ?? [], 14);
    els.coinsSpark.textContent = spark;
    els.coinsSpark.style.display = spark ? "inline-block" : "none";
  }
  if (els.netWorth) {
    // net worth is tracked by tick() history; display the latest if present.
    const arr = state.history?.netWorth || [];
    const nw = arr.length ? arr[arr.length - 1] : NaN;
    els.netWorth.textContent = fmt(Number.isFinite(nw) ? nw : coins);
  }
  if (els.nwSpark) {
    const spark = sparkline(state.history?.netWorth ?? [], 14);
    els.nwSpark.textContent = spark;
    els.nwSpark.style.display = spark ? "inline-block" : "none";
  }
  if (els.nwRate) {
    const arr = state.history?.netWorth || [];
    if (arr.length >= 2) {
      const seconds = arr.length - 1; // 1Hz sampling
      const diff = arr[arr.length - 1] - arr[0];
      const perMin = seconds > 0 ? (diff / (seconds / 60)) : 0;
      els.nwRate.textContent = fmt(perMin);
    } else {
      els.nwRate.textContent = fmt(0);
    }
  }

  // Income is coin delta over the last ~60s (1Hz sampling). This intentionally ignores inventory valuation.
  if (els.incomeRate) {
    const arr = state.history?.coins || [];
    if (arr.length >= 2) {
      const window = Math.min(60, arr.length - 1);
      const diff = arr[arr.length - 1] - arr[arr.length - 1 - window];
      const perMin = diff / (window / 60);
      els.incomeRate.textContent = fmt(perMin);

      if (els.incomeSpark) {
        const deltas = [];
        for (let i = Math.max(1, arr.length - 14); i < arr.length; i++) deltas.push(arr[i] - arr[i - 1]);
        const spark = sparkline(deltas, 14);
        els.incomeSpark.textContent = spark;
        els.incomeSpark.style.display = spark ? "inline-block" : "none";
      }
    } else {
      els.incomeRate.textContent = fmt(0);
      if (els.incomeSpark) {
        els.incomeSpark.textContent = "";
        els.incomeSpark.style.display = "none";
      }
    }
  }

  // Hide Heat until it’s a real mechanic.
  const heatLine = els.heatLine || els.heat?.parentElement; // back-compat if markup changes
  if (heatLine) heatLine.style.display = state.unlocked?.heat ? "" : "none";
  if (els.heat) els.heat.textContent = Math.round(state.heat ?? 0);
  if (els.heatSpark) {
    const spark = state.unlocked?.heat ? sparkline(state.history?.heat ?? [], 14) : "";
    els.heatSpark.textContent = spark;
    els.heatSpark.style.display = spark ? "inline-block" : "none";
  }

  // Meta (prestige)
  state.meta ||= { whiskers: 0, seasons: 0, schemeSlots: 1, district: "alley", districtsUnlocked: ["alley"], challenge: "none" };
  if (!state.meta.challenge) state.meta.challenge = "none";
  // Back-compat: older saves may have stored challenge flags as booleans.
  if (state.meta.challenge === "none") {
    if (state.meta.ironContracts === true) state.meta.challenge = "ironContracts";
    else if (state.meta.heatDeath === true) state.meta.challenge = "heatDeath";
  }
  if (els.whiskers) els.whiskers.textContent = Math.round(state.meta.whiskers ?? 0);
  if (els.seasons) els.seasons.textContent = Math.round(state.meta.seasons ?? 0);
  if (els.seedLine) {
    els.seedLine.style.display = state.seed == null ? "none" : "";
  }
  if (els.seed) {
    const seed = state.seed;
    els.seed.textContent = seed == null ? "" : `${seed} (0x${(Number(seed) >>> 0).toString(16).padStart(8, "0")})`;
  }
  if (els.prestigeExplainer) {
    const award = whiskersForCoins(state.coins ?? 0);
    els.prestigeExplainer.textContent = `End Season resets coins, inventory, contracts, Heat, and market pressure. You keep Whiskers + Seasons. (You'd gain ${award} Whiskers right now.)`;
  }

  // Challenge modes (opt-in).
  // Hide until relevant systems are unlocked to avoid early clutter.
  if (els.challengeRow) {
    const show = Boolean(state.unlocked?.contract || state.unlocked?.heat);
    els.challengeRow.style.display = show ? "" : "none";
  }
  if (els.chkIronContracts) {
    const enabled = Boolean(state.unlocked?.contract);
    els.chkIronContracts.checked = state.meta.challenge === "ironContracts";
    els.chkIronContracts.disabled = !enabled;
    els.chkIronContracts.title = enabled ? "" : "Unlock Contracts to enable this challenge.";
    if (els.ironChallenge) {
      els.ironChallenge.style.opacity = enabled ? "" : "0.55";
      els.ironChallenge.style.cursor = enabled ? "" : "not-allowed";
    }
  }
  if (els.chkHeatDeath) {
    const enabled = Boolean(state.unlocked?.heat);
    els.chkHeatDeath.checked = state.meta.challenge === "heatDeath";
    els.chkHeatDeath.disabled = !enabled;
    els.chkHeatDeath.title = enabled ? "" : "Unlock Heat to enable this challenge.";
    if (els.heatChallenge) {
      els.heatChallenge.style.opacity = enabled ? "" : "0.55";
      els.heatChallenge.style.cursor = enabled ? "" : "not-allowed";
    }
  }

  // District selector (unlocked via prestige).
  state.meta.districtsUnlocked = Array.isArray(state.meta.districtsUnlocked) ? state.meta.districtsUnlocked : ["alley"];
  state.meta.district = normalizeDistrictKey(state.meta.district);
  const unlocked = state.meta.districtsUnlocked.filter(k => DISTRICTS.some(d => d.key === k));
  if (els.districtRow && els.districtSelect) {
    els.districtRow.style.display = unlocked.length > 1 ? "" : "none";

    // Populate options (idempotent).
    const cur = state.meta.district;
    if (els.districtSelect._lastKeys !== unlocked.join(",")) {
      els.districtSelect.innerHTML = "";
      for (const k of unlocked) {
        const d = DISTRICTS.find(x => x.key === k);
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = d?.label ?? k;
        els.districtSelect.appendChild(opt);
      }
      els.districtSelect._lastKeys = unlocked.join(",");
    }
    els.districtSelect.value = cur;
  }

  // Level goals (manual “Level Up” button).
  // v0: unlock Catnip at 100 coins.
  const level = Number(state.level) || 0;
  const goals = GOALS;
  const maxLevel = goals.length; // levels are 0..(maxLevel-1)

  if (level >= maxLevel) {
    // No further goals defined yet.
    if (els.goalText) els.goalText.innerHTML = `<strong>Goal:</strong> (more goals soon)`;
    if (els.progressFill) els.progressFill.style.width = `0%`;
    if (els.progressBar) {
      els.progressBar.setAttribute("aria-valuemin", "0");
      els.progressBar.setAttribute("aria-valuemax", "0");
      els.progressBar.setAttribute("aria-valuenow", "0");
      els.progressBar.setAttribute("aria-valuetext", "");
    }
    if (els.progressLabel) els.progressLabel.textContent = ``;
    if (els.btnLevelUp) els.btnLevelUp.style.display = "none";
  } else {
    const cur = goals[level];
    const goalCoins = cur?.coins ?? 100;

    if (els.goalText) {
      els.goalText.innerHTML = `<strong>Goal:</strong> ${cur?.label ?? `reach ${goalCoins} coins`}.`;
    }

    const p = Math.max(0, Math.min(1, coins / goalCoins));
    if (els.progressFill) els.progressFill.style.width = `${Math.round(p * 100)}%`;
    if (els.progressBar) {
      els.progressBar.setAttribute("aria-valuemin", "0");
      els.progressBar.setAttribute("aria-valuemax", String(goalCoins));
      els.progressBar.setAttribute("aria-valuenow", String(Math.min(goalCoins, Math.max(0, coins))));
      els.progressBar.setAttribute("aria-valuetext", `${Math.round(p * 100)}%`);
    }
    // No extra text under the progress bar (coins + goal text already cover it).
    if (els.progressLabel) els.progressLabel.textContent = ``;

    if (els.btnLevelUp) {
      const canLevel = coins >= goalCoins;
      els.btnLevelUp.style.display = canLevel ? "" : "none";
      // Tiny UX: hint what leveling up will do.
      els.btnLevelUp.title = canLevel ? `Level up (${cur?.label ?? ""})` : "";

      // Micro onboarding: when the button first becomes available, nudge once.
      // (Per-level so it doesn't spam, and so future goals still get a hint.)
      state.meta ||= { whiskers: 0, seasons: 0, schemeSlots: 1 };
      const hintedAt = Number(state.meta.levelUpHintedLevel);
      if (canLevel && hintedAt !== level) {
        state.meta.levelUpHintedLevel = level;
        // Save once so the hint doesn't repeat on refresh.
        save(state);
        flashStatus("level up ready", 1800);
      }
    }
  }

  // Hide panels that aren’t unlocked yet to reduce initial clutter.
  setPanelVisible(els.contract, state.unlocked?.contract ?? false);
  setPanelVisible(els.cats, state.unlocked?.cats ?? false);
  setPanelVisible(els.traders, state.unlocked?.traders ?? false);
  setPanelVisible(els.schemes, state.unlocked?.schemes ?? false);

  renderMarket();
  renderInventory();
  if (state.unlocked?.contract) renderContract();
  if (state.unlocked?.cats) renderCats();
  if (state.unlocked?.traders) renderTraders();
  if (state.unlocked?.schemes) renderSchemes();

  setSaveStatus("saved");
}

function frameTick() {
  const t = nowMs();
  const dt = Math.min(0.25, Math.max(0, (t - state._lastTickMs) / 1000));
  state._lastTickMs = t;

  tick(state, dt);
  render();
}

els.btnHardReset.addEventListener("click", () => {
  if (!confirm("Hard reset? This deletes ALL local saves for this game (including older versions).\n\nTip: Export save first if you might want it back.")) return;

  // Remove current + any legacy saves to avoid confusing "ghost" restores after reload.
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // Best-effort only; still reload.
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  // Also clear any one-shot UI flash messages.
  try { sessionStorage.removeItem(FLASH_KEY); } catch {}

  location.reload();
});

els.seed?.addEventListener("click", async () => {
  const seed = state.seed;
  if (seed == null) return;
  const text = String(Number(seed) >>> 0);

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      maybeHaptic();
      flashStatus("seed copied");
      return;
    }
  } catch {
    // fall through
  }

  // Fallback for older browsers / blocked clipboard.
  prompt("Copy seed:", text);
});

els.appVersion?.addEventListener("click", async () => {
  const text = String(getAppVersion());
  if (!text) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      maybeHaptic();
      flashStatus("version copied");
      return;
    }
  } catch {
    // fall through
  }

  prompt("Copy version:", text);
});

els.btnExportSave?.addEventListener("click", async () => {
  const copy = { ...clone(state) };
  delete copy._lastTickMs;
  const raw = JSON.stringify(copy);

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(raw);
      maybeHaptic();
      flashStatus("save copied");
      return;
    }
  } catch {
    // fall through
  }

  // Fallback: trigger a file download so the user can save it even when clipboard is blocked.
  try {
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const seed = copy.seed;
    a.download = seed == null ? "meowconomy-save.json" : `meowconomy-save-${Number(seed) >>> 0}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    maybeHaptic();
    flashStatus("save downloaded");
    return;
  } catch {
    // final fallback
  }

  // Final fallback: show the JSON in a prompt so it can be manually copied.
  prompt("Copy your save JSON:", raw);
  flashStatus("save shown");
});

function importSaveRaw(raw) {
  const text = (raw ?? "").trim();
  if (!text) return;
  try {
    const parsed = JSON.parse(text);
    const next = { ...clone(DEFAULT_STATE), ...parsed };
    next._lastTickMs = nowMs();

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      flashStatus("save failed", 2200);
      alert("Could not write save (storage may be full or blocked). Try exporting your current save first.");
      return;
    }

    try { sessionStorage.setItem(FLASH_KEY, "save imported"); } catch {}
    location.reload();
  } catch {
    flashStatus("invalid save");
    alert("Invalid save JSON.");
  }
}

els.btnImportSave?.addEventListener("click", () => {
  const raw = prompt("Paste save JSON to import (this overwrites your current save):");
  if (!raw || !raw.trim()) return;
  const ok = confirm("Import pasted save JSON? This overwrites your current save.");
  if (!ok) return;
  importSaveRaw(raw);
});

els.btnImportFile?.addEventListener("click", () => {
  els.fileImport?.click();
});

els.fileImport?.addEventListener("change", async () => {
  const f = els.fileImport.files?.[0];
  // allow re-selecting the same file later
  els.fileImport.value = "";
  if (!f) return;

  const ok = confirm("Import save from file? This overwrites your current save.");
  if (!ok) return;

  try {
    const raw = await f.text();
    importSaveRaw(raw);
  } catch {
    alert("Could not read file.");
  }
});

els.btnEndSeason?.addEventListener("click", () => {
  const award = whiskersForCoins(state.coins ?? 0);
  const ok = confirm(
    `End Season?\n\nYou will RESET: coins, inventory, contracts, Heat, and market pressure.\nYou will KEEP: Whiskers, Seasons, and your seed (deterministic save).\n\nWhiskers gained now: ${award}.`
  );
  if (!ok) return;
  endSeason(state);
  save(state);
  render();
});

function setChallengeMode(mode) {
  state.meta ||= { whiskers: 0, seasons: 0, schemeSlots: 1, district: "alley", districtsUnlocked: ["alley"], challenge: "none" };
  state.meta.challenge = mode || "none";
  save(state);
  render();
}

els.chkIronContracts?.addEventListener("change", () => {
  if (els.chkIronContracts.checked) {
    if (els.chkHeatDeath) els.chkHeatDeath.checked = false;
    setChallengeMode("ironContracts");
  } else {
    setChallengeMode("none");
  }
});

els.chkHeatDeath?.addEventListener("change", () => {
  if (els.chkHeatDeath.checked) {
    if (els.chkIronContracts) els.chkIronContracts.checked = false;
    setChallengeMode("heatDeath");
  } else {
    setChallengeMode("none");
  }
});

els.btnLevelUp?.addEventListener("click", () => {
  const coins = state.coins ?? 0;
  const level = Number(state.level) || 0;
  const goals = GOALS;
  const maxLevel = goals.length;
  if (level >= maxLevel) return;

  const cur = goals[level];
  const goalCoins = cur?.coins ?? 100;
  if (coins < goalCoins) return;

  // Apply reward.
  state.unlocked ||= {};
  for (const [k, v] of Object.entries(cur?.unlock || {})) {
    state.unlocked[k] = Boolean(v);
  }

  // Advance level.
  state.level = level + 1;
  save(state);
  render();
});

// Set repo link. On GitHub Pages, the repo name is usually the first path segment.
// Locally ("/"), fall back to the known repo.
{
  const seg = (location.pathname.split("/")[1] || "").trim();
  const repo = seg || "meow-conomy";
  els.repoLink.href = "https://github.com/karmolty/" + repo;
}

// iOS Safari: prevent double-tap-to-zoom inside the game surface.
// This is a common pattern for tap-heavy web games.
let _lastTouchEnd = 0;
els.app?.addEventListener(
  "touchend",
  (e) => {
    const now = Date.now();
    if (now - _lastTouchEnd <= 300) {
      // Prevent the second tap from triggering the browser zoom gesture.
      e.preventDefault();
    }
    _lastTouchEnd = now;
  },
  { passive: false }
);

// Keyboard shortcuts:
// - 1–5 activates schemes (if unlocked + available)
// - ? / H toggles the Help / shortcuts panel
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = String(document.activeElement?.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return;

  if (e.key === "Escape") {
    if (els.helpDetails?.open) {
      e.preventDefault();
      els.helpDetails.open = false;
    }
    return;
  }

  if (e.key === "?" || e.key === "h" || e.key === "H") {
    if (els.helpDetails) {
      e.preventDefault();
      els.helpDetails.open = !els.helpDetails.open;
      if (els.helpDetails.open) {
        // Ensure it's visible when opened from the keyboard.
        try { els.helpDetails.scrollIntoView({ block: "end", behavior: "smooth" }); } catch {}
      }
    }
    return;
  }

  if (e.key === "e" || e.key === "E") {
    if (els.btnExportSave) {
      e.preventDefault();
      els.btnExportSave.click();
    }
    return;
  }

  if (e.key === "i" || e.key === "I") {
    if (els.btnImportSave) {
      e.preventDefault();
      els.btnImportSave.click();
    }
    return;
  }

  if (e.key === "f" || e.key === "F") {
    if (els.btnImportFile) {
      e.preventDefault();
      els.btnImportFile.click();
    }
    return;
  }

  if (e.key === "l" || e.key === "L") {
    if (els.btnLevelUp && !els.btnLevelUp.disabled) {
      e.preventDefault();
      els.btnLevelUp.click();
    }
    return;
  }

  if (e.key === "p" || e.key === "P") {
    if (els.btnEndSeason && !els.btnEndSeason.disabled) {
      e.preventDefault();
      els.btnEndSeason.click();
    }
    return;
  }

  if (e.key === "s" || e.key === "S") {
    // Copy seed (when visible) — handy for sharing a deterministic save.
    if (state.seed != null && els.seedLine && els.seedLine.style.display !== "none") {
      e.preventDefault();
      els.seed?.click();
    }
    return;
  }

  const n = Number(e.key);
  if (!Number.isFinite(n) || n < 1 || n > 5) return;

  if (!(state.unlocked?.schemes ?? false)) return;

  state.meta ||= { whiskers: 0, seasons: 0, schemeSlots: 1 };
  const slots = Math.max(1, Math.floor(Number(state.meta.schemeSlots) || 1));
  if (n > slots) return;

  const scheme = SCHEMES[n - 1];
  if (!scheme) return;

  if (!activateScheme(state, scheme.id)) return;
  save(state);
  render();
});

// Init
tick(state, 0);
render();
setInterval(frameTick, 250);
