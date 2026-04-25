import { loadTimeline } from "@/lib/loaders";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

export default function TimelinePage() {
  const events = loadTimeline().slice().reverse();

  return (
    <div className="mx-auto max-w-4xl px-6 pt-12 pb-24">
      <header className="pb-12 border-b hairline">
        <p className="eyebrow mb-4">Tallea — company memory</p>
        <h1 className="font-display text-[clamp(2.5rem,6vw,4rem)] tracking-[-0.022em] leading-[1.02] text-balance">
          Timeline
        </h1>
        <p className="text-[15px] text-muted mt-4 leading-relaxed max-w-xl">
          A reverse-chronological record of every cycle the company has lived
          through. Each entry preserves trigger, outcome, and what carries
          forward.
        </p>
      </header>

      {events.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title="No history yet"
            description="The first cycle will appear here. Start one from /admin."
          />
        </div>
      ) : (
        <div className="mt-12">
          {events.map((e) => (
            <article
              key={e.cycle_id}
              className="grid grid-cols-12 gap-6 py-12 border-b hairline last:border-0"
            >
              <div className="col-span-12 md:col-span-3">
                <p className="font-display text-3xl tracking-[-0.012em] tabular leading-none">
                  Day {String(e.day).padStart(3, "0")}
                </p>
                <p className="eyebrow mt-3">Cycle</p>
                <p className="tabular text-[12px] text-muted mt-1">
                  {e.cycle_id}
                </p>
              </div>

              <div className="col-span-12 md:col-span-9">
                <h2 className="font-display text-2xl tracking-[-0.014em] leading-snug text-balance">
                  {e.title}
                </h2>
                <p className="text-[15px] text-muted mt-4 leading-relaxed text-pretty">
                  {e.trigger}
                </p>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 mt-8">
                  <div>
                    <dt className="eyebrow mb-1">Pressure</dt>
                    <dd className="text-[13px] text-foreground/85 leading-relaxed">
                      {e.primary_pressure}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow mb-1">Outcome</dt>
                    <dd className="text-[13px] text-foreground/85 leading-relaxed">
                      {e.outcome}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow mb-1">Residue</dt>
                    <dd className="text-[13px] text-foreground/85 leading-relaxed">
                      {e.residue}
                    </dd>
                  </div>
                  {e.affected_characters.length > 0 ? (
                    <div>
                      <dt className="eyebrow mb-1">Affected</dt>
                      <dd className="text-[13px] text-foreground/85 leading-relaxed">
                        {e.affected_characters
                          .map((c) =>
                            c
                              .split("_")
                              .map((w) => w[0].toUpperCase() + w.slice(1))
                              .join(" "),
                          )
                          .join(" · ")}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {e.carries_forward.length > 0 ? (
                  <div className="mt-6 pt-6 border-t hairline">
                    <p className="eyebrow mb-3">Carries forward</p>
                    <ul className="space-y-2">
                      {e.carries_forward.map((c, i) => (
                        <li
                          key={i}
                          className="flex items-baseline gap-3 text-[13px] text-muted"
                        >
                          <span className="text-accent">—</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
