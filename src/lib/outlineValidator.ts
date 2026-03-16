/**
 * Validates an LLM-generated outline and converts it to the internal AdventureOutline format.
 * Supports both legacy (verbose) and slim/nav-graph (compact) outline formats.
 * 
 * Nav-graph outlines only contain navigation structure + thematic beats.
 * Mechanical enrichment (choice types, combat, tests, gates) happens in generate-section.
 */
import { AdventureOutline, Section, Choice, CombatEnemy, InventoryItem } from '@/rules/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  outline?: AdventureOutline;
}

// Detect slim/nav-graph format by checking for `n` field on first section
function isSlimFormat(raw: any): boolean {
  if (!Array.isArray(raw.sections) || raw.sections.length === 0) return false;
  return typeof raw.sections[0].n === 'number';
}

// Normalize a section from slim/nav-graph format to a common intermediate
function normalizeSlimSection(s: any): any {
  return {
    section_number: s.n,
    outline_summary: s.beat || '',
    location_tag: s.loc || s.beat?.substring(0, 20) || '',
    has_plate: s.plate || false,
    is_boss: s.boss || false,
    is_death: s.death || false,
    is_ending: s.end || false,
    ending_key: s.end_key || null,
    is_true_ending: s.true_end || false,
    codex_unlock: s.codex || null,
    rumor_unlock: null,
    inventory_grants: (s.inv || []).map((item: any) => ({
      name: item.name,
      tags: item.tags || [],
      is_clue: item.clue || false,
    })),
    choices: (s.choices || []).map((c: any) => ({
      choice_id: c.id || `c_${Math.random().toString(36).slice(2, 6)}`,
      label: c.label || 'Continue',
      // Nav-graph: all choices are 'free' with nx only; mechanics assigned by generate-section
      type: c.t || 'free',
      next_section: c.nx ?? null,
      success_section: c.ok ?? null,
      fail_section: c.no ?? null,
      test: c.test ? {
        stat_used: c.test.stat,
        tn: c.test.tn,
        opposing_pool: c.test.opp || 0,
        stakes: c.test.stakes || 'unknown',
        on_success: c.test.fx_ok || null,
        on_fail: c.test.fx_no || null,
      } : null,
      gate: c.gate ? normalizeGate(c.gate) : null,
      combat_enemy: c.enemy ? {
        name: c.enemy.name,
        pool: c.enemy.pool,
        tn: c.enemy.tn,
        health: c.enemy.hp,
        engaged_bonus: c.enemy.eng || 0,
        is_boss: c.enemy.boss || false,
      } : null,
    })),
    act_tag: s.act ? `ACT_${s.act}` : undefined,
    is_twist: s.twist || false,
    twist_type: s.twist_type || null,
  };
}

