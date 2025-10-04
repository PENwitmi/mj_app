import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import type { Session } from '@/lib/db'
import { calculateSessionSummary, type SessionSummary } from '@/lib/session-utils'
import { logger } from '@/lib/logger'

export interface SessionWithSummary {
  session: Session
  summary: SessionSummary
}

/**
 * セッション一覧管理カスタムフック
 * 全セッション + サマリー情報を管理
 */
export function useSessions(mainUserId: string) {
  const [sessions, setSessions] = useState<SessionWithSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Dexie useLiveQueryで全セッションを監視
  const allSessions = useLiveQuery(() => db.sessions.toArray(), [])

  useEffect(() => {
    if (!allSessions) return

    const loadSessionsWithSummaries = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log(`[DEBUG] 📋 履歴タブ: セッション読み込み開始 (全${allSessions.length}件)`)
        const startTime = performance.now()

        let cachedCount = 0
        let calculatedCount = 0

        // 各セッションのサマリーを取得（保存済みがあればそれを使用、なければ計算）
        const sessionsWithSummary = await Promise.all(
          allSessions.map(async (session: Session) => {
            try {
              // 保存済みサマリーがあればそれを使用（パフォーマンス最適化）
              if (session.summary) {
                cachedCount++
                return { session, summary: session.summary }
              }

              // 保存済みサマリーがない場合は計算（後方互換性）
              calculatedCount++
              const summary = await calculateSessionSummary(session.id, mainUserId)
              return { session, summary }
            } catch (err) {
              logger.error('Failed to calculate session summary', {
                context: 'useSessions',
                data: { sessionId: session.id },
                error: err as Error
              })
              // エラーが発生してもスキップせず、デフォルト値を返す
              return {
                session,
                summary: {
                  sessionId: session.id,
                  date: session.date,
                  mode: session.mode,
                  hanchanCount: 0,
                  totalPayout: 0,
                  totalChips: 0,
                  averageRank: 0,
                  rankCounts: { first: 0, second: 0, third: 0, fourth: 0 }
                } as SessionSummary
              }
            }
          })
        )

        // 日付降順ソート（新しい順）
        sessionsWithSummary.sort((a: SessionWithSummary, b: SessionWithSummary) =>
          b.session.date.localeCompare(a.session.date)
        )

        const totalTime = performance.now() - startTime

        console.log(`[DEBUG] ✅ 履歴タブ: 読み込み完了 (${totalTime.toFixed(1)}ms)`, {
          total: allSessions.length,
          cached: cachedCount,
          calculated: calculatedCount,
          performance: cachedCount > 0 ? '🚀 キャッシュ利用' : '⚠️ 全計算'
        })

        setSessions(sessionsWithSummary)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load sessions')
        setError(error)
        logger.error('Failed to load sessions', { context: 'useSessions', error })
      } finally {
        setLoading(false)
      }
    }

    loadSessionsWithSummaries()
  }, [allSessions, mainUserId])

  return {
    sessions,
    loading,
    error,
  }
}
