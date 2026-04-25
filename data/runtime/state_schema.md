# State Schema

## Purpose
Use this schema to keep persistent state coherent across cycles.
Values may be qualitative unless the implementation later requires numbers.

## Top-Level Objects
- `world`
- `company_state`
- `product_state`
- `traction_state`
- `character_states`
- `relationship_state`
- `open_tensions`
- `active_events`
- `pending_consequences`
- `public_layer`

## Company State
- `strategic_identity`: user_led | merchant_led | infrastructure_pulled | contested
- `runway_pressure`: low | medium | medium_high | high | critical
- `public_legitimacy`: cold | fragile_warm | rising | overexposed | damaged
- `internal_alignment`: aligned | functional_but_split | openly_split | fractured
- `merchant_dependence`: low | medium | high
- `user_trust_position`: untested | fragile | improving | strained | damaged

## Product State
- `health`: prototype | narrowly_useful_but_brittle | pilot_ready | overextended | damaged
- `manual_cleanup_burden`: low | medium | high | unsustainable
- `catalog_readiness`: poor | uneven | acceptable | strong
- `profile_completion`: low | uneven | improving | strong
- `confidence_accuracy_by_category`: map of category to low | medium_low | medium | medium_high | high
- `unsupported_claims`: list of claims the system must not make

## Traction State
- `user_beta.status`: not_started | small_controlled_beta | expanding | stalled
- `user_beta.completion`: low | uneven | improving | strong
- `merchant_pipeline.status`: none | early_interest | active_pilot | paid_pilot | stalled
- `merchant_pipeline.active_pilot_conversations`: integer
- `merchant_pipeline.white_label_inquiry`: boolean
- `ecosystem_signal.status`: cold | warm_but_fragile | rising | overhyped | negative

## Character State
Each character should track:
- `confidence`
- `stress`
- `influence`
- `alignment`
- `trust_condition`
- `visibility`
- `hidden_pressure`
- `destabilizer`
- `last_major_shift`

Use qualitative values, but update them after every cycle that affects the character.

## Relationship State
Track important relationships as named pairs:
- status
- tension_level: low | medium | high | critical
- trust_direction: mutual | asymmetric | unstable | damaged
- last_event_affecting_relationship

## Event State
Each active or recent event should track:
- `event_id`
- `event_type`
- `trigger`
- `primary_pressure`
- `affected_characters`
- `public_effect`
- `internal_effect`
- `state_changes`
- `pending_consequences`

## Consequence State
Each pending consequence should track:
- `source_event_id`
- `description`
- `time_horizon`: immediate | short | medium | long
- `domain`: product | trust | merchant | reputation | runway | relationship | strategy
- `activation_condition`
- `status`: pending | activated | resolved | transformed

## Update Rule
Every generated cycle must update at least one state object.
Avoid cycles that create only scene texture without state movement.

