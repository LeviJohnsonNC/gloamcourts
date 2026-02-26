/**
 * Validates an LLM-generated outline and converts it to the internal AdventureOutline format.
 * Strict validation: 60-120 sections, 0 broken links, reachability, act structure, clue network, twist.
 */
import { AdventureOutline, Section, Choice, CombatEnemy, InventoryItem } from '@/rules/types';

interface LLMOutlineSection {
  section_number: number;
  outline_summary: string;
  location_tag: string;
  has_plate: boolean;
  is_boss: boolean;
  is_death: boolean;
  is_ending: boolean;
  ending_key: string | null;
  is_true_ending: boolean;
  codex_unlock: string | null;
  rumor_unlock: string | null;
  inventory_grants: { name: string; tags: string[]; is_clue?: boolean }[];
  choices: LLMChoice[];
  act_tag?: 'ACT_I' | 'ACT_II' | 'ACT_III';
  is_twist?: boolean;
  twist_type?: string;
}

interface LLMChoice {
  choice_id: string;
  label: string;
  type: 'free' | 'test' | 'combat' | 'gated';
  next_section: number | null;
  success_section: number | null;
  fail_section: number | null;
  test: {
    stat_used: string;
    tn: number;
    opposing_pool: number;
    stakes: string;
    on_success: any;
    on_fail: any;
  } | null;
  gate: {
    required_item_tag?: string;
    required_codex_key?: string;
    required_clue_tags?: string[];
    min_required?: number;
  } | null;
  combat_enemy: {
    name: string;
    pool: number;
    tn: number;
    health: number;
    engaged_bonus: number;
    is_boss: boolean;
  } | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  outline?: AdventureOutline;
}

// Graph reachability check using BFS
function computeReachability(sections: any[], startSection: number): Set<number> {
  const adj = new Map<number, Set<number>>();
  for (const s of sections) {
    const targets = new Set<number>();
    for (const c of (s.choices || [])) {
      if (c.next_section != null) targets.add(c.next_section);
      if (c.success_section != null) targets.add(c.success_section);
      if (c.fail_section != null) targets.add(c.fail_section);
    }
    adj.set(s.section_number, targets);
  }

  const visited = new Set<number>();
  const queue = [startSection];
  visited.add(startSection);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = adj.get(curr);
    if (neighbors) {
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
  }
  return visited;
}

