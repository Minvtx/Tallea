import Link from "next/link";
import { getPublicAgentStatus } from "@/lib/agent-status";
import { SectionCard, FieldRow } from "@/components/section-card";

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
  if (typeof ms !== "number") return "none";
  return `${(ms / 1000).toFixed(2)}s`;
}

const LOOP = [
  "Cron schedules one run",
  "Workflow executes durable steps",
  "Postgres stores world memory",
  "AI Gateway emits structured output",
  "Guardrails apply the delta",
  "Public world updates",
];

const PUBLIC_LINKS = [
  { href: "/", label: "Public site" },
  { href: "/pulse", label: "Pulse" },
  { href: "/timeline", label: "Timeline" },
  { href: "/daybook", label: "Daybook" },
  { href: "/api/agent/status", label: "Status API" },
];

export default async function AgentPage() {
  const status = await getPublicAgentStatus();
  const phaseLabel = status.world.phase?.replaceAll("_", " ") ?? "seed";
  const lastGen = status.last_generation;
  const latestCycle = status.latest_cycle;

  return (
    <div className="mx-auto max-w-6xl px-6 pt-12 pb-24">
      <header className="grid grid-cols-12 gap-6 pb-12 border-b hairline">
        <div className="col-span-12 lg:col-span-8">
          <p className="eyebrow mb-4">Workflow Agent</p>
          <h1 className="font-display text-[clamp(2.5rem,6vw,4rem)] tracking-[-0.022em] leading-[1.02] text-balance">
            Tallea is a persistent startup world run by an autonomous cycle.
          </h1>
          <p className="text-[15px] text-muted mt-6 leading-relaxed max-w-2xl text-pretty">
            Every cycle reads the current world, generates a structured event,
            applies deterministic guardrails, persists memory, and updates the
            public projection of a simulated Buenos Aires fit-intelligence
            company.
          </p>
        </div>
        <aside className="col-span-12 lg:col-span-4 lg:pl-8 lg:border-l hairline flex flex-col justify-end">
          <p className="eyebrow mb-3">Live status</p>
          <p className="font-display text-4xl tracking-[-0.016em] tabular">
            Day {String(status.world.day).padStart(3, "0")}
          </p>
          <p className="text-[13px] text-muted mt-3 leading-relaxed">
            Phase <span className="text-foreground/85">{phaseLabel}</span>.
            Updated {formatRelative(status.last_updated_at)}.
          </p>
        </aside>
      </header>

      <section className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
        <div className="bg-background p-6">
          <p className="eyebrow mb-3">Runner</p>
          <p className="text-[22px] font-display tracking-[-0.012em]">
            {status.runner}
          </p>
          <p className="text-[12px] text-muted mt-3 leading-relaxed">
            Workflow mode queues durable, observable runs. Direct mode runs
            locally in-process.
          </p>
        </div>
        <div className="bg-background p-6">
          <p className="eyebrow mb-3">Memory</p>
          <p className="text-[22px] font-display tracking-[-0.012em]">
            {status.store}
          </p>
          <p className="text-[12px] text-muted mt-3 leading-relaxed">
            Mutable world state is behind the WorldStore boundary.
          </p>
        </div>
        <div className="bg-background p-6">
          <p className="eyebrow mb-3">Model</p>
          <p className="text-[22px] font-display tracking-[-0.012em] break-words">
            {status.ai.provider}
          </p>
          <p className="text-[12px] text-muted mt-3 leading-relaxed break-words">
            {status.ai.mode} · {status.ai.model}
          </p>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard eyebrow="Autonomous loop" title="One cycle, durable by design">
          <ol className="space-y-3">
            {LOOP.map((step, index) => (
              <li key={step} className="flex items-baseline gap-3">
                <span className="eyebrow text-[10px] tabular">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-[13px] text-foreground/85 leading-relaxed">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard eyebrow="Why it is an agent" title="It carries memory forward">
          <p className="text-[13px] text-muted leading-relaxed">
            Tallea is not a one-shot generator. The agent reads prior state,
            changes the simulated company, records consequences, and uses that
            memory on the next scheduled run. Workflow supplies durable
            execution; Postgres supplies durable memory.
          </p>
          <div className="mt-6 space-y-1">
            <FieldRow label="Cycles">
              <span className="tabular">{status.counts.cycles}</span>
            </FieldRow>
            <FieldRow label="Timeline">
              <span className="tabular">{status.counts.timeline}</span>
            </FieldRow>
            <FieldRow label="Daybook">
              <span className="tabular">{status.counts.daybook}</span>
            </FieldRow>
            <FieldRow label="Last generation">
              <span>{lastGen?.actual_mode ?? "none"}</span>
            </FieldRow>
            <FieldRow label="Duration">
              <span className="tabular">
                {formatDuration(lastGen?.duration_ms)}
              </span>
            </FieldRow>
          </div>
        </SectionCard>
      </section>

      {latestCycle ? (
        <section className="mt-12 border-t hairline pt-12">
          <p className="eyebrow mb-4">Latest cycle</p>
          <h2 className="font-display text-3xl tracking-[-0.016em] leading-tight max-w-3xl text-pretty">
            {latestCycle.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5 mt-8">
            <div>
              <p className="eyebrow mb-2">Trigger</p>
              <p className="text-[14px] text-muted leading-relaxed">
                {latestCycle.trigger}
              </p>
            </div>
            <div>
              <p className="eyebrow mb-2">Outcome</p>
              <p className="text-[14px] text-muted leading-relaxed">
                {latestCycle.outcome}
              </p>
            </div>
          </div>
          <p className="text-[13px] text-muted leading-relaxed mt-6 max-w-3xl">
            <span className="eyebrow text-[10px] mr-2">Residue</span>
            {latestCycle.residue}
          </p>
        </section>
      ) : (
        <section className="mt-12 border-t hairline pt-12">
          <p className="eyebrow mb-4">Latest cycle</p>
          <h2 className="font-display text-3xl tracking-[-0.016em] leading-tight max-w-3xl">
            No generated cycle yet.
          </h2>
          <p className="text-[14px] text-muted leading-relaxed mt-4 max-w-2xl">
            The world is at a clean Day 0 seed. The first cron or admin run will
            create the first durable cycle.
          </p>
        </section>
      )}

      {lastGen?.fallback_reason ? (
        <section className="mt-8 border hairline rounded-md p-4">
          <p className="eyebrow mb-2">Last fallback</p>
          <code className="block text-[12px] text-foreground/85 break-words leading-relaxed">
            {lastGen.fallback_reason}
          </code>
        </section>
      ) : null}

      <section className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
        {PUBLIC_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-[13px] text-muted hover:text-foreground transition-colors"
          >
            {link.label} →
          </Link>
        ))}
      </section>
    </div>
  );
}
