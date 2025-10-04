import { db, type User, type Session, type Hanchan, type PlayerResult, type UmaMark } from './db';
import { logger } from './logger';
import { DatabaseError, ValidationError, NotFoundError } from './errors';

// ========================================
// User Functions
// ========================================

/**
 * メインユーザーを取得
 */
export async function getMainUser(): Promise<User | undefined> {
  try {
    logger.debug('メインユーザーを取得開始', { context: 'db-utils.getMainUser' });
    const allUsers = await db.users.toArray();
    const mainUser = allUsers.find(user => user.isMainUser);

    if (mainUser) {
      logger.debug('メインユーザー取得成功', {
        context: 'db-utils.getMainUser',
        data: { userId: mainUser.id }
      });
    } else {
      logger.warn('メインユーザーが見つかりません', { context: 'db-utils.getMainUser' });
    }

    return mainUser;
  } catch (err) {
    const error = new DatabaseError('メインユーザーの取得に失敗しました', {
      originalError: err
    });
    logger.error(error.message, {
      context: 'db-utils.getMainUser',
      error
    });
    throw error;
  }
}

/**
 * 全ユーザーを取得
 */
export async function getAllUsers(): Promise<User[]> {
  return await db.users.toArray();
}

/**
 * 登録ユーザーを取得（アクティブのみ、メインユーザーを除く）
 */
export async function getRegisteredUsers(): Promise<User[]> {
  const allUsers = await db.users.toArray();
  return allUsers.filter(user => !user.isMainUser && !user.isArchived);
}

/**
 * 新規ユーザーを追加
 */
export async function addUser(name: string): Promise<User> {
  // バリデーション
  if (!name.trim()) {
    const error = new ValidationError('ユーザー名が空です', 'name');
    logger.error(error.message, {
      context: 'db-utils.addUser',
      error
    });
    throw error;
  }

  try {
    logger.debug('ユーザー追加開始', {
      context: 'db-utils.addUser',
      data: { userName: name }
    });

    const user: User = {
      id: crypto.randomUUID(),
      name,
      isMainUser: false,
      isArchived: false,
      createdAt: new Date()
    };

    await db.users.add(user);

    logger.info('ユーザー追加成功', {
      context: 'db-utils.addUser',
      data: { userId: user.id, userName: user.name }
    });

    return user;
  } catch (err) {
    const error = new DatabaseError('ユーザーの追加に失敗しました', {
      userName: name,
      originalError: err
    });
    logger.error(error.message, {
      context: 'db-utils.addUser',
      error
    });
    throw error;
  }
}

/**
 * ユーザー名を更新
 */
export async function updateUser(userId: string, name: string): Promise<User> {
  // バリデーション
  if (!name.trim()) {
    const error = new ValidationError('ユーザー名が空です', 'name');
    logger.error(error.message, {
      context: 'db-utils.updateUser',
      error
    });
    throw error;
  }

  try {
    logger.debug('ユーザー名更新開始', {
      context: 'db-utils.updateUser',
      data: { userId, newName: name }
    });

    // ユーザー情報を取得
    const user = await db.users.get(userId);
    if (!user) {
      const error = new NotFoundError('ユーザーが見つかりません', userId);
      logger.error(error.message, {
        context: 'db-utils.updateUser',
        error
      });
      throw error;
    }

    // ユーザー名を更新
    await db.users.update(userId, { name: name.trim() });

    // 更新後のユーザー情報を取得
    const updatedUser = await db.users.get(userId);
    if (!updatedUser) {
      throw new DatabaseError('更新後のユーザー情報取得に失敗しました');
    }

    logger.info('ユーザー名更新成功', {
      context: 'db-utils.updateUser',
      data: { userId, oldName: user.name, newName: updatedUser.name }
    });

    return updatedUser;
  } catch (err) {
    if (err instanceof ValidationError || err instanceof NotFoundError) {
      throw err;
    }
    const error = new DatabaseError('ユーザー名の更新に失敗しました', { originalError: err });
    logger.error(error.message, {
      context: 'db-utils.updateUser',
      error
    });
    throw error;
  }
}

/**
 * ユーザーをアーカイブ（論理削除）
 * @param userId - アーカイブするユーザーID
 */
