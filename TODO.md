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
- [x] **Add price pattern unpredictability**: move beyond obvious sine cycles (e.g., regime switches, bounded random walk with mean reversion, or noise + events), while keeping it learnable.
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
- [ ] Design + implement **Hire Traders**: limited automation with player-configured rules (buy/sell thresholds, caps), plus constraints (fees, action rate, Heat).
  - [x] Define Trader schema + rule format
  - [x] Implement trader execution per tick (respects caps + action rate)
  - [x] UI to configure trader rules

### Balance checks
- [x] Add 2 “viable strategy” smoke tests (even if manual): trade-first vs produce-first can both clear a starter contract

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
