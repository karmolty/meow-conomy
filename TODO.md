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

## v1.9 — Tiny safety/UX
- [x] Hard reset requires typing `RESET` (instead of a single confirm click) to avoid accidental wipes.

## v1.8.1 — Tiny market readability
- [x] UI: show per-good Δ% (change since last tick) next to the price in the Market panel.
- [x] A11y: mark Δ% indicator as aria-hidden (it’s redundant with the price + sparkline).

## v1.9 — Tiny accessibility polish
- [x] Docs: mention keyboard focus ring + keyboard-focusable help icons (Heat info) in README.
- [x] A11y: make small help affordances (like Heat "(?)") keyboard-focusable buttons.
- [x] A11y: mark the save status pill as a proper live "status" region.
- [x] A11y: add a consistent keyboard focus ring for buttons.
- [x] A11y: avoid duplicate focus styles for help icon buttons.

## v1.9 — Tiny UX clarity
- [x] UI: add a small Heat tooltip hint (what it affects) so the meter isn’t mysterious when it unlocks.
- [x] UI: add a tooltip to the Market "sat" (saturation) indicator so players know it’s price pressure that decays.
- [x] UI: add hover titles to the Core sparklines (coins / net worth / income) for quick discoverability.

## v1.9 — Tiny accessibility shortcuts
- [x] A11y: add `aria-keyshortcuts` for main keyboard controls (Help, Export/Import, Level Up, End Season, Seed copy).
- [x] A11y: add `aria-keyshortcuts` for Schemes (1–5).

## v2.0 — Micro onboarding
- [x] UX: show a one-shot status hint when **Level Up** becomes available (per level).

## v2.1 — Tiny docs
- [x] Docs: README LAN URL example should reflect custom PORT (not always :5173).

## v2.2 — Tiny dev ergonomics
- [x] Dev: add `npm run serve:lan` script (bind to 0.0.0.0) for easy mobile testing.
- [x] Docs: mention `npm run serve:lan` in CONTRIBUTING.

## v2.3 — Tiny test hardening
- [x] Tests: `fmt()` clamps non-finite inputs (NaN/Infinity) to "0".
- [x] Tests: `fmt()` behavior near the K suffix threshold (e.g. <1000 stays plain number; 1000 becomes "1.00K").

## v2.4 — Tiny UI formatting
- [x] UI: `fmt()` supports billions (e.g. 1,000,000,000 → "1.00B").

## v1.9 — Tiny UX
- [x] Avoid repo link placeholder (set a sensible default href in HTML; JS may override).

## v1.10 — Tiny test hardening
- [x] Tests: `whiskersForCoins()` is monotonic and clamps non-positive coin inputs to 0.
- [x] Tests: `endSeason()` retains a non-zero `state.seed` (determinism per save).

## v1.10 — Micro UI polish
- [x] Prevent "flash of dev version" by hiding the Version line until JS sets it.

## v1.11 — Tiny dev quality
- [x] Dev: allow `HOST=0.0.0.0 npm run serve` to bind the dev server (useful for LAN/mobile testing).
- [x] Docs: mention how to bind the Python quick-start server for LAN/mobile testing.
- [x] Docs: add a quick note on finding your LAN IP for mobile testing.

## Nice-to-have (after v1.0)
- [x] Opt-in challenge modes (explicit fail states)
  - [x] Iron Contracts: if a contract expires, your run is busted (run reset, 0 Whiskers)
  - [x] Hot Paws: if Heat hits 100, your run is busted (run reset, 0 Whiskers)
- [x] Simple charts (income over time, heat over time, price history)
  - [x] Coins sparkline in Core panel
  - [x] Net worth sparkline + /min rate in Core panel
  - [x] Heat sparkline in Core panel
  - [x] Income (/min) + delta sparkline in Core panel
- [x] More cats, jobs, and scheme cards (starter set)
- [x] UI polish
  - [x] Keyboard shortcuts: number keys 1–5 activate schemes (when available)
  - [x] Hook up Price Pounce to improve trade prices
  - [x] Hook up Production cat job (generates Kibble)
  - [x] Hook up Hustle scheme (boosts production)
  - [x] Hook up Nine Lives scheme (negates next Heat event)
  - [x] Make Scouting increase market intel (retain more price history)
  - [x] UI: show Nine Lives shield charges
  - [x] Prevent using Cool Whiskers before Heat unlock
  - [x] UI: disable Cool Whiskers until Heat unlock
  - [x] Make Guarding reduce Heat event impact
  - [x] Add a 3rd starter cat (Toast)
  - [x] Add a 4th starter cat (Pixel)
  - [x] Add a 4th scheme card (Cool Whiskers)
  - [x] Add a 5th scheme card (Market Nap)
  - [x] Add another scheme card (Purr-suasion)
  - [x] Add save **Export/Import** (copy/paste JSON) in the Core panel
  - [x] Export save fallback: download `meowconomy-save.json` when clipboard blocked
  - [x] Import save from file upload (in addition to paste JSON)
  - [x] UI: add a small Help / shortcuts section (keyboard + progression tips)
  - [x] Accessibility: add aria-labels to Market buy/sell buttons and Scheme buttons
  - [x] Accessibility: add aria-labels to Core buttons (reset/export/import/level up/end season)
  - [x] Accessibility: add aria-labels to Contract buttons (accept/redeem/abandon)
  - [x] Accessibility: add aria-live to key stats (coins/Heat/Whiskers) for screen readers

