export type StatName = 'STEEL' | 'GUILE' | 'WITS' | 'GRACE' | 'HEX';

export const STAT_NAMES: StatName[] = ['STEEL', 'GUILE', 'WITS', 'GRACE', 'HEX'];

export const STAT_DESCRIPTIONS: Record<StatName, string> = {
  STEEL: 'Physical force & endurance',
  GUILE: 'Lies & social leverage',
  WITS: 'Investigation & perception',
  GRACE: 'Speed & finesse',
  HEX: 'Occult & bargaining with the unnatural',
};

export interface Stats {
  STEEL: number;
  GUILE: number;
  WITS: number;
  GRACE: number;
  HEX: number;
}

export interface Resources {
  health: number;
  focus: number;
  luck: number;
}

export interface Tracks {
  madness: number;
  taint: number;
}

export type Stance = 'Aggressive' | 'Guarded' | 'Cunning';
export type RangeBand = 'Engaged' | 'Near' | 'Far';

export type RollContext = 'social' | 'investigation' | 'combat_attack' | 'combat_defense' | 'hex' | 'stealth' | 'endurance' | 'general' | 'court_social' | 'perception' | 'occult' | 'bargaining';

export interface Trait {
  key: string;
  name: string;
  flavor: string;
  effect: string;
  mechanical: TraitMechanical;
}

export interface TraitMechanical {
  type: 'bonus_die' | 'start_bonus' | 'reroll' | 'convert_die';
  stat?: StatName;
  context?: RollContext;
  bonus?: number;
  resource?: keyof Resources;
  once_per_run?: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  tags: string[];
  description: string;
}

export interface StatusEffect {
  key: string;
  name: string;
  source: 'madness' | 'taint' | 'trait' | 'other';
  description: string;
}

export interface DiceResult {
  dice: number[];
  targetNumber: number;
  successes: number;
  margin?: number;
}

export interface RollOutcome {
  playerRoll: DiceResult;
  opposingRoll?: DiceResult;
  margin: number;
  outcome: 'critical_success' | 'success' | 'partial' | 'failure' | 'critical_failure';
  stat_used?: StatName;
  roll_context?: RollContext;
}

export type ChoiceType = 'free' | 'test' | 'combat' | 'gated';

export interface Choice {
  label: string;
  type: ChoiceType;
  stat_used?: StatName;
  base_pool?: number;
  tn?: number;
  opposing_pool?: number;
  stakes?: string;
  required_item_tag?: string;
  required_codex_key?: string;
  success_section?: number;
  fail_section?: number;
  next_section?: number;
  codex_unlock?: string;
  rumor_unlock?: string;
  item_gain?: InventoryItem;
  resource_change?: Partial<Resources>;
  track_change?: Partial<Tracks>;
  roll_context?: RollContext;
}

export interface Section {
  section_number: number;
  title: string;
  narrator_text: string;
  has_plate: boolean;
  plate_caption?: string;
  choices: Choice[];
  is_death?: boolean;
  death_cause?: string;
  death_epitaph?: string;
  is_ending?: boolean;
  ending_key?: string;
  is_true_ending?: boolean;
  combat_enemy?: CombatEnemy;
  codex_unlock?: string;
  rumor_unlock?: string;
  requires_codex_keys?: string[];
  alternate_section?: number;
}

export interface CombatEnemy {
  name: string;
  pool: number;
  tn: number;
  health: number;
  stance: Stance;
  is_boss: boolean;
  description: string;
  engaged_bonus?: number;
}

export type CombatAction = 'attack' | 'defend' | 'trick' | 'flee' | 'advance' | 'withdraw';

export interface AdventureOutline {
  title: string;
  seed: string;
  sections: Section[];
  start_section: number;
  required_codex_keys?: string[];
}

export interface GameState {
  run_id: string;
  current_section: number;
  stats: Stats;
  resources: Resources;
  tracks: Tracks;
  stance: Stance;
  range_band: RangeBand;
  inventory: InventoryItem[];
  visited_sections: number[];
  status_effects: StatusEffect[];
  log: LogEntry[];
  trait_key: string;
  character_description: string;
  combat_state?: CombatState;
  used_trait_abilities?: string[];
}

export interface CombatState {
  enemy: CombatEnemy;
  enemy_health: number;
  round: number;
  player_stance: Stance;
  player_range: RangeBand;
  log: string[];
}

export interface LogEntry {
  section: number;
  text: string;
  timestamp: number;
}

