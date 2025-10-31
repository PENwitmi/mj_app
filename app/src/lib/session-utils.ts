import type { PlayerResult, GameMode } from './db'
import { getSessionWithDetails, saveSession as dbSaveSession, type SessionSaveData } from './db-utils'
import { db } from './db'
import { umaMarkToValue } from './uma-utils'
import { logger } from './logger'

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
  overallRank: number // セッション内総合順位（総収支ベース）
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
  umaMark: import('./db').UmaMark,
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

  // chips/parlorFeeはセッション全体で1回のみカウント
  let sessionChips = 0
  let sessionParlorFee = 0
  let chipsInitialized = false

  // 各半荘で着順と収支を計算
  for (const hanchan of hanchans) {
    const ranks = calculateRanks(hanchan.players)

    const mainUserResult = hanchan.players.find((p) => p.userId === mainUserId)

    if (!mainUserResult) {
      logger.warn('半荘にメインユーザーが見つかりません', {
        context: 'session-utils.calculateSessionSummary',
        data: {
          hanchanNumber: hanchan.hanchanNumber,
          mainUserId,
          players: hanchan.players.map(p => ({ name: p.playerName, userId: p.userId }))
        }
      })
      continue
    }

    if (mainUserResult) {
      // 点数が入力されていない半荘はスキップ（未入力の半荘は集計対象外）
      // 防御的プログラミング: null or 0 の両方をスキップ
      if (mainUserResult.score === null || mainUserResult.score === 0) {
        continue
      }

      // 最初の有効な半荘からchips/parlorFeeを取得（1回のみ）
      if (!chipsInitialized) {
        sessionChips = mainUserResult.chips
        sessionParlorFee = mainUserResult.parlorFee
        chipsInitialized = true
      }

      const rank = ranks.get(mainUserResult.id) || 0

      // 着順カウント
      if (rank === 1) rankCounts.first++
      else if (rank === 2) rankCounts.second++
      else if (rank === 3) rankCounts.third++
      else if (rank === 4) rankCounts.fourth++
      else {
        logger.warn('rankがカウント範囲外です', {
          context: 'session-utils.calculateSessionSummary',
          data: {
            hanchanNumber: hanchan.hanchanNumber,
            rank,
            expectedRange: '1-4'
          }
        })
      }

      // score + umaのみの収支を計算（chips/parlorFeeは除く）
      const umaPoints = umaMarkToValue(mainUserResult.umaMark)
      const subtotal = mainUserResult.score + umaPoints * session.umaValue
      const scorePayout = subtotal * session.rate
      totalPayout += scorePayout
    }
  }

  // セッション全体で1回のみchips/parlorFeeを加算
  totalPayout += sessionChips * session.chipRate - sessionParlorFee
  totalChips = sessionChips

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

  // 総合順位計算（セッション内の全プレイヤーの総収支ベース）
  const playerPayouts = new Map<string, number>()
  const playerChips = new Map<string, number>()
  const playerParlorFees = new Map<string, number>()

  // 全プレイヤーの総収支を計算
  for (const hanchan of hanchans) {
    for (const player of hanchan.players) {
      // 見学者を除外、点数未入力もスキップ
      if (player.isSpectator || player.score === null || player.score === 0) {
        continue
      }

      const playerKey = player.userId ?? player.playerName

      // 各プレイヤーのchips/parlorFeeを最初の半荘から取得（1回のみ）
      if (!playerChips.has(playerKey)) {
        playerChips.set(playerKey, player.chips)
        playerParlorFees.set(playerKey, player.parlorFee)
      }

      // score + umaのみの収支を計算
      const umaPoints = umaMarkToValue(player.umaMark)
      const subtotal = player.score + umaPoints * session.umaValue
      const scorePayout = subtotal * session.rate

      const currentTotal = playerPayouts.get(playerKey) || 0
      playerPayouts.set(playerKey, currentTotal + scorePayout)
    }
  }

  // 各プレイヤーにセッション全体で1回のみchips/parlorFeeを加算
  for (const [playerKey, scorePayout] of playerPayouts.entries()) {
    const chips = playerChips.get(playerKey) || 0
    const parlorFee = playerParlorFees.get(playerKey) || 0
    const finalPayout = scorePayout + chips * session.chipRate - parlorFee
    playerPayouts.set(playerKey, finalPayout)
  }

  // 収支降順でソート（高い収支が上位）
  const sortedPlayers = Array.from(playerPayouts.entries())
    .sort((a, b) => b[1] - a[1]) // [userId, totalPayout]

  // メインユーザーの順位を特定
  const overallRank = sortedPlayers.findIndex(
    ([userId]) => userId === mainUserId
  ) + 1

  // エラーケース: メインユーザーが見つからない場合
  if (overallRank === 0) {
    logger.warn('総合順位計算: メインユーザーが見つかりません', {
      context: 'session-utils.calculateSessionSummary',
      data: {
        sessionId,
        mainUserId,
        playerCount: playerPayouts.size
      }
    })
  }

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
      : rankCounts,
    overallRank
  }
}

// ========================================
// Session Save with Summary
// ========================================

/**
 * セッションを保存し、サマリーを事前計算して保存
 * パフォーマンス最適化のため、保存時にサマリーを計算
 * @param data セッション保存データ
 * @param mainUserId メインユーザーID
 * @returns 保存されたセッションID
 */
export async function saveSessionWithSummary(
  data: SessionSaveData,
  mainUserId: string
): Promise<string> {
  logger.debug('セッション保存開始', {
    context: 'session-utils.saveSessionWithSummary',
    data: {
      date: data.date,
      mode: data.mode,
      hanchanCount: data.hanchans.length,
      mainUserId
    }
  })

  const startTime = performance.now()

  // 1. セッションを保存
  const sessionId = await dbSaveSession(data)
  const saveTime = performance.now() - startTime

  logger.debug('セッション保存完了', {
    context: 'session-utils.saveSessionWithSummary',
    data: {
      sessionId,
      saveTime: `${saveTime.toFixed(1)}ms`
    }
  })

  // 2. サマリーを計算
  const summaryStartTime = performance.now()
  const summary = await calculateSessionSummary(sessionId, mainUserId)
  const summaryTime = performance.now() - summaryStartTime

  logger.debug('サマリー計算完了', {
    context: 'session-utils.saveSessionWithSummary',
    data: {
      summary,
      summaryTime: `${summaryTime.toFixed(1)}ms`
    }
  })

  // 3. セッションにサマリーを保存
  const updateStartTime = performance.now()
  await db.sessions.update(sessionId, { summary })
  const updateTime = performance.now() - updateStartTime

  const totalTime = performance.now() - startTime

  logger.debug('サマリー保存完了', {
    context: 'session-utils.saveSessionWithSummary',
    data: {
      updateTime: `${updateTime.toFixed(1)}ms`,
      totalTime: `${totalTime.toFixed(1)}ms`
    }
  })

  return sessionId
}
