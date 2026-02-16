import { DEFAULT_STATE, GOODS, tick, buy, sell, getPrice } from "./game.js";
import {
  CONTRACTS,
  getAvailableContracts,
  getActiveContract,
  acceptContractById,
  abandonActiveContract
} from "../src/contracts.js";

const STORAGE_KEY = "meowconomy.save.v0.1";

function nowMs() { return Date.now(); }

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...parsed };
  } catch {
    return structuredClone(DEFAULT_STATE);
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
  progressFill: document.getElementById("progressFill"),
  progressLabel: document.getElementById("progressLabel"),
  market: document.getElementById("market"),
  inventory: document.getElementById("inventory"),
  contract: document.getElementById("contract"),
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

function renderContract() {
  if (!els.contract) return;
  els.contract.innerHTML = "";

  const active = getActiveContract(state);
  if (active) {
    const div = document.createElement("div");
    div.className = "item";

    const top = document.createElement("div");
    top.className = "row";
    top.innerHTML = `<div><strong>${active.title}</strong></div><div class="muted">reward +${active.reward.coins}</div>`;

    const desc = document.createElement("div");
    desc.className = "muted";
    desc.style.marginTop = "8px";
    desc.textContent = active.desc;

    const btnRow = document.createElement("div");
    btnRow.className = "row";
    btnRow.style.justifyContent = "flex-end";
    btnRow.style.marginTop = "10px";

    const abandon = document.createElement("button");
    abandon.textContent = `Abandon (-${active.penalty.coins} coins)`;
    abandon.addEventListener("click", () => {
      abandonActiveContract(state);
      save(state);
      render();
    });

    btnRow.append(abandon);
    div.append(top, desc, btnRow);
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

function render() {
  const coins = state.coins ?? 0;
  els.coins.textContent = fmt(coins);

  // Progress to next level (first goal).
  const nextGoal = 100;
  const p = Math.max(0, Math.min(1, coins / nextGoal));
  if (els.progressFill) els.progressFill.style.width = `${Math.round(p * 100)}%`;
  if (els.progressLabel) els.progressLabel.textContent = `${fmt(coins)} / ${nextGoal}`;

  renderMarket();
  renderInventory();
  renderContract();

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
