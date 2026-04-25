# Runtime

Compact, orchestrator-facing documents. These are the primary inputs to every cycle.

## Files

- `runtime_foundation.md` — The minimal brief the orchestrator needs to generate cycles.
- `cycle_generation_rules.md` — Hard rules every cycle must satisfy.
- `event_types.md` — The reusable event ingredients (merchant pilot, catalog mess, etc).
- `state_schema.md` — Field-by-field schema with allowed qualitative values.
- `external_entities_day0.md` — Concrete external actors available for early cycles.
- `character_state_day0.md` — Day 0 emotional and influence baselines for the team.

## Mutability
All read-only. The runtime never writes back here. Persisted state lives in `data/current_state.json`, `data/timeline.json`, and `data/cycles/`.
