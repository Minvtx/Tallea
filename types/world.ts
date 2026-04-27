/**
 * Tallea world types.
 *
 * Mirrors data/runtime/state_schema.md. Qualitative scales are unioned strings
 * so the orchestrator (mock or AI) can produce typed deltas without numeric
 * commitment.
 */

// ---------------------------------------------------------------------------
// Qualitative scales
// ---------------------------------------------------------------------------

export type StrategicIdentity =
  | "user_led"
  | "merchant_led"
  | "infrastructure_pulled"
  | "contested"
  | "externally_clear_internally_contested";

export type RunwayPressure = "low" | "medium" | "medium_high" | "high" | "critical";

export type PublicLegitimacy =
  | "cold"
  | "fragile_warm"
  | "rising"
  | "overexposed"
  | "damaged";

export type InternalAlignment =
  | "aligned"
  | "functional_but_split"
  | "openly_split"
  | "fractured";

export type MerchantDependence = "low" | "medium" | "high";
export type UserTrustPosition =
  | "untested"
  | "fragile"
  | "improving"
  | "strained"
  | "damaged";

export type ProductHealth =
  | "prototype"
  | "narrowly_useful_but_brittle"
  | "pilot_ready"
  | "overextended"
  | "damaged";

export type CleanupBurden = "low" | "medium" | "high" | "unsustainable";
export type CatalogReadiness = "poor" | "uneven" | "acceptable" | "strong";
export type ProfileCompletion = "low" | "uneven" | "improving" | "strong";
export type ConfidenceLevel =
  | "low"
  | "medium_low"
  | "medium"
  | "medium_high"
  | "high";

export type UserBetaStatus =
  | "not_started"
  | "small_controlled_beta"
  | "expanding"
  | "stalled";

export type MerchantPipelineStatus =
  | "none"
  | "early_interest"
  | "active_pilot"
  | "paid_pilot"
  | "stalled"
  | "pilot_conversation";

export type EcosystemSignalStatus =
  | "cold"
  | "warm_but_fragile"
  | "rising"
  | "overhyped"
  | "negative";

export type StressLevel =
  | "low"
  | "medium"
  | "medium_high"
  | "high_controlled"
  | "high_visible"
  | "high_in_motion"
  | "medium_high_accumulating";

export type InfluenceLevel =
  | "low"
  | "medium"
  | "medium_high"
  | "high"
  | "very_high_narrative"
  | "high_technical_claims"
  | "high_when_pilots_or_runway_dominate"
  | "high_operational_low_symbolic"
  | "high_external_brittle_internal"
  | "medium_high_trust";

// ---------------------------------------------------------------------------
// Sub-objects
// ---------------------------------------------------------------------------

export interface CompanyState {
  company_name: string;
  category: string;
  public_promise: string;
  initial_wedge: string;
  strategic_identity: StrategicIdentity | string;
  runway_pressure: RunwayPressure;
  public_legitimacy: PublicLegitimacy;
  internal_alignment: InternalAlignment;
  merchant_dependence?: MerchantDependence;
  user_trust_position?: UserTrustPosition;
}

export interface ProductState {
  health: ProductHealth | string;
  reliable_capabilities: string[];
  inconsistent_capabilities: string[];
  unsupported_claims: string[];
  manual_cleanup_burden: CleanupBurden;
  catalog_readiness?: CatalogReadiness;
  profile_completion?: ProfileCompletion;
  confidence_accuracy_by_category: Record<string, ConfidenceLevel | string>;
}

export interface UserBetaState {
  status: UserBetaStatus | string;
  curiosity?: ConfidenceLevel | string;
  completion: ProfileCompletion | string;
  main_blocker?: string;
}

export interface MerchantPipelineState {
  status: MerchantPipelineStatus | string;
  active_pilot_conversations: number;
  white_label_inquiry: boolean;
  dominant_pressure?: string;
}

export interface EcosystemSignalState {
  status: EcosystemSignalStatus | string;
  source?: string;
  risk?: string;
}

export interface TractionState {
  user_beta: UserBetaState;
  merchant_pipeline: MerchantPipelineState;
  ecosystem_signal: EcosystemSignalState;
}

export interface PublicPerceptionState {
  website_positioning: string;
  allowed_claim_style: string;
  forbidden_claims: string[];
  category_interpretation?: string;
  misinterpretation_risk?: string;
}

export type ExternalEntityType =
  | "merchant"
  | "operator_angel"
  | "commerce_operator"
  | "ecosystem_event"
  | "press"
  | "competitor"
  | "platform"
  | "investor";

export interface ExternalEntity {
  type: ExternalEntityType | string;
  status: string;
  pressure: string;
}

export interface CharacterState {
  role: string;
  confidence: ConfidenceLevel | string;
  stress: StressLevel | string;
  influence: InfluenceLevel | string;
  alignment: string;
  trust_condition?: string;
  visibility?: string;
  hidden_pressure?: string;
  destabilizer: string;
  last_major_shift?: string;
}

export type RelationshipValue = string;

export interface PendingConsequence {
  source_event_id: string;
  description: string;
  time_horizon: "immediate" | "short" | "medium" | "long";
  domain:
    | "product"
    | "trust"
    | "merchant"
    | "reputation"
    | "runway"
    | "relationship"
    | "strategy";
  activation_condition?: string;
  status: "pending" | "activated" | "resolved" | "transformed";
}

export interface WorldHeader {
  name: string;
  day: number;
  location: string;
  phase: string;
  core_question: string;
}

