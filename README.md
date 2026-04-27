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
  timeline.json        Append-only headline log (one entry per cycle)
  log.json             Append-only daybook log (many entries per cycle)

types/world.ts          Strongly typed world model + WorldStateDelta + WorldLogEntry
lib/loaders.ts          Reads + deep-merges state from cycles + seed
lib/state.ts            writeCycleOutput, applyAndPersistCycle, resetWorldState
lib/publisher.ts        deriveProjection — maps state to public site claims
lib/log.ts              deriveBaselineLogEntries / mergeCycleLogEntries — daybook
lib/orchestrator.ts     buildCycleContext, generateCycleOutput, runWorldCycle

app/                    /, /pulse, /timeline, /daybook, /admin, /api/cron/run-cycle
components/             Editorial UI primitives (status-badge, section-card, ...)
```

Cycles never mutate canon. Each cycle produces a `CycleOutput` containing a
`WorldStateDelta`; the runtime applies it deterministically through `applyDelta`.

---

## Pages

- `/` — public-facing facade for Tallea (hero, dispatch, proof points, claims).
- `/pulse` — internal-feel daily briefing for the current day.
- `/timeline` — one headline per cycle, reverse-chronological.
- `/daybook` — fuller daily record with internal/public/mixed visibility filter.
- `/admin` — operator console: run next cycle, run 3 cycles, reset to seed.
- `/api/cron/run-cycle` — Vercel Cron entry point; calls `runWorldCycle()`.

### Timeline vs daybook

- **Timeline** is the canonical highlight. One `TimelineEvent` per cycle —
  trigger, outcome, residue, what carries forward.
- **Daybook** is the granular log. Multiple `WorldLogEntry`s per cycle,
  each tagged `internal` / `public` / `mixed` and a `kind`
  (`decision`, `merchant_signal`, `press_signal`, `internal_shift`, …).
  Baseline entries are derived deterministically from the cycle output;
  the orchestrator (mock or AI) may attach extra `logEntries` to enrich it
  without a second LLM call.

---

## Modes

The orchestrator has two modes; selection is automatic at runtime.

### Mock mode (default)
- Deterministic event templates (merchant pilot, catalog mess, product claim,
  white-label inquiry, internal repair) chosen from current state signals.
- No API key required. Day 0 always plays the Veta merchant pilot from
  `data/seed/first_cycle_seed.md`.

### AI mode
- Enabled when **both** `TALLEA_ENABLE_AI=true` and `OPENAI_API_KEY` are set.
- Uses AI SDK 6 + the `@ai-sdk/openai` provider with structured output
  (`generateObject` + Zod schema for `CycleOutput`).
- The model only produces a structured `CycleOutput`; everything else
  (delta application, realism clamps, timeline append, daybook derivation,
  public site projection) stays deterministic in `lib/state.ts`,
  `lib/log.ts`, and `lib/publisher.ts`. The model never writes to disk.
- Default model: `gpt-4o-mini` — broadly available, structured-output capable,
  cheap. Override with `TALLEA_AI_MODEL` (e.g. `gpt-4o`, `gpt-5-mini` if your
  account has access).
- Any AI failure (timeout, schema reject, network) is logged and falls back
  to mock generation for that cycle — the simulation never stalls.

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | for AI mode | — | OpenAI API key (`sk-...`). Billed against your OpenAI account. |
| `TALLEA_ENABLE_AI` | for AI mode | — | Set to `"true"` to flip into AI mode. |
| `TALLEA_AI_MODEL` | optional | `gpt-4o-mini` | Any OpenAI-hosted model id available to the account. |
| `TALLEA_AI_TEMPERATURE` | optional | `0.7` | Float in `[0, 1]`. |
| `CRON_SECRET` | production | — | Bearer token Vercel Cron sends; the cron route rejects mismatches. |

Local development without any env vars runs in mock mode against the file
system (`data/cycles/`, `data/timeline.json`, `data/log.json`,
`data/current_state.json`).

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
2. Set `CRON_SECRET` (and optionally `OPENAI_API_KEY` + `TALLEA_ENABLE_AI`).
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
