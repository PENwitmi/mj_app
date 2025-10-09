import { db, type Session, type Hanchan, type PlayerResult, type UmaMark, type GameMode } from '../db';
import { logger } from '../logger';
import { DatabaseError, ValidationError } from '../errors';
import { validateZeroSum, validateUmaMarks } from './validation';
import type { SessionSettings } from '@/components/input/SessionSettings';

// ========================================
// UI Layer Types (編集用)
// ========================================

/**
 * UI層で使用する半荘データ型
 * DB層のHanchanとの違い:
 * - idを含まない（編集時は新規作成されるため）
 * - players配列がUIPlayerResult型
 */
export interface UIHanchan {
  hanchanNumber: number
  players: UIPlayerResult[]
  autoCalculated: boolean
}

/**
 * UI層で使用するプレイヤー結果型
 * DB層のPlayerResultとの違い:
 * - idとhanchanIdを含まない
 * - umaMarkManualフィールドを含む（UI専用）
 */
export interface UIPlayerResult {
  playerName: string
  userId: string | null
  score: number | null
  umaMark: UmaMark
  chips: number
  parlorFee: number
  isSpectator: boolean
  umaMarkManual: boolean  // UI専用: ウママークが手動設定されたか
}

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
      position: number  // 列番号（0, 1, 2, 3）
    }>
  }>
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

/**
 * 空ハンチャン判定
 *
 * 空ハンチャンの定義:
 * - 全プレイヤーが見学者、または
 * - 全プレイヤーのscoreがnullまたは0
 *
 * @param hanchan - 判定対象のハンチャンデータ
 * @returns true: 空ハンチャン, false: 有効なハンチャン
 *
 * @example
 * // 全員0点
 * isEmptyHanchan({ players: [{ score: 0, isSpectator: false }, { score: 0, isSpectator: false }] }) // true
 *
 * // 1人でも点数入力あり
 * isEmptyHanchan({ players: [{ score: 100, isSpectator: false }, { score: 0, isSpectator: false }] }) // false
 *
 * // 全員見学者
 * isEmptyHanchan({ players: [{ isSpectator: true }, { isSpectator: true }] }) // true
 */
function isEmptyHanchan(hanchan: { players: Array<{ score: number | null; isSpectator: boolean }> }): boolean {
  return hanchan.players.every(p =>
    p.isSpectator || p.score === null || p.score === 0
  )
}

/**
 * セッションを保存（Session + Hanchan + PlayerResult を一括作成）
 */
