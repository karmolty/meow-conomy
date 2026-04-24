# meow-conomy

![CI](https://github.com/karmolty/meow-conomy/actions/workflows/ci.yml/badge.svg)

Live site: https://karmolty.github.io/meow-conomy/

A minimalist cat-themed incremental browser game (inspired by the genre, not a clone).

## Dev notes
- Source lives in `src/`
- Static site output lives in `site/`
- Deployed to GitHub Pages via GitHub Actions on push to `main`
- Optional: `npm run stamp` updates the in-game footer version to the current git SHA
- Changelog: see `CHANGELOG.md`

## Roadmap
The game is playable; planned changes (with acceptance criteria) live in:
- `MILESTONES.md`

## Deployment (GitHub Pages)
- Push to `main` → GitHub Actions publishes `site/` to Pages.
- Live URL: https://karmolty.github.io/meow-conomy/
- If you change paths/asset URLs, verify `site/index.html` still works when served from `/meow-conomy/`.

## Local dev
Use a local server (recommended; `file://` can break ES module imports in some browsers).

Quick start (no Node required):

```bash
python3 -m http.server 5173 --directory site

# optional: bind to LAN for mobile testing
python3 -m http.server 5173 --bind 0.0.0.0 --directory site
```

Then open: http://localhost:5173

Or via npm (recommended if you already have Node installed):

```bash
npm start
# or
npm run dev
# or
npm run serve

# optional: choose a different port
PORT=3000 npm run serve

# optional: bind to LAN for mobile testing
HOST=0.0.0.0 npm run serve
# or
npm run serve:lan
# then open from your phone on the same Wi‑Fi: http://<your-lan-ip>:5173
# (if you set PORT=####, use that port instead; find your LAN IP via `ip addr` on Linux)
```

Tip: open the in-game **Help / shortcuts** section (footer) for keyboard + progression reminders.

Handy shortcuts:
- **?** / **H**: toggle Help / shortcuts (remembers if you left it open)
- **Esc**: close Help (when open)
- **1–5**: activate Schemes (when unlocked)
- **E**: export save
- **I**: import save
- **F**: open Import file picker
- **L**: Level Up (when available)
- **P**: End Season (when available)
- **S**: copy the current save seed (when visible)
- **R**: redeem a completed contract (when available)

Mobile notes:
- iOS Safari: the game prevents double-tap-to-zoom inside the game surface.
- Tap-heavy controls also guard against “ghost clicks” (a synthetic click firing after touch), to avoid accidental double-trades.

Accessibility notes:
- Small help affordances (like the Heat "(?)") are real buttons, so they’re keyboard-focusable.
- Buttons show a visible focus ring when navigating by keyboard.
- Respects `prefers-reduced-motion` (disables floaty animations and avoids smooth scrolling when reduced motion is requested).

## Saving
- The game auto-saves to `localStorage`.
- If the save format/key ever changes, the game will try to **auto-migrate** the newest prior `meowconomy.save.*` entry forward.
- Use **Hard reset** to clear your save (it removes the current save key and any older `meowconomy.save.*` keys).
- If `localStorage` is blocked/unavailable (some private browsing modes or strict browser settings), the game will still run but **progress may not persist**. In that case, use **Export save** occasionally as a manual backup (downloaded save filenames include the current app version to make it easier to keep multiple backups).
- **Debug/determinism:** to start a brand-new run with a specific deterministic seed, open the page with `?seed=<u32>` (only works if you don’t already have a save for this version).

## Search
If you don’t have `rg` / ripgrep installed:

```bash
npm run search -- "search term"

# extended regex
npm run search:re -- "Heat|Whiskers" site
# (or: SEARCH_RE=1 npm run search -- "Heat|Whiskers" site)
```

## Dev helpers

TODO checklist stats:

```bash
npm run todo:stats

# suppress listing remaining items (only show the counts)
TODO_STATS_MAX=0 npm run todo:stats

# JSON output (useful for scripts)
TODO_STATS_JSON=1 npm run todo:stats
```

## Smoke test
Automated:

```bash
npm test
# or (same thing)
node src/game.test.mjs
```

CI/local parity:

```bash
npm run check
```

Watch mode (Node 22+):

```bash
npm run test:watch
```

Manual “viable strategy” smoke tests (v0.2 AC1 support):

1) Trade-first (low stress)
- Start a contract (e.g. “Quick Flip”)
- Trade **Kibble** only:
  - buy when price is low-ish (trend sparkline bottoming)
  - sell after it rises
- You should be able to finish without touching Catnip/Shiny.

2) Risky / opportunistic (faster swings)
- Reach 100 coins to unlock **Catnip** (250 unlocks **Shiny Things**)
- Trade the swingy good:
  - buy dips, sell spikes
- If you get stuck, pivot back to Kibble to stabilize.

## Schemes (active abilities)
- Schemes unlock alongside **Heat** at **500 coins**.
- Some schemes are Heat-gated too (e.g. **Cool Whiskers** can’t be used until Heat is unlocked).

## Prestige (End Season)
- Click **End Season** in the Core panel.
- You gain **Whiskers** based on your current coins, then your run state resets (coins/inventory/contracts/Heat/market pressure).
- You keep **Whiskers** and **Seasons**.

## Challenges (opt-in)
Challenges add explicit fail states. They are optional and intended for players who want stakes.

Enable them in the Core panel:
- **Iron Contracts**: if a contract expires, your run is busted (instant run reset, 0 Whiskers)
- **Hot Paws**: if Heat reaches 100, your run is busted (instant run reset, 0 Whiskers)

## Tuning knobs (balance)
Quick pointers for pacing/balance tweaks:
- **Goods feel / volatility**: `goodParams()` in `src/game.js` (`volSlow`, `volFast`, `drift`, `meanRev`, regime durations).
- **Saturation strength + recovery**: `withPressure()` (multiplier per pressure) + `decayPressure()` (`decayPerSec`) in `src/game.js`.
- **Heat scaling**: trade Heat deltas in `buy()`/`sell()` and job mitigation in cats logic (`src/game.js`, `src/cats.js`).
- **Trader constraints**: fees + action rate in `src/traders.js`.
- **Prestige rewards**: `whiskersForCoins()` in `src/prestige.js`.
