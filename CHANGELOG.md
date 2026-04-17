# Changelog

This project ships continuously; this file is a lightweight, human-readable summary (not an exhaustive list).

## Unreleased
- Docs: add a short Roadmap section in the README pointing to `MILESTONES.md`.
- Docs: note that if `localStorage` is blocked/unavailable, progress may not persist (suggest Export save as a manual backup).
- Dev: `npm run todo:stats` prints a short list of remaining unchecked items (when any exist).
- Dev: `npm run todo:stats` prints an explicit "no remaining items" line when fully complete.
- Dev: `npm run todo:stats` supports `TODO_STATS_MAX=0` to suppress listing remaining items.
- Dev: `npm run todo:stats` supports JSON output (`TODO_STATS_JSON=1`).
- Docs: document `npm run todo:stats` env vars in the README.
- Docs/TODO: note these tiny dev ergonomics updates in `TODO.md`.

## 2026-04-11
- Docs: clarify `npm run search` usage/help text.
- Docs: note the search clarification in the changelog.

## 2026-04-10
- UI: Help / shortcuts panel remembers whether you left it open.
- Docs/UI: mention Help panel persistence in the README and in-game Help text.
