# Tallea Data

This folder is the source of truth for the simulated world.

## Structure

- **`canon/`** — Stable lore. Read-only reference. Loaded only when a cycle needs deeper detail.
- **`runtime/`** — Compact orchestrator-facing documents. Used to generate every cycle.
- **`seed/`** — One-time bootstrap files that define Day 0.
- **`cycles/`** — Generated cycle outputs (`cycle_NNN_output.json`). Mutable.
- **`current_state.json`** — Live world state, written after every cycle. Mutable.
- **`timeline.json`** — Append-only log of cycle events. Mutable.

## Loading order
1. Seed (`data/seed/initial_state.json`) → starting `WorldState`.
2. Each `data/cycles/cycle_NNN_output.json` is replayed in order, applying its delta.
3. Result is cached as `data/current_state.json` for fast reads.

## Reset
`resetWorldState()` (in `lib/state.ts`) deletes `current_state.json`, `timeline.json`, and all `cycle_*.json` files. Canon, runtime, and seed are never touched.