export async function archiveUser(userId: string): Promise<void> {
  try {
    logger.debug('ユーザーアーカイブ開始', {
      context: 'db-utils.archiveUser',
      data: { userId }
    });

    // ユーザー情報を取得
    const user = await db.users.get(userId);
    if (!user) {
      const error = new NotFoundError('ユーザーが見つかりません', userId);
      logger.error(error.message, {
        context: 'db-utils.archiveUser',
        error
      });
      throw error;
    }

    // メインユーザーのアーカイブを防止
    if (user.isMainUser) {
      const error = new ValidationError('メインユーザーはアーカイブできません', 'userId');
      logger.error(error.message, {
        context: 'db-utils.archiveUser',
        error,
        data: { userId }
      });
      throw error;
    }

    // アーカイブフラグを設定
    await db.users.update(userId, {
      isArchived: true,
      archivedAt: new Date()
    });

    logger.info('ユーザーアーカイブ成功', {
      context: 'db-utils.archiveUser',
      data: { userId, userName: user.name }
    });
  } catch (err) {
    if (err instanceof ValidationError || err instanceof NotFoundError) {
      throw err;
    }
    const error = new DatabaseError('ユーザーのアーカイブに失敗しました', { originalError: err });
    logger.error(error.message, {
      context: 'db-utils.archiveUser',
      error
    });
    throw error;
  }
}

/**
 * アーカイブ済みユーザーを復元
 * @param userId - 復元するユーザーID
 */
export async function restoreUser(userId: string): Promise<void> {
  try {
    logger.debug('ユーザー復元開始', {
      context: 'db-utils.restoreUser',
      data: { userId }
    });

    const user = await db.users.get(userId);
    if (!user) {
      const error = new NotFoundError('ユーザーが見つかりません', userId);
      logger.error(error.message, {
        context: 'db-utils.restoreUser',
        error
      });
      throw error;
    }

    if (!user.isArchived) {
      const error = new ValidationError('ユーザーは既にアクティブです', 'userId');
      logger.error(error.message, {
        context: 'db-utils.restoreUser',
        error,
        data: { userId }
      });
      throw error;
    }

    await db.users.update(userId, {
      isArchived: false,
      archivedAt: undefined
    });

    logger.info('ユーザー復元成功', {
      context: 'db-utils.restoreUser',
      data: { userId, userName: user.name }
    });
  } catch (err) {
    if (err instanceof ValidationError || err instanceof NotFoundError) {
      throw err;
    }
    const error = new DatabaseError('ユーザーの復元に失敗しました', { originalError: err });
    logger.error(error.message, {
      context: 'db-utils.restoreUser',
      error
    });
    throw error;
  }
}

/**
 * アクティブユーザーのみ取得
 */
export async function getActiveUsers(): Promise<User[]> {
  try {
    const allUsers = await db.users.toArray();
    return allUsers.filter(u => !u.isArchived);
  } catch (err) {
    const error = new DatabaseError('アクティブユーザーの取得に失敗しました', {
      originalError: err
    });
    logger.error(error.message, {
      context: 'db-utils.getActiveUsers',
      error
    });
    throw error;
  }
}

/**
 * アーカイブ済みユーザーのみ取得
 */
export async function getArchivedUsers(): Promise<User[]> {
  try {
    const allUsers = await db.users.toArray();
    return allUsers.filter(u => u.isArchived);
  } catch (err) {
    const error = new DatabaseError('アーカイブ済みユーザーの取得に失敗しました', {
      originalError: err
    });
    logger.error(error.message, {
      context: 'db-utils.getArchivedUsers',
      error
    });
    throw error;
  }
}

/**
 * @deprecated archiveUserを使用してください
 * ユーザーを削除（非推奨）
 */
export async function deleteUser(userId: string): Promise<void> {
  logger.warn('deleteUserは非推奨です。archiveUserを使用してください', {
    context: 'db-utils.deleteUser',
    data: { userId }
  });

  // 内部的にarchiveUserを呼び出す
  return archiveUser(userId);
}

// ========================================
// Session Functions
// ========================================

/**
 * 新規セッションを作成
 */
export async function createSession(
  date: string,
  mode: '4-player' | '3-player'
): Promise<Session> {
  const session: Session = {
    id: crypto.randomUUID(),
    date,
    mode,
    rate: 30,           // デフォルト値
    umaValue: 10,       // デフォルト値
    chipRate: 100,      // デフォルト値
    parlorFee: 0,       // デフォルト値
    umaRule: 'standard', // デフォルト値
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.sessions.add(session);
  return session;
}

/**
 * 日付でセッションを取得
 */
export async function getSessionsByDate(date: string): Promise<Session[]> {
  return await db.sessions
    .where('date')
    .equals(date)
    .toArray();
}

/**
 * すべてのセッションを取得（日付降順）
 */
export async function getAllSessions(): Promise<Session[]> {
  return await db.sessions
    .orderBy('date')
    .reverse()
    .toArray();
}

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
  umaMark: UmaMark
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
    createdAt: new Date()
  };

  await db.playerResults.add(playerResult);
  return playerResult;
}

