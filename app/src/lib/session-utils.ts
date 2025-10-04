import type { PlayerResult, UmaMark, GameMode } from './db'
import { getSessionWithDetails } from './db-utils'

// ========================================
// Type Definitions
// ========================================

export interface SessionSummary {
  sessionId: string
  date: string
  mode: GameMode
  hanchanCount: number
  totalPayout: number // 最終収支合計
  totalChips: number // チップ合計
  averageRank: number // 平均着順
  rankCounts: {
    first: number
    second: number
    third: number
    fourth?: number // 3人打ちの場合はundefined
  }
}

// ========================================
// Rank Calculation
// ========================================

/**
 * 半荘内のプレイヤーの着順を計算（点数ベース）
 * @param playerResults 半荘内のプレイヤー結果
 * @returns Map<PlayerResult.id, 着順>
 */
export function calculateRanks(playerResults: PlayerResult[]): Map<string, number> {
  const rankMap = new Map<string, number>()

  // 見学者を除外、かつ点数が入力されているプレイヤーのみを対象
  const activePlayers = playerResults
    .filter((p) => !p.isSpectator && p.score !== null)
    .sort((a, b) => b.score - a.score) // 点数降順

  // 着順を割り当て（同点の場合は同着）
  let currentRank = 1
  activePlayers.forEach((player, index) => {
    if (index > 0 && player.score < activePlayers[index - 1].score) {
      currentRank = index + 1
    }
    rankMap.set(player.id, currentRank)
  })

  return rankMap
}

// ========================================
// Payout Calculation
// ========================================

/**
 * ウママークを数値に変換
 */
function umaMarkToValue(umaMark: UmaMark): number {
  switch (umaMark) {
    case '○○○':
      return 3
    case '○○':
      return 2
    case '○':
      return 1
    case '':
      return 0
    case '✗':
      return -1
    case '✗✗':
      return -2
    case '✗✗✗':
      return -3
    default:
      return 0
  }
}

/**
 * 単一半荘での収支を計算
 * @param score ±点数
 * @param umaMark ウママーク
 * @param chips チップ枚数
 * @param rate 点数レート
 * @param umaValue ウマ1個あたりの価値
 * @param chipRate チップレート
 * @param parlorFee 場代
 * @returns 最終収支
 */
export function calculatePayout(
  score: number,
  umaMark: UmaMark,
  chips: number,
  rate: number,
  umaValue: number,
  chipRate: number,
  parlorFee: number
): number {
  const umaPoints = umaMarkToValue(umaMark)
  const subtotal = score + umaPoints * umaValue
  const payout = subtotal * rate + chips * chipRate
  const finalPayout = payout - parlorFee

  return finalPayout
}

// ========================================
// Session Summary Calculation
// ========================================

/**
 * セッションサマリーを計算
 * @param sessionId セッションID
 * @param mainUserId メインユーザーID
 * @returns セッションサマリー
 */
export async function calculateSessionSummary(
  sessionId: string,
  mainUserId: string
): Promise<SessionSummary> {
  const sessionDetails = await getSessionWithDetails(sessionId)

  if (!sessionDetails) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const { session, hanchans } = sessionDetails

  const rankCounts = { first: 0, second: 0, third: 0, fourth: 0 }
  let totalPayout = 0
  let totalChips = 0

  // 各半荘で着順と収支を計算
  for (const hanchan of hanchans) {
    const ranks = calculateRanks(hanchan.players)

    const mainUserResult = hanchan.players.find((p) => p.userId === mainUserId)
    if (mainUserResult) {
      // 点数が入力されていない半荘はスキップ（未入力の半荘は集計対象外）
      if (mainUserResult.score === null) {
        continue
      }

      const rank = ranks.get(mainUserResult.id) || 0

      // 着順カウント
      if (rank === 1) rankCounts.first++
      else if (rank === 2) rankCounts.second++
      else if (rank === 3) rankCounts.third++
      else if (rank === 4) rankCounts.fourth++

      // 収支とチップを加算
      totalPayout += calculatePayout(
        mainUserResult.score,
        mainUserResult.umaMark,
        mainUserResult.chips,
        session.rate,
        session.umaValue,
        session.chipRate,
        session.parlorFee
      )
      totalChips += mainUserResult.chips
    }
  }

  // 平均着順（入力済み半荘のみ）
  const totalHanchans = rankCounts.first + rankCounts.second + rankCounts.third + rankCounts.fourth
  const averageRank =
    totalHanchans > 0
      ? (rankCounts.first * 1 +
          rankCounts.second * 2 +
          rankCounts.third * 3 +
          rankCounts.fourth * 4) /
        totalHanchans
      : 0

  return {
    sessionId,
    date: session.date,
    mode: session.mode,
    hanchanCount: totalHanchans, // 入力済み半荘数のみカウント
    totalPayout,
    totalChips,
    averageRank,
    rankCounts: session.mode === '3-player'
      ? { first: rankCounts.first, second: rankCounts.second, third: rankCounts.third }
      : rankCounts
  }
}
