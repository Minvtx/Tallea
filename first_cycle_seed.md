# First Cycle Seed

## Purpose
This is the recommended Day 1 trigger for runtime.
Use it to start the first orchestrated cycle unless a different opening is explicitly requested.

## Trigger
Veta, a Buenos Aires womenswear brand with high sizing friction, asks Tallea for a closed pilot on fitted tops and trousers.

## Immediate Opportunity
- Veta is small enough to move fast.
- The pain is real and easy to prove.
- A successful pilot could become Tallea's first concrete merchant proof.
- Nicolas can turn the conversation into runway-relevant momentum.

## Immediate Problem
- Veta's catalog data is incomplete.
- Some measurements live in spreadsheets; some live in staff knowledge.
- Their trousers are riskier than their tops.
- They want the pilot fast enough that manual cleanup will be hidden under the demo story.

## Character Pressure
- **Lucia:** Wants the pilot as proof that Tallea is becoming real.
- **Nicolas:** Wants to say yes quickly and shape scope later.
- **Matias:** Wants to restrict the pilot to safer garments and clear confidence limits.
- **Camila:** Wants consent and user messaging reviewed before live users enter.
- **Rafaela:** Knows the catalog will require more cleanup than the team is admitting.

## Decision Point
Should Tallea accept Veta's requested pilot scope, narrow it to safer categories, or delay until catalog data is cleaner?

## Good First Cycle Outcome
The cycle should not simply accept or reject the pilot.
It should create a partial commitment that gives Tallea momentum while adding operational burden and internal residue.

## Likely State Changes
- `merchant_pipeline.status` moves toward `active_pilot`.
- `manual_cleanup_burden` rises.
- `nicolas_bianchi.influence` rises.
- `rafaela_peralta.stress` rises.
- `matias_roldan.stress` rises if scope is too broad.
- `camila_sosa.trust_condition` worsens if consent is postponed.
- A pending consequence is created around pilot expectations.

