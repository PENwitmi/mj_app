import type { PlayerResult, GameMode } from '../db';

// ========================================
// Analysis Types
// ========================================

/**
 * 期間フィルタータイプ
 */
export type PeriodType =
  | 'this-month'      // 今月
  | 'this-year'       // 今年
  | `year-${number}`  // 特定年（例: 'year-2024'）
  | 'all-time'        // 全期間

/**
 * 分析フィルター条件
 */
export interface AnalysisFilter {
  userId: string           // 分析対象ユーザーID
  period: PeriodType       // 期間フィルター
  mode: GameMode | 'all'   // モードフィルター（'4-player' | '3-player' | 'all'）
}

/**
 * 着順統計
 */
export interface RankStatistics {
  totalGames: number         // 総半荘数
  rankCounts: {
    first: number            // 1位回数
    second: number           // 2位回数
    third: number            // 3位回数
    fourth?: number          // 4位回数（4人打ちのみ）
  }
  rankRates: {
    first: number            // 1位率（%）
    second: number           // 2位率（%）
    third: number            // 3位率（%）
    fourth?: number          // 4位率（%）
  }
  averageRank: number        // 平均着順（小数第2位まで）
}

/**
 * 収支統計
 */
export interface RevenueStatistics {
  totalIncome: number        // 総収入（プラスセッションの合計）
  totalExpense: number       // 総支出（マイナスセッションの合計、負の値）
  totalBalance: number       // 総収支（totalIncome + totalExpense）
}

/**
 * ポイント統計
 */
export interface PointStatistics {
  plusPoints: number         // プラスポイント合計（半荘単位）
  minusPoints: number        // マイナスポイント合計（半荘単位、負の値）
  pointBalance: number       // ポイント収支（plusPoints + minusPoints）
}

/**
 * チップ統計
 */
export interface ChipStatistics {
  plusChips: number          // プラスチップ合計
  minusChips: number         // マイナスチップ合計
  chipBalance: number        // チップ収支（plusChips + minusChips）
}

/**
 * 分析統計（統合型）
 */
export interface AnalysisStatistics {
  rank?: RankStatistics      // 着順統計（全体モード時はundefined）
  revenue: RevenueStatistics
  point: PointStatistics
  chip: ChipStatistics
}

// ========================================
// Analysis Functions
// ========================================

/**
 * 半荘内のプレイヤーの着順を計算（点数ベース）
 * session-utils.ts の calculateRanks と同じロジック
 */
function calculateRanksFromScores(playerResults: PlayerResult[]): Map<string, number> {
  const rankMap = new Map<string, number>()

  // 見学者を除外、かつ点数が入力されているプレイヤーのみを対象
  const activePlayers = playerResults
    .filter((p) => !p.isSpectator && p.score !== null)
    .sort((a, b) => b.score! - a.score!) // 点数降順

  // 着順を割り当て（同点の場合は同着）
  let currentRank = 1
  activePlayers.forEach((player, index) => {
    if (index > 0 && player.score! < activePlayers[index - 1].score!) {
      currentRank = index + 1
    }
    rankMap.set(player.id, currentRank)
  })

  return rankMap
}

/**
 * 着順統計を計算
 *
 * @param hanchans 半荘データ配列（各半荘の全プレイヤーデータを含む）
 * @param targetUserId 対象ユーザーID
 * @param mode ゲームモード
 * @returns 着順統計
 */