## v1.3.1 — Tiny UX polish
- [x] UI: number formatting shows integers without trailing ".00" for readability.
- [x] UI: avoid displaying "-0" in formatted numbers.
- [x] UI: Hard reset clears all localStorage saves (current + legacy) to prevent "ghost" restores.
- [x] UI: Hard reset confirm text warns it clears older versions + suggests exporting first.
- [x] UI: Hard reset clears sessionStorage flash message (avoid stale "save imported" after reset).
- [x] Tests: cover UI number formatter (fmt) for integer output, K/M suffixes, and -0.
- [x] UI: use fmt() for /min rate displays (avoid trailing .00 spam).
- [x] UI: use fmt() for saturation display in Market rows.
- [x] UI: format trader fee % with fmt() (consistent number formatting).
  - [x] Accessibility: add aria-live to key rate stats (net worth + income) for screen readers
  - [x] Accessibility: add aria-live to goal + progress labels for screen readers
  - [x] Keyboard shortcut: press ?/H to toggle the Help / shortcuts panel
  - [x] Keyboard shortcut: press E to Export save
  - [x] Keyboard shortcut: press I to Import save
  - [x] Keyboard shortcut: press L to Level Up (when available)
  - [x] Keyboard shortcut: press P to End Season (Prestige) (when available)
  - [x] Keyboard shortcut: press Esc to close the Help panel (when open)
  - [x] Accessibility: add aria-live to save status indicator for screen readers

## v1.7 — Tiny accessibility (skip link)
- [x] UI: ensure skip link target is focusable (tabindex=-1)
- [x] UI: add visible focus styles (focus-visible) for keyboard users
- [x] UI: add a “Skip to game” link for keyboard/screen reader users
- [x] UI: use a <main> landmark for the game container

## v1.8 — Tiny docs consistency
- [x] README: watch mode note says Node 22+ (matches package.json engines)
- [x] CONTRIBUTING: watch mode note says Node 22+ too

## v1.8.1 — Tiny UX consistency
- [x] Goal ladder: 250-coin goal label mentions Contracts (matches actual unlock behavior)

## v1.8.2 — Tiny UX consistency
- [x] Goal ladder: goal labels mention their key unlocks (Heat/Schemes, Traders, Cats)

## v1.8.3 — Tiny UX polish
- [x] UI: Level Up button tooltip hints what the next goal unlocks


## v1.9 — Micro UI consistency
- [x] UI: floaty coin deltas use coins formatting (no "$" prefix)

## v1.9.1 — Micro contract UX
- [x] Contracts UI: show good labels ("Kibble") instead of internal keys ("kibble") in requirements

## v1.9.2 — Micro contract UX
- [x] Contracts list: show penalty + rough time limit on available contracts

## v1.9.3 — Micro contract UX
- [x] Contracts list: show exact deadline as m:ss instead of rough "Nm"

## v1.9.4 — Micro contract UX
- [x] Contracts list: show a one-line requirement summary (earn coins / deliver good)

## v1.9.5 — Micro contract UX
- [x] Contracts list: show tags (safe/risky, trade/production) as small muted chips

## v1.9.6 — Micro contract UX
- [x] Contracts list: only render tags row when tags exist (avoid extra blank space)

## v1.9.7 — Micro contract UX
- [x] Contracts list: format reward/penalty amounts with fmt()

## v1.9.8 — Micro contract UX
- [x] Active contract UI: format reward/penalty amounts with fmt()

## v1.9.9 — Micro contract UX
- [x] Contracts list: only show player-relevant tags (hide internal ones like starter/prestige)

## v1.10 — Tiny Help UX
- [x] UX: clicking/tapping outside the Help panel closes it (when open)

## v1.10.1 — Tiny a11y UX
- [x] A11y: when opening Help via keyboard, move focus to the Help summary

## v1.10.2 — Tiny Help hint polish
- [x] A11y: Help summary advertises Esc as a close shortcut (title + aria-keyshortcuts)

## v1.10.3 — Tiny Scheme UX
- [x] UX: Scheme buttons show their 1–5 keyboard shortcut in the tooltip

## v1.10.4 — Tiny Scheme UX
- [x] UX: Schemes list shows the 1–5 hotkey next to each scheme

## v1.10.5 — Tiny button hint polish
- [x] UX: Level Up / End Season buttons include their keyboard shortcut in the tooltip

## v1.10.6 — Tiny docs polish
- [x] README: expand Handy shortcuts list to include Help, Export/Import, Level Up, End Season, and Esc
