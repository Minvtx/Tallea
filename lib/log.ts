/**
 * World log / daybook derivation.
 *
 * The timeline is one TimelineEvent per cycle — the headline.
 * The log is many WorldLogEntry per cycle — the fuller daily record.
 *
 * Each entry is tagged with a `layer`:
 *   - company:       inside Tallea
 *   - around:        directly around Tallea (specific entities)
 *   - ecosystem:     ambient world motion (market, category, regional)
 *   - carry_forward: latent consequences / implications
 *
 * The baseline derivation pivots away from the headline fields the
 * timeline already shows (outcome, residue) and toward the *delta* — the
 * actual state changes that did not make the headline. That is what stops
 * the daybook from feeling like a vertical re-listing of the timeline.
 *
 * Whatever the model attaches to CycleOutput.logEntries is merged on top
 * and tagged source: "model".
 *
 * No second LLM call. No retrieval. No new system.
 */

import type {
  CharacterState,
  CycleLogEntryInput,
  CycleOutput,
  WorldLogDomain,
  WorldLogEntry,
  WorldLogKind,
  WorldLogLayer,
  WorldLogVisibility,
  WorldState,
  WorldStateDelta,
} from "@/types/world";

// ---------------------------------------------------------------------------
// Heuristics: classify a free-text beat into a kind + visibility + layer.
// ---------------------------------------------------------------------------

const PRESS_HINTS = [
  "newsletter",
  "press",
  "media",
  "outlet",
  "headline",
  "twitter",
  "linkedin",
  "site",
  "homepage",
  "public",
  "ai sizing",
];
const MERCHANT_HINTS = [
  "veta",
  "casa nimbo",
  "merchant",
  "pilot",
  "white-label",
  "white label",
  "platform",
  "brand",
  "retailer",
];
const PRODUCT_HINTS = [
  "catalog",
  "ingestion",
  "model",
  "confidence",
  "recommendation",
  "rec ",
  "prototype",
  "cleanup",
];
const TRUST_HINTS = [
  "consent",
  "body-profile",
  "body profile",
  "completion",
  "drop-off",
  "drop off",
  "user",
  "shopper",
];
const RUNWAY_HINTS = ["runway", "cash", "fundrais", "investor", "burn"];

function lower(s: string | undefined): string {
  return (s ?? "").toLowerCase();
}

function any(text: string, hints: readonly string[]): boolean {
  return hints.some((h) => text.includes(h));
}

function classifyTriggerKind(text: string): WorldLogKind {
  const t = lower(text);
  if (any(t, MERCHANT_HINTS)) return "merchant_signal";
  if (any(t, PRESS_HINTS)) return "press_signal";
  if (any(t, TRUST_HINTS)) return "trust_signal";
  if (any(t, PRODUCT_HINTS)) return "product_change";
  if (any(t, RUNWAY_HINTS)) return "operational";
  return "conversation";
}

function classifyTriggerLayer(text: string): WorldLogLayer {
  const t = lower(text);
  // External-entity-driven triggers belong "around" the company.
  if (any(t, MERCHANT_HINTS) || any(t, PRESS_HINTS)) return "around";
  // Everything else (a team conversation, a product change) is company-internal.
  return "company";
}

