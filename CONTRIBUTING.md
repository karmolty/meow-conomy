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
```
Then open: http://localhost:5173

## Tests / checks

```bash
npm run check
```

Watch mode:

```bash
npm run test:watch
```

## Project layout
- `src/` — game logic (prefer pure/deterministic functions where possible)
- `site/` — static site UI

## Deploy

GitHub Pages is published via GitHub Actions on push to `main`.
If you change asset paths/imports, verify the site still works when served from `/meow-conomy/`.

## Style / architecture
- Keep changes small and boring.
- Avoid heavy deps.
- Preserve determinism (same seed + same actions => same outcomes).
