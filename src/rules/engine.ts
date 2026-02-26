import { GameState, Resources, Tracks, StatusEffect, Stats, MADNESS_THRESHOLDS, TAINT_THRESHOLDS, TRAITS, Choice, Section } from './types';

export function createInitialGameState(
  runId: string,
  stats: Stats,
  traitKey: string,
  startSection: number,
  characterDescription: string
): GameState {
  const trait = TRAITS.find(t => t.key === traitKey);
  const resources: Resources = { health: 10, focus: 6, luck: 3 };

  // Apply trait start bonuses
  if (trait?.mechanical.type === 'start_bonus' && trait.mechanical.resource) {
    resources[trait.mechanical.resource] += trait.mechanical.bonus || 0;
  }

  return {
    run_id: runId,
    current_section: startSection,
    stats,
    resources,
    tracks: { madness: 0, taint: 0 },
    stance: 'Guarded',
    range_band: 'Near',
    inventory: [],
    visited_sections: [startSection],
    status_effects: [],
    log: [{ section: startSection, text: 'Your journey begins.', timestamp: Date.now() }],
    trait_key: traitKey,
    character_description: characterDescription,
  };
}

export function applyResourceChange(state: GameState, change: Partial<Resources>): GameState {
  const newResources = { ...state.resources };
  if (change.health !== undefined) newResources.health = Math.max(0, Math.min(10, newResources.health + change.health));
  if (change.focus !== undefined) newResources.focus = Math.max(0, Math.min(6, newResources.focus + change.focus));
  if (change.luck !== undefined) newResources.luck = Math.max(0, Math.min(6, newResources.luck + change.luck));
  return { ...state, resources: newResources };
}

export function applyTrackChange(state: GameState, change: Partial<Tracks>): GameState {
  const newTracks = { ...state.tracks };
  const newEffects = [...state.status_effects];

  if (change.madness !== undefined) {
    const oldVal = newTracks.madness;
    newTracks.madness = Math.max(0, Math.min(10, newTracks.madness + change.madness));
    // Check thresholds
    for (const [threshold, effect] of Object.entries(MADNESS_THRESHOLDS)) {
      const t = Number(threshold);
      if (oldVal < t && newTracks.madness >= t && !newEffects.find(e => e.key === effect.key)) {
        newEffects.push(effect);
      }
    }
  }

  if (change.taint !== undefined) {
    const oldVal = newTracks.taint;
    newTracks.taint = Math.max(0, Math.min(10, newTracks.taint + change.taint));
    for (const [threshold, effect] of Object.entries(TAINT_THRESHOLDS)) {
      const t = Number(threshold);
      if (oldVal < t && newTracks.taint >= t && !newEffects.find(e => e.key === effect.key)) {
        newEffects.push(effect);
      }
    }
  }

  return { ...state, tracks: newTracks, status_effects: newEffects };
}

export function navigateToSection(state: GameState, sectionNumber: number): GameState {
  const visited = state.visited_sections.includes(sectionNumber)
    ? state.visited_sections
    : [...state.visited_sections, sectionNumber];

  return {
    ...state,
    current_section: sectionNumber,
    visited_sections: visited,
    log: [...state.log, { section: sectionNumber, text: `Turned to section ${sectionNumber}.`, timestamp: Date.now() }],
  };
}

export function spendLuck(state: GameState, amount: number = 1): GameState | null {
  if (state.resources.luck < amount) return null;
  return applyResourceChange(state, { luck: -amount });
}

export function spendFocus(state: GameState): GameState | null {
  if (state.resources.focus < 1) return null;
  return applyResourceChange(state, { focus: -1 });
}

export function embraceDarkness(state: GameState, track: 'madness' | 'taint'): GameState {
  // +2 dice bonus for next roll, +1 to chosen track
  return applyTrackChange(state, { [track]: 1 });
}

export function canMakeGatedChoice(state: GameState, choice: Choice): boolean {
  if (choice.required_item_tag) {
    return state.inventory.some(item => item.tags.includes(choice.required_item_tag!));
  }
  if (choice.required_codex_key) {
    // This will be checked against codex_unlocks from DB
    return true; // placeholder - checked at UI level
  }
  return true;
}

export function isPlayerDead(state: GameState): boolean {
  return state.resources.health <= 0;
}

export function serializeGameState(state: GameState) {
  return {
    current_section: state.current_section,
    stats_json: state.stats,
    resources_json: state.resources,
    tracks_json: state.tracks,
    stance: state.stance,
    range_band: state.range_band,
    inventory_json: state.inventory,
    visited_sections: state.visited_sections,
    status_effects_json: state.status_effects,
    log_json: state.log,
    trait_key: state.trait_key,
    character_description: state.character_description,
    autosave_at: new Date().toISOString(),
  };
}

export function deserializeGameState(runId: string, data: any): GameState {
  return {
    run_id: runId,
    current_section: data.current_section,
    stats: data.stats_json as Stats,
    resources: data.resources_json as Resources,
    tracks: data.tracks_json as Tracks,
    stance: data.stance,
    range_band: data.range_band,
    inventory: data.inventory_json || [],
    visited_sections: data.visited_sections || [],
    status_effects: data.status_effects_json || [],
    log: data.log_json || [],
    trait_key: data.trait_key || '',
    character_description: data.character_description || '',
  };
}
