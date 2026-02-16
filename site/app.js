import { DEFAULT_STATE, GOODS, tick, buy, sell, getPrice } from "./game.js";
import {
  CONTRACTS,
  getAvailableContracts,
  getActiveContract,
  acceptContractById,
  abandonActiveContract,
  isActiveContractComplete,
  redeemActiveContract
} from "./contracts.js";

import { JOB_DEFS, JOB_CAPS, assignCatJob, jobCounts } from "./cats.js";

const STORAGE_KEY = "meowconomy.save.v0.1";

function nowMs() { return Date.now(); }

// iOS Safari compatibility: structuredClone shipped relatively late.
// If it doesn't exist, fall back to a JSON deep-clone (safe for our plain data state).
function clone(obj) {
  if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...clone(DEFAULT_STATE), ...parsed };
  } catch {
    return clone(DEFAULT_STATE);
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
  heat: document.getElementById("statHeat"),
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
  saveStatus: document.getElementById("saveStatus"),
  btnHardReset: document.getElementById("btnHardReset"),
  repoLink: document.getElementById("repoLink"),
  gameTitle: document.getElementById("gameTitle")
};

const state = load();
state._lastTickMs ??= nowMs();

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

function sparkline(values) {
  const vals = (values || []).filter(n => Number.isFinite(n));
  if (vals.length < 2) return "";

  let min = Infinity;
  let max = -Infinity;
  for (const v of vals) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return "";

  const blocks = "▁▂▃▄▅▆▇█";
  const span = max - min;
  return vals
    .map(v => {
      const t = (v - min) / span;
      const i = Math.max(0, Math.min(blocks.length - 1, Math.round(t * (blocks.length - 1))));
      return blocks[i];
    })
    .join("");
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
    const spark = sparkline(hist);
    right.innerHTML = `<strong class="num">${fmt(price)}</strong> <span class="muted">coins</span> <span class="muted">(sat ${pressure.toFixed(2)})</span>${spark ? ` <span class="muted" title="recent trend">${spark}</span>` : ""}`;

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
      if (!buy(state, g.key, 1)) {
        pulse(buyBtn, "red");
        return;
      }
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
      if (!sell(state, g.key, 1)) {
        pulse(sellBtn, "red");
        return;
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

    const top = document.createElement("div");
    top.className = "row";
    top.innerHTML = `<div><strong>${active.title}</strong></div><div class="muted">${remaining}s left</div>`;

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
    els.contract.innerHTML = `<div class="muted">No contracts available.</div>`;
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

  // Hide Heat until it’s a real mechanic.
  // NOTE: els.heat is the <strong> inside the heat line; its parent is the line container.
  const heatLine = els.heat?.parentElement; // <div class="muted">Heat: <strong .../></div>
  if (heatLine) heatLine.style.display = state.unlocked?.heat ? "" : "none";
  if (els.heat) els.heat.textContent = Math.round(state.heat ?? 0);

  // Level goals (manual “Level Up” button).
  // v0: unlock Catnip at 100 coins.
  const level = Number(state.level) || 0;
  const goals = [
    { coins: 100, reward: { unlock: { catnip: true } }, label: "reach 100 coins (unlocks Catnip)" },
    { coins: 250, reward: { unlock: { contract: true } }, label: "reach 250 coins (unlocks Contracts)" }
  ];
  const cur = goals[Math.min(level, goals.length - 1)];
  const goalCoins = cur?.coins ?? 100;

  if (els.goalText) {
    els.goalText.innerHTML = `<strong>Goal:</strong> ${cur?.label ?? `reach ${goalCoins} coins`}.`;
  }

  const p = Math.max(0, Math.min(1, coins / goalCoins));
  if (els.progressFill) els.progressFill.style.width = `${Math.round(p * 100)}%`;
  if (els.progressLabel) els.progressLabel.textContent = `${fmt(coins)} / ${goalCoins}`;

  if (els.btnLevelUp) {
    const canLevel = coins >= goalCoins;
    els.btnLevelUp.style.display = canLevel ? "" : "none";
  }

  // Hide panels that aren’t unlocked yet to reduce initial clutter.
  setPanelVisible(els.contract, state.unlocked?.contract ?? true);
  setPanelVisible(els.cats, state.unlocked?.cats ?? false);
  setPanelVisible(els.traders, state.unlocked?.traders ?? false);

  renderMarket();
  renderInventory();
  if (state.unlocked?.contract ?? true) renderContract();
  if (state.unlocked?.cats) renderCats();
  if (state.unlocked?.traders) renderTraders();

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

els.btnLevelUp?.addEventListener("click", () => {
  const coins = state.coins ?? 0;
  const level = Number(state.level) || 0;
  const goals = [
    { coins: 100, reward: { unlock: { catnip: true } } },
    { coins: 250, reward: { unlock: { contract: true } } }
  ];
  const cur = goals[Math.min(level, goals.length - 1)];
  const goalCoins = cur?.coins ?? 100;
  if (coins < goalCoins) return;

  // Apply reward.
  state.unlocked ||= {};
  for (const [k, v] of Object.entries(cur?.reward?.unlock || {})) {
    state.unlocked[k] = Boolean(v);
  }

  // Advance level.
  state.level = level + 1;
  save(state);
  render();
});

// set repo link if we're on pages
els.repoLink.href = "https://github.com/karmolty/" + location.pathname.split("/")[1].replaceAll("/", "");

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

// Init
tick(state, 0);
render();
setInterval(frameTick, 250);
