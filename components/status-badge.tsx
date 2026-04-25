/**
 * Editorial status indicator: tone dot + optional mono prefix + tone-graded text.
 * Replaces shadcn-style colored pills.
 */

type Tone = "neutral" | "positive" | "warning" | "critical";

const POSITIVE = new Set([
  "rising",
  "improving",
  "high",
  "medium_high",
  "active_pilot",
  "paid_pilot",
  "aligned",
  "strong",
  "pilot_ready",
  "expanding",
  "mutual",
  "high_confidence",
  "high_external_brittle_internal",
  "very_high_narrative",
  "high_technical_claims",
  "high_when_pilots_or_runway_dominate",
  "high_operational_low_symbolic",
  "medium_high_trust",
  "publicly_aligned_privately_infrastructure_pulled",
]);

const WARNING = new Set([
  "fragile_warm",
  "warm_but_fragile",
  "functional_but_split",
  "narrowly_useful_but_brittle",
  "uneven",
  "medium",
  "medium_high",
  "medium_low",
  "early_interest",
  "small_controlled_beta",
  "stalled",
  "asymmetric",
  "high_visible",
  "high_in_motion",
  "medium_high_accumulating",
  "high_controlled",
  "loyalty_under_strain",
  "tactical_alliance_with_drift_risk",
  "trust_with_moral_tension",
  "symbolic_power_vs_operational_reality",
  "unstable_trust",
  "practical_alliance",
  "most_fragile_relationship",
  "quiet_solidarity",
  "dependency_without_enough_recognition",
  "publicly_aligned_privately_infrastructure_pulled",
  "partially_aligned_speed_wary",
  "aligned_with_user_mission_wary_of_merchant_drift",
  "merchant_execution_first",
  "narrow_honest_fit_guidance",
]);

const CRITICAL = new Set([
  "critical",
  "damaged",
  "overexposed",
  "openly_split",
  "fractured",
  "unsustainable",
  "high",
  "negative",
  "overhyped",
  "unstable",
]);

function toneFor(value: string): Tone {
  if (POSITIVE.has(value)) return "positive";
  if (CRITICAL.has(value)) return "critical";
  if (WARNING.has(value)) return "warning";
  return "neutral";
}

function dotClass(tone: Tone): string {
  if (tone === "positive") return "bg-accent";
  if (tone === "warning") return "bg-foreground/55";
  if (tone === "critical") return "bg-foreground";
  return "bg-muted";
}

function textClass(tone: Tone): string {
  if (tone === "critical") return "text-foreground";
  if (tone === "positive") return "text-foreground/85";
  if (tone === "warning") return "text-foreground/75";
  return "text-muted";
}

/**
 * For inverted scales (where "high" is bad — runway pressure, cleanup burden),
 * pass inverse so positive↔critical are flipped. Warning stays the same.
 */
function flipTone(t: Tone): Tone {
  if (t === "positive") return "critical";
  if (t === "critical") return "positive";
  return t;
}

export function StatusBadge({
  value,
  prefix,
  inverse = false,
  className = "",
}: {
  value: string;
  prefix?: string;
  inverse?: boolean;
  className?: string;
}) {
  const baseTone = toneFor(value);
  const tone = inverse ? flipTone(baseTone) : baseTone;
  const display = value.replaceAll("_", " ");
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass(tone)}`} aria-hidden />
      {prefix ? (
        <span className="eyebrow text-[10px]">{prefix}</span>
      ) : null}
      <span className={`text-[13px] ${textClass(tone)}`}>{display}</span>
    </span>
  );
}
