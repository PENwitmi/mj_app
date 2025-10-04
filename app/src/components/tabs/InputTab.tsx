import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { GameMode, UmaMark, UmaRule, User } from '@/lib/db'
import { getDefaultUmaRule } from '@/lib/utils'
import { PlayerSelect } from '@/components/PlayerSelect'
import { saveSessionWithSummary } from '@/lib/session-utils'
import type { SessionSaveData } from '@/lib/db-utils'

// セッション設定の型定義
interface SessionSettings {
  date: string
  rate: number
  umaValue: number
  chipRate: number
  umaRule: UmaRule
}

// プレイヤー結果の型定義
interface PlayerResult {
  playerName: string
  userId: string | null // 集計用ID（nullは集計対象外）
  score: number | null // ±点数
  umaMark: UmaMark
  chips: number
  parlorFee: number // 場代
  isSpectator: boolean
  umaMarkManual: boolean // ウママークが手動設定されたか
}

// 半荘の型定義
interface Hanchan {
  hanchanNumber: number
  players: PlayerResult[]
  autoCalculated: boolean
}

// デフォルト値
const DEFAULT_SETTINGS: SessionSettings = {
  date: new Date().toISOString().split('T')[0], // YYYY-MM-DD形式
  rate: 30,
  umaValue: 10,
  chipRate: 100,
  umaRule: getDefaultUmaRule(), // localStorageから取得
}

// ウママークの選択肢（縦積み表示用）
const UMA_MARK_OPTIONS: { value: UmaMark; label: string; display: string }[] = [
  { value: '○○○', label: '○○○', display: '○\n○\n○' },
  { value: '○○', label: '○○', display: '○\n○' },
  { value: '○', label: '○', display: '○' },
  { value: '', label: '無印', display: '─' },
  { value: '✗', label: '✗', display: '✗' },
  { value: '✗✗', label: '✗✗', display: '✗\n✗' },
  { value: '✗✗✗', label: '✗✗✗', display: '✗\n✗\n✗' },
]

// 初期プレイヤー名
const getInitialPlayerNames = (_mode: GameMode, playerCount: number, mainUserName?: string): string[] => {
  const names = [mainUserName || '自分']
  for (let i = 2; i <= playerCount; i++) {
    names.push(`user${i}`)
  }
  return names
}

// 初期プレイヤー結果作成
const createInitialPlayerResult = (playerName: string): PlayerResult => ({
  playerName,
  userId: null, // デフォルトは集計対象外
  score: null,
  umaMark: '',
  chips: 0,
  parlorFee: 0,
  isSpectator: false,
  umaMarkManual: false,
})

