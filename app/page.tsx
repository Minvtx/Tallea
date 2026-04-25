import Link from "next/link";
import {
  getLastUpdatedAt,
  loadCurrentWorldState,
  loadLatestCycleOutput,
} from "@/lib/loaders";
import { deriveProjection } from "@/lib/publisher";

export const dynamic = "force-dynamic";

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  const diffSec = Math.round((Date.now() - ts) / 1000);
  if (diffSec < 60) return "moments ago";
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export default async function HomePage() {
  const world = await loadCurrentWorldState();
  const latestCycle = loadLatestCycleOutput();
  const projection = world ? deriveProjection(world) : null;
  const updatedLabel = formatRelative(getLastUpdatedAt());

  if (!world || !projection) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-32 text-center">
        <p className="eyebrow mb-6">Tallea</p>
        <h1 className="font-display text-5xl tracking-[-0.02em] leading-[1.05]">
          Know your fit before you buy.
        </h1>
        <p className="text-[15px] text-muted mt-6 leading-relaxed max-w-md mx-auto">
          Public site is initializing. Visit /admin to begin the simulation.
        </p>
      </div>
    );
  }

  const dayLabel = `Day ${String(world.world.day).padStart(3, "0")}`;
  const phaseLabel = world.world.phase.replaceAll("_", " ");

  return (
    <div className="mx-auto max-w-6xl px-6 pt-16">
      {/* Hero */}
      <section className="grid grid-cols-12 gap-6 pt-8">
        <div className="col-span-12 lg:col-span-8">
          <p className="eyebrow mb-6">Tallea — Buenos Aires</p>
          <h1 className="font-display text-[clamp(2.75rem,7vw,5rem)] tracking-[-0.022em] leading-[1.02] text-balance">
            {projection.headline}
          </h1>
          <p className="text-[17px] text-muted mt-8 leading-relaxed max-w-xl text-pretty">
            {projection.positioning}
          </p>
          <div className="mt-12 flex items-center gap-6">
            <Link
              href="#claims"
              className="text-[13px] text-foreground hover:text-accent transition-colors"
            >
              {projection.cta_label} →
            </Link>
            <Link
              href="/timeline"
              className="text-[13px] text-muted hover:text-foreground transition-colors"
            >
              Read the dispatch
            </Link>
          </div>
        </div>

        {/* Currently sidebar */}
        <aside className="col-span-12 lg:col-span-4 lg:pl-8 lg:border-l hairline">
          <p className="eyebrow mb-4">Currently</p>
          <div className="flex items-center gap-2 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
            <span className="tabular text-[13px] text-foreground">{dayLabel}</span>
          </div>
          <p className="text-[13px] text-muted leading-relaxed">
            Phase: <span className="text-foreground/85">{phaseLabel}</span>
          </p>
          <p className="text-[13px] text-muted leading-relaxed mt-1">
            {world.traction_state.merchant_pipeline.active_pilot_conversations}{" "}
            active pilot{" "}
            {world.traction_state.merchant_pipeline.active_pilot_conversations === 1
              ? "conversation"
              : "conversations"}
          </p>
          {updatedLabel ? (
            <p className="text-[12px] text-muted mt-3">Updated {updatedLabel}</p>
          ) : null}
        </aside>
      </section>

      {/* Latest dispatch */}
      {latestCycle ? (
        <section className="mt-24 pt-12 border-t hairline grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-3">
            <p className="eyebrow">Latest dispatch</p>
            <p className="tabular text-[12px] text-muted mt-2">
              Day {String(latestCycle.day).padStart(3, "0")}
            </p>
          </div>
          <div className="col-span-12 md:col-span-9">
            <h2 className="font-display text-3xl tracking-[-0.016em] leading-tight text-pretty">
              {latestCycle.title}
            </h2>
            <p className="text-[15px] text-muted mt-4 leading-relaxed text-pretty max-w-2xl">
              {latestCycle.outcome}
            </p>
            <Link
              href="/timeline"
              className="text-[13px] text-foreground hover:text-accent transition-colors mt-6 inline-block"
            >
              See the full timeline →
            </Link>
          </div>
        </section>
      ) : null}

      {/* Proof points */}
      <section className="mt-24 pt-12 border-t hairline">
        <p className="eyebrow mb-8">How Tallea works</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
          {[
            {
              n: "01",
              title: "Reusable fit profile",
              body: "A guided phone-camera flow captures body proportions and fit preferences once. Shoppers reuse it across participating stores.",
            },
            {
              n: "02",
              title: "Confidence guidance",
              body: "Tallea recommends likely sizes with explicit confidence, not certainty. The product names what it cannot answer.",
            },
            {
              n: "03",
              title: "Catalog-aware",
              body: "Recommendations factor brand-specific cuts, fabric behavior, and garment data. Quality is highest where merchant data is clean.",
            },
          ].map((item) => (
            <div key={item.n} className="bg-background p-8">
              <p className="tabular eyebrow mb-3">{item.n}</p>
              <h3 className="font-display text-xl tracking-[-0.012em] mb-3">
                {item.title}
              </h3>
              <p className="text-[14px] text-muted leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Allowed claims */}
      <section id="claims" className="mt-24 pt-12 border-t hairline grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-3">
          <p className="eyebrow">What Tallea is</p>
        </div>
        <ol className="col-span-12 md:col-span-9 space-y-3">
          {projection.allowed_claims.map((claim, i) => (
            <li
              key={i}
              className="flex gap-4 text-[15px] leading-relaxed text-foreground/85"
            >
              <span className="tabular text-muted text-[12px] pt-1.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{claim}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Bonus claims, when state allows */}
      {projection.bonus_claims.length > 0 ? (
        <section className="mt-12">
          <ul className="space-y-2">
            {projection.bonus_claims.map((claim, i) => (
              <li key={i} className="flex items-baseline gap-3 text-[14px] text-muted">
                <span className="text-accent">—</span>
                <span>{claim}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Pilot CTA */}
      <section className="mt-24 pt-12 border-t hairline grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-3">
          <p className="eyebrow">For merchants</p>
        </div>
        <div className="col-span-12 md:col-span-9">
          <h2 className="font-display text-2xl tracking-[-0.014em] leading-tight max-w-xl text-pretty">
            Fewer abandoned carts. Fewer avoidable exchanges. Fit data your support
            team can actually act on.
          </h2>
          <p className="text-[14px] text-muted mt-4 leading-relaxed max-w-xl">
            {projection.bonus_claims.length > 0
              ? "Tallea is piloting with regional fitted-apparel and denim-adjacent brands. Pilots are scoped, time-boxed, and start with categories where confidence is highest."
              : "Tallea is opening a small set of scoped, time-boxed pilots with regional fitted-apparel and denim-adjacent brands. Pilots start with categories where confidence is highest."}
          </p>
          <Link
            href="mailto:pilots@tallea.example"
            className="text-[13px] text-foreground hover:text-accent transition-colors mt-6 inline-block"
          >
            Pilot inquiry →
          </Link>
        </div>
      </section>

      {/* Colophon */}
      <footer className="mt-32 pt-8 border-t hairline flex items-baseline justify-between text-[12px] text-muted">
        <span>Tallea — Buenos Aires</span>
        <span className="tabular">{dayLabel}</span>
      </footer>
    </div>
  );
}
