# TODO

This TODO is organized to map directly onto `MILESTONES.md`.

## v0.1 — Playable Active Skeleton
### Core code
- [x] Define `GameState` type (coins, inventory, market, cats, time/tick)
- [x] Implement `tick(state, dt)` (deterministic update; no UI side effects)
- [x] Implement basic **Trade** action(s): `buy(good, qty)` / `sell(good, qty)`
- [x] Add 2 goods + coins (simple fixed or gently moving prices for v0.1)
- [x] Decide + implement **staged goods unlock**: start with 1 good, then unlock the next good when the player hits the first goal (100 coins).

### UI (minimal is fine)
- [x] Add a minimal play UI in `site/` (or console) that:
  - shows coins + inventory
  - shows current prices
  - lets player buy/sell
- [x] Add a short “goal” message (e.g., Earn 100 coins) for the <10 min AC

### Quality
- [x] Add a tiny test harness for `tick` and `buy/sell` invariants (coins never negative unless explicitly allowed, inventory non-negative)
- [x] Add README instructions: run locally + what the player is trying to do

## v0.2 — Decision-Rich Economy + Contracts
### Economy
- [x] Expand to 3 goods (Kibble/Catnip/Shiny Things or renamed)
- [x] Add **saturation**: repeatedly trading the same good reduces its profitability (per-good pressure variable)
- [x] Implement price update rule that depends on saturation + mild drift (deterministic or seedable RNG)
- [x] **v0.2.1 Price Engine v1** (see MILESTONES.md / DESIGN.md)
  - [x] Add `state.seed` (persisted in save); initialize once for new saves
  - [x] Add tiny PRNG (xorshift32) + helpers (uniform, maybe gaussian-ish via sum-of-uniforms)
  - [x] Add `state.marketLatent` per good (anchor, drift, regime, timers)
  - [x] Replace `basePriceAtTime()` with latent update + multi-timescale components
  - [x] Implement regime switching (calm/choppy/hype) with durations and per-good parameterization
  - [x] Ensure determinism: same seed + same actions => same prices
  - [x] Calibrate vol by good (kibble < catnip < shiny)
  - [x] Add tests for invariants + determinism + no obvious periodic loop in a 3-min window
- [x] Add a **tiny price graph widget** (sparkline per good) so players can see recent trend at a glance.

### Cats / capacity
- [x] Define Cat roster + jobs (production/scouting/negotiating/guarding)
- [x] Implement **allocation** constraints (limited cats/slots) + effects (e.g., production per tick, better trade prices, reduced Heat)
- [x] UI to assign/unassign cats

### Contracts
- [x] Define Contract schema (requirements, deadline, reward, penalty, tags)
- [x] Implement contract generation/selection
- [x] Enforce **max 1 active contract**
- [x] Implement abandon contract + defined penalty
- [x] UI: show active contract + progress + time remaining

### Automation (assistive)
- [x] Design + implement **Hire Traders**: limited automation with player-configured rules (buy/sell thresholds, caps), plus constraints (fees, action rate, Heat).
  - [x] Define Trader schema + rule format
  - [x] Implement trader execution per tick (respects caps + action rate + fees)
  - [x] UI to configure trader rules
  - [x] Heat integration: trader actions generate Heat (and Heat reduces trader action rate)

### Balance checks
- [x] Add 2 “viable strategy” smoke tests (even if manual): trade-first vs produce-first can both clear a starter contract

## v0.2.2 — Goal Ladder + Unlock Gating
- [x] Define goal ladder table in code (levels, targets, rewards)
- [x] Persist `state.level` + ensure it can’t exceed defined goals
- [x] Gate UI panels by unlocks:
  - [x] Contracts panel gated until unlocked
  - [x] Heat row hidden until unlocked
  - [x] Traders panel hidden until unlocked
  - [x] Cats panel hidden until unlocked
- [x] Add new unlock steps:
  - [x] Level 2 @ 500: unlock Heat + Schemes + make Heat affect something (e.g. contract availability or trader constraint)
  - [x] Level 3 @ 800: unlock Traders + tie at least one constraint to Heat
  - [x] Level 4 @ 1200: unlock Cats + ensure at least one job has a visible effect
