import {
  getLastUpdatedAt,
  listCycleOutputFiles,
  loadCurrentWorldState,
  loadLatestCycleOutput,
  loadTimeline,
  loadWorldLog,
} from "@/lib/loaders";
import { getCycleModeStatus } from "@/lib/orchestrator";
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

export default async function AdminPage() {
  const world = await loadCurrentWorldState();
  const latestCycle = loadLatestCycleOutput();
  const cycleCount = listCycleOutputFiles().length;
  const timelineCount = loadTimeline().length;
  const logCount = loadWorldLog().length;
  const updatedLabel = formatRelative(getLastUpdatedAt());
  const modeStatus = getCycleModeStatus();
  const mode = modeStatus.mode;

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

      {/* Actions */}
      <section className="mt-12">
        <p className="eyebrow mb-4">Actions</p>
        <AdminActionsPanel />
        {mode === "mock" ? (
          <p className="text-[12px] text-muted mt-4 max-w-xl leading-relaxed">
            Running in <span className="text-foreground/85">mock mode</span>.
            Cycles are produced by deterministic event templates.{" "}
            {modeStatus.reason === "missing_enable_flag" ? (
              <>
                Set{" "}
                <code className="text-foreground/85">TALLEA_ENABLE_AI=true</code>{" "}
                and provide{" "}
                <code className="text-foreground/85">OPENAI_API_KEY</code>{" "}
                to switch to AI generation.
              </>
            ) : (
              <>
                <code className="text-foreground/85">OPENAI_API_KEY</code>{" "}
                is missing — add it in project settings to enable AI mode.
              </>
            )}
          </p>
        ) : (
          <p className="text-[12px] text-muted mt-4 max-w-xl leading-relaxed">
            Running in <span className="text-accent">AI mode</span>. Cycles are
            generated via the OpenAI API using model{" "}
            <code className="text-foreground/85">{modeStatus.model}</code>{" "}
            (temperature{" "}
            <span className="tabular">{modeStatus.temperature}</span>). The
            deterministic publisher still owns timeline, daybook, and the
            public site projection.
          </p>
        )}
      </section>

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
