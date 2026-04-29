# Contributing

Thanks for helping!

## Local dev

Requirements:
- Node (see `.nvmrc`)

Install:
```bash
npm install
```

Run the game:
```bash
npm start
# or
npm run dev

# optional: choose a different port
PORT=3000 npm run serve

# optional: bind to LAN for mobile testing
HOST=0.0.0.0 npm run serve
# or
npm run serve:lan
```
Then open: http://localhost:5173 (or the port you picked)

## Tests / checks

```bash
npm test
# or
npm run check
```

Environment sanity check (Node/npm/python/git):

```bash
npm run doctor
```

One-shot sanity check (doctor + tests):

```bash
npm run verify
```

Watch mode (Node 22+):

```bash
npm run test:watch
```

## Project layout
- `src/` — game logic (prefer pure/deterministic functions where possible)
- `site/` — static site UI

## Deploy

GitHub Pages is published via GitHub Actions on push to `main`.
If you change asset paths/imports, verify the site still works when served from `/meow-conomy/`.

Optional: stamp the current git SHA into the UI footer before deploying:
```bash
npm run stamp
```
(This updates a version meta tag in `site/index.html`.)

## Style / architecture
- Keep changes small and boring.
- Avoid heavy deps.
- Preserve determinism (same seed + same actions => same outcomes).

## Handy commands
Search the codebase (if you don’t have `rg` / ripgrep installed):
```bash
# Quote the pattern so your shell doesn’t eat special characters.
npm run search -- "search term"
# or specify folders
npm run search -- "search term" src site

# tip: use extended regex when needed
npm run search:re -- "Heat|Whiskers" site
# (or: SEARCH_RE=1 npm run search -- "Heat|Whiskers" site)

# raw grep fallback
grep -RIn "search term" src site
```