- [x] UI: after max level reached, show a friendly “more goals soon” message

## v0.3 — Schemes + Heat
### Schemes
- [x] Implement Scheme system (cooldowns, duration, effect application)
- [x] Add 3 starter schemes (placeholder names OK):
  - Hustle (burst output)
  - Price Pounce (temporary favorable price)
  - Nine Lives (mitigate one bad outcome)
- [x] UI: scheme buttons + cooldown indicators

### Heat + events
- [x] Add Heat meter to state
- [x] Heat increases with certain profitable/risky actions; decreases with calming actions/jobs
- [x] Add at least 3 event types (tax, rival, confiscation) whose probability/scaling depends on Heat
- [x] Ensure events are not unavoidable death spirals: add mitigation paths (cats/schemes/pivot)

## v0.4 — Season Prestige
- [x] Implement “End Season” action
- [x] Implement Whisker Points (meta currency) award formula
- [x] Implement carryover/unlocks:
  - [x] unlock new district/market
  - [x] unlock new contract type (prestige-gated contract after Season 1)
  - [x] unlock new scheme slot (meta.schemeSlots; +1 slot after Season 1)
- [x] UI: prestige explainer (what resets, what carries, why)

## v1.0 — Stable Minimal Game
- [x] Save/load (localStorage or JSON) for run + meta progression
- [x] Add CI badge to README.
- [x] Document tuning knobs (pacing, price volatility, heat scaling, contract rewards)
- [x] Add tests for tick/pricing/contracts (core invariants)
  - [x] Trading respects unlock gating (buy/sell return false for locked goods)
  - [x] Contract edge-cases: rejecting unknown ids; abandoning only when active
  - [x] Contract redeem: only when complete; consumes deliverables
  - [x] Contract deadline helper: `isActiveContractExpired()`
  - [x] Contract expiry: auto-fail on tick (penalty + clear)
  - [x] Prestige reset: clears contract, cat jobs, scheme runtime, trader runtime
  - [x] Price engine: 10-min idle sim sanity bounds (no runaway drift)
  - [x] Traders: Heat constraint meaningfully reduces action rate (tight unit test)
- [x] Deployment instructions (GitHub Pages if applicable)

## Maintenance / compatibility
- [x] Back-compat: normalize legacy challenge flags (`meta.ironContracts` / `meta.heatDeath`) into `meta.challenge` on load.
- [x] Back-compat: if STORAGE_KEY changes, try to load + migrate the newest `meowconomy.save.*` localStorage entry.
- [x] Add `.nvmrc` (Node 22) for a consistent local dev environment.
- [x] Add an `npm run check` script alias (run tests) for CI/local parity.
- [x] Docs: mention `npm run check` in README smoke test instructions.
- [x] Harden save loading with a `normalizeLoadedState()` so older saves don’t crash as fields are added.
- [x] UI: show current save seed in the Core panel (debug/determinism helper).
- [x] UI: hide seed line if save seed is missing (defensive/back-compat).
- [x] UI: click seed to copy it to clipboard (tiny debug helper).
- [x] UI: seed copy uses saveStatus pill instead of an alert (less annoying).
- [x] Export save: include seed in downloaded filename (helps manage multiple saves).
- [x] UI: add haptic feedback when exporting save to clipboard.
- [x] UI: export save fallback (download/prompt) uses saveStatus feedback too.
- [x] Unlock Schemes whenever Heat unlocks (500-coin step) + add regression test.
- [x] Defense-in-depth: block scheme activation when `unlocked.schemes` is false + add test.
- [x] Docs: mention scheme unlock gating (Schemes unlock alongside Heat at 500 coins).
- [x] Add a simple CI workflow that runs `node src/game.test.mjs` on push/PR.
- [x] Add a basic .gitignore.
- [x] Add `package.json` with `npm test` + `npm run serve` convenience scripts.
- [x] Add `npm start` as an alias for `npm run serve`.
- [x] Add an `.editorconfig` to keep whitespace consistent across editors.

