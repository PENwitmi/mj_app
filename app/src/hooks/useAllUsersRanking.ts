import { useMemo } from 'react'
import type { User, GameMode, Session, Hanchan, PlayerResult } from '@/lib/db'
import {
  calculateAllStatistics,
  calculateRankStatistics,
  calculateRecordStatistics,
  filterSessionsByMode,
  type FilteredSession
} from '@/lib/db-utils'

// ========================================
// Types
// ========================================

export type SessionCountFilter = 'all' | 'last-5' | 'last-10'

export interface UserRankingData {
  userId: string
  userName: string
  isMainUser: boolean
  sessionCount: number  // 実際の参加セッション数
  stats: {
    // 基本成績（mode='all'時はundefined）
    averageRank?: number
    topRate?: number
    rentaiRate?: number
    lastAvoidRate?: number

    // 収支
    totalRevenue: number
    averageRevenuePerSession: number

    // 記録
    maxScore: number              // 半荘最高得点
    maxRevenueInSession: number   // 1日最高収支
    maxChipsInSession: number     // 1日最高チップ
    maxConsecutiveTop: number     // 最大連続トップ
  }
}

export interface RankingEntry {
  rank: number
  user: UserRankingData
  value: number
  formattedValue: string
}

export interface Rankings {
  // 基本成績（mode='all'時はnull）
  averageRank: RankingEntry[] | null
  topRate: RankingEntry[] | null
  rentaiRate: RankingEntry[] | null
  lastAvoidRate: RankingEntry[] | null

  // 収支
  totalRevenue: RankingEntry[]
  averageRevenue: RankingEntry[]

  // 記録
  maxScore: RankingEntry[]
  maxRevenueInSession: RankingEntry[]
  maxChipsInSession: RankingEntry[]
  maxConsecutiveTop: RankingEntry[]
}

export interface UseAllUsersRankingResult {
  rankings: Rankings
  userCount: number
}

// ========================================
// Helper Functions
// ========================================

/**
 * ソートしてランキングを生成（同点は同順位）
 */
function createRanking(
  users: UserRankingData[],
  getValue: (u: UserRankingData) => number | undefined,
  formatValue: (v: number) => string,
  ascending: boolean = false
): RankingEntry[] {
  // 値がundefinedのユーザーを除外
  const validUsers = users.filter(u => getValue(u) !== undefined)

  // ソート
  const sorted = [...validUsers].sort((a, b) => {
    const aVal = getValue(a)!
    const bVal = getValue(b)!
    return ascending ? aVal - bVal : bVal - aVal
  })

  // ランキング生成（同点は同順位）
  const result: RankingEntry[] = []
  let currentRank = 1
  let prevValue: number | null = null

  sorted.forEach((user, index) => {
    const value = getValue(user)!

    // 同点でなければ順位を更新
    if (prevValue !== null && value !== prevValue) {
      currentRank = index + 1
    }

    result.push({
      rank: currentRank,
      user,
      value,
      formattedValue: formatValue(value)
    })

    prevValue = value
  })

  return result
}

/**
 * フォーマット関数
 */
const formatters = {
  rank: (v: number) => `${v.toFixed(2)}位`,
  percent: (v: number) => `${v.toFixed(1)}%`,
  revenue: (v: number) => `${v >= 0 ? '+' : ''}${v.toLocaleString()}pt`,
  score: (v: number) => `${v >= 0 ? '+' : ''}${v.toLocaleString()}点`,
  chips: (v: number) => `${v >= 0 ? '+' : ''}${v}枚`,
  streak: (v: number) => `${v}連勝`
}

// ========================================
// Main Hook
// ========================================

type SessionWithHanchans = {
  session: Session
  hanchans?: Array<Hanchan & { players: PlayerResult[] }>
}

