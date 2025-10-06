import type { GameMode, UmaMark, UmaRule } from './db'

/**
 * ウママークを数値に変換
 */
export function umaMarkToValue(umaMark: UmaMark): number {
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
 * ウママークの選択肢（縦積み表示用）
 */
export const UMA_MARK_OPTIONS: { value: UmaMark; label: string; display: string }[] = [
  { value: '○○○', label: '○○○', display: '○\n○\n○' },
  { value: '○○', label: '○○', display: '○\n○' },
  { value: '○', label: '○', display: '○' },
  { value: '', label: '無印', display: '─' },
  { value: '✗', label: '✗', display: '✗' },
  { value: '✗✗', label: '✗✗', display: '✗\n✗' },
  { value: '✗✗✗', label: '✗✗✗', display: '✗\n✗\n✗' },
]

/**
 * プレイヤー結果の型定義
 */
export interface PlayerResult {
  playerName: string
  userId: string | null
  score: number | null
  umaMark: UmaMark
  chips: number
  parlorFee: number
  isSpectator: boolean
  umaMarkManual: boolean
}

/**
 * ウママーク自動割り当て
 */
export function assignUmaMarks(
  players: PlayerResult[],
  mode: GameMode,
  umaRule: UmaRule
): UmaMark[] {
  // 点数で順位をつける（見学者を除く）
  const playersWithIndex = players
    .map((p, idx) => ({ player: p, index: idx }))
    .filter(({ player }) => !player.isSpectator && player.score !== null)
    .sort((a, b) => (b.player.score ?? 0) - (a.player.score ?? 0))

  const umaMarks: UmaMark[] = players.map(() => '')

  // 2位の点数を取得（2位マイナス判定用）
  const secondPlaceScore = playersWithIndex.length >= 2 ? (playersWithIndex[1].player.score ?? 0) : 0
  const isSecondMinus = umaRule === 'second-minus' && secondPlaceScore < 0

  if (mode === '4-player') {
    if (isSecondMinus) {
      // 4人打ち2位マイナス判定: 1位→○○○、2位→無印、3位→✗、4位→✗✗
      if (playersWithIndex.length >= 1) umaMarks[playersWithIndex[0].index] = '○○○'
      if (playersWithIndex.length >= 2) umaMarks[playersWithIndex[1].index] = ''
      if (playersWithIndex.length >= 3) umaMarks[playersWithIndex[2].index] = '✗'
      if (playersWithIndex.length >= 4) umaMarks[playersWithIndex[3].index] = '✗✗'
    } else {
      // 4人打ち標準ルール: 1位→○○、2位→○、3位→✗、4位→✗✗
      if (playersWithIndex.length >= 1) umaMarks[playersWithIndex[0].index] = '○○'
      if (playersWithIndex.length >= 2) umaMarks[playersWithIndex[1].index] = '○'
      if (playersWithIndex.length >= 3) umaMarks[playersWithIndex[2].index] = '✗'
      if (playersWithIndex.length >= 4) umaMarks[playersWithIndex[3].index] = '✗✗'
    }
  } else {
    if (isSecondMinus) {
      // 3人打ち2位マイナス判定: 1位→○○○、2位→✗、3位→✗✗
      if (playersWithIndex.length >= 1) umaMarks[playersWithIndex[0].index] = '○○○'
      if (playersWithIndex.length >= 2) umaMarks[playersWithIndex[1].index] = '✗'
      if (playersWithIndex.length >= 3) umaMarks[playersWithIndex[2].index] = '✗✗'
    } else {
      // 3人打ち標準ルール: 1位→○○、2位→○、3位→✗✗✗
      if (playersWithIndex.length >= 1) umaMarks[playersWithIndex[0].index] = '○○'
      if (playersWithIndex.length >= 2) umaMarks[playersWithIndex[1].index] = '○'
      if (playersWithIndex.length >= 3) umaMarks[playersWithIndex[2].index] = '✗✗✗'
    }
  }

  return umaMarks
}

/**
 * 点数自動計算（ゼロサム原則）
 */
export function calculateAutoScore(players: PlayerResult[]): number | null {
  // 見学者を除く、点数入力済みのプレイヤー
  const scores = players
    .filter((p) => !p.isSpectator && p.score !== null)
    .map((p) => p.score as number)

  if (scores.length === 0) return null

  // ゼロサムなので、合計の逆数が最後のプレイヤーの点数
  const sum = scores.reduce((acc, score) => acc + score, 0)
  return -sum
}

/**
 * 初期プレイヤー名生成
 */
export function getInitialPlayerNames(
  _mode: GameMode,
  playerCount: number,
  mainUserName?: string
): string[] {
  const names = [mainUserName || '自分']
  for (let i = 2; i <= playerCount; i++) {
    names.push(`user${i}`)
  }
  return names
}

/**
 * 初期プレイヤー結果作成
 */
export function createInitialPlayerResult(playerName: string): PlayerResult {
  return {
    playerName,
    userId: null,
    score: null,
    umaMark: '',
    chips: 0,
    parlorFee: 0,
    isSpectator: false,
    umaMarkManual: false,
  }
}
