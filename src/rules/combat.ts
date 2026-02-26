import { CombatState, CombatEnemy, GameState, RollOutcome, Stance } from './types';
import { opposedRoll, getPoolSize, getTargetNumber } from './dice';

export function initCombat(enemy: CombatEnemy, gameState: GameState): CombatState {
  return {
    enemy,
    enemy_health: enemy.health,
    round: 1,
    player_stance: gameState.stance,
    player_range: gameState.range_band,
    log: [`You face ${enemy.name}. ${enemy.description}`],
  };
}

export function resolveCombatRound(
  gameState: GameState,
  combatState: CombatState,
  playerAction: 'attack' | 'defend' | 'trick' | 'flee',
  rng?: () => number
): { gameState: GameState; combatState: CombatState; rollOutcome: RollOutcome; narrative: string } {
  const newGameState = { ...gameState, resources: { ...gameState.resources }, tracks: { ...gameState.tracks } };
  const newCombat = { ...combatState, log: [...combatState.log] };

  let playerStat = playerAction === 'attack' ? 'STEEL' as const :
    playerAction === 'defend' ? 'GRACE' as const :
    playerAction === 'trick' ? 'GUILE' as const : 'GRACE' as const;

  const isAttack = playerAction === 'attack';
  const playerPool = getPoolSize(playerStat, gameState.stats, combatState.player_stance, isAttack, gameState.status_effects);
  const playerTn = getTargetNumber(combatState.enemy.tn, gameState.status_effects);
  const enemyPool = combatState.enemy.pool;
  const enemyTn = combatState.enemy.tn;

  const rollOutcome = opposedRoll(playerPool, playerTn, enemyPool, enemyTn, rng);
  let narrative = '';

  if (playerAction === 'flee') {
    if (rollOutcome.outcome === 'success' || rollOutcome.outcome === 'critical_success') {
      narrative = `You disengage from ${combatState.enemy.name} and escape!`;
      newCombat.enemy_health = -1; // signal flee success
    } else {
      const dmg = Math.max(1, Math.abs(rollOutcome.margin));
      newGameState.resources.health -= dmg;
      narrative = `You try to flee but ${combatState.enemy.name} catches you for ${dmg} damage!`;
    }
  } else if (playerAction === 'attack') {
    if (rollOutcome.margin > 0) {
      const dmg = rollOutcome.margin;
      newCombat.enemy_health -= dmg;
      narrative = `You strike ${combatState.enemy.name} for ${dmg} damage!`;
      if (rollOutcome.outcome === 'critical_success') {
        narrative += ' A devastating blow!';
        newCombat.enemy_health -= 1;
      }
    } else {
      const dmg = Math.max(1, Math.abs(rollOutcome.margin));
      newGameState.resources.health -= dmg;
      narrative = `${combatState.enemy.name} strikes you for ${dmg} damage!`;
    }
  } else if (playerAction === 'defend') {
    if (rollOutcome.margin >= 0) {
      narrative = 'You hold your ground, deflecting the attack.';
      if (rollOutcome.margin > 0) {
        newCombat.enemy_health -= 1;
        narrative += ' You find an opening for a riposte!';
      }
    } else {
      const dmg = Math.max(1, Math.abs(rollOutcome.margin) - 1);
      newGameState.resources.health -= dmg;
      narrative = `Despite your guard, ${combatState.enemy.name} lands a blow for ${dmg} damage.`;
    }
  } else if (playerAction === 'trick') {
    if (rollOutcome.margin > 0) {
      newCombat.enemy_health -= rollOutcome.margin;
      narrative = `Your cunning maneuver pays off! ${combatState.enemy.name} takes ${rollOutcome.margin} damage.`;
      if (combatState.player_stance === 'Cunning') {
        newCombat.enemy_health -= 1;
        narrative += ' Your cunning stance amplifies the effect!';
      }
    } else {
      const dmg = Math.max(1, Math.abs(rollOutcome.margin));
      newGameState.resources.health -= dmg;
      narrative = `Your trick backfires spectacularly. ${combatState.enemy.name} punishes you for ${dmg} damage.`;
    }
  }

  // Corrupted status: +1 madness per combat round
  if (gameState.status_effects.some(e => e.key === 'corrupted')) {
    newGameState.tracks.madness = Math.min(10, newGameState.tracks.madness + 1);
  }

  newCombat.round += 1;
  newCombat.log.push(`Round ${newCombat.round - 1}: ${narrative}`);

  return { gameState: newGameState, combatState: newCombat, rollOutcome, narrative };
}

export function isCombatOver(combatState: CombatState, gameState: GameState): {
  over: boolean;
  playerWon: boolean;
  fled: boolean;
} {
  if (combatState.enemy_health < 0) return { over: true, playerWon: true, fled: true };
  if (combatState.enemy_health <= 0) return { over: true, playerWon: true, fled: false };
  if (gameState.resources.health <= 0) return { over: true, playerWon: false, fled: false };
  return { over: false, playerWon: false, fled: false };
}

export function changeStance(combatState: CombatState, newStance: Stance): CombatState {
  return {
    ...combatState,
    player_stance: newStance,
    log: [...combatState.log, `You shift to a ${newStance} stance.`],
  };
}