export function useAllUsersRanking(
  sessions: SessionWithHanchans[],
  mode: GameMode | 'all',
  mainUser: User | null,
  users: User[],
  sessionCountFilter: SessionCountFilter = 'all'
): UseAllUsersRankingResult {
  const rankings = useMemo(() => {
    // 全ユーザーリスト
    const allUsers = mainUser ? [mainUser, ...users] : users

    if (allUsers.length === 0) {
      return createEmptyRankings()
    }

    // モードでセッションをフィルタ
    const filteredSessions: FilteredSession[] = filterSessionsByMode(sessions, mode)

    // セッション数フィルタの閾値を取得
    const getSessionLimit = (filter: SessionCountFilter): number | null => {
      switch (filter) {
        case 'last-5': return 5
        case 'last-10': return 10
        default: return null
      }
    }
    const sessionLimit = getSessionLimit(sessionCountFilter)

    // 各ユーザーの統計を計算（内部用に totalSessions を含む）
    type UserStatsInternal = UserRankingData & { totalSessions: number }
    const userStats: UserStatsInternal[] = allUsers.map(user => {
      // ユーザーが参加しているセッションをフィルタ
      let userSessions = filteredSessions.filter(({ hanchans }) =>
        hanchans?.some(h => h.players.some(p => p.userId === user.id && !p.isSpectator))
      )

      // 実際の参加セッション数を記録
      const totalSessionCount = userSessions.length

      // セッション数フィルタが適用されている場合、日付降順でN件に絞り込む
      if (sessionLimit !== null && userSessions.length > 0) {
        userSessions = [...userSessions]
          .sort((a, b) => b.session.date.localeCompare(a.session.date))
          .slice(0, sessionLimit)
      }

      // 統計計算用の半荘リスト
      const allHanchans = userSessions.flatMap(({ hanchans }) => hanchans || [])

      // 着順統計（mode='all'以外のみ）
      const rankStats = mode !== 'all'
        ? calculateRankStatistics(allHanchans, user.id, mode)
        : null

      // 全体統計
      const allStats = calculateAllStatistics(
        userSessions,
        user.id,
        mode,
        rankStats ?? undefined
      )

      // 記録統計
      const recordStats = calculateRecordStatistics(userSessions, user.id, mode)

      // 連対率・ラス回避率の計算
      let rentaiRate: number | undefined
      let lastAvoidRate: number | undefined

      if (rankStats && rankStats.totalGames > 0) {
        rentaiRate = rankStats.rankRates.first + rankStats.rankRates.second
        if (mode === '4-player' && rankStats.rankRates.fourth !== undefined) {
          lastAvoidRate = 100 - rankStats.rankRates.fourth
        } else if (mode === '3-player') {
          lastAvoidRate = 100 - rankStats.rankRates.third
        }
      }

      return {
        userId: user.id,
        userName: user.isMainUser ? '自分' : user.name,
        isMainUser: user.isMainUser,
        sessionCount: totalSessionCount,  // 実際の参加セッション数（フィルタ前）
        totalSessions: allStats.basic.totalSessions,  // 統計計算に使用したセッション数
        stats: {
          // 基本成績
          averageRank: rankStats?.averageRank,
          topRate: rankStats?.rankRates.first,
          rentaiRate,
          lastAvoidRate,

          // 収支
          totalRevenue: allStats.revenue.totalBalance,
          averageRevenuePerSession: allStats.basic.averageRevenuePerSession,

          // 記録
          maxScore: recordStats.maxScoreInHanchan.value === -Infinity
            ? 0
            : recordStats.maxScoreInHanchan.value,
          maxRevenueInSession: recordStats.maxRevenueInSession.value === -Infinity
            ? 0
            : recordStats.maxRevenueInSession.value,
          maxChipsInSession: recordStats.maxChipsInSession.value === -Infinity
            ? 0
            : recordStats.maxChipsInSession.value,
          maxConsecutiveTop: recordStats.maxConsecutiveTopStreak
        }
      }
    })

    // データがあるユーザーのみフィルタ（セッション0件を除外）
    const activeUsers = userStats.filter(u => u.totalSessions > 0)

    // ランキング生成
    const isAllMode = mode === 'all'

    return {
      // 基本成績（mode='all'時はnull）
      averageRank: isAllMode ? null : createRanking(
        activeUsers,
        u => u.stats.averageRank,
        formatters.rank,
        true // 昇順（低いほど上位）
      ),
      topRate: isAllMode ? null : createRanking(
        activeUsers,
        u => u.stats.topRate,
        formatters.percent
      ),
      rentaiRate: isAllMode ? null : createRanking(
        activeUsers,
        u => u.stats.rentaiRate,
        formatters.percent
      ),
      lastAvoidRate: isAllMode ? null : createRanking(
        activeUsers,
        u => u.stats.lastAvoidRate,
        formatters.percent
      ),

      // 収支
      totalRevenue: createRanking(
        activeUsers,
        u => u.stats.totalRevenue,
        formatters.revenue
      ),
      averageRevenue: createRanking(
        activeUsers,
        u => u.stats.averageRevenuePerSession,
        formatters.revenue
      ),

      // 記録
      maxScore: createRanking(
        activeUsers,
        u => u.stats.maxScore,
        formatters.score
      ),
      maxRevenueInSession: createRanking(
        activeUsers,
        u => u.stats.maxRevenueInSession,
        formatters.revenue
      ),
      maxChipsInSession: createRanking(
        activeUsers,
        u => u.stats.maxChipsInSession,
        formatters.chips
      ),
      maxConsecutiveTop: createRanking(
        activeUsers,
        u => u.stats.maxConsecutiveTop,
        formatters.streak
      )
    } satisfies Rankings
  }, [sessions, mode, mainUser, users, sessionCountFilter])

  const userCount = useMemo(() => {
    const allUsers = mainUser ? [mainUser, ...users] : users
    return allUsers.length
  }, [mainUser, users])

  return { rankings, userCount }
}

// ========================================
// Empty Rankings
// ========================================

function createEmptyRankings(): Rankings {
  return {
    averageRank: null,
    topRate: null,
    rentaiRate: null,
    lastAvoidRate: null,
    totalRevenue: [],
    averageRevenue: [],
    maxScore: [],
    maxRevenueInSession: [],
    maxChipsInSession: [],
    maxConsecutiveTop: []
  }
}
