/**
 * Validates an LLM-generated outline and converts it to the internal AdventureOutline format.
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
  inventory_grants: { name: string; tags: string[] }[];
  choices: LLMChoice[];
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
  gate: { required_item_tag?: string; required_codex_key?: string } | null;
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
  outline?: AdventureOutline;
}

export function validateAndConvertOutline(raw: any, seed: string): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') return { valid: false, errors: ['Not an object'] };
  if (!raw.title) errors.push('Missing title');
  if (!raw.start_section) errors.push('Missing start_section');
  if (!Array.isArray(raw.sections)) return { valid: false, errors: ['sections not array'] };
  if (raw.sections.length < 20) errors.push(`Too few sections: ${raw.sections.length}`);

  const nums = new Set<number>();
  for (const s of raw.sections) {
    if (typeof s.section_number !== 'number') { errors.push('Section missing number'); continue; }
    if (nums.has(s.section_number)) errors.push(`Duplicate: ${s.section_number}`);
    nums.add(s.section_number);
  }

  if (!nums.has(raw.start_section)) errors.push('start_section not in sections');

  if (errors.length > 0) return { valid: false, errors };

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
        // Map stat to roll context
        const statContextMap: Record<string, string> = {
          GUILE: 'social', WITS: 'investigation', HEX: 'hex', GRACE: 'stealth', STEEL: 'endurance'
        };
        choice.roll_context = (statContextMap[c.test.stat_used] || 'general') as any;
      }

      if (c.gate) {
        if ('required_item_tag' in c.gate) choice.required_item_tag = c.gate.required_item_tag;
        if ('required_codex_key' in c.gate) choice.required_codex_key = c.gate.required_codex_key;
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

    // Build inventory items from grants
    const firstGrant = s.inventory_grants?.[0];
    const itemGain: InventoryItem | undefined = firstGrant ? {
      id: firstGrant.name.toLowerCase().replace(/\s+/g, '_'),
      name: firstGrant.name,
      tags: firstGrant.tags || [],
      description: '',
    } : undefined;

    // Attach item_gain to first free choice if present
    if (itemGain && choices.length > 0) {
      const freeChoice = choices.find(c => c.type === 'free');
      if (freeChoice) freeChoice.item_gain = itemGain;
    }

    const section: Section = {
      section_number: s.section_number,
      title: s.outline_summary?.substring(0, 60) || `Section ${s.section_number}`,
      narrator_text: '', // Will be filled by generate-section
      has_plate: s.has_plate || false,
      choices,
      is_death: s.is_death || false,
      is_ending: s.is_ending || false,
      ending_key: s.ending_key || undefined,
      is_true_ending: s.is_true_ending || false,
      combat_enemy: combatEnemy,
      codex_unlock: s.codex_unlock || undefined,
      rumor_unlock: s.rumor_unlock || undefined,
    };

    if (s.is_death) {
      section.death_cause = s.outline_summary || 'unknown';
      section.death_epitaph = `Here lies someone who learned that ${s.location_tag || 'the Courts'} takes its guests very seriously.`;
      section.narrator_text = `YOU ARE DEAD.\n\n${s.outline_summary || 'Your journey ends here.'}`;
    }

    return section;
  });

  const outline: AdventureOutline = {
    title: raw.title,
    seed,
    sections,
    start_section: raw.start_section,
    required_codex_keys: raw.required_codex_keys || ['the_pallid_ministry', 'the_echo_vault', 'the_grey_protocol', 'the_cinder_crown', 'the_pallid_seal'],
  };

  return { valid: true, errors: [], outline };
}