export async function saveSession(data: SessionSaveData): Promise<string> {
  try {
    logger.info('セッション保存開始', {
      context: 'db.sessions.saveSession',
      data: { date: data.date, mode: data.mode }
    });

    // バリデーション
    if (!data.date || !data.mode) {
      throw new ValidationError('必須項目が入力されていません', 'date, mode');
    }

    if (data.hanchans.length === 0) {
      throw new ValidationError('半荘データがありません', 'hanchans');
    }

    // 空ハンチャンの二重チェック（防御的プログラミング）
    const validHanchans = data.hanchans.filter(h => !isEmptyHanchan(h))

    if (validHanchans.length === 0) {
      logger.warn('全ハンチャンが空データでした', {
        context: 'db.sessions.saveSession',
        data: { totalHanchans: data.hanchans.length }
      })
      throw new ValidationError('有効な半荘データがありません', 'hanchans')
    }

    if (validHanchans.length < data.hanchans.length) {
      logger.warn('空ハンチャンが検出されました（フィルタリング済み）', {
        context: 'db.sessions.saveSession',
        data: {
          totalHanchans: data.hanchans.length,
          validHanchans: validHanchans.length,
          filtered: data.hanchans.length - validHanchans.length
        }
      })
    }

    // 有効ハンチャンのみを保存
    const dataToSave = { ...data, hanchans: validHanchans }

    // Session作成
    const sessionId = crypto.randomUUID();
    const now = new Date();

    const session: Session = {
      id: sessionId,
      date: dataToSave.date,
      mode: dataToSave.mode === 'four-player' ? '4-player' : '3-player',
      rate: dataToSave.rate,
      umaValue: dataToSave.umaValue,
      chipRate: dataToSave.chipRate,
      parlorFee: dataToSave.hanchans[0]?.players[0]?.parlorFee || 0,
      umaRule: dataToSave.umaRule as 'standard' | 'second-minus',
      createdAt: now,
      updatedAt: now
    };

    // トランザクション内で全て保存（完了まで他の処理から見えない）
    await db.transaction('rw', [db.sessions, db.hanchans, db.playerResults], async () => {
      await db.sessions.add(session);

      // 各半荘とプレイヤー結果を作成（有効ハンチャンのみ）
      for (const hanchanData of dataToSave.hanchans) {
        const hanchanId = crypto.randomUUID();

        logger.debug('半荘保存開始', {
          context: 'db.sessions.saveSession',
          data: { hanchanNumber: hanchanData.hanchanNumber }
        });

        const hanchan: Hanchan = {
          id: hanchanId,
          sessionId,
          hanchanNumber: hanchanData.hanchanNumber,
          autoCalculated: false,
          createdAt: now
        };

        await db.hanchans.add(hanchan);
        logger.debug('Hanchanレコード保存完了', {
          context: 'db.sessions.saveSession',
          data: { hanchanNumber: hanchanData.hanchanNumber }
        });

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
            position: playerData.position,  // 列番号を保存
            createdAt: now
          };

          await db.playerResults.add(playerResult);
        }
        logger.debug('PlayerResults保存完了', {
          context: 'db.sessions.saveSession',
          data: {
            hanchanNumber: hanchanData.hanchanNumber,
            playerCount: hanchanData.players.length
          }
        });

        // ゼロサム検証
        const isZeroSum = await validateZeroSum(hanchanId);
        logger.debug('ゼロサム検証完了', {
          context: 'db.sessions.saveSession',
          data: {
            hanchanNumber: hanchanData.hanchanNumber,
            isValid: isZeroSum
          }
        });
        if (!isZeroSum) {
          logger.warn(`半荘${hanchanData.hanchanNumber}のゼロサムチェック失敗`, {
            context: 'db.sessions.saveSession',
            data: { hanchanId, hanchanNumber: hanchanData.hanchanNumber }
          });
        }

        // ウママーク合計検証
        const isUmaValid = await validateUmaMarks(hanchanId);
        logger.debug('ウママーク検証完了', {
          context: 'db.sessions.saveSession',
          data: {
            hanchanNumber: hanchanData.hanchanNumber,
            isValid: isUmaValid
          }
        });
        if (!isUmaValid) {
          logger.warn(`半荘${hanchanData.hanchanNumber}のウママーク合計チェック失敗`, {
            context: 'db.sessions.saveSession',
            data: { hanchanId, hanchanNumber: hanchanData.hanchanNumber }
          });
        }

        logger.debug('半荘保存完了', {
          context: 'db.sessions.saveSession',
          data: { hanchanNumber: hanchanData.hanchanNumber }
        });
      }
    }); // トランザクション終了

    logger.info('セッション保存成功', {
      context: 'db.sessions.saveSession',
      data: { sessionId, hanchanCount: dataToSave.hanchans.length }
    });

    return sessionId;
  } catch (err) {
    const error = new DatabaseError('セッションの保存に失敗しました', {
      originalError: err
    });
    logger.error(error.message, {
      context: 'db.sessions.saveSession',
      error
    });
    throw error;
  }
}

