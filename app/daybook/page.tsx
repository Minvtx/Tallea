import Link from "next/link";
import { loadTimeline, loadWorldLog } from "@/lib/loaders";
import { EmptyState } from "@/components/empty-state";
import type {
  TimelineEvent,
  WorldLogEntry,
  WorldLogLayer,
  WorldLogVisibility,
} from "@/types/world";

export const dynamic = "force-dynamic";

type ViewFilter = "all" | "public" | "internal";

const FILTERS: { id: ViewFilter; label: string; description: string }[] = [
  {
    id: "all",
    label: "All",
    description: "Every entry from the day, internal and public.",
  },
  {
    id: "public",
    label: "Public-facing",
    description: "What a careful outsider would have been able to see.",
  },
  {
    id: "internal",
    label: "Inside the company",
    description: "Decisions and conversations the public never saw.",
  },
];

const KIND_LABELS: Record<WorldLogEntry["kind"], string> = {
  decision: "Decision",
  conversation: "Conversation",
  merchant_signal: "Merchant",
  product_change: "Product",
  trust_signal: "Trust",
  press_signal: "Press",
  internal_shift: "Inside",
  operational: "Ops",
  consequence: "Consequence",
  external_entity_motion: "Entity",
  market_drift: "Market",
  category_pressure: "Category",
  public_misreading: "Framing",
  carry_forward: "Carry-forward",
};

const VISIBILITY_LABELS: Record<WorldLogVisibility, string> = {
  internal: "internal",
  public: "public",
  mixed: "mixed",
};

// Layer ordering and presentation. The order here defines the vertical
// reading order within a cycle: company → around → ecosystem → carry-forward.
const LAYER_ORDER: WorldLogLayer[] = [
  "company",
  "around",
  "ecosystem",
  "carry_forward",
];

const LAYER_TITLES: Record<WorldLogLayer, string> = {
  company: "Inside the company",
  around: "Around the company",
  ecosystem: "Ecosystem signals",
  carry_forward: "Carry-forward",
};

const LAYER_HINTS: Record<WorldLogLayer, string> = {
  company: "Decisions, conversations, internal shifts.",
  around: "External entities directly engaging Tallea.",
  ecosystem: "Ambient world motion that matters but does not act on Tallea today.",
  carry_forward: "Latent consequences and what this changes next.",
};

function passesFilter(entry: WorldLogEntry, view: ViewFilter): boolean {
  if (view === "all") return true;
  if (view === "public") {
    return entry.visibility === "public" || entry.visibility === "mixed";
  }
  return entry.visibility === "internal" || entry.visibility === "mixed";
}

