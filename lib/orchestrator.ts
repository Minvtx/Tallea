/**
 * Tallea cycle orchestrator.
 *
 * Two modes:
 *  - mock (default): deterministic event templates driven by current state.
 *  - ai: AI SDK 6 + Vercel AI Gateway + structured output (see generateWithAI).
 *
 * Mode is selected at runtime by env:
 *   TALLEA_ENABLE_AI=true && AI_GATEWAY_API_KEY=...  -> ai
 *   otherwise                                        -> mock
 *
 * AI mode env config:
 *   AI_GATEWAY_API_KEY        (required)  Vercel AI Gateway key.
 *   TALLEA_ENABLE_AI=true     (required)  Flips the orchestrator into AI mode.
 *   TALLEA_AI_MODEL           (optional)  Default: "openai/gpt-5-mini".
 *                                         Any AI Gateway-routable model id.
 *   TALLEA_AI_TEMPERATURE     (optional)  Default: "0.7". Float 0..1.
 *
 * The model only produces structured CycleOutput. The deterministic
 * publishing layer (lib/state.ts + lib/publisher.ts + lib/log.ts) is what
 * actually updates the timeline, the daybook, the public site projection
 * and the realism guardrails. The model never writes to disk directly.
 *
 * Any AI failure cleanly falls back to mock generation so the simulation
 * never stalls — the cycle just runs on deterministic templates instead.
 */

import type {
  CycleOutput,
  PendingConsequence,
  SiteProjection,
  TimelineEvent,
  WorldLogEntry,
  WorldState,
  WorldStateDelta,
} from "@/types/world";
import {
  loadCurrentWorldState,
  loadCycleRules,
  loadEventTypes,
  loadFirstCycleSeed,
  loadInitialState,
  loadRuntimeFoundation,
  loadStateSchema,
  loadTimeline,
  loadWorldRules,
} from "@/lib/loaders";
import { applyAndPersistCycle, writeCycleOutput } from "@/lib/state";
import { deriveProjection } from "@/lib/publisher";

// ---------------------------------------------------------------------------
// Cycle context (compact inputs, never canon)
// ---------------------------------------------------------------------------

export interface CycleContext {
  state: WorldState;
  runtimeFoundation: string;
  cycleRules: string;
  stateSchema: string;
  eventTypes: string;
  worldRules: string;
  recentTimeline: TimelineEvent[];
  firstCycleSeed?: string;
}

export function buildCycleContext(state: WorldState): CycleContext {
  const recent = loadTimeline().slice(-5);
  return {
    state,
    runtimeFoundation: loadRuntimeFoundation(),
    cycleRules: loadCycleRules(),
    stateSchema: loadStateSchema(),
    eventTypes: loadEventTypes(),
    worldRules: loadWorldRules(),
    recentTimeline: recent,
    firstCycleSeed: state.world.day === 0 ? loadFirstCycleSeed() : undefined,
  };
}

// ---------------------------------------------------------------------------
// Mode selection
// ---------------------------------------------------------------------------

export type CycleMode = "mock" | "ai";

export type CycleModeReason =
  | "ai_enabled"
  | "missing_enable_flag"
  | "missing_gateway_key";

export function getCycleModeStatus(): {
  mode: CycleMode;
  reason: CycleModeReason;
  model: string;
  temperature: number;
} {
  const enabled = process.env.TALLEA_ENABLE_AI === "true";
  const hasKey = (process.env.AI_GATEWAY_API_KEY ?? "").length > 0;
  const model = process.env.TALLEA_AI_MODEL || "openai/gpt-5-mini";
  const temperature = (() => {
    const raw = process.env.TALLEA_AI_TEMPERATURE;
    if (!raw) return 0.7;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.7;
  })();

  if (!enabled) return { mode: "mock", reason: "missing_enable_flag", model, temperature };
  if (!hasKey) return { mode: "mock", reason: "missing_gateway_key", model, temperature };
  return { mode: "ai", reason: "ai_enabled", model, temperature };
}

export function getCycleMode(): CycleMode {
  return getCycleModeStatus().mode;
}

// ---------------------------------------------------------------------------
// AI mode (real generation)
// ---------------------------------------------------------------------------

