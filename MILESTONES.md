# MILESTONES

These milestones are written as **deliverables with acceptance criteria** (AC). If a milestone’s AC is met, we can confidently ship/tag it.

## v0.1 — Playable Active Skeleton (single-session loop)
### Deliverables
- **Core state + tick loop** in `src/`
- **Minimal UI** (can be super plain) to play the loop
- **Two resources + coins**
- **One active action** the player can spam/choose (e.g., Trade)

### Acceptance criteria
- AC1: Running the project locally shows an interface where the player can perform at least **one meaningful action** repeatedly (e.g., buy/sell) and see the state change immediately.
- AC2: There is a single source of truth state (no hidden globals) and a deterministic “tick/update” function that can be called in tests.
- AC3: A new player can reach a clear short-term goal in **< 10 minutes** (e.g., “earn 100 coins”).

## v0.2 — Decision-Rich Economy + Contracts (active play focus)
### Deliverables
- **3-goods economy** (Kibble/Catnip/Shiny Things or similar placeholders)
- **Price/demand model** that responds to player actions (basic saturation)
- **Cat allocation** system (limited slots) impacting production/trade outcomes
- **Contracts**: at most 1 active contract, with rewards + penalties

### Acceptance criteria
- AC1: The player can choose between at least **2 viable strategies** to complete a contract (e.g., trade-focused vs production-focused) without one being strictly dominant.
- AC2: Contract has: requirements, deadline, reward, penalty, and can be **abandoned** with a defined consequence.
- AC3: The player must make a meaningful choice at least every **30–120 seconds** (no long mandatory waits).
- AC4: Market “saturation” exists: repeatedly exploiting one good reduces its profitability until the player pivots.

## v0.2.1 — Price Engine v1 (less predictable, still learnable)
### Deliverables
- Replace visible repeating price cycles with a **seeded, multi-timescale price process** (see DESIGN.md: Market dynamics plan).
- Prices remain **deterministic per save** (same seed + same actions → same prices).
- Goods feel distinct:
  - Kibble = calmer (lower volatility, stronger mean reversion)
  - Catnip = swingier (higher volatility, occasional "hype" regime)
  - Shiny = chaotic/high-vol (later-good feel)
- Existing **pressure/saturation** continues to influence prices and decays over time.
- Basic test coverage for invariants + determinism.

### Acceptance criteria
- AC1: Watching any good for **3 minutes** does **not** reveal an exact repeating loop with a fixed period.
- AC2: Prices are bounded + sane:
  - price >= 1 always
  - no runaway drift over a 10-minute idle simulation
- AC3: Determinism: given fixed `state.seed` and a fixed sequence of actions, the price series matches exactly across runs.
- AC4: Distinct feel: measured price volatility satisfies `vol(kibble) < vol(catnip) < vol(shiny)` over a representative window (e.g. 2 minutes).
- AC5: Pressure works: repeated buys measurably worsen execution price on that good, and it recovers toward baseline after ~30–90s of no trading.

## v0.2.2 — Goal Ladder + Unlock Gating (reduce early clutter)
### Deliverables
- Replace ad-hoc unlocks with a simple **goal ladder** (level → goal → reward → next).
- Unlocks gate both **mechanics** and **UI panels** (don’t show panels that aren’t unlocked).
- At minimum, define and implement these unlock steps:
  1) **Level 0 → 100 coins:** unlock Catnip (already)
  2) **Level 1 → 250 coins:** unlock Contracts (already)
  3) **Level 2 → 500 coins:** unlock Heat (meter becomes visible + has at least one gameplay consequence)
  4) **Level 3 → 800 coins:** unlock Traders (panel visible; traders have at least one meaningful constraint tied to Heat)
  5) **Level 4 → 1200 coins:** unlock Cats (panel visible; at least one job has a real effect)

### Acceptance criteria
- AC1: A fresh save shows only **Core + Market + Inventory**; additional panels appear only when unlocked.
- AC2: Each goal has a single clear reward (new good or new system). The UI reflects the current goal only.
- AC3: After leveling up, the next goal cannot be leveled again repeatedly (no infinite level-up loops).
- AC4: Heat is not just cosmetic when unlocked: it changes at least one probability/cost/constraint.
- AC5: Traders are not fire-and-forget: they incur a meaningful constraint (fee/actions/Heat) once unlocked.

## v0.3 — Schemes (active abilities) + Risk (Heat)
### Deliverables
- **Scheme system**: 3 ability cards with cooldowns (Hustle/Price Pounce/Nine Lives or similar)
- **Heat meter** with at least 2 consequences (events, contract availability, penalties)
- **Basic event system** (a few event types) tied to Heat

### Acceptance criteria
- AC1: Using schemes changes optimal play (i.e., there exist situations where timing a scheme is clearly beneficial).
- AC2: Heat can be both a risk and an opportunity: high Heat unlocks better rewards *and* increases bad outcomes.
- AC3: The game has **no unavoidable hard-fail RNG**: the player can mitigate risk via choices (cats, schemes, pivoting).

## v0.4 — Season Prestige (new levers, not just multipliers)
### Deliverables
- **End Season / Prestige** action
- **Whisker Points** meta currency
- At least **one new mechanic unlocked** by prestige (new district/market OR new contract type OR new scheme slot)

### Acceptance criteria
- AC1: Prestiging resets run resources (coins/inventory/contracts) and grants Whisker Points based on clear criteria.
- AC2: After prestige, the player has at least **one new decision lever** available immediately (not just “+X%”).
- AC3: Prestige explanation is clear in-game: what resets, what carries over, and why it’s worth it.

## v1.0 — Stable Minimal Game
### Deliverables
- Save/load (local)
- Balance knobs documented (what to tweak for pacing)
- Tests for core rules (tick, pricing, contracts)
- Simple deploy instructions

### Acceptance criteria
- AC1: A player can complete at least **one full Season loop** (start → contracts → upgrades → prestige) without reading the source.
- AC2: Core logic has automated tests covering the main systems.
- AC3: No progress blockers: the game can always recover from bad choices via pivoting/prestige (unless in opt-in challenge mode).