function humanizeActor(id: string): string {
  return id
    .split("_")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function groupByCycle(
  entries: WorldLogEntry[],
): Map<string, WorldLogEntry[]> {
  const map = new Map<string, WorldLogEntry[]>();
  for (const e of entries) {
    const arr = map.get(e.cycle_id);
    if (arr) arr.push(e);
    else map.set(e.cycle_id, [e]);
  }
  return map;
}

function groupByLayer(
  entries: WorldLogEntry[],
): Map<WorldLogLayer, WorldLogEntry[]> {
  const map = new Map<WorldLogLayer, WorldLogEntry[]>();
  for (const e of entries) {
    // Defensive: legacy entries persisted before the schema add do not have
    // a layer. Fall back to "company" so they still render.
    const layer: WorldLogLayer = (e.layer ?? "company") as WorldLogLayer;
    const arr = map.get(layer);
    if (arr) arr.push(e);
    else map.set(layer, [e]);
  }
  return map;
}

export default async function DaybookPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const rawView = (params.view ?? "all").toLowerCase();
  const view: ViewFilter =
    rawView === "public" || rawView === "internal" ? rawView : "all";

  const [allEntries, timeline] = await Promise.all([
    loadWorldLog(),
    loadTimeline(),
  ]);
  const titleByCycle = new Map<string, TimelineEvent>(
    timeline.map((t) => [t.cycle_id, t]),
  );

  // Reverse-chronological by day, but stable within a day by id order.
  const sorted = [...allEntries].sort((a, b) => {
    if (a.day !== b.day) return b.day - a.day;
    return a.id.localeCompare(b.id);
  });

  const filtered = sorted.filter((e) => passesFilter(e, view));
  const grouped = groupByCycle(filtered);
  const orderedCycles = Array.from(grouped.entries()).sort((a, b) => {
    const da = a[1][0]?.day ?? 0;
    const db = b[1][0]?.day ?? 0;
    return db - da;
  });

  return (
    <div className="mx-auto max-w-4xl px-6 pt-12 pb-24">
      <header className="pb-12 border-b hairline">
        <p className="eyebrow mb-4">Tallea — daybook</p>
        <h1 className="font-display text-[clamp(2.5rem,6vw,4rem)] tracking-[-0.022em] leading-[1.02] text-balance">
          A fuller record of each day.
        </h1>
        <p className="text-[15px] text-muted mt-4 leading-relaxed max-w-xl text-pretty">
          The{" "}
          <Link
            href="/timeline"
            className="text-foreground hover:text-accent transition-colors"
          >
            timeline
          </Link>{" "}
          shows one headline per cycle. The daybook keeps everything else:
          smaller decisions inside the company, motion around it, and the
          ambient ecosystem that drifts whether or not Tallea acts on it.
        </p>
      </header>

      {/* Filter tabs */}
      <nav
        aria-label="Daybook visibility filter"
        className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3"
      >
        {FILTERS.map((f) => {
          const isActive = view === f.id;
          const href = f.id === "all" ? "/daybook" : `/daybook?view=${f.id}`;
          return (
            <Link
              key={f.id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`text-[13px] transition-colors ${
                isActive
                  ? "text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span
                className={`mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                  isActive ? "bg-accent" : "bg-foreground/25"
                }`}
              />
              {f.label}
            </Link>
          );
        })}
        <p className="basis-full text-[12px] text-muted leading-relaxed">
          {FILTERS.find((f) => f.id === view)?.description}
        </p>
      </nav>

      {orderedCycles.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title={
              allEntries.length === 0
                ? "No entries yet"
                : "Nothing in this view"
            }
            description={
              allEntries.length === 0
                ? "Run the first cycle from /admin and the daybook will start filling itself."
                : "Try a different filter, or switch to All."
            }
          />
        </div>
      ) : (
        <div className="mt-12">
          {orderedCycles.map(([cycleId, entries]) => {
            const headline = titleByCycle.get(cycleId);
            const day = entries[0].day;
            const byLayer = groupByLayer(entries);
            return (
              <article
                key={cycleId}
                className="grid grid-cols-12 gap-6 py-12 border-b hairline last:border-0"
              >
                <div className="col-span-12 md:col-span-3">
                  <p className="font-display text-3xl tracking-[-0.012em] tabular leading-none">
                    Day {String(day).padStart(3, "0")}
                  </p>
                  <p className="eyebrow mt-3">Daybook</p>
                  <p className="tabular text-[12px] text-muted mt-1">
                    {cycleId}
                  </p>
                  <p className="tabular text-[12px] text-muted mt-1">
                    {entries.length}{" "}
                    {entries.length === 1 ? "entry" : "entries"}
                  </p>
                  {headline ? (
                    <Link
                      href="/timeline"
                      className="text-[12px] text-muted hover:text-foreground transition-colors mt-4 inline-block"
                    >
                      Headline →
                    </Link>
                  ) : null}
                </div>

                <div className="col-span-12 md:col-span-9">
                  {headline ? (
                    <h2 className="font-display text-xl tracking-[-0.012em] leading-snug text-pretty mb-8 text-foreground/85">
                      {headline.title}
                    </h2>
                  ) : null}

                  <div className="space-y-10">
                    {LAYER_ORDER.map((layer) => {
                      const layerEntries = byLayer.get(layer);
                      if (!layerEntries || layerEntries.length === 0) return null;
                      return (
                        <section
                          key={layer}
                          aria-label={LAYER_TITLES[layer]}
                          className="space-y-4"
                        >
                          <header className="flex items-baseline justify-between gap-4">
                            <h3 className="eyebrow text-[11px] text-foreground/80">
                              {LAYER_TITLES[layer]}
                            </h3>
                            <p className="text-[11px] text-muted text-right max-w-[18rem] hidden sm:block">
                              {LAYER_HINTS[layer]}
                            </p>
                          </header>
                          <ul className="space-y-5">
                            {layerEntries.map((e) => (
                              <li key={e.id} className="flex gap-4">
                                <div className="flex flex-col items-end pt-0.5 min-w-[6rem]">
                                  <span className="eyebrow text-[10px]">
                                    {KIND_LABELS[e.kind]}
                                  </span>
                                  <span
                                    className={`tabular text-[10px] mt-1 ${
                                      e.visibility === "public"
                                        ? "text-accent"
                                        : e.visibility === "mixed"
                                          ? "text-foreground/70"
                                          : "text-muted"
                                    }`}
                                  >
                                    {VISIBILITY_LABELS[e.visibility]}
                                  </span>
                                </div>
                                <div className="flex-1 border-l hairline pl-4">
                                  <p className="text-[14px] text-foreground/85 leading-relaxed text-pretty">
                                    {e.summary}
                                  </p>
                                  {e.actors && e.actors.length > 0 ? (
                                    <p className="text-[12px] text-muted mt-2">
                                      {e.actors.map(humanizeActor).join(" · ")}
                                    </p>
                                  ) : null}
                                  {e.domain ? (
                                    <p className="eyebrow text-[10px] mt-2">
                                      {e.domain}
                                    </p>
                                  ) : null}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <footer className="mt-16 pt-8 border-t hairline flex items-baseline justify-between text-[12px] text-muted">
        <span>
          Timeline is the headline.{" "}
          <span className="text-foreground/70">Daybook is the record.</span>
        </span>
        <Link
          href="/timeline"
          className="hover:text-foreground transition-colors"
        >
          Read the timeline →
        </Link>
      </footer>
    </div>
  );
}
