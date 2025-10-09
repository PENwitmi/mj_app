import { db, type Hanchan, type PlayerResult, type UmaMark } from '../db';
import { logger } from '../logger';
import { DatabaseError } from '../errors';

// ========================================
// Hanchan Functions
// ========================================

/**
 * 新規半荘を作成
 */
export async function createHanchan(
  sessionId: string,
  hanchanNumber: number
): Promise<Hanchan> {
  const hanchan: Hanchan = {
    id: crypto.randomUUID(),
    sessionId,
    hanchanNumber,
    autoCalculated: false,
    createdAt: new Date()
  };

  await db.hanchans.add(hanchan);
  return hanchan;
}

/**
 * セッションの半荘を取得
 */
export async function getHanchansBySession(sessionId: string): Promise<Hanchan[]> {
  return await db.hanchans
    .where('sessionId')
    .equals(sessionId)
    .sortBy('hanchanNumber');
}

// ========================================
// PlayerResult Functions
// ========================================

/**
 * プレイヤー結果を作成
 */
export async function createPlayerResult(
  hanchanId: string,
  userId: string | null,
  playerName: string,
  score: number,
  umaMark: UmaMark,
  position = 0  // デフォルト値: 0
): Promise<PlayerResult> {
  const playerResult: PlayerResult = {
    id: crypto.randomUUID(),
    hanchanId,
    userId,
    playerName,
    score,
    umaMark,
    isSpectator: false,
    chips: 0,
    position,
    createdAt: new Date()
  };

  await db.playerResults.add(playerResult);
  return playerResult;
}

/**
 * 半荘のプレイヤー結果を取得（position順にソート）
 */
export async function getPlayerResultsByHanchan(hanchanId: string): Promise<PlayerResult[]> {
  const results = await db.playerResults
    .where('hanchanId')
    .equals(hanchanId)
    .toArray();

  // positionでソート（0, 1, 2, 3の順）- InputTabでの列順を復元
  return results.sort((a, b) => a.position - b.position);
}

// ========================================
// Complex Query Functions
// ========================================

/**
 * セッションの全データを取得（半荘・プレイヤー結果含む）
 */
export async function getSessionWithDetails(sessionId: string) {
  const session = await db.sessions.get(sessionId);

  if (!session) {
    return null;
  }

  const hanchans = await getHanchansBySession(sessionId);

  const hanchansWithPlayers = await Promise.all(
    hanchans.map(async (hanchan) => ({
      ...hanchan,
      players: await getPlayerResultsByHanchan(hanchan.id)
    }))
  );

  return {
    session,
    hanchans: hanchansWithPlayers
  };
}

/**
 * 特定ユーザーの全統計データを取得
 */
export async function getUserStats(userId: string) {
  try {
    // ユーザーが参加した全てのPlayerResult
    const playerResults = await db.playerResults
      .where('userId')
      .equals(userId)
      .toArray();

    // 各PlayerResultから半荘情報を取得
    const hanchanIds = [...new Set(playerResults.map(pr => pr.hanchanId))];
    const hanchans = await db.hanchans
      .where('id')
      .anyOf(hanchanIds)
      .toArray();

    // セッション情報を取得
    const sessionIds = [...new Set(hanchans.map(h => h.sessionId))];
    const sessions = await db.sessions
      .where('id')
      .anyOf(sessionIds)
      .toArray();

    return { playerResults, hanchans, sessions };
  } catch (err) {
    const error = new DatabaseError('ユーザー統計データの取得に失敗しました', {
      userId,
      originalError: err
    });
    logger.error(error.message, {
      context: 'db.hanchans.getUserStats',
      error
    });
    throw error;
  }
}
