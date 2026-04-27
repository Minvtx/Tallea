# Cycle Generation Rules

## Purpose
Use this document to generate Day 1 and future runtime cycles.
A cycle is a bounded unit of narrative progression that changes state.

## Required Cycle Shape
Each cycle must include:
- **Trigger:** What starts the cycle.
- **Primary pressure:** The main force acting on Tallea.
- **Secondary pressure:** A different force that complicates the first.
- **Internal translation:** How the outside pressure becomes team conflict.
- **Decision point:** What the team must choose, delay, expose, or hide.
- **Outcome:** What changes immediately.
- **Residue:** What remains unresolved or becomes harder.
- **State updates:** Which runtime fields changed.
- **Next hooks:** 1-3 possible future cycle openings.

## Good Cycle Behavior
- External opportunity should reveal internal disagreement.
- Progress should create obligations.
- Public clarity should risk outrunning product truth.
- Merchant wins should create support, catalog, trust, or roadmap burden.
- Product failures should affect confidence, relationships, or public claims.
- Character power should shift depending on pressure type.

## Early Cycle Priorities
Use these before introducing larger ecosystem complexity:
1. Closed merchant pilot
2. Messy catalog ingestion
3. Body-profile completion drop-off
4. Consent or privacy wording conflict
5. White-label request
6. Demo-driven overexpectation
7. High-confidence recommendation failure
8. Small press/newsletter mention

## Character Pressure Routing
- **Merchant pilot:** empowers Nicolas; pressures Matias, Rafaela, and Camila.
- **Technical failure:** empowers Matias; exposes Lucia and Nicolas.
- **Consent/privacy friction:** empowers Camila; pressures Lucia and Nicolas.
- **Catalog mess:** empowers Rafaela; delays Nicolas; validates Matias.
- **Public attention:** empowers Lucia; risks overclaim; stresses Matias and Camila.
- **Runway pressure:** empowers Nicolas and Lucia; pressures everyone to accept compromise.

## Consequence Rules
- Every merchant win adds operational burden.
- Every public claim creates future reputational liability.
- Every shortcut should create a delayed cost.
- Every internal conflict should leave relationship residue unless explicitly repaired.
- Every external validation should clarify one thing and obscure another.

## Avoid
- Clean wins with no cost.
- Total failure that collapses the group too early.
- Generic startup beats not tied to fit, catalogs, body data, merchant pilots, or Argentine commerce reality.
- Introducing major new entities before Day 0 pressures have paid off.
- Solving strategic identity too soon.

## Scale and Pacing
This is the most important section. The system has been observed making implausible jumps when this is not enforced.

- **One cycle equals one in-universe day.** Whatever happens in a cycle must fit inside a single working day in a five-person Argentine startup.
- **Most cycles should advance a thread, not conclude one.** Threads should run across multiple cycles before resolving.
- **Public narrative lags internal state.** A single internal conversation does not change the website. A single bad recommendation does not damage public legitimacy. A single press mention does not move the company from `cold` to `rising`.
- **Big outcomes require buildup.** A signed pilot follows pilot conversations. A press explosion follows a smaller mention. A platform deal follows a platform inquiry. A team fracture follows multiple cycles of accumulated residue.
- **Pressure usually accumulates rather than resolves.** Most cycles should leave at least one tension worse than they found it.
- **Internal changes typically happen before public ones.** Strategy doubt, relationship strain, and product-truth slips should be visible inside the team for one or more cycles before they become visible publicly.

## Forbidden Single-Cycle Moves (too soon / too large)
Unless prior cycles explicitly built up to it:
- Going from no merchant pilot to a signed paid pilot in one cycle.
- Moving `public_legitimacy` more than one step in either direction in one cycle.
- Moving `runway_pressure` more than one step in either direction in one cycle.
- Moving `internal_alignment` more than one step in one cycle.
- Major press, acquisition rumors, large fundraising, or platform deals appearing without any prior signal in recent cycles.
- A single conversation fully repairing a previously fractured relationship.
- A single recommendation failure permanently damaging public legitimacy.
- Adding a new external entity that is already at "active partnership" without a prior cycle introducing them.

## Buildup Requirements
Before a cycle generates any of these outcomes, the recent timeline (or pending consequences) must show at least one prior signal:
- **Active or paid pilot:** requires at least one prior `merchant_pilot` or pilot-conversation cycle.
- **Public legitimacy `rising`:** requires at least one prior public-attention or product-claim cycle.
- **Public legitimacy `overexposed`:** requires legitimacy already at `rising` and at least one cycle of further attention.
- **Strategic identity `merchant_led` or `infrastructure_pulled`:** requires at least one prior white-label or platform-interest cycle.
- **Internal alignment `fractured`:** requires at least two prior cycles of unresolved tension between the same characters.
- **Recommendation failure with reputation damage:** requires the system to have previously claimed confidence in that exact category.

## Pacing Test (apply before accepting any cycle)
Ask:
- Could this realistically happen in one day, given the company's current size, runway, network, and stage?
- Is anything in this cycle "too large" without prior cycles to support it?
- Did the cycle advance a thread rather than conclude one?
- Did the public layer change more than the internal layer? If yes, is that justified?
- Did pressure accumulate, or did the cycle quietly clean up state without earning it?

## Cycle Output Template
```markdown
# Cycle: [Title]

## Trigger

## Primary Pressure

## Secondary Pressure

## Internal Translation

## Decision Point

## Outcome

## State Updates
- company_state:
- product_state:
- traction_state:
- character_states:
- relationship_state:
- pending_consequences:

## Residue

## Next Hooks
```

## Runtime Test
Before accepting a cycle, ask:
- Did something materially change?
- Did at least one person gain or lose influence?
- Did the event create a future obligation?
- Did the cycle preserve Tallea's product limits?
- Did it avoid resolving the company's identity too early?

