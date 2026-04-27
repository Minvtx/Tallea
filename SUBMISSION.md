# Tallea

Track: Workflow Agent

## Pitch

Tallea is a persistent simulated startup world: a Buenos Aires fit-intelligence
company that changes day by day. An autonomous agent wakes up on a schedule,
reads the current world state, generates one structured cycle, applies
deterministic guardrails, persists memory, and updates the public-facing world.

## Architecture

- Next.js App Router renders the public site, pulse, timeline, daybook, admin,
  and public agent explainer.
- Vercel Cron triggers one agent cycle per schedule.
- Vercel Workflow runs the cycle as durable, observable, retryable steps.
- AI SDK structured output produces a typed `CycleOutput`.
- Vercel AI Gateway is the preferred model provider, with direct OpenAI as a
  fallback path.
- `WorldStore` abstracts mutable memory.
- Neon/Postgres stores production memory; local development uses JSON files.
- Deterministic TypeScript code applies deltas, clamps unrealistic jumps,
  derives timeline/daybook entries, and publishes the world projection.

## Vercel Resources Used

- Next.js
- Vercel Cron
- Vercel Workflow
- AI SDK
- AI Gateway
- Neon/Postgres via Vercel Marketplace

## What Makes It An Agent

Tallea is not a one-shot content generator. It has durable memory, scheduled
autonomy, structured decision output, deterministic state transition logic, and
observable workflow execution. Each run changes the world state that the next
run reads, so the simulation carries consequences forward over time.

## Demo

1. Open `/agent` for the public explanation and live status.
2. Open `/` to see the current public projection of Tallea.
3. Open `/pulse` for the internal state snapshot.
4. Open `/timeline` for one headline per generated cycle.
5. Open `/daybook` for the fuller world log.
6. If authorized, open `/admin?admin_secret=...` to inspect operator health or
   start a cycle.
7. In Vercel, inspect Workflow Observability after a cron/admin-triggered run.

Production environment setup is documented in `DEPLOYMENT.md`.