/**
 * セッションを削除（カスケード削除: Session → Hanchan → PlayerResult）
 * @param sessionId セッションID
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    logger.info('セッション削除開始', {
      context: 'db.sessions.deleteSession',
      data: { sessionId }
    });

    // Dexieのtransactionで原子性を保証
    await db.transaction('rw', [db.sessions, db.hanchans, db.playerResults], async () => {
      // 1. 関連する半荘を取得
      const hanchans = await db.hanchans
        .where('sessionId')
        .equals(sessionId)
        .toArray();

      // 2. 各半荘のPlayerResultを削除
      for (const hanchan of hanchans) {
        await db.playerResults
          .where('hanchanId')
          .equals(hanchan.id)
          .delete();
      }

      // 3. 半荘を削除
      await db.hanchans
        .where('sessionId')
        .equals(sessionId)
        .delete();

      // 4. セッションを削除
      await db.sessions.delete(sessionId);
    });

    logger.info('セッション削除成功', {
      context: 'db.sessions.deleteSession',
      data: { sessionId }
    });
  } catch (err) {
    const error = new DatabaseError('セッションの削除に失敗しました', {
      originalError: err
    });
    logger.error(error.message, {
      context: 'db.sessions.deleteSession',
      error
    });
    throw error;
  }
}

/**
 * セッションを更新（カスケード削除+再作成パターン）
 * トランザクション内で以下を実行:
 * 1. 既存の半荘・プレイヤー結果を削除
 * 2. セッション設定を更新
 * 3. 新しい半荘・プレイヤー結果を作成
 * 4. サマリーを再計算・保存
 *
 * @param sessionId 更新対象のセッションID
 * @param data 更新データ
 * @param mainUserId メインユーザーID（サマリー計算用）
 */
export async function updateSession(
  sessionId: string,
  data: SessionSaveData,
  mainUserId: string
): Promise<void> {
  try {
    logger.info('セッション更新開始', {
      context: 'db.sessions.updateSession',
      data: { sessionId, date: data.date, mode: data.mode }
    });

    // バリデーション
    if (!data.date || !data.mode) {
      throw new ValidationError('必須項目が入力されていません', 'date, mode');
    }

    if (data.hanchans.length === 0) {
      throw new ValidationError('半荘データがありません', 'hanchans');
    }

    // Dexieのtransactionで原子性を保証（全て成功 or 全て失敗）
    await db.transaction('rw', [db.sessions, db.hanchans, db.playerResults], async () => {
      // 1. 既存の半荘IDを取得
      const existingHanchans = await db.hanchans
        .where('sessionId')
        .equals(sessionId)
        .toArray();

      logger.debug('既存半荘取得完了', {
        context: 'db.sessions.updateSession',
        data: { count: existingHanchans.length }
      });

      // 2. カスケード削除: PlayerResults → Hanchans
      for (const hanchan of existingHanchans) {
        await db.playerResults
          .where('hanchanId')
          .equals(hanchan.id)
          .delete();
      }

      await db.hanchans
        .where('sessionId')
        .equals(sessionId)
        .delete();

      logger.debug('既存データ削除完了', {
        context: 'db.sessions.updateSession'
      });

      // 3. セッション設定を更新
      const now = new Date();
      await db.sessions.update(sessionId, {
        date: data.date,
        mode: data.mode === 'four-player' ? '4-player' : '3-player',
        rate: data.rate,
        umaValue: data.umaValue,
        chipRate: data.chipRate,
        parlorFee: data.hanchans[0]?.players[0]?.parlorFee || 0,
        umaRule: data.umaRule as 'standard' | 'second-minus',
        updatedAt: now
      });

      logger.debug('セッション設定更新完了', {
        context: 'db.sessions.updateSession'
      });

      // 4. 新しい半荘とプレイヤー結果を作成
      for (const hanchanData of data.hanchans) {
        const hanchanId = crypto.randomUUID();

        logger.debug('半荘作成開始', {
          context: 'db.sessions.updateSession',
          data: { hanchanNumber: hanchanData.hanchanNumber }
        });

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
            position: playerData.position,
            createdAt: now
          };

          await db.playerResults.add(playerResult);
        }

        logger.debug('半荘作成完了', {
          context: 'db.sessions.updateSession',
          data: { hanchanNumber: hanchanData.hanchanNumber }
        });

        // ゼロサム検証
        const isZeroSum = await validateZeroSum(hanchanId);
        if (!isZeroSum) {
          logger.warn(`半荘${hanchanData.hanchanNumber}のゼロサムチェック失敗`, {
            context: 'db.sessions.updateSession',
            data: { hanchanId, hanchanNumber: hanchanData.hanchanNumber }
          });
        }

        // ウママーク合計検証
        const isUmaValid = await validateUmaMarks(hanchanId);
        if (!isUmaValid) {
          logger.warn(`半荘${hanchanData.hanchanNumber}のウママーク合計チェック失敗`, {
            context: 'db.sessions.updateSession',
            data: { hanchanId, hanchanNumber: hanchanData.hanchanNumber }
          });
        }
      }
    }); // トランザクション終了

    logger.debug('トランザクション完了', {
      context: 'db.sessions.updateSession'
    });

    // 5. サマリーを再計算（トランザクション外で実行）
    // session-utils.tsのcalculateSessionSummaryを使用
    const { calculateSessionSummary } = await import('../session-utils');
    const summary = await calculateSessionSummary(sessionId, mainUserId);

    // 6. サマリーを保存
    await db.sessions.update(sessionId, { summary });

    logger.info('セッション更新成功', {
      context: 'db.sessions.updateSession',
      data: { sessionId, hanchanCount: data.hanchans.length }
    });
  } catch (err) {
    const error = new DatabaseError('セッションの更新に失敗しました', {
      originalError: err
    });
    logger.error(error.message, {
      context: 'db.sessions.updateSession',
      error
    });
    throw error;
  }
}

