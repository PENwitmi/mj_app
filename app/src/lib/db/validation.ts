import { db } from '../db';
import { umaMarkToValue } from '../uma-utils';

// ========================================
// Validation Functions
// ========================================

/**
 * ゼロサム原則を検証
 */
export async function validateZeroSum(hanchanId: string): Promise<boolean> {
  const playerResults = await db.playerResults
    .where('hanchanId')
    .equals(hanchanId)
    .filter(pr => !pr.isSpectator) // 見学者を除く
    .toArray();

  const total = playerResults.reduce((sum, pr) => sum + pr.score, 0);

  return Math.abs(total) < 0.01; // 誤差許容
}

/**
 * ウママークの合計を検証（ゼロサムであるべき）
 */
export async function validateUmaMarks(hanchanId: string): Promise<boolean> {
  const playerResults = await db.playerResults
    .where('hanchanId')
    .equals(hanchanId)
    .filter(pr => !pr.isSpectator) // 見学者を除く
    .toArray();

  const total = playerResults.reduce(
    (sum, pr) => sum + umaMarkToValue(pr.umaMark),
    0
  );

  return total === 0; // 必ず0になる（ゼロサム）
}
