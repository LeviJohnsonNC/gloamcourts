import { GameState, Resources, Tracks, StatusEffect, Stats, MADNESS_THRESHOLDS, TAINT_THRESHOLDS, TRAITS, Choice, Section, getActiveTwist } from './types';

export function createInitialGameState(
  runId: string,
  stats: Stats,
  traitKey: string,
  startSection: number,
  characterDescription: string
): GameState {
  const trait = TRAITS.find(t => t.key === traitKey);
  const resources: Resources = { health: 10, focus: 6, luck: 3 };

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
    used_trait_abilities: [],
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

/** Activate twist when entering a twist section */
export function activateTwist(state: GameState, twistType: string): GameState {
  // Don't activate twice
  if (getActiveTwist(state.status_effects)) return state;

  const twistEffect: StatusEffect = {
    key: 'TWIST',
    name: twistType === 'DebtWrit' ? 'Debt Writ' : twistType === 'GreyNotice' ? 'Grey Notice' : 'Hollow Contract',
    source: 'twist',
    description: twistType === 'DebtWrit' ? 'Spending Luck also +1 Taint.'
      : twistType === 'GreyNotice' ? 'Embracing Darkness also +1 Madness and Marked.'
      : 'Focus costs 2 but reduces TN by 2.',
    type: twistType,
    active: true,
  };

  return {
    ...state,
    status_effects: [...state.status_effects, twistEffect],
    log: [...state.log, { section: state.current_section, text: `TWIST ACTIVATED: ${twistEffect.name}`, timestamp: Date.now() }],
  };
}

export function spendLuck(state: GameState, amount: number = 1): GameState | null {
  if (state.resources.luck < amount) return null;
  let newState = applyResourceChange(state, { luck: -amount });

  // DebtWrit twist: spending Luck also +1 Taint
  const twist = getActiveTwist(newState.status_effects);
  if (twist?.type === 'DebtWrit') {
    newState = applyTrackChange(newState, { taint: 1 });
  }

  return newState;
}

export function spendFocus(state: GameState): GameState | null {
  const twist = getActiveTwist(state.status_effects);

  if (twist?.type === 'HollowContract') {
    // Costs 2 Focus but reduces TN by 2
    if (state.resources.focus < 2) return null;
    return applyResourceChange(state, { focus: -2 });
  }

  if (state.resources.focus < 1) return null;
  return applyResourceChange(state, { focus: -1 });
}

/** Get TN reduction from Focus spend (affected by HollowContract twist) */
export function getFocusTnReduction(state: GameState): number {
  const twist = getActiveTwist(state.status_effects);
  return twist?.type === 'HollowContract' ? 2 : 1;
}

export function embraceDarkness(state: GameState, track: 'madness' | 'taint'): GameState {
  let newState = applyTrackChange(state, { [track]: 1 });

  // GreyNotice twist: embracing also +1 Madness and Marked
  const twist = getActiveTwist(newState.status_effects);
  if (twist?.type === 'GreyNotice') {
    newState = applyTrackChange(newState, { madness: 1 });
    if (!newState.status_effects.find(e => e.key === 'marked')) {
      newState = {
        ...newState,
        status_effects: [...newState.status_effects, MADNESS_THRESHOLDS[7]],
      };
    }
  }

  return newState;
}

export function useTraitAbility(state: GameState, abilityKey: string): GameState {
  return {
    ...state,
    used_trait_abilities: [...(state.used_trait_abilities || []), abilityKey],
  };
}

export function hasUsedTraitAbility(state: GameState, abilityKey: string): boolean {
  return (state.used_trait_abilities || []).includes(abilityKey);
}

export function canMakeGatedChoice(state: GameState, choice: Choice): boolean {
  if (choice.required_item_tag) {
    return state.inventory.some(item => item.tags.includes(choice.required_item_tag!));
  }
  if (choice.required_codex_key) {
    return true; // checked at UI level with DB
  }
  // Clue gate
  if (choice.required_clue_tags && choice.required_clue_tags.length > 0) {
    const minRequired = choice.min_clues_required || choice.required_clue_tags.length;
    const playerClueTags = state.inventory
      .filter(item => item.is_clue)
      .flatMap(item => item.tags.filter(t => t.startsWith('Clue:')));
    const matchCount = choice.required_clue_tags.filter(tag => playerClueTags.includes(tag)).length;
    return matchCount >= minRequired;
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
    status_effects_json: [...state.status_effects, ...(state.used_trait_abilities || []).map(k => ({ key: `used_${k}`, name: `Used ${k}`, source: 'trait' as const, description: 'Trait ability used' }))],
    log_json: state.log,
    trait_key: state.trait_key,
    character_description: state.character_description,
    autosave_at: new Date().toISOString(),
  };
}

export function deserializeGameState(runId: string, data: any): GameState {
  const allEffects = (data.status_effects_json || []) as any[];
  const traitUsed = allEffects.filter((e: any) => e.source === 'trait' && e.key?.startsWith('used_')).map((e: any) => e.key.replace('used_', ''));
  const statusEffects = allEffects.filter((e: any) => !(e.source === 'trait' && e.key?.startsWith('used_')));
  
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
    status_effects: statusEffects,
    log: data.log_json || [],
    trait_key: data.trait_key || '',
    character_description: data.character_description || '',
    used_trait_abilities: traitUsed,
  };
}
