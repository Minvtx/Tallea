# Seed

One-time Day 0 bootstrap.

## Files

- `initial_state.json` — Starting `WorldState` snapshot. Loaded once; never replayed.
- `first_cycle_seed.md` — Recommended Day 1 trigger (Veta merchant pilot). Used by the orchestrator on day 0 only.

## Versioning
If the seed needs to change, create `initial_state.v2.json` rather than editing in place. Existing runs that have already advanced past Day 0 should not be affected.
