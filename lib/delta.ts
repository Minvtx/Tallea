import type { WorldState, WorldStateDelta } from "@/types/world";

// ---------------------------------------------------------------------------
// Delta application (deep merge sub-objects without wiping unmentioned keys)
// ---------------------------------------------------------------------------

export function applyDelta(state: WorldState, delta: WorldStateDelta): WorldState {
  const next: WorldState = {
    ...state,
    world: { ...state.world, ...(delta.world ?? {}) },
    company_state: { ...state.company_state, ...(delta.company_state ?? {}) },
    product_state: { ...state.product_state, ...(delta.product_state ?? {}) },
    traction_state: {
      user_beta: {
        ...state.traction_state.user_beta,
        ...(delta.traction_state?.user_beta ?? {}),
      },
      merchant_pipeline: {
        ...state.traction_state.merchant_pipeline,
        ...(delta.traction_state?.merchant_pipeline ?? {}),
      },
      ecosystem_signal: {
        ...state.traction_state.ecosystem_signal,
        ...(delta.traction_state?.ecosystem_signal ?? {}),
      },
    },
    public_layer: { ...state.public_layer, ...(delta.public_layer ?? {}) },
    external_entities: { ...state.external_entities },
    character_states: { ...state.character_states },
    relationship_state: { ...state.relationship_state },
    open_tensions: [...state.open_tensions],
    active_events: [...state.active_events],
    pending_consequences: [...state.pending_consequences],
  };

  // External entities: merge per-key
  if (delta.external_entities) {
    for (const [id, patch] of Object.entries(delta.external_entities)) {
      const existing = next.external_entities[id];
      next.external_entities[id] = existing
        ? { ...existing, ...patch }
        : ({
            type: patch.type ?? "merchant",
            status: patch.status ?? "unknown",
            pressure: patch.pressure ?? "",
          } as typeof next.external_entities[string]);
    }
  }

  // Characters: merge per-character
  if (delta.character_states) {
    for (const [id, patch] of Object.entries(delta.character_states)) {
      const existing = next.character_states[id];
      if (existing) {
        next.character_states[id] = { ...existing, ...patch };
      }
    }
  }

  // Relationships: replace per-pair
  if (delta.relationship_state) {
    for (const [pair, value] of Object.entries(delta.relationship_state)) {
      next.relationship_state[pair] = value;
    }
  }

  // Tensions: add then remove
  if (delta.open_tensions_added) {
    for (const t of delta.open_tensions_added) {
      if (!next.open_tensions.includes(t)) next.open_tensions.push(t);
    }
  }
  if (delta.open_tensions_removed) {
    next.open_tensions = next.open_tensions.filter(
      (t) => !delta.open_tensions_removed!.includes(t),
    );
  }

  // Consequences: append
  if (delta.pending_consequences_added) {
    next.pending_consequences.push(...delta.pending_consequences_added);
  }

  return next;
}
