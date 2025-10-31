import { db } from './db'
import { calculateSessionSummary } from './session-utils'
import { logger } from './logger'
import { DatabaseError } from './errors'

// ========================================
// Type Definitions
// ========================================

export interface MigrationResult {
  success: boolean
  totalSessions: number
  successCount: number
  failedSessions: Array<{
    sessionId: string
    error: string
  }>
  duration: number // ミリ秒
}

export interface MigrationProgress {
  current: number
  total: number
  sessionId: string
}

export type MigrationProgressCallback = (progress: MigrationProgress) => void

// ========================================
// Migration Functions
// ========================================

/**
 * 全セッションのサマリーを再計算
 * chips/parlorFee修正後の新しいロジックで既存データを更新
 *
 * @param mainUserId メインユーザーID
 * @param onProgress 進捗コールバック（オプション）
 * @returns マイグレーション結果
 */
export async function migrateAllSessionSummaries(
  mainUserId: string,
  onProgress?: MigrationProgressCallback
): Promise<MigrationResult> {
  const startTime = performance.now()

  logger.info('セッションサマリーマイグレーション開始', {
    context: 'migration-utils.migrateAllSessionSummaries',
    data: { mainUserId }
  })

  const result: MigrationResult = {
    success: true,
    totalSessions: 0,
    successCount: 0,
    failedSessions: [],
    duration: 0
  }

  try {
    // 全セッションを取得
    const sessions = await db.sessions.toArray()
    result.totalSessions = sessions.length

    logger.info('セッション取得完了', {
      context: 'migration-utils.migrateAllSessionSummaries',
      data: { sessionCount: sessions.length }
    })

    // セッションがない場合は早期リターン
    if (sessions.length === 0) {
      logger.info('マイグレーション対象のセッションがありません', {
        context: 'migration-utils.migrateAllSessionSummaries'
      })
      result.duration = performance.now() - startTime
      return result
    }

    // 各セッションを処理
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i]

      try {
        // 進捗通知
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: sessions.length,
            sessionId: session.id
          })
        }

        // サマリーを再計算
        const summary = await calculateSessionSummary(session.id, mainUserId)

        // セッションを更新
        await db.sessions.update(session.id, { summary })

        result.successCount++

        logger.debug('セッションサマリー更新完了', {
          context: 'migration-utils.migrateAllSessionSummaries',
          data: {
            sessionId: session.id,
            date: session.date,
            progress: `${i + 1}/${sessions.length}`
          }
        })
      } catch (error) {
        // 個別セッションのエラーは記録して続行
        const errorMessage = error instanceof Error ? error.message : String(error)

        result.failedSessions.push({
          sessionId: session.id,
          error: errorMessage
        })

        logger.error('セッションサマリー更新失敗', {
          context: 'migration-utils.migrateAllSessionSummaries',
          data: {
            sessionId: session.id,
            date: session.date,
            error: errorMessage
          }
        })
      }
    }

    // 全体の成否を判定（1つでも失敗したら部分的失敗）
    result.success = result.failedSessions.length === 0
    result.duration = performance.now() - startTime

    logger.info('セッションサマリーマイグレーション完了', {
      context: 'migration-utils.migrateAllSessionSummaries',
      data: {
        totalSessions: result.totalSessions,
        successCount: result.successCount,
        failedCount: result.failedSessions.length,
        duration: `${result.duration.toFixed(0)}ms`,
        success: result.success
      }
    })

    return result
  } catch (error) {
    // 全体的なエラー（DB接続エラー等）
    const dbError = new DatabaseError('マイグレーション実行中にエラーが発生しました', {
      originalError: error
    })

    logger.error(dbError.message, {
      context: 'migration-utils.migrateAllSessionSummaries',
      error: dbError
    })

    result.success = false
    result.duration = performance.now() - startTime

    throw dbError
  }
}

/**
 * マイグレーションが必要かチェック
 * 既存のセッションがある場合はtrueを返す
 *
 * @returns マイグレーションが必要な場合true
 */
export async function checkMigrationNeeded(): Promise<boolean> {
  try {
    const sessionCount = await db.sessions.count()
    return sessionCount > 0
  } catch (error) {
    logger.error('マイグレーション必要性チェック失敗', {
      context: 'migration-utils.checkMigrationNeeded',
      error
    })
    return false
  }
}
