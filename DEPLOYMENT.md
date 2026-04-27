# Deployment

This is the concise production checklist for Tallea on Vercel.

## Vercel Project

1. Create or import the project in Vercel.
2. Use the default Next.js settings.
3. Confirm `vercel.json` includes the daily cron for `/api/cron/run-cycle`.

## Neon/Postgres

1. Install Neon Postgres from the Vercel Marketplace.
2. Connect it to the Tallea project.
3. Confirm Vercel exposes `DATABASE_URL`; `POSTGRES_URL` also works.
4. Set `TALLEA_WORLD_STORE=postgres`.

No manual migration is needed. `PostgresWorldStore` creates JSONB tables lazily.

## Recommended Production Env

```bash
TALLEA_WORLD_STORE=postgres
TALLEA_CYCLE_RUNNER=workflow
TALLEA_ENABLE_AI=true
TALLEA_AI_PROVIDER=gateway
AI_GATEWAY_API_KEY=...
TALLEA_AI_MODEL=openai/gpt-4o-mini
TALLEA_AI_TEMPERATURE=0.7
CRON_SECRET=...
ADMIN_SECRET=...
```

Keep `OPENAI_API_KEY` only if you want the direct OpenAI fallback path available
with `TALLEA_AI_PROVIDER=openai`.

## First Deploy Checklist

1. Deploy to Vercel.
2. Open `/admin?admin_secret=...` once to set the admin cookie.
3. Confirm the admin health panel shows:
   - store `postgres`
   - runner `workflow`
   - AI mode `ai`
   - provider `gateway`
4. Trigger one cycle from `/admin`, or call the cron route manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://YOUR_PROJECT.vercel.app/api/cron/run-cycle
```

Workflow mode returns after the run is queued/started, so refresh `/admin` after
the Workflow completes.

## Verify Workflow Observability

In Vercel, open Observability / Workflow runs. Confirm the run has steps for:

1. loading world state and context
2. generating the structured cycle output
3. persisting and applying the cycle

Use this view for run ids, retries, timing, and step logs.

## Verify Postgres Memory

After a completed cycle, check either `/admin` or Neon:

- `/admin` should show world day greater than 0 and updated counts.
- Neon should contain rows in `world_state`, `cycle_outputs`,
  `timeline_events`, `world_log_entries`, and `generation_metadata`.

## Debug `fallback_to_mock`

If the last generation shows `fallback_to_mock`:

1. Read the fallback reason in `/admin`.
2. Confirm `TALLEA_ENABLE_AI=true`.
3. Confirm `TALLEA_AI_PROVIDER=gateway` and `AI_GATEWAY_API_KEY` are set.
4. Confirm `TALLEA_AI_MODEL` is a Gateway model id, usually provider-prefixed
   like `openai/gpt-4o-mini`.
5. Inspect the Workflow step logs for the generation step.

The fallback is intentional: one failed AI call should not stall the world.

## Reset Local State Safely

Local mutable runtime files live under:

- `data/current_state.json`
- `data/timeline.json`
- `data/log.json`
- `data/generation_log.json`
- `data/cycles/*.json`

Canon, runtime, and seed files should not be reset. Use `/admin` Reset to seed,
or remove only the mutable runtime files above. Then run:

```bash
npm run check:data
```

An empty Day 0 local state is valid.
