import type { PlayerResult, GameMode, Session, Hanchan } from '../db';
import { umaMarkToValue } from '../uma-utils';

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
 * 記録統計
 */
export interface RecordStatistics {
  // 半荘単位
  maxScoreInHanchan: { value: number; date: string }      // 半荘最高得点 + 日付
  minScoreInHanchan: { value: number; date: string }      // 半荘最低得点 + 日付

  // セッション単位（ポイント小計合計）
  maxPointsInSession: { value: number; date: string }     // セッション最高ポイント + 日付
  minPointsInSession: { value: number; date: string }     // セッション最低ポイント + 日付

  // セッション単位（収支）
  maxRevenueInSession: { value: number; date: string }    // セッション最高収支 + 日付
  minRevenueInSession: { value: number; date: string }    // セッション最低収支 + 日付

  // セッション単位（チップ）
  maxChipsInSession: { value: number; date: string }      // セッション最高チップ + 日付
  minChipsInSession: { value: number; date: string }      // セッション最低チップ + 日付

  // 連続記録（過去最大）
  maxConsecutiveTopStreak: number                          // 最大連続トップ記録
  maxConsecutiveLastStreak: number                         // 最大連続ラス記録

  // 現在の連続（オプション）
  currentTopStreak?: number                                // 現在の連続トップ中
  currentLastStreak?: number                               // 現在の連続ラス中
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

/**
 * 拡張収支統計（場代を含む）
 */
export interface ExtendedRevenueStatistics extends RevenueStatistics {
  totalParlorFee: number     // 総場代
}

/**
 * 統計計算オプション
 */
export interface StatisticsOptions {
  excludeParlorFee?: boolean  // 場代を除外するか（デフォルト: true）
}

/**
 * 基本統計
 */
export interface BasicStatistics {
  totalSessions: number          // 総セッション数
  totalHanchans: number          // 総半荘数
  averageScorePerHanchan: number // 平均スコア/半荘
  averageRevenuePerSession: number // 平均収支/セッション
  averageRank?: number           // 平均着順（全体モード時はundefined）
  averageChipsPerSession: number // 平均チップ/セッション
}

/**
 * 統合統計（全統計を1回のイテレーションで計算）
 */
export interface AllStatistics {
  revenue: ExtendedRevenueStatistics
  point: PointStatistics
  chip: ChipStatistics
  basic: BasicStatistics
}

/**
 * フィルター済みセッションの型
 */
export type FilteredSession = {
  session: Session
  hanchans?: Array<Hanchan & { players: PlayerResult[] }>
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
 * 全統計を1回のイテレーションで計算
 *
 * AnalysisTab.tsxで分散していた統計計算ロジックを統合し、
 * パフォーマンスを改善（4回のループ → 1回）
 *
 * @param sessions フィルター済みセッション配列
 * @param targetUserId 対象ユーザーID
 * @param mode ゲームモード（'all'の場合、平均着順はundefined）
 * @param rankStats 着順統計（平均着順の取得用、事前計算済み）
 * @returns 全統計（revenue, point, chip, basic）
 */
export function calculateAllStatistics(
  sessions: FilteredSession[],
  targetUserId: string,
  mode: GameMode | 'all',
  rankStats?: RankStatistics,
  options: StatisticsOptions = { excludeParlorFee: true }
): AllStatistics {
  // 収支統計用
  let totalIncome = 0
  let totalExpense = 0
  let totalParlorFee = 0

  // ポイント統計用
  let plusPoints = 0
  let minusPoints = 0

  // チップ統計用
  let plusChips = 0
  let minusChips = 0

  // 基本統計用
  let totalHanchans = 0

  // 1回のイテレーションで全統計を計算
  sessions.forEach(({ session, hanchans }) => {
    if (!hanchans) return

    // セッション単位の変数
    let sessionRevenue = 0
    let sessionChips = 0
    let sessionParlorFee = 0
    let chipsInitialized = false

    hanchans.forEach(hanchan => {
      const userResult = hanchan.players.find(p => p.userId === targetUserId)

      // 見学者・未入力を除外
      if (!userResult || userResult.isSpectator || userResult.score === null) {
        return
      }

      // 半荘カウント
      totalHanchans++

      // chips/parlorFeeはセッションで1回のみ取得
      if (!chipsInitialized) {
        sessionChips = userResult.chips || 0
        sessionParlorFee = userResult.parlorFee || 0
        chipsInitialized = true
        totalParlorFee += sessionParlorFee
      }

      // 小計（score + umaPoints * umaValue）
      const umaPoints = umaMarkToValue(userResult.umaMark)
      const subtotal = userResult.score + umaPoints * session.umaValue

      // ポイント統計: プラス/マイナスに振り分け
      if (subtotal > 0) {
        plusPoints += subtotal
      } else {
        minusPoints += subtotal
      }

      // 収支計算: レート適用してセッション収支に加算
      const scorePayout = subtotal * session.rate
      sessionRevenue += scorePayout
    })

    // セッション終了時の処理
    if (chipsInitialized) {
      // チップ統計: セッション単位でプラス/マイナスに振り分け
      if (sessionChips >= 0) {
        plusChips += sessionChips
      } else {
        minusChips += sessionChips
      }

      // 収支統計: chips/parlorFeeを加算
      const chipsPayout = options.excludeParlorFee
        ? sessionChips * session.chipRate
        : sessionChips * session.chipRate - sessionParlorFee
      sessionRevenue += chipsPayout

      // 収支統計: セッション単位でプラス/マイナスに振り分け
      if (sessionRevenue >= 0) {
        totalIncome += sessionRevenue
      } else {
        totalExpense += sessionRevenue
      }
    }
  })

  // 基本統計の計算
  const totalSessions = sessions.length
  const totalBalance = totalIncome + totalExpense
  const pointBalance = plusPoints + minusPoints
  const chipBalance = plusChips + minusChips

  const averageScorePerHanchan = totalHanchans > 0 ? pointBalance / totalHanchans : 0
  const averageRevenuePerSession = totalSessions > 0 ? totalBalance / totalSessions : 0
  const averageChipsPerSession = totalSessions > 0 ? chipBalance / totalSessions : 0

  // 平均着順: mode='all'時はundefined
  const averageRank = mode !== 'all' && rankStats ? rankStats.averageRank : undefined

  return {
    revenue: {
      totalIncome,
      totalExpense,
      totalBalance,
      totalParlorFee
    },
    point: {
      plusPoints,
      minusPoints,
      pointBalance
    },
    chip: {
      plusChips,
      minusChips,
      chipBalance
    },
    basic: {
      totalSessions,
      totalHanchans,
      averageScorePerHanchan,
      averageRevenuePerSession,
      averageRank,
      averageChipsPerSession
    }
  }
}

/**
 * 記録統計を計算
 *
 * @param sessions セッション配列（各セッションの半荘データを含む）
 * @param targetUserId 対象ユーザーID
 * @param selectedMode ゲームモード（'all'の場合も計算するが、モード別に最下位を判定）
 * @returns 記録統計
 */
export function calculateRecordStatistics(
  sessions: Array<{ session: Session; hanchans?: Array<Hanchan & { players: PlayerResult[] }> }>,
  targetUserId: string,
  _selectedMode: GameMode | 'all', // 将来の拡張用（現在は各半荘のmodeを使用）
  options: StatisticsOptions = { excludeParlorFee: true }
): RecordStatistics {
  // 初期値設定
  let maxScoreInHanchan = { value: -Infinity, date: '' }
  let minScoreInHanchan = { value: Infinity, date: '' }
  let maxPointsInSession = { value: -Infinity, date: '' }
  let minPointsInSession = { value: Infinity, date: '' }
  let maxRevenueInSession = { value: -Infinity, date: '' }
  let minRevenueInSession = { value: Infinity, date: '' }
  let maxChipsInSession = { value: -Infinity, date: '' }
  let minChipsInSession = { value: Infinity, date: '' }

  // 1. 全半荘を時系列順に収集・ソート
  type HanchanWithContext = {
    date: string
    hanchanNumber: number
    session: Session
    hanchan: Hanchan & { players: PlayerResult[] }
    userResult: PlayerResult
  }

  const allHanchans: HanchanWithContext[] = []

  sessions.forEach(({ session, hanchans }) => {
    if (!hanchans) return

    hanchans.forEach(hanchan => {
      const userResult = hanchan.players.find(p => p.userId === targetUserId)

      // 見学者・未入力を除外
      if (!userResult || userResult.isSpectator || userResult.score === null) {
        return
      }

      allHanchans.push({
        date: session.date,
        hanchanNumber: hanchan.hanchanNumber,
        session,
        hanchan,
        userResult
      })
    })
  })

  // 時系列順にソート（date → session.createdAt → hanchanNumber）
  allHanchans.sort((a, b) => {
    // 1. 日付でソート
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date)
    }

    // 2. 同じ日付の場合、セッションの作成日時でソート
    const aTime = a.session.createdAt.getTime()
    const bTime = b.session.createdAt.getTime()
    if (aTime !== bTime) {
      return aTime - bTime
    }

    // 3. 同じセッション内では半荘番号でソート
    return a.hanchanNumber - b.hanchanNumber
  })

