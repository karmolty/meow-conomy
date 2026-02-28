# meow-conomy

![CI](https://github.com/karmolty/meow-conomy/actions/workflows/ci.yml/badge.svg)

Live site: https://karmolty.github.io/meow-conomy/

A minimalist cat-themed incremental browser game (inspired by the genre, not a clone).

## Dev notes
- Source lives in `src/`
- Static site output lives in `site/`
- Deployed to GitHub Pages via GitHub Actions on push to `main`

## Deployment (GitHub Pages)
- Push to `main` → GitHub Actions publishes `site/` to Pages.
- Live URL: https://karmolty.github.io/meow-conomy/
- If you change paths/asset URLs, verify `site/index.html` still works when served from `/meow-conomy/`.

## Local dev
Open `site/index.html` in a browser.

Tip: open the in-game **Help / shortcuts** section (footer) for keyboard + progression reminders.

## Saving
- The game auto-saves to `localStorage`.
- Use **Hard reset** to clear your save.

## Smoke test
Automated:

```bash
node --test
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