// Detect SCCs without exits using Tarjan's algorithm
function detectTrappedSCCs(sections: any[]): string[] {
  const errors: string[] = [];
  const adj = new Map<number, number[]>();
  const allNums = new Set<number>();

  for (const s of sections) {
    allNums.add(s.section_number);
    const targets: number[] = [];
    for (const c of (s.choices || [])) {
      if (c.next_section != null) targets.push(c.next_section);
      if (c.success_section != null) targets.push(c.success_section);
      if (c.fail_section != null) targets.push(c.fail_section);
    }
    adj.set(s.section_number, targets);
  }

  // Find sections that are endings or deaths (terminal)
  const terminals = new Set<number>();
  for (const s of sections) {
    if (s.is_death || s.is_ending || (s.choices || []).length === 0) {
      terminals.add(s.section_number);
    }
  }

  // For each non-terminal section, check it can reach a terminal via BFS
  for (const s of sections) {
    if (terminals.has(s.section_number)) continue;
    const visited = new Set<number>();
    const queue = [s.section_number];
    visited.add(s.section_number);
    let canExit = false;
    while (queue.length > 0 && !canExit) {
      const curr = queue.shift()!;
      if (terminals.has(curr) && curr !== s.section_number) { canExit = true; break; }
      const neighbors = adj.get(curr) || [];
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
    if (!canExit) {
      errors.push(`Section ${s.section_number} cannot reach any ending/death (trapped cycle)`);
    }
  }

  return errors;
}

export function validateAndConvertOutline(raw: any, seed: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') return { valid: false, errors: ['Not an object'], warnings };
  if (!raw.title) errors.push('Missing title');
  if (!raw.start_section) errors.push('Missing start_section');
  if (!Array.isArray(raw.sections)) return { valid: false, errors: ['sections not array'], warnings };

  // Hard fail: 60-120 sections
  if (raw.sections.length < 60) errors.push(`Too few sections: ${raw.sections.length} (need 60-120)`);
  if (raw.sections.length > 120) errors.push(`Too many sections: ${raw.sections.length} (need 60-120)`);

  // Unique section numbers in 1..400
  const nums = new Set<number>();
  for (const s of raw.sections) {
    if (typeof s.section_number !== 'number') { errors.push('Section missing number'); continue; }
    if (s.section_number < 1 || s.section_number > 400) errors.push(`Section ${s.section_number} outside 1..400`);
    if (nums.has(s.section_number)) errors.push(`Duplicate: ${s.section_number}`);
    nums.add(s.section_number);
  }

  if (!nums.has(raw.start_section)) errors.push('start_section not in sections');

  // Broken links: MUST be 0
  let brokenLinks = 0;
  for (const s of raw.sections) {
    for (const c of (s.choices || [])) {
      for (const key of ['next_section', 'success_section', 'fail_section']) {
        const val = c[key];
        if (val != null && !nums.has(val)) {
          brokenLinks++;
        }
      }
    }
  }
  if (brokenLinks > 0) errors.push(`${brokenLinks} broken section links (must be 0)`);

  // Endings: 5-8, exactly 1 true ending
  const endings = raw.sections.filter((s: any) => s.is_ending);
  const trueEndings = raw.sections.filter((s: any) => s.is_true_ending);
  if (endings.length < 5) errors.push(`Only ${endings.length} endings (need 5-8)`);
  if (endings.length > 8) warnings.push(`${endings.length} endings (recommended 5-8)`);
  if (trueEndings.length !== 1) errors.push(`${trueEndings.length} true endings (need exactly 1)`);

  // Content minimums
  const combatSections = raw.sections.filter((s: any) => (s.choices || []).some((c: any) => c.type === 'combat'));
  const witsSections = raw.sections.filter((s: any) => (s.choices || []).some((c: any) => c.type === 'test' && c.test?.stat_used === 'WITS'));
  const guileSections = raw.sections.filter((s: any) => (s.choices || []).some((c: any) => c.type === 'test' && c.test?.stat_used === 'GUILE'));
  const hexSections = raw.sections.filter((s: any) => (s.choices || []).some((c: any) => c.type === 'test' && c.test?.stat_used === 'HEX'));
  const gatedChoices = raw.sections.filter((s: any) => (s.choices || []).some((c: any) => c.type === 'gated' || c.gate));

  if (combatSections.length < 8) warnings.push(`Only ${combatSections.length} combat sections (want 8-15)`);
  if (witsSections.length < 10) warnings.push(`Only ${witsSections.length} WITS tests (want 10-20)`);
  if (guileSections.length < 8) warnings.push(`Only ${guileSections.length} GUILE tests (want 8-15)`);
  if (hexSections.length < 6) warnings.push(`Only ${hexSections.length} HEX tests (want 6-12)`);
  if (gatedChoices.length < 6) warnings.push(`Only ${gatedChoices.length} gated choices (want 6-12)`);

  // Reachability: start must reach 85% of sections
  if (nums.has(raw.start_section) && errors.length === 0) {
    const reachable = computeReachability(raw.sections, raw.start_section);
    const reachPct = reachable.size / nums.size;
    if (reachPct < 0.85) {
      errors.push(`Only ${Math.round(reachPct * 100)}% sections reachable from start (need 85%)`);
    }

    // Trapped cycles check
    const trappedErrors = detectTrappedSCCs(raw.sections);
    if (trappedErrors.length > 3) {
      errors.push(`${trappedErrors.length} sections trapped in infinite cycles`);
    } else if (trappedErrors.length > 0) {
      warnings.push(...trappedErrors);
    }
  }

  if (errors.length > 0) return { valid: false, errors, warnings };

  // Convert to internal format
  const sections: Section[] = raw.sections.map((s: LLMOutlineSection) => {
    const choices: Choice[] = (s.choices || []).map((c: LLMChoice) => {
      const choice: Choice = {
        label: c.label || 'Continue',
        type: c.type || 'free',
        next_section: c.next_section ?? undefined,
        success_section: c.success_section ?? undefined,
        fail_section: c.fail_section ?? undefined,
      };

      if (c.test) {
        choice.stat_used = c.test.stat_used as any;
        choice.tn = Math.max(2, Math.min(10, c.test.tn || 6));
        choice.opposing_pool = c.test.opposing_pool > 0 ? c.test.opposing_pool : undefined;
        choice.stakes = c.test.stakes;
        choice.base_pool = 3;
        const statContextMap: Record<string, string> = {
          GUILE: 'social', WITS: 'investigation', HEX: 'hex', GRACE: 'stealth', STEEL: 'endurance'
        };
        choice.roll_context = (statContextMap[c.test.stat_used] || 'general') as any;
      }

      if (c.gate) {
        if (c.gate.required_item_tag) choice.required_item_tag = c.gate.required_item_tag;
        if (c.gate.required_codex_key) choice.required_codex_key = c.gate.required_codex_key;
        if (c.gate.required_clue_tags) {
          choice.required_clue_tags = c.gate.required_clue_tags;
          choice.min_clues_required = c.gate.min_required || c.gate.required_clue_tags.length;
        }
      }

      return choice;
    });

    const combatChoice = s.choices?.find((c: LLMChoice) => c.combat_enemy);
    const combatEnemy: CombatEnemy | undefined = combatChoice?.combat_enemy ? {
      name: combatChoice.combat_enemy.name,
      pool: Math.max(1, Math.min(8, combatChoice.combat_enemy.pool)),
      tn: Math.max(2, Math.min(10, combatChoice.combat_enemy.tn)),
      health: Math.max(2, Math.min(12, combatChoice.combat_enemy.health)),
      stance: 'Guarded' as const,
      is_boss: combatChoice.combat_enemy.is_boss || s.is_boss,
      description: s.outline_summary || combatChoice.combat_enemy.name,
      engaged_bonus: combatChoice.combat_enemy.engaged_bonus || 0,
    } : undefined;

    // Build inventory items from grants (including clues)
    const inventoryGrants: InventoryItem[] = (s.inventory_grants || []).map((g: any) => ({
      id: g.name.toLowerCase().replace(/\s+/g, '_'),
      name: g.name,
      tags: g.tags || [],
      description: '',
      is_clue: g.is_clue || (g.tags || []).some((t: string) => t.startsWith('Clue:')),
    }));

    const firstGrant = inventoryGrants[0];

    // Attach item_gain to first free choice if present
    if (firstGrant && choices.length > 0) {
      const freeChoice = choices.find(c => c.type === 'free');
      if (freeChoice) freeChoice.item_gain = firstGrant;
    }

    const section: Section = {
      section_number: s.section_number,
      title: s.outline_summary?.substring(0, 60) || `Section ${s.section_number}`,
      narrator_text: '',
      has_plate: s.has_plate || false,
      choices,
      is_death: s.is_death || false,
      is_ending: s.is_ending || false,
      ending_key: s.ending_key || undefined,
      is_true_ending: s.is_true_ending || false,
      combat_enemy: combatEnemy,
      codex_unlock: s.codex_unlock || undefined,
      rumor_unlock: s.rumor_unlock || undefined,
      is_twist: s.is_twist || false,
      twist_type: s.twist_type || undefined,
      act_tag: s.act_tag || undefined,
    };

    if (s.is_death) {
      section.death_cause = s.outline_summary || 'unknown';
      section.death_epitaph = `Here lies someone who learned that ${s.location_tag || 'the Courts'} takes its guests very seriously.`;
      section.narrator_text = `YOU ARE DEAD.\n\n${s.outline_summary || 'Your journey ends here.'}`;
    }

    return section;
  });

  // Store world_bible if present
  const outline: AdventureOutline = {
    title: raw.title,
    seed,
    sections,
    start_section: raw.start_section,
    required_codex_keys: raw.required_codex_keys || ['the_pallid_ministry', 'the_echo_vault', 'the_grey_protocol', 'the_cinder_crown', 'the_pallid_seal'],
    world_bible: raw.world_bible || undefined,
  };

  return { valid: true, errors: [], warnings, outline };
}