function classifyVisibility(
  text: string,
  fallback: WorldLogVisibility = "internal",
): WorldLogVisibility {
  const t = lower(text);
  if (any(t, PRESS_HINTS)) return "public";
  if (any(t, MERCHANT_HINTS)) return "mixed";
  return fallback;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function actorsFromThreads(cycle: CycleOutput): string[] {
  const seen = new Set<string>();
  for (const t of cycle.threads) {
    for (const c of t.affected_characters) seen.add(c);
  }
  return Array.from(seen);
}

function changedCharacterIds(delta: WorldStateDelta): string[] {
  return Object.keys(delta.character_states ?? {});
}

function humanizeKey(id: string): string {
  return id
    .split("_")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function describeEntityKind(type: string | undefined): string {
  if (!type) return "Entity";
  switch (type) {
    case "merchant":
      return "Merchant";
    case "press":
      return "Outlet";
    case "competitor":
      return "Competitor";
    case "platform":
      return "Platform";
    case "investor":
      return "Investor";
    case "operator_angel":
      return "Operator";
    case "commerce_operator":
      return "Operator";
    case "ecosystem_event":
      return "Ecosystem signal";
    default:
      return humanizeKey(type);
  }
}

function entityLayer(type: string | undefined): WorldLogLayer {
  // Press, competitors, platforms, investors and operators are the ambient
  // ecosystem. Concrete merchants and named operators directly engaged are
  // "around" the company.
  if (!type) return "around";
  switch (type) {
    case "merchant":
      return "around";
    case "platform":
    case "competitor":
    case "investor":
    case "ecosystem_event":
    case "operator_angel":
    case "commerce_operator":
    case "press":
      return "ecosystem";
    default:
      return "around";
  }
}

function relationshipPair(key: string): string[] {
  // relationship keys are like "matias_nicolas" or "lucia_camila".
  return key.split("_").filter(Boolean);
}

// ---------------------------------------------------------------------------
// Baseline derivation
// ---------------------------------------------------------------------------

interface BaselinePush {
  kind: WorldLogKind;
  layer: WorldLogLayer;
  visibility: WorldLogVisibility;
  summary: string;
  actors?: string[];
  domain?: WorldLogDomain;
}

/**
 * Produce a deterministic baseline set of log entries from a CycleOutput.
 *
 * Design intent: stop restating the timeline. Describe the *delta* the
 * timeline summarizes but does not enumerate.
 *
 * Always emitted (anchors the day to the timeline):
 *   - the trigger of the day
 *   - the decision the team made (often invisible on the timeline)
 *
 * Conditionally emitted (from the actual state delta):
 *   - one company entry per character whose `last_major_shift` was set
 *   - one around entry per external entity touched in the delta
 *   - one ecosystem entry per ecosystem_signal change
 *   - one around/ecosystem entry per public_layer shift
 *   - one company entry per relationship_state change
 *   - one company entry if cleanup burden escalated to high/unsustainable
 *   - one carry_forward entry per pending consequence added
 *
 * Outcome and residue are intentionally NOT duplicated here — the timeline
 * already shows them. That was the main source of overlap.
 */
export function deriveBaselineLogEntries(
  cycle: CycleOutput,
  prevState: WorldState,
): WorldLogEntry[] {
  const entries: WorldLogEntry[] = [];
  const delta = cycle.state_updates;
  const threadActors = actorsFromThreads(cycle);

  let idx = 0;
  const push = (e: BaselinePush) => {
    const summary = (e.summary ?? "").trim();
    if (!summary) return;
    entries.push({
      id: `${cycle.cycle_id}_log_${String(idx).padStart(2, "0")}`,
      cycle_id: cycle.cycle_id,
      day: cycle.day,
      kind: e.kind,
      layer: e.layer,
      visibility: e.visibility,
      summary,
      actors: e.actors && e.actors.length > 0 ? e.actors : undefined,
      domain: e.domain,
      source: "derived",
    });
    idx += 1;
  };

  // 1. Main development of the day. Anchors the daybook to the timeline
  //    without restating outcome+residue. Layer follows classification.
  push({
    kind: classifyTriggerKind(cycle.trigger),
    layer: classifyTriggerLayer(cycle.trigger),
    visibility: classifyVisibility(cycle.trigger, "internal"),
    summary: cycle.trigger,
    actors: threadActors,
  });

  // 2. The decision. Always company-internal. The timeline does not show
  //    the decision text; this is genuinely additive.
  push({
    kind: "decision",
    layer: "company",
    visibility: "internal",
    summary: cycle.decision_made,
    actors: threadActors,
  });

  // 3. Per-character internal shifts. One entry per character whose
  //    last_major_shift was rewritten this cycle. These are the kind of
  //    "smaller beat" the timeline cannot fit.
  for (const [charId, partial] of Object.entries(delta.character_states ?? {})) {
    const shift = (partial as Partial<CharacterState>)?.last_major_shift;
    if (!shift) continue;
    push({
      kind: "internal_shift",
      layer: "company",
      visibility: "internal",
      summary: shift,
      actors: [charId],
    });
  }

  // 4. Relationship-state changes. Quiet two-person conversations the
  //    timeline does not capture.
  for (const [pairKey, value] of Object.entries(delta.relationship_state ?? {})) {
    const people = relationshipPair(pairKey);
    push({
      kind: "conversation",
      layer: "company",
      visibility: "internal",
      summary: `${people.map(humanizeKey).join(" and ")}: ${String(value).replaceAll("_", " ")}.`,
      actors: people,
    });
  }

  // 5. External entities touched in the delta. These are world-motion beats
  //    the timeline does not enumerate. Layer depends on entity type.
  for (const [entityId, partial] of Object.entries(delta.external_entities ?? {})) {
    const prevEntity = prevState.external_entities[entityId];
    const type =
      (partial as { type?: string }).type ??
      prevEntity?.type ??
      undefined;
    const status = (partial as { status?: string }).status;
    const pressure = (partial as { pressure?: string }).pressure;
    const pieces: string[] = [];
    if (status) pieces.push(`now ${String(status).replaceAll("_", " ")}`);
    if (pressure) pieces.push(pressure);
    const pretty = humanizeKey(entityId);
    if (pieces.length === 0) continue;
    const layer = entityLayer(type);
    push({
      kind: "external_entity_motion",
      layer,
      visibility: layer === "ecosystem" ? "public" : "mixed",
      summary: `${describeEntityKind(type)} ${pretty}: ${pieces.join("; ")}.`,
      actors: [entityId],
    });
  }

  // 6. Ecosystem signal change. Pure ambient world.
  const eco = delta.traction_state?.ecosystem_signal;
  if (eco && (eco.status || eco.source || eco.risk)) {
    const pieces: string[] = [];
    if (eco.status) pieces.push(`status reads ${String(eco.status).replaceAll("_", " ")}`);
    if (eco.source) pieces.push(`source: ${eco.source}`);
    if (eco.risk) pieces.push(`risk: ${eco.risk}`);
    push({
      kind: "market_drift",
      layer: "ecosystem",
      visibility: "public",
      summary: `Ecosystem signal — ${pieces.join("; ")}.`,
    });
  }

  // 7. Public-layer shift. The site does not change every cycle; when it
  //    does, that is its own beat. Around-the-company by default; ecosystem
  //    when the misinterpretation_risk is about category framing.
  if (delta.public_layer) {
    const pl = delta.public_layer;
    const cat = pl.category_interpretation;
    const risk = pl.misinterpretation_risk;
    if (cat) {
      push({
        kind: "public_misreading",
        layer: "ecosystem",
        visibility: "public",
        summary: `Public framing drifts toward "${cat}".`,
      });
    }
    if (risk) {
      push({
        kind: "public_misreading",
        layer: "ecosystem",
        visibility: "public",
        summary: `Misinterpretation risk surfaced: ${risk}.`,
      });
    }
  }
  if (delta.company_state?.public_legitimacy) {
    push({
      kind: "press_signal",
      layer: "around",
      visibility: "public",
      summary: `Public legitimacy now reads as ${String(
        delta.company_state.public_legitimacy,
      ).replaceAll("_", " ")}.`,
    });
  }

  // 8. Operational beat: cleanup burden escalated.
  const burden = delta.product_state?.manual_cleanup_burden;
  if (burden === "high" || burden === "unsustainable") {
    push({
      kind: "operational",
      layer: "company",
      visibility: "internal",
      summary: `Manual catalog cleanup burden now sits at ${String(burden).replaceAll("_", " ")}.`,
    });
  }

  // 9. Carry-forward / implications. Pending consequences are exactly that:
  //    not "what happened today" but "what today changes next."
  for (const pc of delta.pending_consequences_added ?? []) {
    push({
      kind: "carry_forward",
      layer: "carry_forward",
      visibility: "internal",
      summary: pc.description,
      domain: pc.domain,
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Merging model-provided entries on top of baseline
// ---------------------------------------------------------------------------

function naiveOverlap(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\W+/).filter((t) => t.length > 3));
  const tb = new Set(b.toLowerCase().split(/\W+/).filter((t) => t.length > 3));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / Math.min(ta.size, tb.size);
}

/**
 * Take baseline derived entries plus whatever the orchestrator attached
 * via CycleOutput.logEntries, assign canonical ids, and return the full
 * WorldLogEntry[] for this cycle.
 *
 * Dedup: we drop a model entry if it is a substring of a baseline entry
 * or shares more than 70% of its content words with one. This keeps model
 * entries that *enrich* and removes ones that merely paraphrase.
 */
export function mergeCycleLogEntries(
  cycle: CycleOutput,
  baseline: WorldLogEntry[],
): WorldLogEntry[] {
  const merged = [...baseline];
  const inputs: CycleLogEntryInput[] = cycle.logEntries ?? [];
  let idx = baseline.length;

  for (const input of inputs) {
    const summary = (input.summary ?? "").trim();
    if (!summary) continue;
    const lower = summary.toLowerCase();

    const isDup = merged.some((b) => {
      const bl = b.summary.toLowerCase();
      if (bl === lower) return true;
      if (bl.includes(lower) || lower.includes(bl)) return true;
      return naiveOverlap(bl, lower) > 0.7;
    });
    if (isDup) continue;

    merged.push({
      id: `${cycle.cycle_id}_log_${String(idx).padStart(2, "0")}`,
      cycle_id: cycle.cycle_id,
      day: cycle.day,
      kind: input.kind,
      layer: input.layer,
      visibility: input.visibility,
      summary,
      actors: input.actors && input.actors.length > 0 ? input.actors : undefined,
      domain: input.domain,
      source: "model",
    });
    idx += 1;
  }
  return merged;
}
