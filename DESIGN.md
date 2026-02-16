# DESIGN

## Goals
- Keep the project minimal and easy to extend.
- Favor clear, boring architecture over cleverness.
- **Lean active over idle**: the player should make frequent meaningful decisions; automation exists, but it should *support* play, not replace it.

## Notes from r/incremental_games research (trade-offs we want)
Using Brave search results for r/incremental_games, the recurring themes relevant to **meow-conomy** are:

### Active vs idle: players like *options*, but preferences differ
- People explicitly debate whether they prefer “active idle” (stuff to do while playing) vs mostly passive. Takeaway: if we lean active, we should still include **light passive/offline progress** as a convenience—not the main game.
  - Thread: “Active idle games or passive?” https://www.reddit.com/r/incremental_games/comments/1krzv6r/active_idle_games_or_passive/

### Vocabulary is fuzzy: “idle” and “incremental” overlap, but agency matters
- There’s community discussion about distinctions between idle vs incremental and how games can shift between active and idle as they progress. Takeaway: we can be “incremental” while staying active, as long as growth and unlocking are foundational.
  - Thread: “Idle VS incremental: let’s agree on a distinction?” https://www.reddit.com/r/incremental_games/comments/1q05oju/idle_vs_incremental_lets_agree_on_a_distinction/

### Meaningful choices beat linear upgrades
- Players repeatedly emphasize that upgrades/trees are best when they **force build choices** instead of being a single linear track where you just eventually buy everything. Takeaway: our upgrades should create **real trade-offs** (specialization, mutually exclusive picks, opportunity costs).
  - Thread: “Upgrade trees” https://www.reddit.com/r/incremental_games/comments/1qg2dsq/upgrade_trees/

### Prestige/reset systems: good when they add clarity + new decisions; bad when confusing or purely grind
- People complain about prestige that feels like wiping hours for an unclear or tiny benefit, or prestige “layers” that are basically fake length. Takeaway: if we do prestige, it must be:
  - clearly explained,
  - a satisfying breakpoint,
  - and it should unlock **new mechanics / new levers**, not just a % multiplier.
  - Thread: “What makes a prestige system bad?” https://www.reddit.com/r/incremental_games/comments/1lcswig/what_makes_a_prestige_system_bad/
  - Thread: “Is not having a prestige system… a red flag?” https://www.reddit.com/r/incremental_games/comments/1lj4fe6/is_not_having_a_prestige_system_in_new_releasing/

### What’s “fun” is often: progress + discovery + decisions (not just bigger numbers)
- Players describe quitting when the endgame becomes “only bigger numbers” or when goals feel artificially extended. Takeaway: keep introducing **new objectives** and **new interactions** on a cadence; avoid padding.
  - Thread: “What makes an idle/incremental game actually addictive for you?” https://www.reddit.com/r/incremental_games/comments/1ko0i7y/what_makes_an_idleincremental_game_actually/

### Fail states: many players dislike unavoidable/random failure, but enjoy opt-in challenge runs
- Discussions about “fully active” incremental games mention “lack of fail state” as part of the genre expectation, while other threads criticize loss that’s out of player control. Takeaway: default mode should avoid hard fail; include **opt-in** challenge scenarios where losing is part of the fun.
  - Thread: “Are fully active games considered incremental?” https://www.reddit.com/r/incremental_games/comments/1ji25mr/are_fully_active_games_considered_incremental/
  - Thread: “A simple double or nothing…” (critique of unavoidable randomness) https://www.reddit.com/r/incremental_games/comments/1k0ec3q/a_simple_double_or_nothing_game_made_incremental/
  - Thread: “What makes… relaxing” (fail states not enjoyable for some) https://www.reddit.com/r/incremental_games/comments/1puo4ph/what_makes_an_incremental_idle_game_feel_truly_relaxing_to_you/

## Core gameplay loop (active incremental)
**Moment-to-moment (seconds → minutes):**
1. **Scan** the economy state (prices, inventory, demand, risk, timers).
2. **Choose an action** with opportunity cost:
   - buy/sell/convert resources
   - allocate “workers/cats” to jobs
   - trigger an ability (“hustle”, “scheme”, “market manipulation”, etc.)
   - take a contract/quest with constraints
