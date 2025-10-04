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

        // 各セッションのサマリーを並列計算
        const sessionsWithSummary = await Promise.all(
          allSessions.map(async (session: Session) => {
            try {
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