function normalizeGate(gate: any): any {
  if (gate.tag) return { required_item_tag: gate.tag };
  if (gate.codex) return { required_codex_key: gate.codex };
  if (gate.clues) return { required_clue_tags: gate.clues, min_required: gate.min || gate.clues.length };
  return gate;
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

export function validateAndConvertOutline(raw: any, seed: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') return { valid: false, errors: ['Not an object'], warnings };
  if (!raw.title) errors.push('Missing title');
  if (!raw.start_section) errors.push('Missing start_section');
  if (!Array.isArray(raw.sections)) return { valid: false, errors: ['sections not array'], warnings };

  const slim = isSlimFormat(raw);

  const normalizedSections = slim
    ? raw.sections.map(normalizeSlimSection)
    : raw.sections;

  // Section count: 5-150 (relaxed to accept smaller outlines)
  if (normalizedSections.length < 5) errors.push(`Too few sections: ${normalizedSections.length} (need at least 5)`);
  if (normalizedSections.length > 150) warnings.push(`High section count: ${normalizedSections.length}`);

  // Unique section numbers in 1..400
  const nums = new Set<number>();
  for (const s of normalizedSections) {
    if (typeof s.section_number !== 'number') { errors.push('Section missing number'); continue; }
    if (s.section_number < 1 || s.section_number > 400) errors.push(`Section ${s.section_number} outside 1..400`);
    if (nums.has(s.section_number)) errors.push(`Duplicate: ${s.section_number}`);
    nums.add(s.section_number);
  }

  if (!nums.has(raw.start_section)) errors.push('start_section not in sections');

  // Auto-repair broken links
  const sortedNums = Array.from(nums).sort((a, b) => a - b);
  function findNearest(target: number): number {
    let best = sortedNums[0];
    let bestDist = Math.abs(target - best);
    for (const n of sortedNums) {
      const d = Math.abs(target - n);
      if (d < bestDist) { best = n; bestDist = d; }
    }
    return best;
  }

  let repairedLinks = 0;
  for (const s of normalizedSections) {
    for (const c of (s.choices || [])) {
      for (const key of ['next_section', 'success_section', 'fail_section']) {
        const val = c[key];
        if (val != null && !nums.has(val)) {
          c[key] = findNearest(val);
          repairedLinks++;
        }
      }
    }
  }
  if (repairedLinks > 0) warnings.push(`Auto-repaired ${repairedLinks} broken links`);

  // Endings check (warnings only)
  const endings = normalizedSections.filter((s: any) => s.is_ending);
  const trueEndings = normalizedSections.filter((s: any) => s.is_true_ending);
  if (endings.length < 1) warnings.push(`No endings found`);
  if (trueEndings.length !== 1) warnings.push(`${trueEndings.length} true endings (want exactly 1)`);

  // Reachability: start must reach 60% of sections
  if (nums.has(raw.start_section) && errors.length === 0) {
    const reachable = computeReachability(normalizedSections, raw.start_section);
    const reachPct = reachable.size / nums.size;
    if (reachPct < 0.60) {
      errors.push(`Only ${Math.round(reachPct * 100)}% sections reachable from start (need 60%)`);
    }
  }

  if (errors.length > 0) return { valid: false, errors, warnings };

  // Convert to internal format
  const sections: Section[] = normalizedSections.map((s: any) => {
    const choices: Choice[] = (s.choices || []).map((c: any) => {
      const choice: Choice = {
        label: c.label || 'Continue',
        type: c.type || 'free',
        next_section: c.next_section ?? undefined,
        success_section: c.success_section ?? undefined,
        fail_section: c.fail_section ?? undefined,
      };

      // Legacy outlines may still have test/gate/combat data
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

    const combatChoice = s.choices?.find((c: any) => c.combat_enemy);
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

    const inventoryGrants: InventoryItem[] = (s.inventory_grants || []).map((g: any) => ({
      id: g.name.toLowerCase().replace(/\s+/g, '_'),
      name: g.name,
      tags: g.tags || [],
      description: '',
      is_clue: g.is_clue || (g.tags || []).some((t: string) => t.startsWith('Clue:')),
    }));

    const firstGrant = inventoryGrants[0];
    if (firstGrant && choices.length > 0) {
      const freeChoice = choices.find(c => c.type === 'free');
      if (freeChoice) freeChoice.item_gain = firstGrant;
    }

    const section: Section = {
      section_number: s.section_number,
      title: (s.outline_summary || s.location_tag || '').substring(0, 60) || `Section ${s.section_number}`,
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

  const openingPlatePrompt = raw.opening_plate_prompt || undefined;

  // Normalize world_bible if present (legacy outlines)
  const rawBible = raw.world_bible;
  const worldBible = rawBible ? {
    courts: (rawBible.courts || []).map((c: any) => ({
      name: c.name, motto: c.motto, signature: c.signature || '', taboo: c.taboo,
    })),
    factions: (rawBible.factions || []).map((f: any) => ({
      name: f.name, goal: f.goal, method: f.method || '', tell: f.tell,
    })),
    recurring_npcs: (rawBible.recurring_npcs || []).map((n: any) => ({
      name: n.name, role: n.role, voice_tick: n.voice_tick, tell: n.tell || '', secret: n.secret || '',
    })),
    signature_places: rawBible.signature_places || [],
    linguistic_rules: rawBible.linguistic_rules || undefined,
  } : undefined;

  const outline: AdventureOutline = {
    title: raw.title,
    seed,
    sections,
    start_section: 1,
    required_codex_keys: raw.required_codex_keys || ['the_pallid_ministry', 'the_echo_vault', 'the_grey_protocol', 'the_cinder_crown', 'the_pallid_seal'],
    world_bible: worldBible,
    opening_plate_prompt: openingPlatePrompt,
  };

  return { valid: true, errors: [], warnings, outline };
}