3. **Resolve outcomes** (profit/loss, reputation, instability, unlock progress).
4. **Reinvest**: upgrade tools, unlock new markets, improve efficiency, reduce risk.

**Session loop (minutes → tens of minutes):**
- Push toward a **goal state** (hit a profit target, stabilize inflation, corner a market, satisfy a faction).
- Decide when to **pivot** (change product line, switch strategy, enter new market).

**Meta loop (hours → days):**
- **Prestige/reset** (or “seasonal shift”) that trades short-term progress for long-term multipliers and new mechanics.
- New layers should add **new decisions**, not just bigger numbers.

### Active vs idle stance
- The game should be *playable* with frequent input.
- “Idle” progression (offline gains / long timers) should be limited and primarily used as:
  - a safety net (you don’t fall behind if you step away), and/or
  - a way to bank resources for the next active burst.

## Concrete initial spec (what we’re actually building first)
This section turns the principles above into a **minimal, active-first** design we can implement.

### Player verbs (2–3 core actions + 1 supporting action)
**Core verbs (active):**
1. **Trade**: buy/sell goods using coins.
   - The player chooses *what* to trade and *when* (price/demand changes create timing decisions).
2. **Allocate cats**: assign a small roster of cats to jobs (production, scouting, negotiating, guarding).
   - Allocation is constrained (limited cats / limited slots), so choices matter.
3. **Trigger a Scheme (cooldown ability)**: a short, player-initiated burst move.
   - Examples: “Hustle” (double output for 20s), “Price Pounce” (lock a favorable price briefly), “Nine Lives” (insurance against one bad outcome).

**Supporting verb (strategic):**
4. **Take a Contract**: pick one active objective that shapes the next few minutes.
   - Contracts create pressure and define what “good play” means right now.

### The first contract system (v0.2 target)
A contract is a timed objective with explicit inputs/outputs and stakes.
- Fields:
  - **Title + description** (flavor)
  - **Requirements** (deliver X of good A, or earn Y coins via category)
  - **Deadline** (N ticks / minutes)
  - **Reward** (coins + reputation + unlock tokens)
  - **Penalty** (reputation loss, temporary lockout, increased “Heat”)
  - **Tags** (safe/risky, trader/producer, early/mid)
- Design goals:
  - At any time the player can hold **at most 1 active contract** (keeps focus and prevents checklist spam).
  - The player should be able to **abandon** a contract (small penalty) to preserve agency.

### The economy model (minimal but decision-rich)
- 3 starter goods (example placeholders):
  - **Kibble** (stable, low margin)
  - **Catnip** (volatile, high margin)
  - **Shiny Things** (rare, used for upgrades)
- Prices are not purely random: they respond to **player actions** (saturation) and simple market drift.
- Add one explicit risk meter: **Heat** (how much attention you’re attracting).
  - High Heat increases event chance (taxes, confiscation, rival interference) but can also unlock higher-paying contracts.

### Prestige concept (v0.3/v0.4 target): “Seasons”
Prestige should be a **clean breakpoint** that unlocks new levers.
- When you “End the Season”, you reset most run resources (coins, inventory, contracts) but gain:
  - **Whisker Points** (meta currency)
  - **New districts/markets** (new price behaviors + new goods)
  - **New Scheme cards** (new active abilities)
- Prestige should never be “wipe for +1%”. Each prestige step must unlock at least **one new mechanic** or a new strategic path.

### Run structure (what a ‘session’ feels like)
- In a 10–30 minute session, you should:
  1) pick a contract,
  2) build a trade/production plan,
  3) execute with schemes + allocation,
  4) cash out and upgrade,
  5) decide whether to pivot or continue.

## Expected duration & difficulty
**Target play pattern:**
- **Core session length:** 10–30 minutes feels satisfying.
- **Meaningful progress cadence:** every 30–120 seconds the player should see a new option, trade-off, or payoff.
- **Arc length:** 2–6 hours to reach “first full loop” (first prestige / first big system reveal).