// ========================================
// Data Conversion Functions (UI ↔ DB)
// ========================================

/**
 * DB Session → UI SessionSettings
 * 編集モード開始時に使用
 */
export function sessionToSettings(session: Session): SessionSettings {
  return {
    date: session.date,
    rate: session.rate,
    umaValue: session.umaValue,
    chipRate: session.chipRate,
    umaRule: session.umaRule
  }
}

/**
 * DB Hanchan[] → UI Hanchan[]
 * 編集モード開始時に使用
 * - players配列をposition順にソート
 * - umaMarkManualをfalseで初期化（編集時はリセット）
 */
export function dbHanchansToUIHanchans(
  dbHanchans: Array<Hanchan & { players: PlayerResult[] }>
): UIHanchan[] {
  return dbHanchans.map(hanchan => ({
    hanchanNumber: hanchan.hanchanNumber,
    autoCalculated: false, // 編集時はリセット
    players: hanchan.players
      .sort((a, b) => a.position - b.position) // position順にソート
      .map(player => ({
        playerName: player.playerName,
        userId: player.userId,
        score: player.score,
        umaMark: player.umaMark,
        chips: player.chips,
        parlorFee: 0, // UI層で設定（DBにはこのフィールドなし）
        isSpectator: player.isSpectator,
        umaMarkManual: false // 編集時はリセット
      }))
  }))
}

/**
 * UI編集データ → DB保存用データ
 * 保存時に使用
 * - GameMode文字列変換: '4-player' → 'four-player'
 * - position番号を配列インデックスから付与
 * - score ?? 0変換
 */
export function uiDataToSaveData(
  settings: SessionSettings,
  hanchans: UIHanchan[],
  mode: GameMode
): SessionSaveData {
  return {
    date: settings.date,
    mode: mode === '4-player' ? 'four-player' : 'three-player',
    rate: settings.rate,
    umaValue: settings.umaValue,
    chipRate: settings.chipRate,
    umaRule: settings.umaRule,
    hanchans: hanchans.map(hanchan => ({
      hanchanNumber: hanchan.hanchanNumber,
      players: hanchan.players.map((player, idx) => ({
        playerName: player.playerName,
        userId: player.userId,
        score: player.score ?? 0,
        umaMark: player.umaMark,
        chips: player.chips,
        parlorFee: player.parlorFee,
        isSpectator: player.isSpectator,
        position: idx  // 配列インデックスをposition番号として使用
      }))
    }))
  }
}