## v1.1 — Maintenance polish
- [x] Back-compat: pick newest `meowconomy.save.*` localStorage key by numeric version (not lexicographic).
- [x] Back-compat: after migrating a legacy localStorage save, delete the legacy key (best-effort) to reduce confusion.
- [x] Perf: avoid rewriting localStorage on every load; only write when migration actually happens.
- [x] README: document localStorage save key migration/back-compat behavior.
- [x] README: clarify that npm serve is a good default for local dev
- [x] Add `CONTRIBUTING.md` (local dev, tests, release/deploy notes)
- [x] Add basic mobile theme meta tags (`theme-color`, Apple status bar styling)
- [x] Add PWA-ish mobile meta tags (`apple-mobile-web-app-capable`, `mobile-web-app-capable`, `viewport-fit=cover`)
- [x] Add minimal web app manifest + link it from the page
- [x] Add `robots.txt` (allow indexing)
- [x] Add `sitemap.xml` for GitHub Pages
- [x] Add canonical URL meta to reduce duplicate indexing
- [x] Add a simple `favicon` (SVG) + link it from the page
- [x] Add icon entries to `manifest.webmanifest`
- [x] Add OpenGraph/Twitter meta tags for nicer link previews
- [x] Add `og:image` / `twitter:image` tags (basic icon fallback)
- [x] Flesh out `manifest.webmanifest` basics (`id`, `description`, `lang`)
- [x] Add `color-scheme` meta tag (reduce UA theming weirdness)

## v1.2 — Tiny dev ergonomics
- [x] Add `npm run test:watch` for faster local iteration.
- [x] Add `npm run dev` as an alias for `npm run serve` (common convention).
- [x] Docs: mention `npm run dev` in CONTRIBUTING.
- [x] Docs: mention `npm run test:watch` in README + CONTRIBUTING.
- [x] UI: confirm before importing save from file (overwrites current save).
- [x] UI: trim whitespace when importing save JSON (paste/file) so leading/trailing newlines don’t break import.
- [x] UI: file import input accepts `.json` explicitly (better picker filtering on some browsers).
- [x] UI: confirm before importing pasted save JSON (overwrites current save).
- [x] UI: keyboard shortcut: F opens Import file picker.
- [x] UI: after importing a save (paste/file), show a one-shot status message after reload ("save imported").

## v1.3 — Tiny UI polish
- [x] UI: show a simple app version string in the footer (from a meta tag in `site/index.html`).
- [x] UI: click the version string to copy it to clipboard (with saveStatus feedback).
- [x] Dev: add `npm run stamp` to update the version meta tag to the current git SHA.
- [x] Dev: run `npm run stamp` automatically in GitHub Pages deploy workflow so the live site shows the deployed SHA.

## v1.4 — Micro polish
- [x] CSS: fix indentation/newline around `button.primary` styles (no behavioral change).
- [x] Mobile: ignore ghost clicks right after touchend on Buy/Sell buttons (prevents double-trades)
- [x] Docs: mention mobile tap behavior (ghost-click + double-tap-zoom prevention)

## v1.5 — Tiny accessibility
- [x] A11y: give the level progress bar proper `role="progressbar"` + `aria-valuenow/max` updates.
- [x] A11y: mark ASCII sparklines as `aria-hidden` so screen readers don’t read them.

## v1.6 — Storage robustness
- [x] UI: handle localStorage quota/blocked-storage errors during `save()` without crashing (show a small status message).

## v1.7 — Tiny accessibility follow-ups
- [x] A11y: add an accessible label to the District selector.
- [x] A11y: add an accessible label to each cat job selector.
- [x] A11y: add ARIA progressbar semantics to contract requirement progress bars.
- [x] A11y: connect challenge checkboxes to their description text via aria-describedby.
- [x] A11y: add aria-valuetext to contract requirement progress bars.