export function calculateRankStatistics(
  hanchans: Array<{ players: PlayerResult[] }>,
  targetUserId: string,
  mode: '4-player' | '3-player'
): RankStatistics {
  const rankCounts = { first: 0, second: 0, third: 0, fourth: 0 }
  let totalGames = 0

  // 各半荘ごとに着順を計算
  for (const hanchan of hanchans) {
    // 空半荘（全プレイヤーが未入力または見学者）をスキップ
    // 注意: score === 0 は正常なプレイ結果として扱う
    const hasValidScores = hanchan.players.some(p =>
      !p.isSpectator && p.score !== null
    )

    if (!hasValidScores) {
      continue // 全員未入力 or 見学者の場合はスキップ
    }

    // 半荘内の全プレイヤーの着順を計算（点数順）
    const ranks = calculateRanksFromScores(hanchan.players)

    // 対象ユーザーのPlayerResultを見つける
    const targetPlayer = hanchan.players.find(p => p.userId === targetUserId)
    // 対象プレイヤーが存在しない、または見学者、または未入力の場合はスキップ
    // 注意: score === 0 は正常なプレイ結果として扱う
    if (!targetPlayer || targetPlayer.isSpectator || targetPlayer.score === null) {
      continue // 見学者 or 点数未入力はスキップ
    }

    // 対象ユーザーの着順を取得
    const rank = ranks.get(targetPlayer.id)
    if (!rank) continue

    // 着順をカウント
    totalGames++
    switch (rank) {
      case 1: rankCounts.first++; break
      case 2: rankCounts.second++; break
      case 3: rankCounts.third++; break
      case 4: rankCounts.fourth++; break
    }
  }

  if (totalGames === 0) {
    return {
      totalGames: 0,
      rankCounts: { first: 0, second: 0, third: 0, fourth: mode === '4-player' ? 0 : undefined },
      rankRates: { first: 0, second: 0, third: 0, fourth: mode === '4-player' ? 0 : undefined },
      averageRank: 0
    }
  }

  // 着順率計算
  const rankRates = {
    first: (rankCounts.first / totalGames) * 100,
    second: (rankCounts.second / totalGames) * 100,
    third: (rankCounts.third / totalGames) * 100,
    fourth: mode === '4-player' ? (rankCounts.fourth / totalGames) * 100 : undefined
  }

  // 平均着順計算
  const totalRankSum =
    1 * rankCounts.first +
    2 * rankCounts.second +
    3 * rankCounts.third +
    (mode === '4-player' ? 4 * rankCounts.fourth : 0)
  const averageRank = totalRankSum / totalGames

  return {
    totalGames,
    rankCounts: mode === '4-player' ? rankCounts : { ...rankCounts, fourth: undefined },
    rankRates,
    averageRank: Number(averageRank.toFixed(2))
  }
}

/**
 * 収支統計を計算
 */
export function calculateRevenueStatistics(
  sessions: Array<{ totalPayout: number }>
): RevenueStatistics {
  let totalIncome = 0
  let totalExpense = 0

  sessions.forEach(session => {
    if (session.totalPayout > 0) {
      totalIncome += session.totalPayout
    } else {
      totalExpense += session.totalPayout // 負の値
    }
  })

  return {
    totalIncome,
    totalExpense,
    totalBalance: totalIncome + totalExpense
  }
}

/**
 * ポイント統計を計算
 */
export function calculatePointStatistics(
  playerResults: PlayerResult[]
): PointStatistics {
  // 見学者を除外、かつscore !== null && score !== 0のみ対象（防御的プログラミング）
  const activeResults = playerResults.filter(pr =>
    !pr.isSpectator && pr.score !== null && pr.score !== 0
  )

  let plusPoints = 0
  let minusPoints = 0

  activeResults.forEach(pr => {
    const score = pr.score!  // filterで null と 0 は除外済み
    if (score > 0) {
      plusPoints += score
    } else {
      minusPoints += score // 負の値
    }
  })

  return {
    plusPoints,
    minusPoints,
    pointBalance: plusPoints + minusPoints
  }
}

/**
 * チップ統計を計算
 */
export function calculateChipStatistics(
  playerResults: PlayerResult[]
): ChipStatistics {
  let plusChips = 0
  let minusChips = 0

  playerResults.forEach(pr => {
    if (pr.chips > 0) {
      plusChips += pr.chips
    } else if (pr.chips < 0) {
      minusChips += pr.chips
    }
  })

  return {
    plusChips,
    minusChips,
    chipBalance: plusChips + minusChips
  }
}

// ========================================
// Filter Functions
// ========================================

/**
 * 期間でセッションをフィルター
 */
export function filterSessionsByPeriod<T extends { session: { date: string } }>(
  sessions: T[],
  period: PeriodType
): T[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-12

  switch (period) {
    case 'this-month': {
      const targetYearMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`
      return sessions.filter(s => s.session.date.startsWith(targetYearMonth))
    }
    case 'this-year': {
      const targetYear = `${currentYear}`
      return sessions.filter(s => s.session.date.startsWith(targetYear))
    }
    case 'all-time': {
      return sessions
    }
    default: {
      // 'year-YYYY' 形式
      if (period.startsWith('year-')) {
        const year = period.substring(5) // 'year-2024' → '2024'
        return sessions.filter(s => s.session.date.startsWith(year))
      }
      return sessions
    }
  }
}

/**
 * モードでセッションをフィルター
 */
export function filterSessionsByMode<T extends { session: { mode: GameMode } }>(
  sessions: T[],
  mode: GameMode | 'all'
): T[] {
  if (mode === 'all') {
    return sessions
  }
  return sessions.filter(s => s.session.mode === mode)
}