  // 2. 半荘単位の最高/最低スコアを計算
  allHanchans.forEach(({ date, userResult }) => {
    if (userResult.score > maxScoreInHanchan.value) {
      maxScoreInHanchan = { value: userResult.score, date }
    }
    if (userResult.score < minScoreInHanchan.value) {
      minScoreInHanchan = { value: userResult.score, date }
    }
  })

  // 3. セッション単位のポイント・収支・チップを計算
  const sessionResults = new Map<string, {
    points: number
    revenue: number
    chips: number
    date: string
  }>()

  sessions.forEach(({ session, hanchans }) => {
    if (!hanchans) return

    let sessionPoints = 0
    let sessionRevenue = 0
    let sessionChips = 0
    let sessionParlorFee = 0
    let chipsInitialized = false

    hanchans.forEach(hanchan => {
      const userResult = hanchan.players.find(p => p.userId === targetUserId)

      if (!userResult || userResult.isSpectator || userResult.score === null) {
        return
      }

      // ポイント小計計算
      // TODO: Issue #11でリファクタリング時にロジック統合（pointStatsと重複）
      const umaPoints = umaMarkToValue(userResult.umaMark)
      const subtotal = userResult.score + umaPoints * session.umaValue
      sessionPoints += subtotal

      // 収支計算
      // TODO: Issue #11でリファクタリング時にロジック統合（revenueStatsと重複）
      if (!chipsInitialized) {
        sessionChips = userResult.chips || 0
        sessionParlorFee = userResult.parlorFee || 0
        chipsInitialized = true
      }

      const scorePayout = subtotal * session.rate
      sessionRevenue += scorePayout
    })

    // chips/parlorFee加算
    if (chipsInitialized) {
      const chipsPayout = options.excludeParlorFee
        ? sessionChips * session.chipRate
        : sessionChips * session.chipRate - sessionParlorFee
      sessionRevenue += chipsPayout
    }

    sessionResults.set(session.id, {
      points: sessionPoints,
      revenue: sessionRevenue,
      chips: sessionChips,
      date: session.date
    })
  })

