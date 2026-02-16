# TODO

This TODO is organized to map directly onto `MILESTONES.md`.

## v0.1 — Playable Active Skeleton
### Core code
- [ ] Define `GameState` type (coins, inventory, market, cats, time/tick)
- [ ] Implement `tick(state, dt)` (deterministic update; no UI side effects)
- [ ] Implement basic **Trade** action(s): `buy(good, qty)` / `sell(good, qty)`
- [ ] Add 2 goods + coins (simple fixed or gently moving prices for v0.1)

### UI (minimal is fine)
- [ ] Add a minimal play UI in `site/` (or console) that:
  - shows coins + inventory
  - shows current prices
  - lets player buy/sell
- [ ] Add a short “goal” message (e.g., Earn 100 coins) for the <10 min AC

### Quality
- [ ] Add a tiny test harness for `tick` and `buy/sell` invariants (coins never negative unless explicitly allowed, inventory non-negative)
- [ ] Add README instructions: run locally + what the player is trying to do

## v0.2 — Decision-Rich Economy + Contracts
### Economy
- [ ] Expand to 3 goods (Kibble/Catnip/Shiny Things or renamed)
- [ ] Add **saturation**: repeatedly trading the same good reduces its profitability (per-good pressure variable)
- [ ] Implement price update rule that depends on saturation + mild drift (deterministic or seedable RNG)

### Cats / capacity
- [ ] Define Cat roster + jobs (production/scouting/negotiating/guarding)
- [ ] Implement **allocation** constraints (limited cats/slots) + effects (e.g., production per tick, better trade prices, reduced Heat)
- [ ] UI to assign/unassign cats

### Contracts
- [ ] Define Contract schema (requirements, deadline, reward, penalty, tags)
- [ ] Implement contract generation/selection
- [ ] Enforce **max 1 active contract**
- [ ] Implement abandon contract + defined penalty
- [ ] UI: show active contract + progress + time remaining

### Balance checks
- [ ] Add 2 “viable strategy” smoke tests (even if manual): trade-first vs produce-first can both clear a starter contract

## v0.3 — Schemes + Heat
### Schemes
- [ ] Implement Scheme system (cooldowns, duration, effect application)
- [ ] Add 3 starter schemes (placeholder names OK):
  - Hustle (burst output)
  - Price Pounce (temporary favorable price)
  - Nine Lives (mitigate one bad outcome)
- [ ] UI: scheme buttons + cooldown indicators

### Heat + events
- [ ] Add Heat meter to state
- [ ] Heat increases with certain profitable/risky actions; decreases with calming actions/jobs
- [ ] Add at least 3 event types (tax, rival, confiscation) whose probability/scaling depends on Heat
- [ ] Ensure events are not unavoidable death spirals: add mitigation paths (cats/schemes/pivot)

## v0.4 — Season Prestige
- [ ] Implement “End Season” action
- [ ] Implement Whisker Points (meta currency) award formula
- [ ] Implement carryover/unlocks:
  - unlock new district/market OR
  - unlock new contract type OR
  - unlock new scheme slot
- [ ] UI: prestige explainer (what resets, what carries, why)

## v1.0 — Stable Minimal Game
- [ ] Save/load (localStorage or JSON) for run + meta progression
- [ ] Document tuning knobs (pacing, price volatility, heat scaling, contract rewards)
- [ ] Add tests for tick/pricing/contracts (core invariants)
- [ ] Deployment instructions (GitHub Pages if applicable)

## Nice-to-have (after v1.0)
- [ ] Opt-in challenge modes (explicit fail states)
- [ ] Simple charts (income over time, heat over time, price history)
- [ ] More cats, jobs, and scheme cards
