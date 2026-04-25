import type { SiteProjection, WorldState } from "@/types/world";

/**
 * Derive the public-facing site projection from the current world state.
 *
 * Rules (from data/canon/public_site_brief.md):
 *  - Allowed claims are always conservative.
 *  - Forbidden claims are forbidden.
 *  - Bonus claims (e.g. "trusted by N merchants") only appear when product
 *    health and public legitimacy support them.
 *  - Tone shifts based on the runway pressure × public legitimacy combo.
 */
export function deriveProjection(state: WorldState): SiteProjection {
  const runway = state.company_state.runway_pressure;
  const legitimacy = state.company_state.public_legitimacy;
  const health = state.product_state.health;
  const pilots = state.traction_state.merchant_pipeline.active_pilot_conversations;

  // Tone matrix
  let tone: SiteProjection["tone"] = "calm";
  if (runway === "critical") tone = "constrained";
  else if (runway === "high" && legitimacy === "fragile_warm") tone = "guarded";
  else if (legitimacy === "rising" && health !== "damaged") tone = "confident";
  else if (legitimacy === "damaged" || legitimacy === "overexposed")
    tone = "guarded";

  // Headline picks language based on tone
  const headline =
    tone === "constrained"
      ? "Practical fit guidance for online apparel."
      : tone === "guarded"
        ? "Know your fit before you buy."
        : tone === "confident"
          ? "Shopper confidence for online apparel fit."
          : "Know your fit before you buy.";

  const positioning =
    "Tallea helps shoppers build a reusable fit profile and use it to make more confident size decisions in participating online stores.";

  // Allowed claims (always safe)
  const allowed_claims = [
    "Helps shoppers make more informed fit decisions.",
    "Provides likely size and confidence guidance.",
    "Works best with participating stores and clean product data.",
    "Body profile, fit preferences, garment data, and confidence modeling.",
    "Helps merchants understand where fit confusion happens.",
  ];

  // Forbidden claims (never shown publicly; surfaced for transparency on /pulse only)
  const forbidden_claims = [
    "Perfect fit.",
    "Universal sizing.",
    "True virtual try-on.",
    "Works across all brands automatically.",
    "Eliminates returns.",
    "Fully automated catalog understanding.",
  ];

  // Bonus claims: only when product is healthy and at least one real pilot exists
  const bonus_claims: string[] = [];
  const productOk =
    health === "pilot_ready" || health === "narrowly_useful_but_brittle";
  const legitOk =
    legitimacy === "rising" ||
    legitimacy === "fragile_warm" ||
    legitimacy === "cold";
  if (productOk && legitOk && pilots >= 1) {
    bonus_claims.push("Live with a small number of regional apparel brands.");
  }
  if (productOk && legitimacy === "rising" && pilots >= 2) {
    bonus_claims.push("Active fit-confidence pilots with fitted-apparel partners.");
  }

  // CTA shifts based on traction and runway
  let cta_label = "Request early access";
  let cta_intent: SiteProjection["cta_intent"] = "shopper";
  if (pilots >= 2 || runway === "high" || runway === "critical") {
    cta_label = "Pilot inquiry for merchants";
    cta_intent = "merchant";
  } else if (tone === "constrained") {
    cta_label = "Stay in touch";
    cta_intent = "muted";
  }

  const show_press_quote =
    legitimacy === "rising" || state.traction_state.ecosystem_signal.status === "rising";

  return {
    headline,
    positioning,
    tone,
    allowed_claims,
    forbidden_claims,
    bonus_claims,
    cta_label,
    cta_intent,
    show_press_quote,
  };
}