**Difficulty philosophy:**
- Not twitch difficulty; it’s **systems/optimization difficulty**.
- Early game: forgiving, teaches verbs.
- Mid game: introduces scarcity and conflicting objectives.
- Late game: mastery/optimization + puzzle-like market situations.

## Where the fun comes from
- **Meaningful decisions under constraints**: limited slots, time, risk budget, capital, reputation.
- **Short feedback loops**: actions have visible consequences quickly.
- **Discovery**: unlocking new mechanics that change how you play (not just multiply output).
- **Planning + execution**: “I have a strategy” → “I pull it off” → “numbers jump”.
- **Expressive playstyles**: multiple viable strategies (safe/steady vs risky/speculative).

## Where the challenge comes from
- **Trade-offs**: every upgrade/action should have a cost (money, time, risk, lockout, reputation hit).
- **Market dynamics**: prices/demand can drift; exploiting a market can saturate it.
- **Risk management**: leverage/speculation can spike growth but can also crash you.
- **Goal pressure**: contracts with deadlines, quotas, or constraints.

## Is it possible to lose?
Yes—*but loss should be interesting and recoverable*.
- **Soft fail states** (preferred):
  - bankruptcy triggers a **bailout/reset** with a penalty (reputation scar, lost time, forced pivot).
  - failed contracts close a path temporarily or change faction relations.
- **Hard fail** (avoid unless very short-run mode):
  - a run-ending wipe that forces a full restart.

Design intent: allow the player to **take calculated risks**. Losing should teach, not punish.

## Player agency (what control they actually have)
The player should be able to:
- pick **what to produce/trade** (portfolio choices)
- pick **where to allocate limited capacity** (slots/worker assignments)
- decide **when to cash out vs reinvest**
- decide **when to prestige/reset**
- manipulate **systems** (temporary buffs, market interventions, arbitrage routes)

To keep agency high, avoid:
- long mandatory waits to unlock core features
- upgrades that are always correct (dominant strategies)

## Key features and how they fit the game arc
### Early game (teach the verbs)
**Features:**
- 2–3 resource types
- simple buy/sell/convert
- 1–2 active abilities with cooldowns

**Arc role:** establish the “I do a thing → I see profit/loss immediately” feeling.

### Mid game (introduce strategy)
**Features:**
- contracts/quests with constraints (deadlines, inputs, reputational stakes)
- market forces (supply/demand shifts, saturation)
- specialization paths (e.g., trader vs producer vs speculator)

**Arc role:** introduce conflicting objectives and force the player to plan.

### Late game (mastery + meta progression)
**Features:**
- prestige layer that unlocks *new mechanics* (not just multipliers)
- advanced tools (automation that still requires supervision/targets)
- challenge modes/scenarios (tight constraints, puzzle markets)

**Arc role:** reward mastery with deeper toys; keep the game active by adding new levers.

## Key mechanics (and how the player can master them)
- **Capacity management**: mastering slot/worker allocation; timing switches.
- **Timing & cooldown play**: chaining abilities for bursts; avoiding dead time.
- **Risk vs reward**: leverage/speculation; learning when to hedge.
- **Market reading**: recognizing patterns (shortages, gluts) and reacting.
- **Run planning**: setting goals for a session; choosing when to reset.

## High-level architecture
- **src/**: core logic (simulation/economy rules, state updates)
- **site/**: static site / UI wrapper (if any)
- **.github/**: CI, templates, automation

## Data model (draft)
- Define the core entities and their fields here (e.g., items, producers, consumers, transactions).

## Mechanics (draft)
- Describe how value is created, transferred, and conserved (if applicable).
- Randomness: where it’s allowed, and how seeds/reproducibility work.

## UI/UX (draft)
- What the user can do.
- What should be visible vs. hidden.

## Non-goals
- Multiplayer / realtime sync (unless explicitly added later)
- Heavy dependencies
- Pure idle gameplay where optimal play is “check once per day”
