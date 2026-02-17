# meow-conomy

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

## Prestige (End Season)
- Click **End Season** in the Core panel.
- You gain **Whiskers** based on your current coins, then your run state resets (coins/inventory/contracts/Heat/market pressure).
- You keep **Whiskers** and **Seasons**.
