/**
 * Computes a fuzzy "gut feel" difficulty label for test choices.
 * Engine-driven, NOT LLM-driven. Intentionally imprecise.
 */

export type GutFeelLevel = 'Feels safe' | 'Risky' | 'Bleak';

export function computeGutFeel(
  tn: number,
  opposingPool?: number,
  playerPool?: number,
): GutFeelLevel {
  // Simple heuristic: estimate probability of success
  // Higher TN = harder, more opposing pool = harder
  const effectiveTn = tn || 6;
  const effectivePool = playerPool || 3;

  // Rough success chance per die: (11 - TN) / 10
  const successRate = Math.max(0.1, (11 - effectiveTn) / 10);
  const expectedSuccesses = effectivePool * successRate;

  // For opposed rolls, subtract expected opposing successes
  const opposingExpected = opposingPool ? opposingPool * 0.5 : 0;
  const netExpected = expectedSuccesses - opposingExpected;

  if (netExpected >= 1.5) return 'Feels safe';
  if (netExpected >= 0.5) return 'Risky';
  return 'Bleak';
}

export const GUT_FEEL_COLORS: Record<GutFeelLevel, string> = {
  'Feels safe': 'text-accent',
  'Risky': 'text-gold',
  'Bleak': 'text-destructive',
};