## v1.8 — Micro UI polish
- [x] Prevent "flash of locked panels" on initial load by hiding gated panels in HTML until JS render shows them.
- [x] Prevent "flash of placeholder progress text" (remove initial "0 / 100" in HTML; render owns it).
- [x] Prevent "flash of seed line" (hide Seed row in HTML until JS decides to show it).
- [x] Prevent "flash of Challenges block" (hide in HTML until unlocked systems make it relevant).

## v1.9.2 — Tiny docs polish
- [x] README: include the full set of common keyboard shortcuts (restart run, abandon contract).
- [x] README: document the panel jump + district focus shortcuts.

## v1.9.3 — Tiny docs polish
- [x] README: clarify which search scripts are shell/grep vs Node (Windows-friendly).

## v1.9 — Tiny UX
- [x] Heat: make the (?) help button show a short hint (status pill) on click (mobile-friendly; title tooltips are unreliable).

## v1.9 — Tiny dev ergonomics (cross-platform)
- [x] Add a Node-based search helper (`npm run search:node`) so repo search works without POSIX shell scripts.
- [x] Search helper: add case-insensitive mode (`SEARCH_I=1`).
- [x] Search helper: accept multiple explicit paths (like the shell version) and default to `src site scripts`.
- [x] Search helper: add `--help` / `-h` output.

## v1.9 — Tiny save UX
- [x] Export save download filename includes app version (helps manage multiple save files).
- [x] Docs: mention versioned save download filenames in README.
- [x] Changelog: note versioned save download filenames.
- [x] UI: Help text mentions versioned save download filenames when clipboard is blocked.

## v2.0 — Tiny discoverability
- [x] UI: add a footer link to the CHANGELOG (GitHub) for curious players.

## v1.9 — Tiny determinism helper
- [x] Dev/debug: allow forcing the initial seed for a brand-new save via URL param `?seed=<u32>` (only when no existing save is present).
- [x] Docs: mention `?seed=<u32>` in README (debug/determinism).

## v1.9 — Tiny dev/test ergonomics
- [x] Tests: stop importing UI code from `site/`; move shared formatting helpers into `src/format.js`.
- [x] Tests: add basic `fmtPct()` coverage (avoid "-0.0%", digit clamping).

## v1.9 — Tiny accessibility / UX polish
- [x] Help panel summary tooltip + `aria-keyshortcuts` reflect the full keyboard shortcut set.
- [x] Add `aria-keyshortcuts` to core action buttons (export/import/level up/prestige/restart) in HTML.

## v1.9 — Tiny run control
- [x] UI: add a "Restart run" button (soft reset; keeps meta + seed) + keyboard shortcut (X).

## v1.10 — Defensive UI
- [x] UI: guard saveStatus updates if the element is missing (defensive/back-compat).

## v1.11 — Run reset polish
- [x] Restart run: clear sparklines/history so the new run starts visually clean.

## v1.12 — Keyboard ergonomics
- [x] Keyboard shortcut: press **A** to abandon the active contract (with confirmation).

## v1.13 — Keyboard ergonomics
- [x] Keyboard shortcut: press **C** to jump to the Contracts panel (when unlocked).
- [x] Keyboard shortcut: press **M** to jump to the Market panel.
- [x] Keyboard shortcut: press **N** to jump to the Inventory panel.

## v1.14 — Keyboard ergonomics
- [x] Keyboard shortcut: press **K** to jump to the Cats panel (when unlocked).

## v1.15 — Keyboard ergonomics
- [x] Keyboard shortcut: press **T** to jump to the Traders panel (when unlocked).

## v1.16 — Keyboard ergonomics
- [x] Keyboard shortcut: press **G** to jump back to the Core panel.

## v1.17 — Keyboard ergonomics
- [x] Keyboard shortcut: press **J** to jump to the Schemes panel (when unlocked).

## v1.18 — Keyboard ergonomics
- [x] Keyboard shortcut: press **D** to focus the District selector (when visible).

## v1.19 — A11y / hints
- [x] District selector: add `aria-keyshortcuts="D"` and hint (title) for the D shortcut.
