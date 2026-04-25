import Link from "next/link";
import {
  getLastUpdatedAt,
  listCycleOutputFiles,
  loadCurrentWorldState,
  loadLatestCycleOutput,
} from "@/lib/loaders";
import { StatusBadge } from "@/components/status-badge";
import { SectionCard, FieldRow } from "@/components/section-card";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  const diffSec = Math.round((Date.now() - ts) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export default async function PulsePage() {
  const world = await loadCurrentWorldState();
  const latestCycle = loadLatestCycleOutput();
  const cycleCount = listCycleOutputFiles().length;
  const updatedLabel = formatRelative(getLastUpdatedAt());

  if (!world) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24">
        <p className="eyebrow mb-8">Pulse</p>
        <EmptyState
          title="No world state yet"
          description="Visit /admin and run the first cycle to bring the simulation to life."
        />
      </div>
    );
  }

  const dayLabel = `Day ${String(world.world.day).padStart(3, "0")}`;
  const characters = Object.entries(world.character_states);

  return (
    <div className="mx-auto max-w-6xl px-6 pt-12 pb-24">
      {/* Masthead */}
      <header className="grid grid-cols-12 gap-6 pb-12 border-b hairline">
        <div className="col-span-12 md:col-span-8">
          <p className="eyebrow mb-4">Tallea pulse</p>
          <h1 className="font-display text-[clamp(2.5rem,6vw,4rem)] tracking-[-0.022em] leading-[1.02] tabular">
            {dayLabel}
          </h1>
          <p className="text-[15px] text-muted mt-4 leading-relaxed max-w-xl text-pretty">
            {world.world.core_question}
          </p>
        </div>
        <div className="col-span-12 md:col-span-4 md:pl-8 md:border-l hairline flex flex-col justify-end gap-1">
          <p className="text-[13px] text-muted">
            <span className="eyebrow">Phase</span>{" "}
            <span className="text-foreground/85 ml-2">
              {world.world.phase.replaceAll("_", " ")}
            </span>
          </p>
          <p className="text-[13px] text-muted">
            <span className="eyebrow">Cycles</span>{" "}
            <span className="tabular text-foreground/85 ml-2">
              {String(cycleCount).padStart(2, "0")}
            </span>
          </p>
          {updatedLabel ? (
            <p className="text-[12px] text-muted mt-2">
              Updated {updatedLabel}
              <Link
                href="/admin"
                className="ml-3 hover:text-foreground transition-colors"
              >
                Advance →
              </Link>
            </p>
          ) : null}
        </div>
      </header>

      {/* Latest cycle lede */}
      {latestCycle ? (
        <section className="mt-12 pb-12 border-b hairline">
          <p className="eyebrow mb-4">Latest cycle</p>
          <h2 className="font-display text-3xl tracking-[-0.016em] leading-tight max-w-3xl text-pretty">
            {latestCycle.title}
          </h2>
          <p className="text-[15px] text-foreground/75 mt-4 leading-relaxed max-w-3xl">
            <span className="eyebrow text-[10px] mr-2">Trigger</span>
            {latestCycle.trigger}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 mt-8 max-w-4xl">
            <div>
              <p className="eyebrow mb-2">Outcome</p>
              <p className="text-[14px] text-foreground/85 leading-relaxed">
                {latestCycle.outcome}
              </p>
            </div>
            <div>
              <p className="eyebrow mb-2">Residue</p>
              <p className="text-[14px] text-foreground/85 leading-relaxed">
                {latestCycle.residue}
              </p>
            </div>
          </div>
          {latestCycle.next_hooks.length > 0 ? (
            <div className="mt-8">
              <p className="eyebrow mb-3">What may come next</p>
              <ul className="space-y-2">
                {latestCycle.next_hooks.map((hook, i) => (
                  <li
                    key={i}
                    className="flex items-baseline gap-3 text-[13px] text-muted"
                  >
                    <span className="tabular text-[11px]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{hook}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Signals grid */}
      <section className="mt-12">
        <p className="eyebrow mb-6">Signals</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
          <div className="bg-background p-6">
            <p className="eyebrow mb-3">Company</p>
            <div className="space-y-1">
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
            </div>
          </div>

          <div className="bg-background p-6">
            <p className="eyebrow mb-3">Product</p>
            <div className="space-y-1">
              <FieldRow label="Health">
                <StatusBadge value={world.product_state.health} />
              </FieldRow>
              <FieldRow label="Cleanup burden">
                <StatusBadge value={world.product_state.manual_cleanup_burden} inverse />
              </FieldRow>
              <FieldRow label="Reliable categories">
                <span className="tabular">
                  {world.product_state.reliable_capabilities.length}
                </span>
              </FieldRow>
              <FieldRow label="Inconsistent">
                <span className="tabular">
                  {world.product_state.inconsistent_capabilities.length}
                </span>
              </FieldRow>
            </div>
          </div>

          <div className="bg-background p-6">
            <p className="eyebrow mb-3">Traction</p>
            <div className="space-y-1">
              <FieldRow label="Pipeline">
                <StatusBadge value={world.traction_state.merchant_pipeline.status} />
              </FieldRow>
              <FieldRow label="Pilot conversations">
                <span className="tabular">
                  {world.traction_state.merchant_pipeline.active_pilot_conversations}
                </span>
              </FieldRow>
              <FieldRow label="User beta">
                <StatusBadge value={world.traction_state.user_beta.status} />
              </FieldRow>
              <FieldRow label="White-label inquiry">
                <StatusBadge
                  value={
                    world.traction_state.merchant_pipeline.white_label_inquiry
                      ? "active"
                      : "none"
                  }
                />
              </FieldRow>
            </div>
          </div>

          <div className="bg-background p-6">
            <p className="eyebrow mb-3">Public layer</p>
            <div className="space-y-1">
              <FieldRow label="Positioning">
                <span className="text-right max-w-[18ch]">
                  {world.public_layer.website_positioning}
                </span>
              </FieldRow>
              <FieldRow label="Category interpretation">
                <span>{world.public_layer.category_interpretation ?? "—"}</span>
              </FieldRow>
              <FieldRow label="Misinterpretation risk">
                <span className="text-right max-w-[20ch]">
                  {world.public_layer.misinterpretation_risk ?? "—"}
                </span>
              </FieldRow>
              <FieldRow label="Forbidden claims">
                <span className="tabular">
                  {world.public_layer.forbidden_claims.length}
                </span>
              </FieldRow>
            </div>
          </div>
        </div>
      </section>

      {/* Open tensions */}
      {world.open_tensions.length > 0 ? (
        <section className="mt-12 pt-12 border-t hairline">
          <p className="eyebrow mb-6">Open tensions</p>
          <ol className="space-y-3 max-w-3xl">
            {world.open_tensions.map((t, i) => (
              <li key={i} className="flex gap-4 text-[14px] text-foreground/85">
                <span className="tabular text-muted text-[11px] pt-1">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* Team */}
      <section className="mt-12 pt-12 border-t hairline">
        <p className="eyebrow mb-6">Team</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
          {characters.map(([id, c]) => (
            <SectionCard
              key={id}
              eyebrow={c.role}
              title={id
                .split("_")
                .map((w) => w[0].toUpperCase() + w.slice(1))
                .join(" ")}
            >
              <div className="space-y-1">
                <FieldRow label="Confidence">
                  <StatusBadge value={c.confidence} />
                </FieldRow>
                <FieldRow label="Stress">
                  <StatusBadge value={c.stress} />
                </FieldRow>
                <FieldRow label="Influence">
                  <StatusBadge value={c.influence} />
                </FieldRow>
                <FieldRow label="Alignment">
                  <span className="text-right max-w-[24ch]">
                    {c.alignment.replaceAll("_", " ")}
                  </span>
                </FieldRow>
              </div>
              {c.last_major_shift ? (
                <p className="font-display italic text-[14px] text-muted leading-relaxed mt-4 pt-4 border-t hairline">
                  &ldquo;{c.last_major_shift}&rdquo;
                </p>
              ) : null}
            </SectionCard>
          ))}
        </div>
      </section>
    </div>
  );
}
