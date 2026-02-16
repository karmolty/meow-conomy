import { DEFAULT_STATE, GOODS, tick, buy, sell, getPrice } from "../src/game.js";

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
  coins: document.getElementById("statCoins"),
  market: document.getElementById("market"),
  inventory: document.getElementById("inventory"),
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

function renderMarket() {
  els.market.innerHTML = "";

  for (const g of GOODS) {
    const price = getPrice(state, g.key);

    const div = document.createElement("div");
    div.className = "item";

    const buyBtn = document.createElement("button");
    buyBtn.className = "primary";
    buyBtn.textContent = "Buy 1";
    buyBtn.disabled = state.coins < price;
    buyBtn.addEventListener("click", () => {
      if (!buy(state, g.key, 1)) return;
      save(state);
      render();
    });

    const sellBtn = document.createElement("button");
    sellBtn.textContent = "Sell 1";
    sellBtn.disabled = (state.inventory?.[g.key] ?? 0) < 1;
    sellBtn.addEventListener("click", () => {
      if (!sell(state, g.key, 1)) return;
      save(state);
      render();
    });

    div.innerHTML = `
      <div class="row">
        <div><strong>${g.label}</strong></div>
        <div><strong>${fmt(price)}</strong> <span class="muted">coins</span></div>
      </div>
      <div class="row" style="margin-top: 10px;">
        <div class="muted" style="max-width: 360px;">${g.desc}</div>
        <div class="row" style="justify-content: flex-end;">
          <span></span>
        </div>
      </div>
    `;

    const btnRow = div.querySelector(".row" + ":nth-of-type(2) .row");
    btnRow.replaceChildren(buyBtn, sellBtn);

    els.market.appendChild(div);
  }
}

function renderInventory() {
  els.inventory.innerHTML = "";
  for (const g of GOODS) {
    const qty = state.inventory?.[g.key] ?? 0;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div class="row"><div><strong>${g.label}</strong></div><div>${qty}</div></div>`;
    els.inventory.appendChild(div);
  }
}

function render() {
  els.coins.textContent = fmt(state.coins ?? 0);

  // Tiny “win” indicator.
  if ((state.coins ?? 0) >= 100) {
    els.gameTitle.textContent = "Meow-conomy (goal reached!)";
  } else {
    els.gameTitle.textContent = "Meow-conomy";
  }

  renderMarket();
  renderInventory();

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

// Init
tick(state, 0);
render();
setInterval(frameTick, 250);
