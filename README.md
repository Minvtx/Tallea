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
  timeline.json        Upserted headline log (one entry per cycle)
  log.json             Upserted daybook log (many entries per cycle)
  generation_log.json  Upserted generation metadata (mode, model, duration)

types/world.ts          Strongly typed world model + WorldStateDelta + WorldLogEntry
lib/loaders.ts          Compatibility loaders + filesystem markdown reads
lib/world-store.ts      WorldStore interface + file/Postgres implementations
lib/delta.ts            applyDelta — deterministic WorldStateDelta merge
lib/state.ts            writeCycleOutput, applyAndPersistCycle, resetWorldState
lib/publisher.ts        deriveProjection — maps state to public site claims
lib/log.ts              deriveBaselineLogEntries / mergeCycleLogEntries — daybook
lib/orchestrator.ts     buildCycleContext, generateCycleOutput, runWorldCycle
lib/cycle-runner.ts     direct vs Workflow runner selection
app/workflows/          durable Vercel Workflow definitions

app/                    /, /pulse, /timeline, /daybook, /admin, /api/cron/run-cycle
components/             Editorial UI primitives (status-badge, section-card, ...)
```

Cycles never mutate canon. Each cycle produces a `CycleOutput` containing a
`WorldStateDelta`; the runtime applies it deterministically through `applyDelta`.
Mutable runtime storage sits behind `WorldStore`; canon/runtime/seed markdown
continues to load directly from the filesystem. Local development defaults to
JSON files, while production can opt into durable Postgres storage.

---

## Pages

- `/` — public-facing facade for Tallea (hero, dispatch, proof points, claims).
- `/pulse` — internal-feel daily briefing for the current day.
- `/timeline` — one headline per cycle, reverse-chronological.
- `/daybook` — fuller daily record with internal/public/mixed visibility filter.
- `/admin` — operator console: run next cycle, run 3 cycles, reset to seed.
- `/api/cron/run-cycle` — Vercel Cron entry point; dispatches the configured cycle runner.

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
- Enabled only when `TALLEA_ENABLE_AI=true`.
- Uses AI SDK 6 structured output (`generateObject` + Zod schema for
  `CycleOutput`).
- Provider selection is controlled by `TALLEA_AI_PROVIDER=gateway|openai`.
  If unset, Tallea prefers AI Gateway when `AI_GATEWAY_API_KEY` exists;
  otherwise it uses the direct OpenAI provider.
- Vercel AI Gateway is preferred in production because it gives unified access
  to many providers and models, plus Vercel-side observability, usage and
  budget monitoring, routing, and failover.
- Direct OpenAI remains available with `TALLEA_AI_PROVIDER=openai` and
  `OPENAI_API_KEY`.
- The model only produces a structured `CycleOutput`; everything else
  (delta application, realism clamps, timeline upsert, daybook derivation,
  public site projection) stays deterministic in `lib/state.ts`,
  `lib/log.ts`, and `lib/publisher.ts`. The model never writes to disk.
- Default Gateway model: `openai/gpt-4o-mini`.
- Default direct OpenAI model: `gpt-4o-mini`.
- Override with `TALLEA_AI_MODEL`. Gateway model ids usually include a provider
  prefix, such as `openai/gpt-5.4` or `anthropic/claude-sonnet-4.6`.
- Any AI failure (timeout, schema reject, network) is logged and falls back
  to mock generation for that cycle — the simulation never stalls.

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `TALLEA_ENABLE_AI` | for AI mode | — | Set to `"true"` to flip into AI mode. |
| `TALLEA_AI_PROVIDER` | optional | Gateway if `AI_GATEWAY_API_KEY` exists, else OpenAI | Set to `gateway` or `openai`. |
| `AI_GATEWAY_API_KEY` | Gateway AI mode | — | Vercel AI Gateway key. Preferred for production. |
| `OPENAI_API_KEY` | direct OpenAI AI mode | — | OpenAI API key (`sk-...`) for `TALLEA_AI_PROVIDER=openai`. |
| `TALLEA_AI_MODEL` | optional | `openai/gpt-4o-mini` for Gateway, `gpt-4o-mini` for OpenAI | Model id. Gateway ids usually include provider prefix. |
| `TALLEA_AI_TEMPERATURE` | optional | `0.7` | Float in `[0, 1]`. |
| `TALLEA_WORLD_STORE` | optional | `file` | Set to `postgres` to use durable Postgres storage. |
| `TALLEA_CYCLE_RUNNER` | optional | `direct` | Set to `workflow` on Vercel to start one durable Workflow run per trigger. |
| `DATABASE_URL` | Postgres store | — | Preferred Postgres connection string, provided by Neon/Vercel integrations. |
| `POSTGRES_URL` | Postgres store fallback | — | Used if `DATABASE_URL` is not set. |
| `CRON_SECRET` | production | — | Bearer token Vercel Cron sends; the cron route rejects mismatches. |

Local development without any env vars runs in mock mode against the file
system (`data/cycles/`, `data/timeline.json`, `data/log.json`,
`data/generation_log.json`, `data/current_state.json`).

### Durable storage with Neon Postgres

For production, install a standard Postgres integration from the Vercel
Marketplace. Neon is the preferred path for this project.

1. In Vercel, add the Neon Postgres integration from Marketplace.
2. Confirm the integration exposes `DATABASE_URL`; `POSTGRES_URL` also works
   as a fallback.
3. Set `TALLEA_WORLD_STORE=postgres`.
4. Keep the existing runtime env vars as needed: `CRON_SECRET`,
   `TALLEA_ENABLE_AI`, `TALLEA_AI_PROVIDER`, `AI_GATEWAY_API_KEY`,
   `OPENAI_API_KEY`, `TALLEA_AI_MODEL`, and `TALLEA_AI_TEMPERATURE`.

No manual migration is required. `PostgresWorldStore` lazily creates the
required JSONB tables on first read or write:
`world_state`, `cycle_outputs`, `timeline_events`, `world_log_entries`, and
`generation_metadata`.

### Durable cycles with Vercel Workflow

The app includes the Workflow DevKit packages (`workflow` and `@workflow/next`)
and wraps `next.config.ts` with `withWorkflow`.

Local/default execution remains direct:

```bash
TALLEA_CYCLE_RUNNER=direct
```

For Vercel production, use:

```bash
TALLEA_CYCLE_RUNNER=workflow
TALLEA_WORLD_STORE=postgres
```

The production flow is:

1. Vercel Cron calls `/api/cron/run-cycle`.
2. The cron route authorizes with `CRON_SECRET`.
3. `lib/cycle-runner.ts` starts `runWorldCycleWorkflow()`.
4. Workflow runs one cycle through durable steps:
   load state/context → generate `CycleOutput` → persist/apply state.
5. `PostgresWorldStore` keeps mutable world memory durable across deploys.

This intentionally starts exactly one workflow run per cron invocation; there is
no infinite loop workflow. Inspect workflow runs in the Vercel dashboard under
Observability / Workflow runs for run IDs, step logs, retries, and timing.

---

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

Use `.env.example` as the starting point for `.env.local`. For production setup,
see `DEPLOYMENT.md`.

Open `/admin` and click **Run next cycle** to advance day 0 → day 1, etc.
Click **Reset to seed** at any point to restore the initial state.

---

## Deploying with cron

1. Push this repo to Vercel.
2. Install Neon from the Vercel Marketplace.
3. Set the production env vars:
   - `TALLEA_WORLD_STORE=postgres`
   - `TALLEA_CYCLE_RUNNER=workflow`
   - `TALLEA_ENABLE_AI=true`
   - `TALLEA_AI_PROVIDER=gateway`
   - `AI_GATEWAY_API_KEY`
   - `TALLEA_AI_MODEL`
   - `CRON_SECRET`
   - `ADMIN_SECRET`
4. Confirm Neon provides `DATABASE_URL` or `POSTGRES_URL`.
5. Open `/admin?admin_secret=...` once, verify the agent health panel, then use
   `/admin` normally with the cookie.
6. Smoke-test the cron endpoint with `Authorization: Bearer ${CRON_SECRET}`.
7. After the first cron-triggered run, inspect Vercel Observability / Workflow
   runs for the run id, step logs, retries, and timing.
8. The schedule in `vercel.json` runs `/api/cron/run-cycle` daily at 14:00 UTC.

To change the schedule, edit `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/run-cycle", "schedule": "0 14 * * *" }]
}
```

Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically; the
route returns `401` for any other request. In production, a missing
`CRON_SECRET` returns `500` so the deployment is visibly misconfigured instead
of leaving the cron endpoint open.

---

## Core runtime rule

Cycles must change something. No atmospheric filler. Every cycle should shift
pressure, alter relationships, or create residue that future cycles inherit.
