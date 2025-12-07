import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSessionWithDetails } from '@/lib/db-utils'
import type { Session, Hanchan, PlayerResult } from '@/lib/db-utils'
import { calculateSessionSummary, type SessionSummary } from '@/lib/session-utils'
import { logger } from '@/lib/logger'

export interface SessionWithSummary {
  session: Session
  summary: SessionSummary
  hanchans?: Array<Hanchan & { players: PlayerResult[] }>
}

/**
 * セッション一覧管理カスタムフック
 * 全セッション + サマリー情報を管理
 * @param mainUserId メインユーザーID
 * @param mainUserId メインユーザーID
 * @param includeHanchans hanchansデータを含めるかどうか（デフォルト: false）
 */
export function useSessions(mainUserId: string, includeHanchans: boolean = false) {
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

        // 各セッションのサマリーを取得（保存済みがあればそれを使用、なければ計算）
        const sessionsWithSummary = await Promise.all(
          allSessions.map(async (session: Session) => {
            try {
              let hanchans: Array<Hanchan & { players: PlayerResult[] }> | undefined

              // hanchansデータが必要な場合は取得
              if (includeHanchans) {
                const sessionDetails = await getSessionWithDetails(session.id)
                if (sessionDetails) {
                  hanchans = sessionDetails.hanchans
                }
              }

              // 保存済みサマリーがあればそれを使用（パフォーマンス最適化）
              if (session.summary) {
                return { session, summary: session.summary, hanchans }
              }

              // 保存済みサマリーがない場合は計算（後方互換性）
              const summary = await calculateSessionSummary(session.id, mainUserId)
              return { session, summary, hanchans }
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

        // 作成日時降順ソート（新しい順＝入力順の逆）
        sessionsWithSummary.sort((a: SessionWithSummary, b: SessionWithSummary) =>
          b.session.createdAt.getTime() - a.session.createdAt.getTime()
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
  }, [allSessions, mainUserId, includeHanchans])

  return {
    sessions,
    loading,
    error,
  }
}
