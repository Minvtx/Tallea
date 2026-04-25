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
 */

import type {
  CycleOutput,
  PendingConsequence,
  SiteProjection,
  TimelineEvent,
  WorldState,
  WorldStateDelta,
} from "@/types/world";
import {
  loadCurrentWorldState,
  loadCycleRules,
  loadFirstCycleSeed,
  loadInitialState,
  loadRuntimeFoundation,
  loadStateSchema,
  loadTimeline,
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
    recentTimeline: recent,
    firstCycleSeed: state.world.day === 0 ? loadFirstCycleSeed() : undefined,
  };
}

// ---------------------------------------------------------------------------
// Mode selection
// ---------------------------------------------------------------------------

export type CycleMode = "mock" | "ai";

export function getCycleMode(): CycleMode {
  if (
    process.env.TALLEA_ENABLE_AI === "true" &&
    (process.env.AI_GATEWAY_API_KEY ?? "").length > 0
  ) {
    return "ai";
  }
  return "mock";
}

// ---------------------------------------------------------------------------
// AI mode (real generation)
// ---------------------------------------------------------------------------

async function generateWithAI(ctx: CycleContext): Promise<CycleOutput> {
  // Lazy import so mock mode never pulls in the AI SDK
  const { generateObject } = await import("ai");
  const { z } = await import("zod");

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

  const prompt = [
    "You are the orchestrator for a persistent simulated startup world named Tallea.",
    "Generate the next cycle as a CycleOutput object that conforms to the schema.",
    "",
    "## Runtime Foundation",
    ctx.runtimeFoundation,
    "",
    "## Cycle Generation Rules",
    ctx.cycleRules,
    "",
    "## State Schema",
    ctx.stateSchema,
    "",
    `## Cycle ID: ${cycleId} (day ${day})`,
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
    "Generate exactly one cycle. The state_updates delta must touch at least one character and at least one strategic field. Add at least one pending_consequence unless none would be honest.",
  ].join("\n");

  const result = await generateObject({
    model: "openai/gpt-5-mini",
    schema: CycleSchema,
    prompt,
  });

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
  | "internal_repair";

function pickEventKind(state: WorldState): EventKind {
  const day = state.world.day;
  if (day === 0) return "merchant_pilot";

  const cleanup = state.product_state.manual_cleanup_burden;
  const legitimacy = state.company_state.public_legitimacy;
  const runway = state.company_state.runway_pressure;
  const wlInquiry = state.traction_state.merchant_pipeline.white_label_inquiry;

  if (cleanup === "high" || cleanup === "unsustainable") return "catalog_mess";
  if (legitimacy === "rising" || legitimacy === "overexposed")
    return "product_claim";
  if (wlInquiry && (runway === "high" || runway === "medium_high"))
    return "white_label";

  // rotate
  const rot: EventKind[] = [
    "merchant_pilot",
    "internal_repair",
    "product_claim",
    "catalog_mess",
  ];
  return rot[day % rot.length];
}

function generateMock(ctx: CycleContext): CycleOutput {
  const state = ctx.state;
  const day = state.world.day + 1;
  const cycleId = `cycle_${String(day).padStart(3, "0")}`;
  const kind = pickEventKind(state);

  switch (kind) {
    case "merchant_pilot": {
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
            status: "active_pilot",
            active_pilot_conversations:
              state.traction_state.merchant_pipeline.active_pilot_conversations + 1,
          },
        },
        product_state: { manual_cleanup_burden: "high" },
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
      };
    }

    case "product_claim": {
      const delta: WorldStateDelta = {
        company_state: { public_legitimacy: "rising" },
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
      };
    }

    case "internal_repair":
    default: {
      const delta: WorldStateDelta = {
        company_state: { internal_alignment: "functional_but_split" },
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
  projection: SiteProjection;
  mode: CycleMode;
}

/**
 * Run a single cycle: load state, generate, persist, project. Single entry
 * point for /admin and the cron route.
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
  const { nextState, timelineEvent } = applyAndPersistCycle(state, cycleOutput);
  const projection = deriveProjection(nextState);

  return {
    cycleOutput,
    nextState,
    timelineEvent,
    projection,
    mode: getCycleMode(),
  };
}