/**
 * 半荘のプレイヤー結果を取得
 */
export async function getPlayerResultsByHanchan(hanchanId: string): Promise<PlayerResult[]> {
  return await db.playerResults
    .where('hanchanId')
    .equals(hanchanId)
    .toArray();
}

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

  const umaValues: Record<UmaMark, number> = {
    '○○○': 3,
    '○○': 2,
    '○': 1,
    '': 0,
    '✗': -1,
    '✗✗': -2,
    '✗✗✗': -3
  };

  const total = playerResults.reduce(
    (sum, pr) => sum + umaValues[pr.umaMark],
    0
  );

  return total === 0; // 必ず0になる（ゼロサム）
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
}

// ========================================
// Session Save Functions
// ========================================

/**
 * セッション保存用のデータ型
 */
export interface SessionSaveData {
  date: string
  mode: 'four-player' | 'three-player'
  rate: number
  umaValue: number
  chipRate: number
  umaRule: 'standard' | 'second-minus'
  hanchans: Array<{
    hanchanNumber: number
    players: Array<{
      playerName: string
      userId: string | null
      score: number
      umaMark: UmaMark
      chips: number
      parlorFee: number
      isSpectator: boolean
    }>
  }>
}

/**
 * セッションを保存（Session + Hanchan + PlayerResult を一括作成）
 */
export async function saveSession(data: SessionSaveData): Promise<string> {
  try {
    logger.info('セッション保存開始', {
      context: 'db-utils.saveSession',
      data: { date: data.date, mode: data.mode }
    });

    // バリデーション
    if (!data.date || !data.mode) {
      throw new ValidationError('必須項目が入力されていません', 'date, mode');
    }

    if (data.hanchans.length === 0) {
      throw new ValidationError('半荘データがありません', 'hanchans');
    }

    // Session作成
    const sessionId = crypto.randomUUID();
    const now = new Date();

    const session: Session = {
      id: sessionId,
      date: data.date,
      mode: data.mode as '4-player' | '3-player',
      rate: data.rate,
      umaValue: data.umaValue,
      chipRate: data.chipRate,
      parlorFee: data.hanchans[0]?.players[0]?.parlorFee || 0,
      umaRule: data.umaRule as 'standard' | 'second-minus',
      createdAt: now,
      updatedAt: now
    };

    await db.sessions.add(session);

    // 各半荘とプレイヤー結果を作成
    for (const hanchanData of data.hanchans) {
      const hanchanId = crypto.randomUUID();

      const hanchan: Hanchan = {
        id: hanchanId,
        sessionId,
        hanchanNumber: hanchanData.hanchanNumber,
        autoCalculated: false,
        createdAt: now
      };

      await db.hanchans.add(hanchan);

      // プレイヤー結果を作成
      for (const playerData of hanchanData.players) {
        const playerResult: PlayerResult = {
          id: crypto.randomUUID(),
          hanchanId,
          userId: playerData.userId,
          playerName: playerData.playerName,
          score: playerData.score,
          umaMark: playerData.umaMark,
          isSpectator: playerData.isSpectator,
          chips: playerData.chips,
          createdAt: now
        };

        await db.playerResults.add(playerResult);
      }

      // ゼロサム検証
      const isZeroSum = await validateZeroSum(hanchanId);
      if (!isZeroSum) {
        logger.warn(`半荘${hanchanData.hanchanNumber}のゼロサムチェック失敗`, {
          context: 'db-utils.saveSession',
          data: { hanchanId, hanchanNumber: hanchanData.hanchanNumber }
        });
      }

      // ウママーク合計検証
      const isUmaValid = await validateUmaMarks(hanchanId);
      if (!isUmaValid) {
        logger.warn(`半荘${hanchanData.hanchanNumber}のウママーク合計チェック失敗`, {
          context: 'db-utils.saveSession',
          data: { hanchanId, hanchanNumber: hanchanData.hanchanNumber }
        });
      }
    }

    logger.info('セッション保存成功', {
      context: 'db-utils.saveSession',
      data: { sessionId, hanchanCount: data.hanchans.length }
    });

    return sessionId;
  } catch (err) {
    const error = new DatabaseError('セッションの保存に失敗しました', {
      originalError: err
    });
    logger.error(error.message, {
      context: 'db-utils.saveSession',
      error
    });
    throw error;
  }
}
