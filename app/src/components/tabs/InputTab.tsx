import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { GameMode, User } from '@/lib/db-utils'
import { getDefaultUmaRule } from '@/lib/utils'
import { saveSessionWithSummary } from '@/lib/session-utils'
import type { SessionSaveData } from '@/lib/db-utils'
import { getInitialPlayerNames, createInitialPlayerResult } from '@/lib/uma-utils'
import { SessionSettingsCard, type SessionSettings } from '@/components/input/SessionSettings'
import { ScoreInputTable } from '@/components/input/ScoreInputTable'
import { TotalsPanel, type Hanchan } from '@/components/input/TotalsPanel'

// デフォルト値
const DEFAULT_SETTINGS: SessionSettings = {
  date: new Date().toISOString().split('T')[0],
  rate: 30,
  umaValue: 10,
  chipRate: 100,
  umaRule: getDefaultUmaRule(),
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

  // コンポーネントマウント時にlocalStorageから最新のウマルールを取得
  useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      umaRule: getDefaultUmaRule(),
    }))
  }, [])

  // メインユーザー名が変更されたら、既存の半荘データの1列目を更新
  useEffect(() => {
    if (mainUser && hanchans.length > 0) {
      setHanchans((prevHanchans) =>
        prevHanchans.map((hanchan) => ({
          ...hanchan,
          players: hanchan.players.map((player, idx) =>
            idx === 0 && player.userId === mainUser.id
              ? { ...player, playerName: mainUser.name }
              : player
          ),
        }))
      )
    }
  }, [mainUser, mainUser?.name, hanchans.length])

  // 登録ユーザー名が変更されたら、該当するプレイヤー名を更新
  useEffect(() => {
    if (users.length > 0 && hanchans.length > 0) {
      setHanchans((prevHanchans) =>
        prevHanchans.map((hanchan) => ({
          ...hanchan,
          players: hanchan.players.map((player) => {
            if (!player.userId) return player

            const matchedUser = users.find((u) => u.id === player.userId)
            if (matchedUser && matchedUser.name !== player.playerName) {
              return { ...player, playerName: matchedUser.name }
            }

            return player
          }),
        }))
      )
    }
  }, [users, hanchans.length])

  // モード選択時に初期データをセットアップ
  const handleModeSelect = (mode: GameMode) => {
    setSelectedMode(mode)
    const initialPlayerCount = mode === '4-player' ? 4 : 3
    const playerNames = getInitialPlayerNames(mode, initialPlayerCount, mainUser?.name)

    // 初期表示で3つの半荘を作成
    const initialHanchans: Hanchan[] = [1, 2, 3].map((num) => ({
      hanchanNumber: num,
      players: playerNames.map((name, idx) => ({
        ...createInitialPlayerResult(name),
        userId: idx === 0 && mainUser ? mainUser.id : null,
      })),
      autoCalculated: false,
    }))

    setHanchans(initialHanchans)
  }

  // プレイヤー選択更新ハンドラー
  const handlePlayerChange = (playerIndex: number, userId: string | null, playerName: string) => {
    setHanchans((prevHanchans) =>
      prevHanchans.map((hanchan) => ({
        ...hanchan,
        players: hanchan.players.map((player, idx) =>
          idx === playerIndex ? { ...player, userId, playerName } : player
        ),
      }))
    )
  }

  // チップ変更ハンドラー
  const handleChipsChange = (playerIndex: number, chips: number) => {
    setHanchans((prevHanchans) =>
      prevHanchans.map((hanchan) => ({
        ...hanchan,
        players: hanchan.players.map((player, idx) =>
          idx === playerIndex ? { ...player, chips } : player
        ),
      }))
    )
  }

  // 場代変更ハンドラー
  const handleParlorFeeChange = (playerIndex: number, parlorFee: number) => {
    setHanchans((prevHanchans) =>
      prevHanchans.map((hanchan) => ({
        ...hanchan,
        players: hanchan.players.map((player, idx) =>
          idx === playerIndex ? { ...player, parlorFee } : player
        ),
      }))
    )
  }

  // セッション保存処理
  const handleSave = async () => {
    try {
      // 空ハンチャン判定関数（ローカルヘルパー）
      const isEmptyHanchan = (h: Hanchan): boolean => {
        return h.players.every(p =>
          p.isSpectator || p.score === null || p.score === 0
        )
      }

      // 1. 空ハンチャンをフィルタリング（有効なハンチャンのみ抽出）
      const validHanchans = hanchans.filter(h => !isEmptyHanchan(h))

      // 2. バリデーション：最低1半荘の有効データが必要
      if (validHanchans.length === 0) {
        toast.error('点数が入力されていません')
        return
      }

      // 3. 半荘番号を振り直し（1から連番）
      const renumberedHanchans = validHanchans.map((h, index) => ({
        ...h,
        hanchanNumber: index + 1
      }))

      // 4. セッションデータを作成
      const saveData: SessionSaveData = {
        date: settings.date,
        mode: selectedMode === '4-player' ? 'four-player' : 'three-player',
        rate: settings.rate,
        umaValue: settings.umaValue,
        chipRate: settings.chipRate,
        umaRule: settings.umaRule === 'standard' ? 'standard' : 'second-minus',
        hanchans: renumberedHanchans.map((h) => ({
          hanchanNumber: h.hanchanNumber,
          players: h.players.map((p, idx) => ({
            playerName: p.playerName,
            userId: p.userId,
            score: p.score ?? 0,  // 有効ハンチャンのみなので、ここでのnullは想定外
            umaMark: p.umaMark,
            chips: p.chips,
            parlorFee: p.parlorFee,
            isSpectator: p.isSpectator,
            position: idx,
          })),
        })),
      }

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
    <div className="flex flex-col gap-2 h-full min-h-0">
      {/* セッション設定カード */}
      <SessionSettingsCard
        settings={settings}
        onSettingsChange={setSettings}
        onModeChange={() => setSelectedMode(null)}
        onSave={handleSave}
      />

      {/* 点数入力表 */}
      <ScoreInputTable
        hanchans={hanchans}
        selectedMode={selectedMode}
        settings={settings}
        mainUser={mainUser}
        users={users}
        onHanchansChange={setHanchans}
        onPlayerChange={handlePlayerChange}
        onAddNewUser={addNewUser}
      />

      {/* 集計エリア */}
      <TotalsPanel
        hanchans={hanchans}
        settings={settings}
        onChipsChange={handleChipsChange}
        onParlorFeeChange={handleParlorFeeChange}
      />
    </div>
  )
}