async function generateWithAI(ctx: CycleContext): Promise<CycleOutput> {
  // Lazy import so mock mode never pulls in the AI SDK at all.
  const { generateObject } = await import("ai");
  const { z } = await import("zod");

  const { model, temperature } = getCycleModeStatus();

  const ConsequenceSchema = z.object({
    source_event_id: z.string(),
    description: z.string(),
    time_horizon: z.enum(["immediate", "short", "medium", "long"]),
    domain: z.enum([
      "product",
      "trust",
      "merchant",
      "reputation",
      "runway",
      "relationship",
      "strategy",
    ]),
    activation_condition: z.string().optional(),
    status: z.enum(["pending", "activated", "resolved", "transformed"]),
  });

  const DeltaSchema = z.object({
    company_state: z.record(z.string(), z.unknown()).optional(),
    product_state: z.record(z.string(), z.unknown()).optional(),
    traction_state: z
      .object({
        user_beta: z.record(z.string(), z.unknown()).optional(),
        merchant_pipeline: z.record(z.string(), z.unknown()).optional(),
        ecosystem_signal: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
    public_layer: z.record(z.string(), z.unknown()).optional(),
    external_entities: z
      .record(z.string(), z.record(z.string(), z.unknown()))
      .optional(),
    character_states: z
      .record(z.string(), z.record(z.string(), z.unknown()))
      .optional(),
    relationship_state: z.record(z.string(), z.string()).optional(),
    open_tensions_added: z.array(z.string()).optional(),
    open_tensions_removed: z.array(z.string()).optional(),
    pending_consequences_added: z.array(ConsequenceSchema).optional(),
  });

  const ThreadSchema = z.object({
    thread_id: z.string(),
    title: z.string(),
    affected_characters: z.array(z.string()),
    status: z.enum(["opened", "developing", "resolved", "deferred"]),
  });

  const LogEntrySchema = z.object({
    kind: z.enum([
      "decision",
      "conversation",
      "merchant_signal",
      "product_change",
      "trust_signal",
      "press_signal",
      "internal_shift",
      "operational",
      "consequence",
      "external_entity_motion",
      "market_drift",
      "category_pressure",
      "public_misreading",
      "carry_forward",
    ]),
    layer: z.enum(["company", "around", "ecosystem", "carry_forward"]),
    visibility: z.enum(["internal", "public", "mixed"]),
    summary: z.string(),
    actors: z.array(z.string()).optional(),
    domain: z
      .enum([
        "product",
        "trust",
        "merchant",
        "reputation",
        "runway",
        "relationship",
        "strategy",
      ])
      .optional(),
  });

  const CycleSchema = z.object({
    cycle_id: z.string(),
    day: z.number(),
    title: z.string(),
    trigger: z.string(),
    primary_pressure: z.string(),
    secondary_pressure: z.string(),
    internal_translation: z.string(),
    decision_point: z.string(),
    decision_made: z.string(),
    outcome: z.string(),
    residue: z.string(),
    next_hooks: z.array(z.string()),
    threads: z.array(ThreadSchema),
    state_updates: DeltaSchema,
    logEntries: z.array(LogEntrySchema).optional(),
  });

  const day = ctx.state.world.day + 1;
  const cycleId = `cycle_${String(day).padStart(3, "0")}`;

  const compactState = {
    day: ctx.state.world.day,
    company: ctx.state.company_state,
    product: {
      health: ctx.state.product_state.health,
      cleanup: ctx.state.product_state.manual_cleanup_burden,
    },
    traction: ctx.state.traction_state,
    public: ctx.state.public_layer,
    characters: ctx.state.character_states,
    open_tensions: ctx.state.open_tensions,
    pending_consequences: ctx.state.pending_consequences,
  };

  const system = [
    "You are the orchestrator for a persistent simulated startup world named Tallea.",
    "Tallea is a five-person Buenos Aires fit-intelligence company with finite runway.",
    "You generate exactly one cycle (one in-universe day) as a structured CycleOutput.",
    "",
    "Hard rules:",
    "- Output only the structured object the schema requires. No prose outside the object.",
    "- The deterministic publishing layer in this app applies your delta, clamps single-cycle jumps to one step on key ladders, persists the timeline, and derives the public site. You do not write to disk; you emit a cycle.",
    "- Honor canonical realism: most cycles advance a thread rather than concluding one; public narrative lags internal state; pressure usually accumulates rather than resolves; a signal is more honest than a result.",
    "- Forbidden single-cycle moves unless the recent timeline explicitly built up to them: instant signed paid pilots, public_legitimacy jumps of more than one step, runway_pressure jumps of more than one step, internal_alignment jumps of more than one step, press explosions, acquisition rumors, large fundraising, full repair of openly-strained relationships.",
    "- The state_updates delta must touch at least one character and at least one strategic field. Add at least one pending_consequence unless none would be honest.",
    "",
    "About logEntries (the daybook):",
    "- The app already stores a one-line-per-cycle highlight timeline. logEntries is a complementary fuller daily record. The publisher derives baseline entries from the cycle delta (decisions, character shifts, external entity motion, public-layer changes, pending consequences). Your job is to ENRICH the daybook beyond what the delta already implies.",
    "- Provide between 4 and 8 logEntries with the following layer mix as a target:",
    "    * 0 to 1 entries with layer=\"company\" (the baseline already covers most company-internal beats)",
    "    * 1 to 3 entries with layer=\"around\" (specific external entities directly engaging Tallea or its work — named merchants, named beta users by initials, specific outlets, specific operators, specific platforms)",
    "    * 1 to 3 entries with layer=\"ecosystem\" (ambient world motion that does not directly involve Tallea but matters to it — market sentiment, category pressure, competitor moves, investor chatter, regional commerce news, retail chatter, public misreadings of the category, environmental or operational shifts in Buenos Aires apparel)",
    "    * 0 to 2 entries with layer=\"carry_forward\" (latent implications, what this changes next, slow-burn consequences not yet activated)",
    "- Pick the matching kind for each layer. Suggested pairings: company→decision/conversation/internal_shift/operational; around→merchant_signal/trust_signal/press_signal/external_entity_motion; ecosystem→market_drift/category_pressure/public_misreading/external_entity_motion; carry_forward→carry_forward/consequence.",
    "- Visibility is independent of layer. ecosystem entries are usually public, around entries are often mixed, company entries are usually internal, carry_forward is usually internal.",
    "- Ambient/ecosystem entries should be SUBTLE SIGNALS. Not breaking news. A regional retailer hesitates. A competitor posts something defensive. A fit-tech newsletter mentions a different company. An operator group chat circulates a misreading. Argentine apparel margins tighten one notch. These are the texture of a real day in this world.",
    "- Do NOT lore-dump. Each ambient entry must be plausibly relevant to Tallea's current situation, even if Tallea does not act on it today. Do NOT introduce more than one new external entity per cycle. Do NOT swing the broader world hard — most ambient entries should be drifts, not events.",
    "- Do NOT restate the title, trigger, decision, outcome or residue. The baseline already covers those and the publisher will dedupe paraphrases.",
    "- Keep each summary to one or two sentences. Readable, like a quiet company log a careful operator would write at end of day.",
  ].join("\n");

  const userPrompt = [
    `## Cycle to generate: ${cycleId} (day ${day})`,
    "",
    "## Runtime Foundation",
    ctx.runtimeFoundation,
    "",
    "## World Rules (realism canon)",
    ctx.worldRules,
    "",
    "## Cycle Generation Rules",
    ctx.cycleRules,
    "",
    "## Event Types (canonical event catalog)",
    ctx.eventTypes,
    "",
    "## State Schema",
    ctx.stateSchema,
    "",
    "## Current World State (compact)",
    JSON.stringify(compactState, null, 2),
    "",
    "## Recent timeline (last 5)",
    JSON.stringify(ctx.recentTimeline, null, 2),
    ctx.firstCycleSeed
      ? "\n## Day 0 Seed (use this for the first cycle)\n" + ctx.firstCycleSeed
      : "",
    "",
    "Generate exactly one cycle now.",
  ].join("\n");

  const startedAt = Date.now();
  let result;
  try {
    result = await generateObject({
      model,
      schema: CycleSchema,
      system,
      prompt: userPrompt,
      temperature,
    });
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    console.error(
      `[orchestrator:ai] generateObject failed model=${model} after ${elapsed}ms`,
      err,
    );
    throw err;
  }
  const elapsed = Date.now() - startedAt;
  console.log(
    `[orchestrator:ai] generated cycle=${cycleId} day=${day} model=${model} temp=${temperature} in ${elapsed}ms`,
  );

  // The model proposes cycle_id and day, but the orchestrator owns them.
  // We override to avoid drift between generation and persistence.
  return {
    ...(result.object as CycleOutput),
    cycle_id: cycleId,
    day,
  };
}

// ---------------------------------------------------------------------------
// Mock mode (deterministic event templates)
// ---------------------------------------------------------------------------

type EventKind =
  | "merchant_pilot"
  | "catalog_mess"
  | "product_claim"
  | "white_label"
  | "internal_repair"
  | "trust_friction";

const KIND_TITLES: Record<EventKind, string> = {
  merchant_pilot: "Veta says yes, with a deadline",
  catalog_mess: "The catalog arrives, and it is a mess",
  product_claim: "A newsletter calls Tallea 'AI sizing'",
  white_label: "Casa Nimbo wants Tallea behind their brand",
  internal_repair: "The team finally says it out loud",
  trust_friction: "Beta users hesitate at the body-profile flow",
};

/**
 * Detect which mock template was last used by matching the latest cycle's
 * title. Returns null in AI mode (titles diverge) or when no cycle exists.
 */
function detectLastKind(recent: TimelineEvent[]): EventKind | null {
  if (recent.length === 0) return null;
  const last = recent[recent.length - 1];
  for (const k of Object.keys(KIND_TITLES) as EventKind[]) {
    if (last.title === KIND_TITLES[k]) return k;
  }
  return null;
}

function pickEventKind(state: WorldState, recent: TimelineEvent[]): EventKind {
  const day = state.world.day;
  if (day === 0) return "merchant_pilot";

  const lastKind = detectLastKind(recent);
  const cleanup = state.product_state.manual_cleanup_burden;
  const legitimacy = state.company_state.public_legitimacy;
  const runway = state.company_state.runway_pressure;
  const wlInquiry = state.traction_state.merchant_pipeline.white_label_inquiry;

  // Priority overrides — but never repeat the kind that just ran.
  if (
    (cleanup === "high" || cleanup === "unsustainable") &&
    lastKind !== "catalog_mess"
  ) {
    return "catalog_mess";
  }
  if (
    (legitimacy === "rising" || legitimacy === "overexposed") &&
    lastKind !== "product_claim"
  ) {
    return "product_claim";
  }
  if (
    wlInquiry &&
    (runway === "high" || runway === "medium_high") &&
    lastKind !== "white_label"
  ) {
    return "white_label";
  }

  // Rotation, also skipping lastKind so back-to-back duplicates never happen.
  // `trust_friction` is included so the world has a canonical low-stakes,
  // internal-only beat (Camila empowered, no public-facing change). This
  // models the runtime rule "internal change before public change".
  const rot: EventKind[] = [
    "merchant_pilot",
    "trust_friction",
    "internal_repair",
    "product_claim",
    "catalog_mess",
  ];
  const filtered = lastKind ? rot.filter((k) => k !== lastKind) : rot;
  return filtered[day % filtered.length];
}

function generateMock(ctx: CycleContext): CycleOutput {
  const state = ctx.state;
  const day = state.world.day + 1;
  const cycleId = `cycle_${String(day).padStart(3, "0")}`;
  const kind = pickEventKind(state, ctx.recentTimeline);

  switch (kind) {
    case "merchant_pilot": {
      // Realistic progression: a single cycle of "merchant says yes" should
      // move the pipeline forward by one stage at most. Going from
      // `early_interest` directly to `active_pilot` skips the
      // `pilot_conversation` stage that the type system already encodes.
      const currentPipeline = state.traction_state.merchant_pipeline.status;
      const nextPipeline =
        currentPipeline === "early_interest" || currentPipeline === "none"
          ? "pilot_conversation"
          : currentPipeline === "pilot_conversation"
            ? "active_pilot"
            : currentPipeline;

      // Cleanup burden should only escalate, never quietly downgrade. If we
      // were already at `unsustainable`, a new pilot does not magically reduce
      // the backlog.
      const currentCleanup = state.product_state.manual_cleanup_burden;
      const nextCleanup =
        currentCleanup === "unsustainable" ? "unsustainable" : "high";

      const consequence: PendingConsequence = {
        source_event_id: cycleId,
        description:
          "Veta pilot expects fast catalog ingestion that cleanup capacity cannot honestly meet.",
        time_horizon: "short",
        domain: "merchant",
        activation_condition: "Veta delivers measurements late or in mixed formats.",
        status: "pending",
      };
      const delta: WorldStateDelta = {
        traction_state: {
          merchant_pipeline: {
            status: nextPipeline,
            active_pilot_conversations:
              state.traction_state.merchant_pipeline.active_pilot_conversations + 1,
          },
        },
        product_state: { manual_cleanup_burden: nextCleanup },
        external_entities: {
          veta: { status: "active_pilot", pressure: "tighter scope, real deadline" },
        },
        character_states: {
          nicolas_bianchi: { stress: "high_in_motion", influence: "high" },
          rafaela_peralta: {
            stress: "medium_high_accumulating",
            last_major_shift: "Took ownership of Veta catalog cleanup under deadline.",
          },
          matias_roldan: {
            stress: "high_visible",
            last_major_shift: "Pushed back on trousers being in scope.",
          },
        },
        relationship_state: {
          matias_nicolas: "unstable_trust_with_open_disagreement",
        },
        open_tensions_added: ["pilot scope vs catalog reality"],
        pending_consequences_added: [consequence],
      };
      return {
        cycle_id: cycleId,
        day,
        title: "Veta says yes, with a deadline",
        trigger:
          "Veta agrees to a closed pilot on fitted tops and trousers, asking Tallea to handle catalog cleanup inside two weeks.",
        primary_pressure:
          "Merchant proof needs to ship before catalog data is honestly ready.",
        secondary_pressure:
          "Trousers are riskier than tops, but Nicolas wants the broader scope to anchor the case study.",
        internal_translation:
          "Nicolas pulls toward speed and breadth; Matias and Rafaela pull toward narrowing scope; Camila wants to lock consent copy before any live shopper sees the flow.",
        decision_point:
          "Accept the broad pilot now, or narrow scope to fitted tops only.",
        decision_made:
          "Narrow live scope to fitted tops; trousers run as a hidden internal validation track behind the demo.",
        outcome:
          "Tallea has a real merchant in motion. Cleanup capacity becomes the binding constraint of the next two weeks.",
        residue:
          "Matias and Nicolas leave the room without resolving how to talk publicly about the trousers track.",
        next_hooks: [
          "Veta delivers half their catalog late",
          "Camila flags the consent copy as not pilot-ready",
          "An ecosystem operator hears about the pilot and reframes Tallea as 'AI sizing'",
        ],
        threads: [
          {
            thread_id: "veta_pilot",
            title: "Veta closed pilot",
            affected_characters: [
              "lucia_ferrer",
              "nicolas_bianchi",
              "matias_roldan",
              "rafaela_peralta",
              "camila_sosa",
            ],
            status: "opened",
          },
        ],
        state_updates: delta,
        logEntries: [
          {
            kind: "external_entity_motion",
            layer: "around",
            visibility: "mixed",
            summary:
              "Veta's head of e-commerce forwards the pilot scope to two adjacent fitted-apparel founders in Palermo without copying Tallea.",
            actors: ["veta"],
          },
          {
            kind: "category_pressure",
            layer: "ecosystem",
            visibility: "public",
            summary:
              "Argentine apparel returns conversation reappears in two operator newsletters this week — both blame catalog quality, not shopper behavior.",
          },
          {
            kind: "market_drift",
            layer: "ecosystem",
            visibility: "mixed",
            summary:
              "An LP-curious operator group chat asks whether anyone has seen a real apparel-fit pilot ship in Buenos Aires this year.",
          },
          {
            kind: "carry_forward",
            layer: "carry_forward",
            visibility: "internal",
            summary:
              "If Veta delivers their catalog inside two weeks, cleanup capacity becomes the next merchant's first impression.",
            domain: "merchant",
          },
        ],
      };
    }

    case "catalog_mess": {
      const consequence: PendingConsequence = {
        source_event_id: cycleId,
        description:
          "Manual cleanup absorbed by Rafaela hides the absence of repeatable ingestion tooling.",
        time_horizon: "medium",
        domain: "product",
        status: "pending",
      };
      const delta: WorldStateDelta = {
        product_state: { manual_cleanup_burden: "unsustainable" },
        character_states: {
          rafaela_peralta: {
            stress: "high_visible",
            influence: "high_operational_low_symbolic",
            last_major_shift: "Worked through the weekend to stage the demo dataset.",
          },
          matias_roldan: { confidence: "medium_high" },
          nicolas_bianchi: { stress: "high_in_motion" },
        },
        relationship_state: {
          nicolas_rafaela: "dependency_more_visible_resentment_rising",
        },
        open_tensions_added: ["automation story vs visible manual labor"],
        pending_consequences_added: [consequence],
      };
      return {
        cycle_id: cycleId,
        day,
        title: "The catalog arrives, and it is a mess",
        trigger:
          "Veta sends their catalog as a mix of spreadsheets, Instagram screenshots, and WhatsApp voice notes from their head seamstress.",
        primary_pressure:
          "Product reality requires manual judgment that does not scale.",
        secondary_pressure:
          "The pilot demo timeline assumes cleanup that has not been built yet.",
        internal_translation:
          "Rafaela carries the work alone; Matias defends the boundary; Nicolas asks 'what would it take to make this fast?' once too many times.",
        decision_point:
          "Slow the pilot, or absorb the cleanup as undisclosed manual labor and ship on time.",
        decision_made:
          "Absorb the cleanup. Privately log it as technical debt; publicly keep the demo language unchanged.",
        outcome:
          "Demo will land on time. Internal cost has shifted entirely onto Rafaela's calendar.",
        residue:
          "Rafaela is now the single point of failure for the pilot, and the company's own automation story has quietly drifted further from reality.",
        next_hooks: [
          "Rafaela hits a hard limit and a demo slips",
          "An investor asks how the ingestion process actually works",
          "A second merchant arrives expecting the same speed",
        ],
        threads: [
          {
            thread_id: "veta_pilot",
            title: "Veta closed pilot",
            affected_characters: [
              "rafaela_peralta",
              "matias_roldan",
              "nicolas_bianchi",
            ],
            status: "developing",
          },
        ],
        state_updates: delta,
        logEntries: [
          {
            kind: "external_entity_motion",
            layer: "around",
            visibility: "mixed",
            summary:
              "Veta's seamstress sends two voice notes after midnight clarifying measurements her spreadsheet got wrong.",
            actors: ["veta"],
          },
          {
            kind: "category_pressure",
            layer: "ecosystem",
            visibility: "public",
            summary:
              "Two Buenos Aires fitted-denim brands publicly complain about return rates this week. Neither mentions catalog quality.",
          },
          {
            kind: "market_drift",
            layer: "ecosystem",
            visibility: "public",
            summary:
              "MercadoShops releases a generic size-guide widget update. Operator chats read it as defensive against fit-tech upstarts.",
          },
          {
            kind: "carry_forward",
            layer: "carry_forward",
            visibility: "internal",
            summary:
              "Rafaela becomes a single point of failure for the pilot. The next investor question about ingestion will land here.",
            domain: "product",
          },
        ],
      };
    }

    case "product_claim": {
      // A single newsletter mention should move public_legitimacy at most one
      // step up from its current rung, and only if there is somewhere to go.
      // Going from `cold` or `damaged` directly to `rising` would be a leap
      // that the canon "what changes slowly" rules forbid.
      const currentLegitimacy = state.company_state.public_legitimacy;
      const stepUp: Record<typeof currentLegitimacy, typeof currentLegitimacy> = {
        damaged: "cold",
        cold: "fragile_warm",
        fragile_warm: "rising",
        rising: "overexposed",
        overexposed: "overexposed",
      };
      const nextLegitimacy = stepUp[currentLegitimacy];

      const delta: WorldStateDelta = {
        company_state: { public_legitimacy: nextLegitimacy },
        public_layer: {
          category_interpretation: "AI sizing",
          misinterpretation_risk: "the press flattens fit intelligence into AI sizing",
        },
        character_states: {
          lucia_ferrer: {
            confidence: "medium_high",
            last_major_shift: "Press mention reshaped her week.",
          },
          camila_sosa: { stress: "medium_high" },
          matias_roldan: { stress: "high_visible" },
        },
        open_tensions_added: ["public clarity vs product truth"],
        pending_consequences_added: [
          {
            source_event_id: cycleId,
            description:
              "A public 'AI sizing' framing is now circulating that Tallea did not author and may not be able to live up to.",
            time_horizon: "medium",
            domain: "reputation",
            status: "pending",
          },
        ],
      };
      return {
        cycle_id: cycleId,
        day,
        title: "A newsletter calls Tallea 'AI sizing'",
        trigger:
          "LatAm Operators Brief covers Tallea in a roundup and reduces the company to 'Buenos Aires AI-sizing startup attacks apparel returns.'",
        primary_pressure:
          "Attention simplifies the company faster than the team can correct.",
        secondary_pressure:
          "Inbound merchant interest spikes from people expecting a product Tallea does not have yet.",
        internal_translation:
          "Lucia accepts the attention quietly; Matias drafts a public limits page nobody asked for; Camila wants to put consent and accuracy language directly on the homepage.",
        decision_point:
          "Embrace the simplification, or actively correct it on the public site.",
        decision_made:
          "Add a 'what Tallea is and is not' section to the site; do not publicly correct the newsletter.",
        outcome:
          "Public legitimacy edges up. The public copy is one inch closer to honest, but the framing risk persists.",
        residue:
          "The company is now described in language it cannot fully control. Future merchant conversations will start from that framing.",
        next_hooks: [
          "An investor takes a meeting expecting the AI-sizing pitch",
          "A high-confidence rec fails publicly",
          "A second outlet repeats the framing",
        ],
        threads: [
          {
            thread_id: "public_framing",
            title: "Public framing of Tallea",
            affected_characters: [
              "lucia_ferrer",
              "matias_roldan",
              "camila_sosa",
            ],
            status: "opened",
          },
        ],
        state_updates: delta,
        logEntries: [
          {
            kind: "public_misreading",
            layer: "ecosystem",
            visibility: "public",
            summary:
              "A Spanish-language operator newsletter copies the LatAm Operators Brief framing one day later and adds 'computer vision' to the description, which Tallea does not use.",
          },
          {
            kind: "external_entity_motion",
            layer: "around",
            visibility: "mixed",
            summary:
              "Three cold inbound emails arrive expecting Tallea to be 'AI sizing as a SaaS'. Two are from outside Argentina.",
          },
          {
            kind: "market_drift",
            layer: "ecosystem",
            visibility: "public",
            summary:
              "A US fit-tech startup announces a Series A the same morning. Argentine operator chatter reads Tallea into that storyline whether Tallea wants it or not.",
          },
          {
            kind: "carry_forward",
            layer: "carry_forward",
            visibility: "internal",
            summary:
              "Future merchant calls will start from the AI-sizing framing. The first time Tallea has to correct it inside a sales conversation is a beat that has not arrived yet.",
            domain: "reputation",
          },
        ],
      };
    }

    case "white_label": {
      const delta: WorldStateDelta = {
        company_state: {
          strategic_identity: "contested",
          internal_alignment: "openly_split",
        },
        external_entities: {
          casa_nimbo: {
            status: "formal_white_label_proposal",
            pressure: "infrastructure path with attractive economics",
          },
        },
        character_states: {
          lucia_ferrer: { last_major_shift: "Spent two days with Casa Nimbo." },
          nicolas_bianchi: { confidence: "high_external_brittle_internal" },
          camila_sosa: {
            stress: "high_visible",
            last_major_shift: "Wrote a memo arguing white-label kills the user promise.",
          },
        },
        relationship_state: {
          camila_nicolas: "openly_strained",
          lucia_camila: "trust_under_visible_strain",
        },
        open_tensions_added: ["user-facing identity vs infrastructure economics"],
        pending_consequences_added: [
          {
            source_event_id: cycleId,
            description:
              "If Casa Nimbo is accepted, the public site will need to be rewritten or quietly downgraded.",
            time_horizon: "short",
            domain: "strategy",
            status: "pending",
          },
        ],
      };
      return {
        cycle_id: cycleId,
        day,
        title: "Casa Nimbo wants Tallea behind their brand",
        trigger:
          "Casa Nimbo formalizes a white-label proposal: Tallea fit guidance shipped under their UI, with multi-merchant economics attached.",
        primary_pressure:
          "Revenue and scale arrive in the same envelope as identity erasure.",
        secondary_pressure:
          "Saying yes solves runway; saying no may shrink Tallea's leverage with Argentine merchants.",
        internal_translation:
          "Lucia is energized; Nicolas is closer to yes than he admits; Camila writes a memo arguing this is the user-promise breaking point; Matias treats it as a multi-tenant integration risk; Rafaela asks who cleans whose catalog.",
        decision_point:
          "Accept, decline, or counter with a co-branded pilot.",
        decision_made:
          "Counter with a co-branded structure that preserves a Tallea-visible surface inside Casa Nimbo's UI.",
        outcome:
          "The deal is alive but smaller. Internal alignment is now openly split.",
        residue:
          "Camila is meaningfully less aligned with Lucia than yesterday. The team has named the identity question out loud for the first time.",
        next_hooks: [
          "Casa Nimbo declines the counter",
          "Camila asks for a written commitment to the user-facing layer",
          "An investor pushes the white-label story harder",
        ],
        threads: [
          {
            thread_id: "casa_nimbo_white_label",
            title: "Casa Nimbo white-label proposal",
            affected_characters: [
              "lucia_ferrer",
              "nicolas_bianchi",
              "camila_sosa",
              "matias_roldan",
            ],
            status: "opened",
          },
        ],
        state_updates: delta,
        logEntries: [
          {
            kind: "external_entity_motion",
            layer: "around",
            visibility: "mixed",
            summary:
              "Casa Nimbo's product lead schedules a follow-up the same week and asks whether Tallea's name would appear in the URL.",
            actors: ["casa_nimbo"],
          },
          {
            kind: "market_drift",
            layer: "ecosystem",
            visibility: "public",
            summary:
              "Latin American DTC apparel funding tightens another notch. Two regional white-label vendors put out case studies the same afternoon.",
          },
          {
            kind: "category_pressure",
            layer: "ecosystem",
            visibility: "mixed",
            summary:
              "An operator angel pings Lucia privately to argue that infrastructure is the only durable apparel-tech moat in this region.",
          },
          {
            kind: "carry_forward",
            layer: "carry_forward",
            visibility: "internal",
            summary:
              "If Casa Nimbo accepts the counter, the homepage will need a structural rewrite within two cycles. If they decline, Camila's user-promise memo becomes the de facto strategy doc.",
            domain: "strategy",
          },
        ],
      };
    }

    case "trust_friction": {
      // Canonical low-stakes, internal-only beat. Empowers Camila, moves
      // user_beta.completion, leaves no public-facing change. Models the
      // runtime rule "internal change before public change".
      const delta: WorldStateDelta = {
        traction_state: {
          user_beta: {
            completion: "uneven",
            main_blocker: "body-profile intimacy and flow length",
          },
        },
        character_states: {
          camila_sosa: {
            stress: "medium_high",
            influence: "medium_high_trust",
            last_major_shift:
              "Walked the team through three drop-off points in the body-profile flow.",
          },
          nicolas_bianchi: {
            last_major_shift:
              "Pushed back on adding a consent screen before checkout for pilot users.",
          },
        },
        relationship_state: {
          camila_nicolas: "openly_strained",
        },
        open_tensions_added: ["consent friction vs onboarding completion"],
        pending_consequences_added: [
          {
            source_event_id: cycleId,
            description:
              "If consent copy is rushed to lift completion, a future trust incident will trace back here.",
            time_horizon: "medium",
            domain: "trust",
            status: "pending",
          },
        ],
      };
      return {
        cycle_id: cycleId,
        day,
        title: "Beta users hesitate at the body-profile flow",
        trigger:
          "Camila brings completion data to the team: three quarters of beta users start the body-profile flow, fewer than half finish it, and the drop-off concentrates exactly where measurement language gets specific.",
        primary_pressure:
          "Trust costs friction; friction costs completion.",
        secondary_pressure:
          "Nicolas wants completion to look better before the next merchant call.",
        internal_translation:
          "Camila refuses to call the consent screen 'overhead'. Nicolas calls it 'one obstacle too many'. Lucia stays quiet. Matias asks whether the model is even confident on the segments that do complete.",
        decision_point:
          "Trim the consent screen for the next pilot, or hold the line and accept the lower completion number for one more cycle.",
        decision_made:
          "Hold the line for one more cycle. Camila will rewrite the consent copy, not remove it.",
        outcome:
          "Nothing visible to the public changes. The user-trust posture is preserved at a measurable cost to short-term completion.",
        residue:
          "Camila and Nicolas now disagree out loud about how much friction the user is allowed to feel. The disagreement was previously polite.",
        next_hooks: [
          "Camila ships rewritten consent copy and completion does not improve",
          "A merchant asks why beta completion is lower than they expected",
          "Nicolas raises the friction question again at a more loaded moment",
        ],
        threads: [
          {
            thread_id: "user_trust",
            title: "Body-profile trust and completion",
            affected_characters: [
              "camila_sosa",
              "nicolas_bianchi",
              "lucia_ferrer",
              "matias_roldan",
            ],
            status: "developing",
          },
        ],
        state_updates: delta,
        logEntries: [
          {
            kind: "external_entity_motion",
            layer: "around",
            visibility: "mixed",
            summary:
              "Two beta users send unprompted notes thanking Tallea for explaining what the body-profile measurements are used for. Neither finished the flow.",
          },
          {
            kind: "category_pressure",
            layer: "ecosystem",
            visibility: "public",
            summary:
              "Argentine consumer-rights coverage runs a piece on body-data collection by retailers this week. It does not mention Tallea by name; the framing is unfriendly to the category.",
          },
          {
            kind: "market_drift",
            layer: "ecosystem",
            visibility: "public",
            summary:
              "A US-based fit-tech competitor quietly removes 'AI body model' language from its homepage. Operator chats notice within hours.",
          },
          {
            kind: "carry_forward",
            layer: "carry_forward",
            visibility: "internal",
            summary:
              "If Camila's rewritten consent copy does not lift completion next cycle, the friction-vs-completion argument becomes structural rather than editorial.",
            domain: "trust",
          },
        ],
      };
    }

    case "internal_repair":
    default: {
      // A single non-agenda meeting should not collapse a fracture. Only
      // step up by one rung, and never above `functional_but_split` (full
      // alignment requires structural follow-through, not a conversation).
      const currentAlignment = state.company_state.internal_alignment;
      const repaired: typeof currentAlignment =
        currentAlignment === "fractured"
          ? "openly_split"
          : currentAlignment === "openly_split"
            ? "functional_but_split"
            : currentAlignment;

      const delta: WorldStateDelta = {
        company_state:
          repaired !== currentAlignment
            ? { internal_alignment: repaired }
            : {},
        character_states: {
          lucia_ferrer: { last_major_shift: "Acknowledged the identity question publicly inside the team." },
          camila_sosa: { stress: "medium" },
          rafaela_peralta: { last_major_shift: "Said out loud that her work is what is shipping." },
        },
        relationship_state: {
          lucia_rafaela: "explicit_recognition_of_operational_reality",
        },
        open_tensions_removed: [],
      };
      return {
        cycle_id: cycleId,
        day,
        title: "The team finally says it out loud",
        trigger:
          "After a week of accumulating residue, Camila calls a non-agenda meeting and asks the question nobody has been asking: who is Tallea actually building for.",
        primary_pressure:
          "Productivity has been substituting for clarity.",
        secondary_pressure:
          "Two simultaneous merchant conversations have been pulling the company in different directions.",
        internal_translation:
          "The conversation does not resolve the strategic question. It does name it. Lucia admits she has been letting it stay ambiguous on purpose.",
        decision_point:
          "Force a resolution now, or schedule a structured strategy week.",
        decision_made:
          "Schedule a structured strategy week. Continue both pilots in parallel until then.",
        outcome:
          "The team is more honest with itself. No external situation has changed.",
        residue:
          "Honesty without resolution leaves the next set of decisions slightly heavier.",
        next_hooks: [
          "Strategy week forces a vote",
          "A pilot demands a decision before strategy week",
          "Lucia cancels strategy week under runway pressure",
        ],
        threads: [
          {
            thread_id: "strategic_identity",
            title: "Strategic identity",
            affected_characters: [
              "lucia_ferrer",
              "camila_sosa",
              "rafaela_peralta",
            ],
            status: "developing",
          },
        ],
        state_updates: delta,
        logEntries: [
          {
            kind: "market_drift",
            layer: "ecosystem",
            visibility: "public",
            summary:
              "A regional commerce conference posts its agenda. Three sessions this year are about apparel returns; none about catalogs.",
          },
          {
            kind: "category_pressure",
            layer: "ecosystem",
            visibility: "public",
            summary:
              "Fit-tech as a category gets quietly reframed by an industry analyst as 'returns-driven retention tooling'. The framing helps merchants and complicates Tallea's user-led story.",
          },
          {
            kind: "carry_forward",
            layer: "carry_forward",
            visibility: "internal",
            summary:
              "Strategy week will arrive with a different external context than the team is currently planning for.",
            domain: "strategy",
          },
        ],
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

export async function generateCycleOutput(
  ctx: CycleContext,
): Promise<CycleOutput> {
  if (getCycleMode() === "ai") {
    try {
      return await generateWithAI(ctx);
    } catch (err) {
      console.error("[orchestrator] AI generation failed, falling back to mock:", err);
      return generateMock(ctx);
    }
  }
  return generateMock(ctx);
}

export interface RunCycleResult {
  cycleOutput: CycleOutput;
  nextState: WorldState;
  timelineEvent: TimelineEvent;
  logEntries: WorldLogEntry[];
  projection: SiteProjection;
  mode: CycleMode;
}

/**
 * Run a single cycle: load state, generate, persist, project. Single entry
 * point for /admin and the cron route.
 *
 * Generation is the only step where the AI model is involved; everything
 * downstream (delta application, realism clamps, timeline, daybook,
 * projection) is deterministic.
 */
export async function runWorldCycle(): Promise<RunCycleResult> {
  let state = await loadCurrentWorldState();
  if (!state) {
    state = loadInitialState();
    if (!state) {
      throw new Error("No initial state found at data/seed/initial_state.json");
    }
  }

  const ctx = buildCycleContext(state);
  const cycleOutput = await generateCycleOutput(ctx);
  writeCycleOutput(cycleOutput);
  const { nextState, timelineEvent, logEntries } = applyAndPersistCycle(
    state,
    cycleOutput,
  );
  const projection = deriveProjection(nextState);

  return {
    cycleOutput,
    nextState,
    timelineEvent,
    logEntries,
    projection,
    mode: getCycleMode(),
  };
}