export const TRAITS: Trait[] = [
  {
    key: 'silver_tongue',
    name: 'Silver Tongue',
    flavor: 'Your lies taste like honey and your truths sting like wasps.',
    effect: '+1 die on GUILE when bargaining or deceiving',
    mechanical: { type: 'bonus_die', stat: 'GUILE', context: 'social', bonus: 1 },
  },
  {
    key: 'lucky_fool',
    name: 'Lucky Fool',
    flavor: 'The universe has a soft spot for idiots. You qualify.',
    effect: 'Start each run with +1 Luck',
    mechanical: { type: 'start_bonus', resource: 'luck', bonus: 1 },
  },
  {
    key: 'iron_constitution',
    name: 'Iron Constitution',
    flavor: 'You have eaten things that would kill a horse. The horse is jealous.',
    effect: '+1 die on STEEL for endurance and poison resistance',
    mechanical: { type: 'bonus_die', stat: 'STEEL', context: 'endurance', bonus: 1 },
  },
  {
    key: 'shadow_step',
    name: 'Shadow Step',
    flavor: 'You move like a rumour: fast, silent, and hard to pin down.',
    effect: '+1 die on GRACE for stealth and evasion',
    mechanical: { type: 'bonus_die', stat: 'GRACE', context: 'stealth', bonus: 1 },
  },
  {
    key: 'third_eye',
    name: 'Third Eye',
    flavor: "You see what others miss. Unfortunately, this includes things you'd rather not.",
    effect: '+1 die on WITS for perception and investigation',
    mechanical: { type: 'bonus_die', stat: 'WITS', context: 'investigation', bonus: 1 },
  },
  {
    key: 'hexblood',
    name: 'Hexblood',
    flavor: 'Something in your ancestry was not entirely human. Family reunions are complicated.',
    effect: '+1 die on HEX for all occult interactions',
    mechanical: { type: 'bonus_die', stat: 'HEX', context: 'hex', bonus: 1 },
  },
  {
    key: 'deaths_jest',
    name: "Death's Jest",
    flavor: 'You have died before. You found it underwhelming.',
    effect: 'Once per run, turn a die showing 1 into a 10',
    mechanical: { type: 'convert_die', once_per_run: true },
  },
  {
    key: 'court_bred',
    name: 'Court-Bred',
    flavor: 'You know which fork to use for salad and which for stabbing.',
    effect: '+1 die on GUILE in social situations at court',
    mechanical: { type: 'bonus_die', stat: 'GUILE', context: 'court_social', bonus: 1 },
  },
];

export const MADNESS_THRESHOLDS: Record<number, StatusEffect> = {
  4: { key: 'paranoia', name: 'Paranoia', source: 'madness', description: 'You see threats in every shadow. -1 die on social rolls.' },
  7: { key: 'marked', name: 'Marked', source: 'madness', description: 'Something has noticed you. +1 to all TNs.' },
  10: { key: 'hollow_eyed', name: 'Hollow-Eyed', source: 'madness', description: 'You have stared too long into the abyss. It stared back and found you wanting.' },
};

export const TAINT_THRESHOLDS: Record<number, StatusEffect> = {
  4: { key: 'touched', name: 'Touched', source: 'taint', description: 'The unnatural clings to you. NPCs sense it. -1 die on first impression rolls.' },
  7: { key: 'corrupted', name: 'Corrupted', source: 'taint', description: 'Your flesh remembers shapes it should not know. +1 Madness per combat.' },
  10: { key: 'abomination', name: 'Abomination', source: 'taint', description: 'You are no longer entirely yourself. This is, depending on your perspective, an upgrade.' },
};

// Map roll contexts to determine trait applicability
export function getTraitBonus(traitKey: string, stat: StatName, context?: RollContext): number {
  const trait = TRAITS.find(t => t.key === traitKey);
  if (!trait || trait.mechanical.type !== 'bonus_die') return 0;
  if (trait.mechanical.stat && trait.mechanical.stat !== stat) return 0;
  
  // If trait has a context, check if it matches or is a parent category
  if (trait.mechanical.context) {
    if (!context) return 0;
    const contextMap: Record<string, RollContext[]> = {
      'social': ['social', 'court_social', 'bargaining'],
      'investigation': ['investigation', 'perception'],
      'combat_attack': ['combat_attack'],
      'combat_defense': ['combat_defense', 'stealth'],
      'hex': ['hex', 'occult'],
      'stealth': ['stealth', 'combat_defense'],
      'endurance': ['endurance'],
      'court_social': ['court_social', 'social'],
      'perception': ['perception', 'investigation'],
      'occult': ['occult', 'hex'],
      'bargaining': ['bargaining', 'social'],
      'general': ['general'],
    };
    const validContexts = contextMap[trait.mechanical.context] || [trait.mechanical.context];
    if (!validContexts.includes(context)) return 0;
  }

  return trait.mechanical.bonus || 0;
}
