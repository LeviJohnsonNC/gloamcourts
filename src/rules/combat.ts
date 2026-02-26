import { CombatState, CombatEnemy, GameState, RollOutcome, Stance, RangeBand, CombatAction } from './types';
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

function moveRange(current: RangeBand, direction: 'closer' | 'farther'): RangeBand {
  const order: RangeBand[] = ['Engaged', 'Near', 'Far'];
  const idx = order.indexOf(current);
  if (direction === 'closer') return order[Math.max(0, idx - 1)];
  return order[Math.min(order.length - 1, idx + 1)];
}

export function resolveCombatRound(
  gameState: GameState,
  combatState: CombatState,
  playerAction: CombatAction,
  rng?: () => number
): { gameState: GameState; combatState: CombatState; rollOutcome: RollOutcome; narrative: string } {
  const newGameState = { ...gameState, resources: { ...gameState.resources }, tracks: { ...gameState.tracks } };
  const newCombat = { ...combatState, log: [...combatState.log], player_range: combatState.player_range };

  const getRollContext = () => {
    if (playerAction === 'attack') return 'combat_attack' as const;
    if (playerAction === 'defend') return 'combat_defense' as const;
    if (playerAction === 'trick') return 'social' as const;
    return 'combat_defense' as const;
  };

  let playerStat = playerAction === 'attack' ? 'STEEL' as const :
    playerAction === 'defend' ? 'GRACE' as const :
    playerAction === 'trick' ? 'GUILE' as const :
    playerAction === 'advance' ? 'GRACE' as const :
    playerAction === 'withdraw' ? 'GRACE' as const :
    'GRACE' as const;

  const isAttack = playerAction === 'attack';
  const hasRanged = gameState.inventory.some(i => i.tags.includes('ranged'));
  const playerPool = getPoolSize(
    playerStat, gameState.stats, combatState.player_stance, isAttack,
    gameState.status_effects, 0,
    gameState.trait_key, getRollContext(),
    combatState.player_range, hasRanged,
    combatState.enemy.engaged_bonus
  );
  const playerTn = getTargetNumber(combatState.enemy.tn, gameState.status_effects);
  const enemyPool = combatState.enemy.pool;
  const enemyTn = combatState.enemy.tn;

  const rollOutcome = opposedRoll(playerPool, playerTn, enemyPool, enemyTn, rng);
  rollOutcome.stat_used = playerStat;
  rollOutcome.roll_context = getRollContext();
  let narrative = '';

  if (playerAction === 'advance') {
    if (rollOutcome.outcome === 'success' || rollOutcome.outcome === 'critical_success') {
      newCombat.player_range = moveRange(combatState.player_range, 'closer');
      narrative = `You close the distance! Now at ${newCombat.player_range} range.`;
    } else {
      const dmg = Math.max(1, Math.abs(rollOutcome.margin));
      newGameState.resources.health -= dmg;
      narrative = `You lunge forward but ${combatState.enemy.name} punishes you for ${dmg} damage!`;
    }
  } else if (playerAction === 'withdraw') {
    if (rollOutcome.outcome === 'success' || rollOutcome.outcome === 'critical_success') {
      newCombat.player_range = moveRange(combatState.player_range, 'farther');
      narrative = `You create distance! Now at ${newCombat.player_range} range.`;
    } else {
      const dmg = Math.max(1, Math.abs(rollOutcome.margin));
      newGameState.resources.health -= dmg;
      narrative = `You try to disengage but ${combatState.enemy.name} follows and strikes for ${dmg} damage!`;
    }
  } else if (playerAction === 'flee') {
    if (rollOutcome.outcome === 'success' || rollOutcome.outcome === 'critical_success') {
      narrative = `You disengage from ${combatState.enemy.name} and escape!`;
      newCombat.enemy_health = -1; // signal flee success
    } else {
      const dmg = Math.max(1, Math.abs(rollOutcome.margin));
      newGameState.resources.health -= dmg;
      narrative = `You try to flee but ${combatState.enemy.name} catches you for ${dmg} damage!`;
    }
  } else if (playerAction === 'attack') {
    // Attack tends to pull to Engaged
    if (rollOutcome.margin > 0) {
      const dmg = rollOutcome.margin;
      newCombat.enemy_health -= dmg;
      narrative = `You strike ${combatState.enemy.name} for ${dmg} damage!`;
      if (rollOutcome.outcome === 'critical_success') {
        narrative += ' A devastating blow!';
        newCombat.enemy_health -= 1;
      }
      // Pull to Engaged on successful attack
      if (combatState.player_range === 'Near') {
        newCombat.player_range = 'Engaged';
        narrative += ' You close to engaged range.';
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
      // Trick can push/pull range if margin >= 2
      if (rollOutcome.margin >= 2) {
        const newRange = combatState.player_range === 'Engaged' ? 'Near' : 
                         combatState.player_range === 'Near' ? 'Far' : 'Near';
        newCombat.player_range = newRange;
        narrative += ` You reposition to ${newRange} range!`;
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