// ---------------------------------------------------------------------------
// Top-level state
// ---------------------------------------------------------------------------

export interface WorldState {
  world: WorldHeader;
  company_state: CompanyState;
  product_state: ProductState;
  traction_state: TractionState;
  public_layer: PublicPerceptionState;
  external_entities: Record<string, ExternalEntity>;
  character_states: Record<string, CharacterState>;
  relationship_state: Record<string, RelationshipValue>;
  open_tensions: string[];
  active_events: string[];
  pending_consequences: PendingConsequence[];
  first_cycle_seed?: string;
}

// ---------------------------------------------------------------------------
// Cycle output (orchestrator emits this every cycle)
// ---------------------------------------------------------------------------

export interface WorldStateDelta {
  world?: Partial<WorldHeader>;
  company_state?: Partial<CompanyState>;
  product_state?: Partial<ProductState>;
  traction_state?: {
    user_beta?: Partial<UserBetaState>;
    merchant_pipeline?: Partial<MerchantPipelineState>;
    ecosystem_signal?: Partial<EcosystemSignalState>;
  };
  public_layer?: Partial<PublicPerceptionState>;
  external_entities?: Record<string, Partial<ExternalEntity>>;
  character_states?: Record<string, Partial<CharacterState>>;
  relationship_state?: Record<string, RelationshipValue>;
  open_tensions_added?: string[];
  open_tensions_removed?: string[];
  pending_consequences_added?: PendingConsequence[];
}

export interface NarrativeThread {
  thread_id: string;
  title: string;
  affected_characters: string[];
  status: "opened" | "developing" | "resolved" | "deferred";
}

export interface CycleOutput {
  cycle_id: string;
  day: number;
  title: string;
  trigger: string;
  primary_pressure: string;
  secondary_pressure: string;
  internal_translation: string;
  decision_point: string;
  decision_made: string;
  outcome: string;
  residue: string;
  next_hooks: string[];
  threads: NarrativeThread[];
  state_updates: WorldStateDelta;
  /**
   * Optional finer-grained daily log entries the orchestrator (mock or AI)
   * can attach to enrich the public daybook beyond the headline timeline.
   *
   * The deterministic publishing layer always derives a baseline set of
   * WorldLogEntries from the cycle (decision, residue, consequences, public
   * shifts). Anything in `logEntries` here is merged on top so the model
   * can add color without owning the canonical record.
   */
  logEntries?: CycleLogEntryInput[];
}

// ---------------------------------------------------------------------------
// World log / Daybook (fuller daily record beyond the highlight timeline)
//
// timeline.json   = one TimelineEvent per cycle (the headline)
// log.json        = many WorldLogEntry per cycle (the daybook)
// ---------------------------------------------------------------------------

export type WorldLogVisibility = "internal" | "public" | "mixed";

/**
 * Where in the world this beat is happening. Orthogonal to visibility.
 *
 *  - company:       inside Tallea (decisions, conversations, internal shifts)
 *  - around:        around Tallea (specific external entities directly
 *                   engaging — Veta, Casa Nimbo, beta users, named outlets)
 *  - ecosystem:     wider ambient world (market sentiment, category drift,
 *                   competitor moves, investor chatter, regional context)
 *  - carry_forward: latent consequences and what this changes next
 */
export type WorldLogLayer = "company" | "around" | "ecosystem" | "carry_forward";

export type WorldLogKind =
  | "decision"
  | "conversation"
  | "merchant_signal"
  | "product_change"
  | "trust_signal"
  | "press_signal"
  | "internal_shift"
  | "operational"
  | "consequence"
  // Ambient/world-motion kinds
  | "external_entity_motion"
  | "market_drift"
  | "category_pressure"
  | "public_misreading"
  | "carry_forward";

export type WorldLogDomain = PendingConsequence["domain"];

/**
 * A single entry in the world log / daybook.
 * Persisted append-only in data/log.json.
 */
export interface WorldLogEntry {
  id: string; // `${cycle_id}_log_${idx}` — stable per cycle
  cycle_id: string;
  day: number;
  kind: WorldLogKind;
  layer: WorldLogLayer;
  visibility: WorldLogVisibility;
  summary: string;
  actors?: string[];
  domain?: WorldLogDomain;
  source: "derived" | "model"; // baseline derivation vs orchestrator-attached
}

/**
 * Shape the orchestrator (mock or AI) may attach to a CycleOutput.
 * The publishing layer assigns id/cycle_id/day before persisting.
 */
export interface CycleLogEntryInput {
  kind: WorldLogKind;
  layer: WorldLogLayer;
  visibility: WorldLogVisibility;
  summary: string;
  actors?: string[];
  domain?: WorldLogDomain;
}

// ---------------------------------------------------------------------------
// Timeline (compact append-only log for /timeline page)
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  cycle_id: string;
  day: number;
  title: string;
  trigger: string;
  outcome: string;
  residue: string;
  affected_characters: string[];
  carries_forward: string[];
  primary_pressure: string;
}

// ---------------------------------------------------------------------------
// Public projection (publisher.ts builds this from WorldState)
// ---------------------------------------------------------------------------

export interface SiteProjection {
  headline: string;
  positioning: string;
  tone: "calm" | "confident" | "guarded" | "constrained";
  allowed_claims: string[];
  forbidden_claims: string[];
  bonus_claims: string[];
  cta_label: string;
  cta_intent: "shopper" | "merchant" | "muted";
  show_press_quote: boolean;
}