  // セッション単位の最高/最低を判定
  sessionResults.forEach(({ points, revenue, chips, date }) => {
    if (points > maxPointsInSession.value) {
      maxPointsInSession = { value: points, date }
    }
    if (points < minPointsInSession.value) {
      minPointsInSession = { value: points, date }
    }
    if (revenue > maxRevenueInSession.value) {
      maxRevenueInSession = { value: revenue, date }
    }
    if (revenue < minRevenueInSession.value) {
      minRevenueInSession = { value: revenue, date }
    }
    if (chips > maxChipsInSession.value) {
      maxChipsInSession = { value: chips, date }
    }
    if (chips < minChipsInSession.value) {
      minChipsInSession = { value: chips, date }
    }
  })

  // 4. 連続記録計算（時系列順に処理）
  let maxTopStreak = 0
  let currentTopStreak = 0
  let maxLastStreak = 0
  let currentLastStreak = 0

  allHanchans.forEach(({ session, hanchan, userResult }) => {
    // 着順を計算
    const ranks = calculateRanksFromScores(hanchan.players)
    const rank = ranks.get(userResult.id)

    if (!rank) return

    // 連続トップカウント
    if (rank === 1) {
      currentTopStreak++
      maxTopStreak = Math.max(maxTopStreak, currentTopStreak)
    } else {
      currentTopStreak = 0
    }

    // 連続ラスカウント（モード別に最下位を判定）
    const lastRank = session.mode === '4-player' ? 4 : 3

    if (rank === lastRank) {
      currentLastStreak++
      maxLastStreak = Math.max(maxLastStreak, currentLastStreak)
    } else {
      currentLastStreak = 0
    }
  })

  return {
    maxScoreInHanchan,
    minScoreInHanchan,
    maxPointsInSession,
    minPointsInSession,
    maxRevenueInSession,
    minRevenueInSession,
    maxChipsInSession,
    minChipsInSession,
    maxConsecutiveTopStreak: maxTopStreak,
    maxConsecutiveLastStreak: maxLastStreak,
    currentTopStreak: currentTopStreak > 0 ? currentTopStreak : undefined,
    currentLastStreak: currentLastStreak > 0 ? currentLastStreak : undefined
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
