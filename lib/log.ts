/**
 * World log / daybook derivation.
 *
 * The timeline is one TimelineEvent per cycle — the headline.
 * The log is many WorldLogEntry per cycle — the fuller daily record.
 *
 * deriveBaselineLogEntries is deterministic and runs every cycle, in BOTH
 * mock and AI mode. Whatever the model attaches to CycleOutput.logEntries
 * is merged on top and tagged source: "model".
 *
 * No second LLM call. No retrieval. No new system. Just a structured
 * pass over the CycleOutput we already have.
 */

import type {
  CycleLogEntryInput,
  CycleOutput,
  WorldLogDomain,
  WorldLogEntry,
  WorldLogKind,
  WorldLogVisibility,
  WorldState,
  WorldStateDelta,
} from "@/types/world";

// ---------------------------------------------------------------------------
// Heuristics: classify a free-text beat into a kind + visibility.
//
// Cheap keyword passes; conservative defaults. The point is to give the
// daybook enough texture to distinguish a press beat from a team conversation
// without pretending the classifier is perfect.
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
// Helpers for picking actors from the cycle context
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

function deltaTouchesPublicSurface(delta: WorldStateDelta): boolean {
  return (
    !!delta.public_layer ||
    delta.company_state?.public_legitimacy !== undefined ||
    delta.traction_state?.ecosystem_signal !== undefined
  );
}

// ---------------------------------------------------------------------------
// Baseline derivation
// ---------------------------------------------------------------------------

/**
 * Produce a deterministic baseline set of log entries from a CycleOutput.
 *
 * These are the entries that would have been generated even if the model
 * attached nothing. They guarantee the daybook always has at least:
 *   - the trigger of the day
 *   - the decision the team made
 *   - the residue it left behind
 *   - any new pending consequences
 *   - any public-facing shift that day
 */
export function deriveBaselineLogEntries(
  cycle: CycleOutput,
  _prevState: WorldState,
): WorldLogEntry[] {
  const entries: WorldLogEntry[] = [];
  const delta = cycle.state_updates;
  const threadActors = actorsFromThreads(cycle);

  let idx = 0;
  const push = (
    kind: WorldLogKind,
    visibility: WorldLogVisibility,
    summary: string,
    extras?: { actors?: string[]; domain?: WorldLogDomain },
  ) => {
    if (!summary || !summary.trim()) return;
    entries.push({
      id: `${cycle.cycle_id}_log_${String(idx).padStart(2, "0")}`,
      cycle_id: cycle.cycle_id,
      day: cycle.day,
      kind,
      visibility,
      summary: summary.trim(),
      actors: extras?.actors && extras.actors.length > 0 ? extras.actors : undefined,
      domain: extras?.domain,
      source: "derived",
    });
    idx += 1;
  };

  // 1. Trigger of the day
  push(
    classifyTriggerKind(cycle.trigger),
    classifyVisibility(cycle.trigger, "internal"),
    cycle.trigger,
    { actors: threadActors },
  );

  // 2. Decision made by the team — always internal, always anchored to threads
  push("decision", "internal", cycle.decision_made, { actors: threadActors });

  // 3. Outcome — visibility follows whether the public surface moved
  push(
    classifyTriggerKind(cycle.outcome),
    deltaTouchesPublicSurface(delta)
      ? "mixed"
      : classifyVisibility(cycle.outcome, "internal"),
    cycle.outcome,
  );

  // 4. Residue — internal by default; this is what the day leaves behind
  push("internal_shift", "internal", cycle.residue, {
    actors: changedCharacterIds(delta),
  });

  // 5. Public-layer or legitimacy shifts get their own dedicated public entry
  if (deltaTouchesPublicSurface(delta)) {
    const pieces: string[] = [];
    if (delta.public_layer?.category_interpretation) {
      pieces.push(
        `Public framing drifts toward "${delta.public_layer.category_interpretation}".`,
      );
    }
    if (delta.public_layer?.misinterpretation_risk) {
      pieces.push(`Risk surfaced: ${delta.public_layer.misinterpretation_risk}.`);
    }
    if (delta.company_state?.public_legitimacy) {
      pieces.push(
        `Public legitimacy now reads as ${delta.company_state.public_legitimacy.replaceAll(
          "_",
          " ",
        )}.`,
      );
    }
    if (pieces.length > 0) {
      push("press_signal", "public", pieces.join(" "));
    }
  }

  // 6. Pending consequences added — one entry each, internal
  for (const pc of delta.pending_consequences_added ?? []) {
    push("consequence", "internal", pc.description, { domain: pc.domain });
  }

  // 7. Operational beat: cleanup burden escalated
  if (delta.product_state?.manual_cleanup_burden) {
    const burden = delta.product_state.manual_cleanup_burden;
    if (burden === "high" || burden === "unsustainable") {
      push(
        "operational",
        "internal",
        `Manual catalog cleanup burden now sits at ${burden.replaceAll("_", " ")}.`,
      );
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Merging model-provided entries on top of baseline
// ---------------------------------------------------------------------------

/**
 * Take baseline derived entries plus whatever the orchestrator attached
 * via CycleOutput.logEntries, assign canonical ids, and return the full
 * WorldLogEntry[] for this cycle.
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
    // Naive dedup: if a baseline entry already covers the same summary, skip.
    if (merged.some((b) => b.summary.toLowerCase() === summary.toLowerCase())) {
      continue;
    }
    merged.push({
      id: `${cycle.cycle_id}_log_${String(idx).padStart(2, "0")}`,
      cycle_id: cycle.cycle_id,
      day: cycle.day,
      kind: input.kind,
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
