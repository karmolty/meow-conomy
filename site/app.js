import { DEFAULT_STATE, TECH_TREE, RESOURCE_DEFS, clamp0, canAfford, payCost } from "../src/game-data.js";

const STORAGE_KEY = "meowconomy.save.v1";

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
  return String(Math.floor(n));
}

const els = {
  purr: document.getElementById("statPurr"),
  btnPurr: document.getElementById("btnPurr"),
  btnAuto: document.getElementById("btnAuto"),
  autoHint: document.getElementById("autoHint"),
  resources: document.getElementById("resources"),
  tech: document.getElementById("tech"),
  saveStatus: document.getElementById("saveStatus"),
  btnHardReset: document.getElementById("btnHardReset"),
  repoLink: document.getElementById("repoLink")
};

const state = load();
state._lastTickMs ??= nowMs();

function setSaveStatus(text) {
  els.saveStatus.textContent = text;
  els.saveStatus.style.borderColor = text === "saved" ? "var(--line)" : "rgba(43,122,120,.35)";
}

function earn(state, key, amount) {
  state.resources[key] = clamp0((state.resources[key] ?? 0) + amount);
}

function tick() {
  const t = nowMs();
  const dt = Math.min(5, (t - state._lastTickMs) / 1000);
  state._lastTickMs = t;

  // passive production (scaffold)
  const interns = state.upgrades.purrInterns || 0;
  if (interns > 0) {
    earn(state, "purr", interns * dt);
  }

  render();
}

function renderResources() {
  els.resources.innerHTML = "";
  for (const r of RESOURCE_DEFS) {
    const v = state.resources[r.key] ?? 0;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div class="row"><div><strong>${r.label}</strong></div><div>${fmt(v)}</div></div><div class="muted">${r.desc}</div>`;
    els.resources.appendChild(div);
  }
}

function renderTech() {
  els.tech.innerHTML = "";

  for (const tech of TECH_TREE) {
    const unlocked = state.tech[tech.id] === true;
    const affordable = canAfford(state.resources, tech.cost);

    const div = document.createElement("div");
    div.className = "item";

    const btn = document.createElement("button");
    btn.textContent = unlocked ? "researched" : `research (${Object.entries(tech.cost).map(([k,v])=>`${v} ${k}`).join(", ")})`;
    btn.disabled = unlocked || !affordable;
    btn.addEventListener("click", () => {
      if (state.tech[tech.id]) return;
      if (!canAfford(state.resources, tech.cost)) return;
      payCost(state.resources, tech.cost);
      state.tech[tech.id] = true;
      setSaveStatus("saved");
      save(state);
      render();
    });

    div.innerHTML = `<div class="row"><div><strong>${tech.name}</strong></div><div></div></div><div class="muted">${tech.desc}</div>`;
    div.querySelector(".row div:last-child")?.replaceWith(btn);

    els.tech.appendChild(div);
  }
}

function render() {
  els.purr.textContent = fmt(state.resources.purr ?? 0);

  const interns = state.upgrades.purrInterns || 0;
  const cost = 25 + interns * 25;
  els.btnAuto.textContent = `Hire a purr intern (${cost} purrs)`;
  els.btnAuto.disabled = (state.resources.purr ?? 0) < cost;
  els.autoHint.textContent = interns ? `Interns: ${interns} (passive +${interns}/sec)` : "No interns yet.";

  renderResources();
  renderTech();

  setSaveStatus("saved");
}

els.btnPurr.addEventListener("click", () => {
  earn(state, "purr", 1);
  save(state);
  render();
});

els.btnAuto.addEventListener("click", () => {
  const interns = state.upgrades.purrInterns || 0;
  const cost = 25 + interns * 25;
  if ((state.resources.purr ?? 0) < cost) return;
  state.resources.purr -= cost;
  state.upgrades.purrInterns = interns + 1;
  save(state);
  render();
});

els.btnHardReset.addEventListener("click", () => {
  if (!confirm("Hard reset? This deletes your save.")) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

// set repo link if we're on pages
els.repoLink.href = "https://github.com/karmolty/" + location.pathname.split("/")[1].replaceAll("/", "");

render();
setInterval(tick, 250);
