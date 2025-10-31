import { useState, useCallback } from 'react'
import { migrateAllSessionSummaries, checkMigrationNeeded, type MigrationResult, type MigrationProgress } from '@/lib/migration-utils'
import { logger } from '@/lib/logger'

// ========================================
// Type Definitions
// ========================================

export type MigrationStatus = 'idle' | 'checking' | 'ready' | 'running' | 'success' | 'error'

export interface UseMigrationReturn {
  status: MigrationStatus
  progress: MigrationProgress | null
  result: MigrationResult | null
  error: string | null
  isNeeded: boolean
  checkIfNeeded: () => Promise<void>
  executeMigration: (mainUserId: string) => Promise<void>
  reset: () => void
}

// ========================================
// Custom Hook
// ========================================

/**
 * マイグレーション実行のための状態管理フック
 *
 * @returns マイグレーション関連の状態と関数
 */
export function useMigration(): UseMigrationReturn {
  const [status, setStatus] = useState<MigrationStatus>('idle')
  const [progress, setProgress] = useState<MigrationProgress | null>(null)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isNeeded, setIsNeeded] = useState<boolean>(false)

  /**
   * マイグレーションが必要かチェック
   */
  const checkIfNeeded = useCallback(async () => {
    setStatus('checking')
    setError(null)

    try {
      const needed = await checkMigrationNeeded()
      setIsNeeded(needed)
      setStatus(needed ? 'ready' : 'idle')

      logger.debug('マイグレーション必要性チェック完了', {
        context: 'useMigration.checkIfNeeded',
        data: { needed }
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'マイグレーション必要性チェックに失敗しました'
      setError(errorMessage)
      setStatus('error')

      logger.error('マイグレーション必要性チェック失敗', {
        context: 'useMigration.checkIfNeeded',
        error: err as Error
      })
    }
  }, [])

  /**
   * マイグレーションを実行
   */
  const executeMigration = useCallback(async (mainUserId: string) => {
    setStatus('running')
    setProgress(null)
    setResult(null)
    setError(null)

    logger.info('マイグレーション実行開始', {
      context: 'useMigration.executeMigration',
      data: { mainUserId }
    })

    try {
      // 進捗コールバック
      const onProgress = (progressData: MigrationProgress) => {
        setProgress(progressData)
      }

      // マイグレーション実行
      const migrationResult = await migrateAllSessionSummaries(mainUserId, onProgress)
      setResult(migrationResult)

      // 成否に応じてステータスを設定
      if (migrationResult.success) {
        setStatus('success')
        logger.info('マイグレーション実行成功', {
          context: 'useMigration.executeMigration',
          data: {
            totalSessions: migrationResult.totalSessions,
            successCount: migrationResult.successCount,
            duration: migrationResult.duration
          }
        })
      } else {
        setStatus('error')
        setError('一部のセッションの更新に失敗しました。詳細は結果を確認してください。')
        logger.warn('マイグレーション部分的失敗', {
          context: 'useMigration.executeMigration',
          data: {
            totalSessions: migrationResult.totalSessions,
            successCount: migrationResult.successCount,
            failedCount: migrationResult.failedSessions.length
          }
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'マイグレーション実行中にエラーが発生しました'
      setError(errorMessage)
      setStatus('error')

      logger.error('マイグレーション実行失敗', {
        context: 'useMigration.executeMigration',
        error: err as Error
      })
    }
  }, [])

  /**
   * 状態をリセット
   */
  const reset = useCallback(() => {
    setStatus('idle')
    setProgress(null)
    setResult(null)
    setError(null)
    setIsNeeded(false)

    logger.debug('マイグレーション状態リセット', {
      context: 'useMigration.reset'
    })
  }, [])

  return {
    status,
    progress,
    result,
    error,
    isNeeded,
    checkIfNeeded,
    executeMigration,
    reset
  }
}
