import {
  getLastUpdatedAt,
  listCycleOutputFiles,
  loadCurrentWorldState,
  loadLatestCycleOutput,
  loadLatestGeneration,
  loadTimeline,
  loadWorldLog,
} from "@/lib/loaders";
import { getCycleModeStatus } from "@/lib/orchestrator";
import { getCycleRunnerKind } from "@/lib/cycle-runner";
import { guardAdminPage } from "@/lib/admin-auth";
import { getWorldStoreKind } from "@/lib/agent-status";
import { AdminActionsPanel } from "@/components/admin-actions-panel";
import { SectionCard, FieldRow } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "never";
  const diffSec = Math.round((Date.now() - ts) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

function formatDuration(ms: number | undefined): string {
  if (typeof ms !== "number") return "never";
  return `${(ms / 1000).toFixed(2)}s`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ admin_secret?: string }>;
}) {
  const params = await searchParams;
  const adminAccess = await guardAdminPage(params);
  const [
    world,
    latestCycle,
    cycleFiles,
    timeline,
    worldLog,
    lastUpdatedAt,
    lastGen,
  ] = await Promise.all([
    loadCurrentWorldState(),
    loadLatestCycleOutput(),
    listCycleOutputFiles(),
    loadTimeline(),
    loadWorldLog(),
    getLastUpdatedAt(),
    loadLatestGeneration(),
  ]);
  const cycleCount = cycleFiles.length;
  const timelineCount = timeline.length;
  const logCount = worldLog.length;
  const updatedLabel = formatRelative(lastUpdatedAt);
  const modeStatus = getCycleModeStatus();
  const mode = modeStatus.mode;
  const runner = getCycleRunnerKind();
  const storeKind = getWorldStoreKind();
  const lastGenerationMode = lastGen?.actual_mode ?? "none";
  const lastGenerationProvider = lastGen?.provider ?? "mock";
  const lastGenerationDuration = formatDuration(lastGen?.duration_ms);
  const workflowIsAsync = runner === "workflow";

  return (
    <div className="mx-auto max-w-5xl px-6 pt-12 pb-24">
      {/* Header */}
      <header className="pb-12 border-b hairline">
        <p className="eyebrow mb-4">Admin</p>
        <h1 className="font-display text-[clamp(2rem,5vw,3rem)] tracking-[-0.02em] leading-[1.05]">
          Tallea world controls
        </h1>
        <p className="text-[14px] text-muted mt-3 leading-relaxed max-w-xl">
          Run the orchestrator, advance time, or reset the simulation to its Day
          0 seed. Canon, runtime, and seed files are never modified.
        </p>
      </header>

      {adminAccess.unprotectedWarning ? (
        <section className="mt-6 border hairline rounded-md p-4">
          <p className="eyebrow mb-2">Admin security</p>
          <p className="text-[12px] text-muted leading-relaxed max-w-2xl">
            <code className="text-foreground/85">ADMIN_SECRET</code> is not set.
            This admin surface is unprotected. Set it in production, then open
            <code className="text-foreground/85 ml-1">/admin?admin_secret=...</code>{" "}
            once to set the admin cookie.
          </p>
        </section>
      ) : null}

      {/* Status strip */}
      <section className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] tabular eyebrow">
        <span className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              mode === "ai" ? "bg-accent" : "bg-foreground/55"
            }`}
            aria-hidden
          />
          MODE {mode}
        </span>
        <span>·</span>
        <span>DAY {String(world?.world.day ?? 0).padStart(3, "0")}</span>
        <span>·</span>
        <span>CYCLES {String(cycleCount).padStart(2, "0")}</span>
        <span>·</span>
        <span>TIMELINE {String(timelineCount).padStart(2, "0")}</span>
        <span>·</span>
        <span>DAYBOOK {String(logCount).padStart(3, "0")}</span>
        <span>·</span>
        <span>UPDATED {updatedLabel.toUpperCase()}</span>
      </section>

      {/* Agent health */}
      <section className="mt-10">
        <p className="eyebrow mb-4">Agent health</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1 border-y hairline py-4">
          <FieldRow label="World day">
            <span className="tabular">
              {String(world?.world.day ?? 0).padStart(3, "0")}
            </span>
          </FieldRow>
          <FieldRow label="Cycles">
            <span className="tabular">{cycleCount}</span>
          </FieldRow>
          <FieldRow label="Timeline">
            <span className="tabular">{timelineCount}</span>
          </FieldRow>
          <FieldRow label="Daybook">
            <span className="tabular">{logCount}</span>
          </FieldRow>
          <FieldRow label="Store">
            <span>{storeKind}</span>
          </FieldRow>
          <FieldRow label="Runner">
            <span>{runner}</span>
          </FieldRow>
          <FieldRow label="AI mode">
            <span>{mode}</span>
          </FieldRow>
          <FieldRow label="AI provider">
            <span>{modeStatus.provider}</span>
          </FieldRow>
          <FieldRow label="Model">
            <code>{modeStatus.model}</code>
          </FieldRow>
          <FieldRow label="Last mode">
            <span>{lastGenerationMode}</span>
          </FieldRow>
          <FieldRow label="Last provider">
            <span>{lastGenerationProvider}</span>
          </FieldRow>
          <FieldRow label="Last duration">
            <span className="tabular">{lastGenerationDuration}</span>
          </FieldRow>
          <FieldRow label="Last updated">
            <span>{updatedLabel}</span>
          </FieldRow>
        </div>
        {lastGen?.fallback_reason ? (
          <p className="text-[12px] text-muted mt-3 leading-relaxed max-w-3xl">
            <span className="eyebrow text-[10px] mr-2">Last fallback</span>
            <code className="text-foreground/85 break-words">
              {lastGen.fallback_reason}
            </code>
          </p>
        ) : null}
      </section>

      <section className="mt-10 border hairline rounded-md p-5">
        <p className="eyebrow mb-3">Agent stack</p>
        <p className="text-[13px] text-muted leading-relaxed max-w-3xl">
          Cron schedules one agent run. Workflow makes that run durable,
          retryable, and observable. Postgres stores long-term world memory.
          AI Gateway generates a structured cycle output. Deterministic code
          applies guardrails, updates the timeline and daybook, and publishes
          the current world projection.
        </p>
      </section>

      {/* Actions */}
      <section className="mt-12">
        <p className="eyebrow mb-4">Actions</p>
        <AdminActionsPanel />
        {workflowIsAsync ? (
          <p className="text-[12px] text-muted mt-4 max-w-xl leading-relaxed">
            Workflow runner is enabled. Admin actions start a durable workflow
            run and return before the cycle necessarily finishes; refresh after
            completion to see the updated state.
          </p>
        ) : null}
        {mode === "mock" ? (
          <p className="text-[12px] text-muted mt-4 max-w-xl leading-relaxed">
            Running in <span className="text-foreground/85">mock mode</span>.
            Cycles are produced by deterministic event templates.{" "}
            {modeStatus.reason === "missing_enable_flag" ? (
              <>
                Set{" "}
                <code className="text-foreground/85">TALLEA_ENABLE_AI=true</code>{" "}
                and provide <code className="text-foreground/85">AI_GATEWAY_API_KEY</code>{" "}
                or <code className="text-foreground/85">OPENAI_API_KEY</code>{" "}
                to switch to AI generation.
              </>
            ) : (
              <>
                AI credentials are missing — add{" "}
                <code className="text-foreground/85">AI_GATEWAY_API_KEY</code>{" "}
                for Gateway or{" "}
                <code className="text-foreground/85">OPENAI_API_KEY</code>{" "}
                for direct OpenAI.
              </>
            )}
          </p>
        ) : (
          <p className="text-[12px] text-muted mt-4 max-w-xl leading-relaxed">
            Running in <span className="text-accent">AI mode</span>. Cycles are
            generated via{" "}
            <span className="text-foreground/85">{modeStatus.provider}</span>{" "}
            using model{" "}
            <code className="text-foreground/85">{modeStatus.model}</code>{" "}
            (temperature{" "}
            <span className="tabular">{modeStatus.temperature}</span>). The
            deterministic publisher still owns timeline, daybook, and the
            public site projection.
          </p>
        )}
      </section>

      {/* Last generation: what actually ran on the most recent cycle */}
      {lastGen ? (
        <section className="mt-8 border hairline rounded-md p-4">
          <p className="eyebrow mb-3">Last generation</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] tabular eyebrow">
            <span className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  lastGen.actual_mode === "ai"
                    ? "bg-accent"
                    : lastGen.actual_mode === "fallback_to_mock"
                      ? "bg-foreground"
                      : "bg-foreground/55"
                }`}
                aria-hidden
              />
              {lastGen.actual_mode === "fallback_to_mock"
                ? "FALLBACK TO MOCK"
                : lastGen.actual_mode.toUpperCase()}
            </span>
            <span>·</span>
            <span>{lastGen.cycle_id.toUpperCase()}</span>
            <span>·</span>
            <span>DAY {String(lastGen.day).padStart(3, "0")}</span>
            {lastGen.model ? (
              <>
                <span>·</span>
                <span>MODEL {lastGen.model}</span>
              </>
            ) : null}
            {lastGen.provider ? (
              <>
                <span>·</span>
                <span>PROVIDER {lastGen.provider.toUpperCase()}</span>
              </>
            ) : null}
            {typeof lastGen.temperature === "number" ? (
              <>
                <span>·</span>
                <span>TEMP {lastGen.temperature}</span>
              </>
            ) : null}
            <span>·</span>
            <span>{(lastGen.duration_ms / 1000).toFixed(2)}S</span>
            <span>·</span>
            <span>{formatRelative(lastGen.generated_at).toUpperCase()}</span>
          </div>
          <p className="text-[12px] text-muted mt-3 leading-relaxed">
            <span className="eyebrow text-[10px] mr-2">Title</span>
            {lastGen.title}
          </p>
          {lastGen.actual_mode === "fallback_to_mock" &&
          lastGen.fallback_reason ? (
            <p className="text-[12px] text-muted mt-3 leading-relaxed max-w-2xl">
              <span className="eyebrow text-[10px] mr-2">Fallback reason</span>
              <code className="text-foreground/85 break-words">
                {lastGen.fallback_reason}
              </code>
            </p>
          ) : null}
          {lastGen.actual_mode === "mock" && mode === "ai" ? (
            <p className="text-[12px] text-muted mt-3 leading-relaxed max-w-2xl">
              Note: the env now says AI mode, but the most recent cycle ran
              under mock mode (likely before the flag was flipped). Run a new
              cycle to get an AI-generated one.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Current position */}
      {world ? (
        <section className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
          <SectionCard eyebrow="Position" title="Where Tallea is now">
            <div className="space-y-1">
              <FieldRow label="Day">
                <span className="tabular">
                  {String(world.world.day).padStart(3, "0")}
                </span>
              </FieldRow>
              <FieldRow label="Phase">
                <span>{world.world.phase.replaceAll("_", " ")}</span>
              </FieldRow>
              <FieldRow label="Strategic identity">
                <StatusBadge value={world.company_state.strategic_identity} />
              </FieldRow>
              <FieldRow label="Runway">
                <StatusBadge value={world.company_state.runway_pressure} inverse />
              </FieldRow>
              <FieldRow label="Public legitimacy">
                <StatusBadge value={world.company_state.public_legitimacy} />
              </FieldRow>
              <FieldRow label="Internal alignment">
                <StatusBadge value={world.company_state.internal_alignment} />
              </FieldRow>
              <FieldRow label="Pilot conversations">
                <span className="tabular">
                  {world.traction_state.merchant_pipeline.active_pilot_conversations}
                </span>
              </FieldRow>
              <FieldRow label="Cycles persisted">
                <span className="tabular">{cycleCount}</span>
              </FieldRow>
              <FieldRow label="Timeline entries">
                <span className="tabular">{timelineCount}</span>
              </FieldRow>
            </div>
          </SectionCard>

          {latestCycle ? (
            <SectionCard
              eyebrow={`Day ${String(latestCycle.day).padStart(3, "0")} · ${latestCycle.cycle_id}`}
              title={latestCycle.title}
            >
              <p className="text-[13px] text-foreground/85 leading-relaxed">
                <span className="eyebrow text-[10px] mr-2">Decision</span>
                {latestCycle.decision_made}
              </p>
              <p className="text-[13px] text-muted leading-relaxed mt-4">
                <span className="eyebrow text-[10px] mr-2">Outcome</span>
                {latestCycle.outcome}
              </p>
              <p className="text-[13px] text-muted leading-relaxed mt-4">
                <span className="eyebrow text-[10px] mr-2">Residue</span>
                {latestCycle.residue}
              </p>
            </SectionCard>
          ) : (
            <SectionCard eyebrow="Latest cycle" title="Fresh world, ready to run">
              <p className="text-[13px] text-muted leading-relaxed">
                No cycles yet. Click{" "}
                <span className="text-foreground/85">Run next cycle</span> to
                produce Day 1 from the Veta merchant pilot seed.
              </p>
            </SectionCard>
          )}
        </section>
      ) : (
        <section className="mt-16">
          <SectionCard eyebrow="State" title="No state on disk">
            <p className="text-[13px] text-muted leading-relaxed">
              Reset cleared every persisted file. The next cycle will load from
              the Day 0 seed.
            </p>
          </SectionCard>
        </section>
      )}
    </div>
  );
}
