# Tallea

A persistent simulated startup world. Tallea is a Buenos Aires fit-intelligence
company for online apparel commerce; this repo runs it as a living organism —
state evolves day by day through scheduled cycles, while a polished public site
shows the company as it appears at any moment in time.

---

## Architecture

```
data/
  canon/        Stable lore (read-only at runtime)
  runtime/      Schemas + rules the orchestrator consumes each cycle
  seed/         Day-0 snapshot (initial_state.json + first_cycle_seed.md)
  cycles/       Generated cycle outputs (cycle_NNN_output.json)
  current_state.json   Latest applied world state (regenerated)
  timeline.json        Append-only event log

types/world.ts          Strongly typed world model + WorldStateDelta
lib/loaders.ts          Reads + deep-merges state from cycles + seed
lib/state.ts            writeCycleOutput, applyAndPersistCycle, resetWorldState
lib/publisher.ts        deriveProjection — maps state to public site claims
lib/orchestrator.ts     buildCycleContext, generateCycleOutput, runWorldCycle

app/                    /, /pulse, /timeline, /admin, /api/cron/run-cycle
components/             Editorial UI primitives (status-badge, section-card, ...)
```

Cycles never mutate canon. Each cycle produces a `CycleOutput` containing a
`WorldStateDelta`; the runtime applies it deterministically through `applyDelta`.

---

## Pages

- `/` — public-facing facade for Tallea (hero, dispatch, proof points, claims).
- `/pulse` — internal-feel daily briefing for the current day.
- `/timeline` — archival view of every cycle event in order.
- `/admin` — operator console: run next cycle, run 3 cycles, reset to seed.
- `/api/cron/run-cycle` — Vercel Cron entry point; calls `runWorldCycle()`.

---

## Modes

The orchestrator has two modes; selection is automatic at runtime.

### Mock mode (default)
- Deterministic event templates (merchant pilot, catalog mess, product claim,
  white-label inquiry, internal repair) chosen from current state signals.
- No API key required. Day 0 always plays the Veta merchant pilot from
  `data/seed/first_cycle_seed.md`.

### AI mode
- Enabled when **both** `TALLEA_ENABLE_AI=true` and `AI_GATEWAY_API_KEY` are set.
- Uses AI SDK 6 + Vercel AI Gateway with structured output (`generateObject` +
  Zod schema for `CycleOutput`).
- Default model: `openai/gpt-5-mini` (zero-config through the gateway).

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `AI_GATEWAY_API_KEY` | for AI mode | Vercel AI Gateway key |
| `TALLEA_ENABLE_AI` | for AI mode | Set to `"true"` to flip mode |
| `CRON_SECRET` | production | Bearer token Vercel Cron sends; the cron route rejects mismatches |

Local development without any env vars runs in mock mode against the file
system (`data/cycles/`, `data/timeline.json`, `data/current_state.json`).

---

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

Open `/admin` and click **Run next cycle** to advance day 0 → day 1, etc.
Click **Reset to seed** at any point to restore the initial state.

---

## Deploying with cron

1. Push this repo to Vercel.
2. Set `CRON_SECRET` (and optionally `AI_GATEWAY_API_KEY` + `TALLEA_ENABLE_AI`).
3. The schedule in `vercel.json` runs `/api/cron/run-cycle` daily at 14:00 UTC.

To change the schedule, edit `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/run-cycle", "schedule": "0 14 * * *" }]
}
```

Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically; the
route returns `401` for any other request.

---

## Core runtime rule

Cycles must change something. No atmospheric filler. Every cycle should shift
pressure, alter relationships, or create residue that future cycles inherit.
