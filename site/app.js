import { DEFAULT_STATE, GOODS, tick, buy, sell, getPrice } from "./game.js";
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

function nowMs() { return Date.now(); }

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
    const raw = localStorage.getItem(STORAGE_KEY);
    const base = clone(DEFAULT_STATE);
    if (!raw) return normalizeLoadedState(base);

    const parsed = JSON.parse(raw);
    const merged = { ...base, ...parsed };
    return normalizeLoadedState(merged);
  } catch {
    return normalizeLoadedState(clone(DEFAULT_STATE));
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return (Math.round(n * 100) / 100).toFixed(2);
}

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
  districtRow: document.getElementById("districtRow"),
  districtSelect: document.getElementById("districtSelect"),
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
  gameTitle: document.getElementById("gameTitle")
};

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

function setSaveStatus(text) {
  els.saveStatus.textContent = text;
  els.saveStatus.style.borderColor = text === "saved" ? "var(--line)" : "rgba(43,122,120,.35)";
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
      ? ` <span class="muted" title="recent trend" style="display:inline-block;width:14ch;white-space:pre;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;line-height:1;">${spark}</span>`
      : "";
    right.innerHTML = `<strong class="num">${fmt(price)}</strong> <span class="muted">coins</span> <span class="muted">(sat ${pressure.toFixed(2)})</span>${sparkSpan}`;

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
    buyBtn.disabled = state.coins < price;
    function doBuyOne(e) {
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
    sellBtn.disabled = (state.inventory?.[g.key] ?? 0) < 1;
    function doSellOne(e) {
      if (e?.cancelable) e.preventDefault();
      const before = state.coins;
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
    left.innerHTML = `<strong>${t.name}</strong> <span class="muted">(fee ${(t.feeBps / 100).toFixed(2)}%)</span>`;

    const toggle = document.createElement("button");
    toggle.className = t.enabled ? "primary" : "";
    toggle.textContent = t.enabled ? "Enabled" : "Disabled";
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
      redeem.addEventListener("click", () => {
        redeemActiveContract(state);
        save(state);
        render();
      });
      btnRow.append(redeem);
    }

    const abandon = document.createElement("button");
    abandon.textContent = `Abandon (-${active.penalty.coins} coins)`;
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
      els.nwRate.textContent = perMin.toFixed(2);
    } else {
      els.nwRate.textContent = "0.00";
    }
  }

  // Income is coin delta over the last ~60s (1Hz sampling). This intentionally ignores inventory valuation.
  if (els.incomeRate) {
    const arr = state.history?.coins || [];
    if (arr.length >= 2) {
      const window = Math.min(60, arr.length - 1);
      const diff = arr[arr.length - 1] - arr[arr.length - 1 - window];
      const perMin = diff / (window / 60);
      els.incomeRate.textContent = perMin.toFixed(2);

      if (els.incomeSpark) {
        const deltas = [];
        for (let i = Math.max(1, arr.length - 14); i < arr.length; i++) deltas.push(arr[i] - arr[i - 1]);
        const spark = sparkline(deltas, 14);
        els.incomeSpark.textContent = spark;
        els.incomeSpark.style.display = spark ? "inline-block" : "none";
      }
    } else {
      els.incomeRate.textContent = "0.00";
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
  if (els.whiskers) els.whiskers.textContent = Math.round(state.meta.whiskers ?? 0);
  if (els.seasons) els.seasons.textContent = Math.round(state.meta.seasons ?? 0);
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
    // No extra text under the progress bar (coins + goal text already cover it).
    if (els.progressLabel) els.progressLabel.textContent = ``;

    if (els.btnLevelUp) {
      const canLevel = coins >= goalCoins;
      els.btnLevelUp.style.display = canLevel ? "" : "none";
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
  if (!confirm("Hard reset? This deletes your save.")) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

els.btnExportSave?.addEventListener("click", async () => {
  const copy = { ...clone(state) };
  delete copy._lastTickMs;
  const raw = JSON.stringify(copy);

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(raw);
      alert("Save copied to clipboard.");
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
    a.download = "meowconomy-save.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  } catch {
    // final fallback
  }

  // Final fallback: show the JSON in a prompt so it can be manually copied.
  prompt("Copy your save JSON:", raw);
});

function importSaveRaw(raw) {
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    const next = { ...clone(DEFAULT_STATE), ...parsed };
    next._lastTickMs = nowMs();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    location.reload();
  } catch {
    alert("Invalid save JSON.");
  }
}

els.btnImportSave?.addEventListener("click", () => {
  const raw = prompt("Paste save JSON to import (this overwrites your current save):");
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

// Keyboard shortcuts: 1–5 activates schemes (if unlocked + available).
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = String(document.activeElement?.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return;

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
