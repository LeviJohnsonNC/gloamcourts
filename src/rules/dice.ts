import { DiceResult, RollOutcome, Stance, StatName, Stats, StatusEffect, RollContext, getTraitBonus, RangeBand } from './types';

// Seeded PRNG (mulberry32)
export function createRng(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6D2B79F5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function rollD10(count: number, rng?: () => number): number[] {
  const roll = rng || Math.random;
  const dice: number[] = [];
  for (let i = 0; i < count; i++) {
    dice.push(Math.floor(roll() * 10) + 1);
  }
  return dice;
}

export function countSuccesses(dice: number[], tn: number): number {
  return dice.filter(d => d >= tn).length;
}

export function rollPool(poolSize: number, tn: number, rng?: () => number): DiceResult {
  const dice = rollD10(Math.max(1, poolSize), rng);
  const successes = countSuccesses(dice, tn);
  return { dice, targetNumber: tn, successes };
}

export function opposedRoll(
  playerPool: number,
  playerTn: number,
  opposingPool: number,
  opposingTn: number,
  rng?: () => number
): RollOutcome {
  const playerRoll = rollPool(playerPool, playerTn, rng);
  const opposingRoll = rollPool(opposingPool, opposingTn, rng);
  const margin = playerRoll.successes - opposingRoll.successes;

  let outcome: RollOutcome['outcome'];
  if (margin >= 3) outcome = 'critical_success';
  else if (margin > 0) outcome = 'success';
  else if (margin === 0) outcome = 'partial';
  else if (margin > -3) outcome = 'failure';
  else outcome = 'critical_failure';

  return { playerRoll, opposingRoll, margin, outcome };
}

export function simpleRoll(
  playerPool: number,
  playerTn: number,
  rng?: () => number
): RollOutcome {
  const playerRoll = rollPool(playerPool, playerTn, rng);
  const margin = playerRoll.successes;

  let outcome: RollOutcome['outcome'];
  if (margin >= 3) outcome = 'critical_success';
  else if (margin >= 1) outcome = 'success';
  else outcome = 'failure';

  return { playerRoll, margin, outcome };
}

export function getPoolSize(
  stat: StatName,
  stats: Stats,
  stance: Stance,
  isAttack: boolean,
  statusEffects: StatusEffect[],
  contextBonuses: number = 0,
  traitKey?: string,
  rollContext?: RollContext,
  rangeBand?: RangeBand,
  hasRangedItem?: boolean,
  enemyEngagedBonus?: number,
): number {
  let pool = stats[stat];

  // Stance modifiers
  if (isAttack) {
    if (stance === 'Aggressive') pool += 1;
    if (stance === 'Guarded') pool -= 1;
  } else {
    if (stance === 'Guarded') pool += 1;
    if (stance === 'Aggressive') pool -= 1;
  }

  // Status effects
  if (statusEffects.some(e => e.key === 'paranoia') && (stat === 'GUILE')) {
    pool -= 1;
  }
  if (statusEffects.some(e => e.key === 'touched') && rollContext === 'social') {
    pool -= 1;
  }

  // Trait bonus
  if (traitKey && rollContext) {
    pool += getTraitBonus(traitKey, stat, rollContext);
  }

  // Range band effects
  if (rangeBand === 'Far' && stat === 'STEEL' && isAttack && !hasRangedItem) {
    pool -= 1;
  }
  if (rangeBand === 'Engaged' && enemyEngagedBonus) {
    // Enemy gets bonus at engaged; player takes penalty
    pool -= enemyEngagedBonus;
  }

  pool += contextBonuses;

  return Math.max(1, pool);
}

export function getTargetNumber(
  baseTn: number,
  statusEffects: StatusEffect[],
  focusSpent: boolean = false
): number {
  let tn = baseTn;
  if (statusEffects.some(e => e.key === 'marked')) tn += 1;
  if (focusSpent) tn -= 1;
  return Math.max(2, Math.min(10, tn));
}

export function rerollDice(originalDice: number[], indicesToReroll: number[], rng?: () => number): number[] {
  const newDice = [...originalDice];
  const roll = rng || Math.random;
  for (const idx of indicesToReroll) {
    if (idx >= 0 && idx < newDice.length) {
      newDice[idx] = Math.floor(roll() * 10) + 1;
    }
  }
  return newDice;
}

export function convertLowestDie(dice: number[]): number[] {
  const newDice = [...dice];
  const lowestIdx = newDice.reduce((minIdx, d, i) => d < newDice[minIdx] ? i : minIdx, 0);
  if (newDice[lowestIdx] === 1) {
    newDice[lowestIdx] = 10;
  }
  return newDice;
}