// ウママーク自動割り当て
const assignUmaMarks = (players: PlayerResult[], mode: GameMode, umaRule: UmaRule): UmaMark[] => {
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

// 点数自動計算（ゼロサム原則）
const calculateAutoScore = (players: PlayerResult[]): number | null => {
  // 見学者を除く、点数入力済みのプレイヤー
  const scores = players
    .filter((p) => !p.isSpectator && p.score !== null)
    .map((p) => p.score as number)

  if (scores.length === 0) return null

  // ゼロサムなので、合計の逆数が最後のプレイヤーの点数
  const sum = scores.reduce((acc, score) => acc + score, 0)
  return -sum
}

// ウママークを数値に変換
const umaMarkToValue = (umaMark: UmaMark): number => {
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

// プレイヤーごとの集計計算
interface PlayerTotals {
  scoreTotal: number // 点数合計
  umaTotal: number // ウマポイント合計
  subtotal: number // 小計（点数+ウマ）
  chips: number // チップ
  payout: number // 収支（小計×レート+チップ×チップレート）
  parlorFee: number // 場代
  finalPayout: number // 最終収支
}

const calculatePlayerTotals = (
  playerIndex: number,
  hanchans: Hanchan[],
  settings: SessionSettings
): PlayerTotals => {
  let scoreTotal = 0
  let umaTotal = 0
  let chips = 0
  let parlorFee = 0

  hanchans.forEach((hanchan) => {
    const player = hanchan.players[playerIndex]
    if (!player.isSpectator && player.score !== null) {
      scoreTotal += player.score
      umaTotal += umaMarkToValue(player.umaMark)
    }
    chips = player.chips // チップは最後の値を使用
    parlorFee = player.parlorFee // 場代は最後の値を使用
  })

  const subtotal = scoreTotal + umaTotal * settings.umaValue
  const payout = subtotal * settings.rate + chips * settings.chipRate
  const finalPayout = payout - parlorFee

  return {
    scoreTotal,
    umaTotal,
    subtotal,
    chips,
    payout,
    parlorFee,
    finalPayout,
  }
}

interface InputTabProps {
  mainUser: User | null
  users: User[]
  addNewUser: (name: string) => Promise<User>
  onSaveSuccess?: () => void
}

export function InputTab({ mainUser, users, addNewUser, onSaveSuccess }: InputTabProps) {
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null)
  const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SETTINGS)
  const [hanchans, setHanchans] = useState<Hanchan[]>([])
  const [playerCount, setPlayerCount] = useState<number>(0)

  // コンポーネントマウント時にlocalStorageから最新のウマルールを取得
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      umaRule: getDefaultUmaRule()
    }))
  }, [])

  // メインユーザー名が変更されたら、既存の半荘データの1列目を更新
  useEffect(() => {
    if (mainUser && hanchans.length > 0) {
      setHanchans(prevHanchans =>
        prevHanchans.map(hanchan => ({
          ...hanchan,
          players: hanchan.players.map((player, idx) =>
            idx === 0 && player.userId === mainUser.id
              ? { ...player, playerName: mainUser.name }
              : player
          )
        }))
      )
    }
  }, [mainUser?.name])

  // 登録ユーザー名が変更されたら、該当するプレイヤー名を更新
  useEffect(() => {
    if (users.length > 0 && hanchans.length > 0) {
      setHanchans(prevHanchans =>
        prevHanchans.map(hanchan => ({
          ...hanchan,
          players: hanchan.players.map(player => {
            if (!player.userId) return player

            const matchedUser = users.find(u => u.id === player.userId)
            if (matchedUser && matchedUser.name !== player.playerName) {
              return { ...player, playerName: matchedUser.name }
            }

            return player
          })
        }))
      )
    }
  }, [users])

  // モード選択時に初期データをセットアップ
  const handleModeSelect = (mode: GameMode) => {
    setSelectedMode(mode)
    const initialPlayerCount = mode === '4-player' ? 4 : 3
    setPlayerCount(initialPlayerCount)

    const playerNames = getInitialPlayerNames(mode, initialPlayerCount, mainUser?.name)

    // 初期表示で3つの半荘を作成
    const initialHanchans: Hanchan[] = [1, 2, 3].map((num) => ({
      hanchanNumber: num,
      players: playerNames.map((name, idx) => ({
        ...createInitialPlayerResult(name),
        userId: idx === 0 && mainUser ? mainUser.id : null, // 1列目は自分のID
      })),
      autoCalculated: false,
    }))

    setHanchans(initialHanchans)
  }

  // プレイヤー選択更新ハンドラー
  const handlePlayerChange = (playerIndex: number, userId: string | null, playerName: string) => {
    setHanchans(prevHanchans =>
      prevHanchans.map(hanchan => ({
        ...hanchan,
        players: hanchan.players.map((player, idx) =>
          idx === playerIndex
            ? { ...player, userId, playerName }
            : player
        ),
      }))
    )
  }

  // セッション保存処理
  const handleSave = async () => {
    try {
      // バリデーション：最低1半荘は入力が必要
      const hasData = hanchans.some(h =>
        h.players.some(p => !p.isSpectator && p.score !== null)
      )
      if (!hasData) {
        toast.error('点数が入力されていません')
        return
      }

      // セッションデータを作成
      const saveData: SessionSaveData = {
        date: settings.date,
        mode: selectedMode === '4-player' ? 'four-player' : 'three-player',
        rate: settings.rate,
        umaValue: settings.umaValue,
        chipRate: settings.chipRate,
        umaRule: settings.umaRule === 'standard' ? 'standard' : 'second-minus',
        hanchans: hanchans.map(h => ({
          hanchanNumber: h.hanchanNumber,
          players: h.players.map((p, idx) => ({
            playerName: p.playerName,
            userId: p.userId,
            score: p.score ?? 0,
            umaMark: p.umaMark,
            chips: p.chips,
            parlorFee: p.parlorFee,
            isSpectator: p.isSpectator,
            position: idx  // 列番号を記録（0, 1, 2, 3）
          }))
        }))
      }

      console.log('[DEBUG] InputTab: saveDataの半荘数 =', saveData.hanchans.length);
      console.log('[DEBUG] InputTab: 半荘番号リスト =', saveData.hanchans.map(h => h.hanchanNumber));

      // DB保存（サマリーも事前計算して保存）
      await saveSessionWithSummary(saveData, mainUser!.id)

      // 成功通知
      toast.success('セッションを保存しました')

      // リセット
      handleReset()

      // 履歴タブへ遷移
      onSaveSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存に失敗しました')
    }
  }

  // リセット処理
  const handleReset = () => {
    setSelectedMode(null)
    setSettings(DEFAULT_SETTINGS)
    setHanchans([])
    setPlayerCount(0)
  }

  // モード未選択時は選択画面を表示
  if (!selectedMode) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">新規セッションを開始</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-20 text-lg"
              onClick={() => handleModeSelect('4-player')}
            >
              4人打ち麻雀
            </Button>
            <Button
              variant="outline"
              className="w-full h-20 text-lg"
              onClick={() => handleModeSelect('3-player')}
            >
              3人打ち麻雀
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // モード選択後はセッション入力画面を表示
  return (
    <div className="flex flex-col gap-2 h-full">
      {/* セッション設定カード */}
      <Card className="py-0 shrink-0">
        <CardContent className="p-3 pb-2">
          {/* 1行目: 日付、モード変更ボタン、保存ボタン */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-0.5 flex-1">
              <span className="text-muted-foreground text-xs">📅</span>
              <Input
                type="date"
                value={settings.date}
                onChange={(e) => setSettings({ ...settings, date: e.target.value })}
                className="h-7 text-sm"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-xs px-1.5"
              onClick={() => setSelectedMode(null)}
            >
              モード変更
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 h-7 text-sm"
              onClick={handleSave}
            >
              保存
            </Button>
          </div>

          {/* 2行目: レート、ウマ、チップ */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-xs shrink-0">レート</span>
              <Input
                type="number"
                value={settings.rate}
                onChange={(e) => setSettings({ ...settings, rate: Number(e.target.value) })}
                className="h-7 text-sm text-center flex-1 min-w-0"
                min={1}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-xs shrink-0">ウマ</span>
              <Input
                type="number"
                value={settings.umaValue}
                onChange={(e) => setSettings({ ...settings, umaValue: Number(e.target.value) })}
                className="h-7 text-sm text-center flex-1 min-w-0"
                min={1}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-xs shrink-0">チップ</span>
              <Input
                type="number"
                value={settings.chipRate}
                onChange={(e) => setSettings({ ...settings, chipRate: Number(e.target.value) })}
                className="h-7 text-sm text-center flex-1 min-w-0"
                min={1}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 点数入力表（スクロール可能） */}
      <Card className="py-0 h-[calc(100vh-375px)] overflow-hidden shrink-0">
        <CardContent className="p-2 flex flex-col h-full">
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-xs table-fixed">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b">
                  <th className="p-0.5 text-center w-4 text-muted-foreground text-[10px]">#</th>
                  {hanchans[0]?.players.map((player, idx) => (
                    <th key={idx} className="p-1">
                      {idx === 0 ? (
                        <div className="text-sm font-medium text-center">{mainUser?.name || '自分'}</div>
                      ) : (
                        <PlayerSelect
                          value={player.userId ?? '__default__'}
                          playerName={player.playerName}
                          onChange={(userId, playerName) => handlePlayerChange(idx, userId, playerName)}
                          position={idx + 1}
                          mainUser={mainUser}
                          users={users}
                          onAddUser={addNewUser}
                          excludeMainUser={true}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hanchans.map((hanchan) => (
                  <tr key={hanchan.hanchanNumber} className="border-b">
                    <td className="p-0.5 text-center text-[10px] font-medium text-muted-foreground">
                      {hanchan.hanchanNumber}
                    </td>
                    {hanchan.players.map((player, playerIdx) => (
                      <td key={playerIdx} className="p-0.5">
                        <div className="flex gap-0.5 items-center">
                          <Input
                            type="number"
                            placeholder="±"
                            value={player.score ?? ''}
                            className="h-10 text-lg text-center flex-1 min-w-0 px-0"
                            onChange={(e) => {
                              // リアルタイム更新（表示のみ）
                              const newHanchans = [...hanchans]
                              const hanchanIdx = hanchans.findIndex(
                                (h) => h.hanchanNumber === hanchan.hanchanNumber
                              )
                              const currentHanchan = newHanchans[hanchanIdx]
                              currentHanchan.players[playerIdx].score =
                                e.target.value === '' ? null : Number(e.target.value)
                              setHanchans(newHanchans)
                            }}
                            onBlur={() => {
                              // フォーカスが外れた時に自動計算とウママーク割り当て
                              const newHanchans = [...hanchans]
                              const hanchanIdx = hanchans.findIndex(
                                (h) => h.hanchanNumber === hanchan.hanchanNumber
                              )
                              const currentHanchan = newHanchans[hanchanIdx]

                              // 自動計算判定（初回のみ）
                              if (!currentHanchan.autoCalculated) {
                                const activePlayers = currentHanchan.players.filter(
                                  (p) => !p.isSpectator
                                )
                                const expectedCount = selectedMode === '4-player' ? 4 : 3
                                const filledCount = activePlayers.filter(
                                  (p) => p.score !== null
                                ).length

                                // 必要人数-1人が入力済みの場合、最後の1人を自動計算
                                if (filledCount === expectedCount - 1) {
                                  const lastPlayerIdx = activePlayers.findIndex(
                                    (p) => p.score === null
                                  )
                                  if (lastPlayerIdx !== -1) {
                                    const globalLastIdx = currentHanchan.players.findIndex(
                                      (p) => p === activePlayers[lastPlayerIdx]
                                    )
                                    const autoScore = calculateAutoScore(currentHanchan.players)
                                    if (autoScore !== null) {
                                      currentHanchan.players[globalLastIdx].score = autoScore
                                      currentHanchan.autoCalculated = true
                                    }
                                  }
                                }
                              }

                              // ウママーク自動割り当て（手動変更されていない場合のみ）
                              const umaMarks = assignUmaMarks(currentHanchan.players, selectedMode!, settings.umaRule)
                              currentHanchan.players.forEach((p, idx) => {
                                if (!p.umaMarkManual) {
                                  p.umaMark = umaMarks[idx]
                                }
                              })

                              setHanchans(newHanchans)
                            }}
                          />
                          <Select
                            value={player.umaMark || 'none'}
                            onValueChange={(value) => {
                              const newHanchans = [...hanchans]
                              const hanchanIdx = hanchans.findIndex(
                                (h) => h.hanchanNumber === hanchan.hanchanNumber
                              )
                              const umaValue = value === 'none' ? '' : (value as UmaMark)
                              newHanchans[hanchanIdx].players[playerIdx].umaMark = umaValue
                              newHanchans[hanchanIdx].players[playerIdx].umaMarkManual = true
                              setHanchans(newHanchans)
                            }}
                          >
                            <SelectTrigger className="h-14 text-xs border border-input bg-white hover:bg-accent w-5 px-0 [&>svg]:hidden whitespace-pre-line leading-[0.9] py-0.5 text-center ml-0.5 justify-center">
                              <SelectValue placeholder="─">
                                {player.umaMark ? UMA_MARK_OPTIONS.find(o => o.value === player.umaMark)?.display : '─'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {UMA_MARK_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value || 'none'}
                                  value={option.value || 'none'}
                                  className="whitespace-pre-line leading-[0.9] text-center py-1"
                                >
                                  {option.display}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
                {/* 半荘追加ボタン行 */}
                <tr>
                  <td colSpan={playerCount + 1} className="p-0">
                    <Button
                      variant="ghost"
                      className="w-full h-10 text-sm rounded-none border-t hover:bg-accent"
                      onClick={() => {
                        // 前の半荘のプレイヤー設定を引き継ぐ
                        const lastHanchan = hanchans[hanchans.length - 1]
                        const newHanchan: Hanchan = {
                          hanchanNumber: hanchans.length + 1,
                          players: lastHanchan.players.map(p => ({
                            ...createInitialPlayerResult(p.playerName),
                            userId: p.userId,
                            playerName: p.playerName,
                          })),
                          autoCalculated: false,
                        }
                        setHanchans([...hanchans, newHanchan])
                      }}
                    >
                      + 半荘を追加
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 集計エリア（固定表示） */}
      <div className="fixed bottom-12 left-0 right-0 px-2 pb-2 z-20">
        <Card className="py-0 shadow-lg">
          <CardContent className="p-2">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs table-fixed">
                <tbody className="text-xs">
                  {/* 小計行 */}
                  <tr className="bg-muted/50">
                    <td className="p-0.5 font-medium text-center text-[10px] w-4">小計</td>
                    {hanchans[0]?.players.map((_, playerIdx) => {
                      const totals = calculatePlayerTotals(playerIdx, hanchans, settings)
                      const sign = totals.subtotal >= 0 ? '+' : ''
                      return (
                        <td key={playerIdx} className="p-1 text-center">
                          <div className="font-semibold text-sm">
                            {sign}
                            {totals.subtotal}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            ({sign}
                            {totals.scoreTotal}+{totals.umaTotal * settings.umaValue})
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                  {/* チップ入力行 */}
                  <tr>
                    <td className="p-0.5 font-medium text-center text-[10px] w-4">CP</td>
                    {hanchans[0]?.players.map((player, playerIdx) => (
                      <td key={playerIdx} className="p-1">
                        <Input
                          type="number"
                          value={player.chips || ''}
                          onChange={(e) => {
                            const newHanchans = [...hanchans]
                            const chipValue = e.target.value === '' ? 0 : Number(e.target.value)
                            // 全ての半荘の同じプレイヤーのチップを更新
                            newHanchans.forEach((hanchan) => {
                              hanchan.players[playerIdx].chips = chipValue
                            })
                            setHanchans(newHanchans)
                          }}
                          className="text-center h-9 text-base leading-tight"
                          placeholder="0"
                        />
                      </td>
                    ))}
                  </tr>
                  {/* 収支行 */}
                  <tr className="bg-muted/30">
                    <td className="p-0.5 font-medium text-center text-[10px] w-4">収支</td>
                    {hanchans[0]?.players.map((_, playerIdx) => {
                      const totals = calculatePlayerTotals(playerIdx, hanchans, settings)
                      const sign = totals.payout >= 0 ? '+' : ''
                      return (
                        <td key={playerIdx} className="p-1 text-center font-semibold">
                          {sign}
                          {totals.payout}
                        </td>
                      )
                    })}
                  </tr>
                  {/* 場代入力行 */}
                  <tr>
                    <td className="p-0.5 font-medium text-center text-[10px] w-4">場代</td>
                    {hanchans[0]?.players.map((player, playerIdx) => (
                      <td key={playerIdx} className="p-1">
                        <Input
                          type="number"
                          value={player.parlorFee || ''}
                          onChange={(e) => {
                            const newHanchans = [...hanchans]
                            const parlorFeeValue = e.target.value === '' ? 0 : Number(e.target.value)
                            // 全ての半荘の同じプレイヤーの場代を更新
                            newHanchans.forEach((hanchan) => {
                              hanchan.players[playerIdx].parlorFee = parlorFeeValue
                            })
                            setHanchans(newHanchans)
                          }}
                          className="text-center h-9 text-base leading-tight"
                          placeholder="0"
                        />
                      </td>
                    ))}
                  </tr>
                  {/* 最終収支行 */}
                  <tr className="bg-primary/10 border-t">
                    <td className="p-0.5 font-bold text-center text-[10px] w-4">最終</td>
                    {hanchans[0]?.players.map((_, playerIdx) => {
                      const totals = calculatePlayerTotals(playerIdx, hanchans, settings)
                      const sign = totals.finalPayout >= 0 ? '+' : ''
                      const textColor =
                        totals.finalPayout > 0
                          ? 'text-green-600'
                          : totals.finalPayout < 0
                            ? 'text-red-600'
                            : ''
                      return (
                        <td
                          key={playerIdx}
                          className={`p-1 text-center font-bold text-base ${textColor}`}
                        >
                          {sign}
                          {totals.finalPayout}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
