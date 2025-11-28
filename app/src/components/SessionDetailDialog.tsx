import { useEffect, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  getSessionWithDetails,
  sessionToSettings,
  dbHanchansToUIHanchans,
  uiDataToSaveData,
  updateSession,
  updateSessionMemo,
  type UIHanchan
} from '@/lib/db-utils'
import type { Session, Hanchan, PlayerResult, User } from '@/lib/db-utils'
import type { SessionSettings } from '@/components/input/SessionSettings'
import { ScoreInputTable } from '@/components/input/ScoreInputTable'
import { TotalsPanel, calculatePlayerTotals } from '@/components/input/TotalsPanel'
import { SessionMemoInput } from '@/components/SessionMemoInput'
import { logger } from '@/lib/logger'
import { formatSessionForClipboard, copyToClipboard } from '@/lib/share-utils'
import { createTemplateFromSession } from '@/lib/db-utils'
import { Input } from '@/components/ui/input'

// getSessionWithDetailsの戻り値の型
interface SessionWithDetails {
  session: Session
  hanchans: Array<Hanchan & { players: PlayerResult[] }>
}

interface SessionDetailDialogProps {
  sessionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  mainUser: User | null
  users: User[]
  addNewUser: (name: string) => Promise<User>
}

export function SessionDetailDialog({
  sessionId,
  open,
  onOpenChange,
  mainUser,
  users,
  addNewUser,
}: SessionDetailDialogProps) {
  // 既存State
  const [sessionData, setSessionData] = useState<SessionWithDetails | null>(null)

  // 編集モード用State
  const [isEditMode, setIsEditMode] = useState(false)
  const [editableSettings, setEditableSettings] = useState<SessionSettings | null>(null)
  const [editableHanchans, setEditableHanchans] = useState<UIHanchan[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // テンプレート保存用State
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)

  useEffect(() => {
    if (!sessionId || !open) {
      setSessionData(null)
      setIsEditMode(false)
      setEditableSettings(null)
      setEditableHanchans([])
      setHasUnsavedChanges(false)
      return
    }

    const loadSession = async () => {
      try {
        const data = await getSessionWithDetails(sessionId)

        setSessionData(data)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load session details')
        logger.error('セッション詳細の読み込みに失敗しました', {
          context: 'SessionDetailDialog.loadSession',
          data: { sessionId },
          error
        })
      }
    }

    loadSession()
  }, [sessionId, open])

  // 編集モード開始
  const handleEditClick = () => {
    if (!sessionData) return

    const settings = sessionToSettings(sessionData.session)
    const hanchans = dbHanchansToUIHanchans(sessionData.hanchans)

    setEditableSettings(settings)
    setEditableHanchans(hanchans)
    setIsEditMode(true)
    setHasUnsavedChanges(false)
  }

  // 保存
  const handleSave = async () => {
    if (!sessionData || !editableSettings || !mainUser) return

    try {
      setIsSaving(true)

      // UI → DB変換
      const saveData = uiDataToSaveData(
        editableSettings,
        editableHanchans,
        sessionData.session.mode
      )

      // セッション更新
      await updateSession(sessionData.session.id, saveData, mainUser.id)

      toast.success('セッションを更新しました')

      // 編集モード終了
      setIsEditMode(false)
      setHasUnsavedChanges(false)

      // データ再読み込み
      const updatedData = await getSessionWithDetails(sessionData.session.id)
      setSessionData(updatedData)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  // キャンセル
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('編集内容が保存されていません。破棄しますか？')
      if (!confirmed) return
    }

    setIsEditMode(false)
    setEditableSettings(null)
    setEditableHanchans([])
    setHasUnsavedChanges(false)
  }

  // 各プレイヤー列に対する除外ユーザーIDを計算
  const getExcludeUserIds = useCallback(
    (currentPlayerIndex: number): string[] => {
      const excludeIds: string[] = []

      // メインユーザーを除外（列1以外）
      if (currentPlayerIndex !== 0 && mainUser) {
        excludeIds.push(mainUser.id)
      }

      // 他列選択中のユーザーを除外
      if (editableHanchans.length > 0) {
        editableHanchans[0].players.forEach((player, idx) => {
          if (idx !== currentPlayerIndex && player.userId) {
            excludeIds.push(player.userId)
          }
        })
      }

      return excludeIds
    },
    [editableHanchans, mainUser]
  )

  // 変更検知
  const handleSettingsChange = (settings: SessionSettings) => {
    setEditableSettings(settings)
    setHasUnsavedChanges(true)
  }

  const handleHanchansChange = (hanchans: UIHanchan[]) => {
    setEditableHanchans(hanchans)
    setHasUnsavedChanges(true)
  }

  // メモ保存
  const handleMemoSave = async (memo: string) => {
    if (!sessionData) return

    await updateSessionMemo(sessionData.session.id, memo)

    // データ再読み込み
    const updatedData = await getSessionWithDetails(sessionData.session.id)
    setSessionData(updatedData)
  }

  // コピー機能（Issue #2）
  const handleCopyResult = async () => {
    if (!sessionData) return

    const { session, hanchans } = sessionData
    const names = hanchans[0]?.players.map(p => p.playerName) || []

    // プレイヤーごとの最終収支を計算
    const playerTotals = names.map((name, idx) => {
      const totals = calculatePlayerTotals(
        idx,
        hanchans as any,
        { date: session.date, rate: session.rate, umaValue: session.umaValue, chipRate: session.chipRate, umaRule: session.umaRule }
      )
      return { playerName: name, finalPayout: totals.finalPayout }
    })

    const text = formatSessionForClipboard(session, playerTotals)
    const success = await copyToClipboard(text)

    if (success) {
      toast.success('結果をコピーしました')
    } else {
      toast.error('コピーに失敗しました')
    }
  }

  // テンプレート保存ダイアログを開く（Issue #9）
  const handleSaveTemplate = () => {
    if (!sessionData) return
    // デフォルト名を設定（メモ or 日付）
    setTemplateName(sessionData.session.memo || sessionData.session.date)
    setTemplateDialogOpen(true)
  }

  // テンプレート保存実行
  const handleConfirmSaveTemplate = async () => {
    if (!sessionData || !templateName.trim()) {
      toast.error('テンプレート名を入力してください')
      return
    }

    setIsSavingTemplate(true)
    try {
      await createTemplateFromSession(
        sessionData.session,
        sessionData.hanchans,
        templateName.trim()
      )
      toast.success('テンプレートを保存しました')
      setTemplateDialogOpen(false)
      setTemplateName('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存に失敗しました')
    } finally {
      setIsSavingTemplate(false)
    }
  }

  if (!sessionData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>読み込み中...</DialogTitle>
            <DialogDescription>セッションデータを取得しています</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  const { session, hanchans } = sessionData

  // プレイヤー名の配列を作成（最初の半荘から取得、position順にソート済み）
  const playerNames = hanchans[0]?.players.map((p: PlayerResult) => p.playerName) || []

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>📅 {session.date}</DialogTitle>
            {!isEditMode ? (
              <Button variant="outline" size="sm" onClick={handleEditClick}>
                編集
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  キャンセル
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? '保存中...' : '保存'}
                </Button>
              </>
            )}
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>
              {session.mode === '4-player' ? '4人打ち' : '3人打ち'} • {hanchans.length}半荘
              {isEditMode && ' • 編集モード'}
            </div>
            {!isEditMode && (
              <div className="text-xs opacity-80">
                レート{session.rate} • ウマ{session.umaValue} • チップ{session.chipRate} • {session.umaRule === 'standard' ? '標準' : '2位マイナス'}
              </div>
            )}
          </div>
        </DialogHeader>

        {!isEditMode ? (
          <>
            {/* 閲覧モード: メモ編集エリア */}
            <div className="px-4 py-2 border-b">
              <SessionMemoInput
                value={session.memo || ''}
                onSave={handleMemoSave}
              />
            </div>

            {/* 閲覧モード: アクションボタン */}
            <div className="flex gap-2 px-4 py-2 border-b">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleCopyResult}>
                📋 コピー
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleSaveTemplate}>
                📝 テンプレ保存
              </Button>
            </div>

            {/* 閲覧モード: タブ切り替え */}
            <Tabs defaultValue="summary" className="flex-1 flex flex-col">
              <div className="px-4 pt-2">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="summary">📊 サマリー</TabsTrigger>
                  <TabsTrigger value="detail">🀄 半荘詳細</TabsTrigger>
                </TabsList>
              </div>

              {/* サマリータブ */}
              <TabsContent value="summary" className="flex-1 overflow-auto px-2 pb-2">
                <Card className="py-0">
                  <CardContent className="p-2">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs table-fixed">
                        <thead>
                          <tr className="border-b">
                            <th className="p-0.5 text-center w-4 text-muted-foreground text-[10px]"></th>
                            {playerNames.map((name: string, idx: number) => (
                              <th key={idx} className="p-1 text-center font-semibold">
                                {name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {/* 小計行 */}
                          <tr className="bg-muted/50">
                            <td className="p-0.5 font-medium text-center text-[10px] w-4">小計</td>
                            {playerNames.map((_, playerIdx: number) => {
                              const totals = calculatePlayerTotals(
                                playerIdx,
                                hanchans as any,
                                { date: session.date, rate: session.rate, umaValue: session.umaValue, chipRate: session.chipRate, umaRule: session.umaRule }
                              )
                              const sign = totals.subtotal >= 0 ? '+' : ''
                              return (
                                <td key={playerIdx} className="p-1 text-center">
                                  <div className="font-semibold text-sm">
                                    {sign}{totals.subtotal}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    ({sign}{totals.scoreTotal}+{totals.umaTotal * session.umaValue})
                                  </div>
                                </td>
                              )
                            })}
                          </tr>

                          {/* チップ行 */}
                          <tr>
                            <td className="p-0.5 font-medium text-center text-[10px] w-4">CP</td>
                            {playerNames.map((_, playerIdx: number) => {
                              const totals = calculatePlayerTotals(
                                playerIdx,
                                hanchans as any,
                                { date: session.date, rate: session.rate, umaValue: session.umaValue, chipRate: session.chipRate, umaRule: session.umaRule }
                              )
                              return (
                                <td key={playerIdx} className="p-1 text-center">
                                  <div className="font-semibold text-base">
                                    {totals.chips}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>

                          {/* 収支行 */}
                          <tr className="bg-muted/30">
                            <td className="p-0.5 font-medium text-center text-[10px] w-4">収支</td>
                            {playerNames.map((_, playerIdx: number) => {
                              const totals = calculatePlayerTotals(
                                playerIdx,
                                hanchans as any,
                                { date: session.date, rate: session.rate, umaValue: session.umaValue, chipRate: session.chipRate, umaRule: session.umaRule }
                              )
                              const sign = totals.payout >= 0 ? '+' : ''
                              return (
                                <td key={playerIdx} className="p-1 text-center font-semibold">
                                  {sign}{totals.payout}
                                </td>
                              )
                            })}
                          </tr>

                          {/* 場代行 */}
                          <tr>
                            <td className="p-0.5 font-medium text-center text-[10px] w-4">場代</td>
                            {playerNames.map((_, playerIdx: number) => {
                              const totals = calculatePlayerTotals(
                                playerIdx,
                                hanchans as any,
                                { date: session.date, rate: session.rate, umaValue: session.umaValue, chipRate: session.chipRate, umaRule: session.umaRule }
                              )
                              return (
                                <td key={playerIdx} className="p-1 text-center">
                                  <div className="font-semibold text-base">
                                    {totals.parlorFee}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>

                          {/* 最終収支行 */}
                          <tr className="bg-primary/10 border-t">
                            <td className="p-0.5 font-bold text-center text-[10px] w-4">最終</td>
                            {playerNames.map((_, playerIdx: number) => {
                              const totals = calculatePlayerTotals(
                                playerIdx,
                                hanchans as any,
                                { date: session.date, rate: session.rate, umaValue: session.umaValue, chipRate: session.chipRate, umaRule: session.umaRule }
                              )
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
                                  {sign}{totals.finalPayout}
                                </td>
                              )
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 半荘詳細タブ */}
              <TabsContent value="detail" className="flex-1 overflow-auto px-2 pb-2">
                <Card className="py-0">
                  <CardContent className="p-2">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs table-fixed">
                        <thead className="sticky top-0 z-10 bg-white">
                          <tr className="border-b">
                            <th className="p-0.5 text-center w-4 text-muted-foreground text-[10px]">#</th>
                            {playerNames.map((name: string, idx: number) => (
                              <th key={idx} className="p-1 text-center font-semibold">
                                {name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {hanchans.map((hanchan: Hanchan & { players: PlayerResult[] }) => (
                            <tr key={hanchan.id} className="border-b hover:bg-muted/30">
                              <td className="p-0.5 text-center text-muted-foreground font-medium">
                                {hanchan.hanchanNumber}
                              </td>
                              {hanchan.players.map((player: PlayerResult, playerIdx: number) => {
                                if (player.isSpectator) {
                                  return (
                                    <td key={playerIdx} className="p-1 text-center text-muted-foreground">
                                      見学
                                    </td>
                                  )
                                }

                                const score = player.score ?? 0
                                const sign = score >= 0 ? '+' : ''
                                const umaMark = player.umaMark || ''

                                return (
                                  <td key={playerIdx} className="p-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className={score >= 0 ? 'text-green-600' : 'text-red-600'}>
                                        {sign}{score}
                                      </span>
                                      <span className="text-muted-foreground">{umaMark}</span>
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <>
            {/* 編集モード: SessionSettingsCard (モード変更・保存ボタンなし) */}
            {editableSettings && (
              <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 p-3 rounded-md">
                <div>モード: {session.mode === '4-player' ? '4人打ち' : '3人打ち'}</div>
                <div className="flex items-center gap-1">
                  <span>レート:</span>
                  <input
                    type="number"
                    value={editableSettings.rate}
                    onChange={(e) => handleSettingsChange({ ...editableSettings, rate: Number(e.target.value) })}
                    className="w-16 h-6 text-sm text-center border rounded px-1"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span>ウマ:</span>
                  <input
                    type="number"
                    value={editableSettings.umaValue}
                    onChange={(e) => handleSettingsChange({ ...editableSettings, umaValue: Number(e.target.value) })}
                    className="w-16 h-6 text-sm text-center border rounded px-1"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span>チップ:</span>
                  <input
                    type="number"
                    value={editableSettings.chipRate}
                    onChange={(e) => handleSettingsChange({ ...editableSettings, chipRate: Number(e.target.value) })}
                    className="w-16 h-6 text-sm text-center border rounded px-1"
                  />
                </div>
                <div>ルール: {session.umaRule === 'standard' ? '標準' : '2位マイナス'}</div>
              </div>
            )}

            {/* 編集モード: ScoreInputTable + TotalsPanel */}
            <div className="flex flex-col gap-2 h-[calc(90vh-220px)]">
              <ScoreInputTable
                hanchans={editableHanchans}
                selectedMode={session.mode}
                settings={editableSettings!}
                mainUser={mainUser}
                users={users}
                onHanchansChange={handleHanchansChange}
                onPlayerChange={(playerIndex, userId, playerName) => {
                  const newHanchans = editableHanchans.map(h => ({
                    ...h,
                    players: h.players.map((p, idx) =>
                      idx === playerIndex ? { ...p, userId, playerName } : p
                    )
                  }))
                  handleHanchansChange(newHanchans)
                }}
                onAddNewUser={addNewUser}
                getExcludeUserIds={getExcludeUserIds}
              />

              <TotalsPanel
                hanchans={editableHanchans}
                settings={editableSettings!}
                onChipsChange={(playerIndex, chips) => {
                  const newHanchans = editableHanchans.map(h => ({
                    ...h,
                    players: h.players.map((p, idx) =>
                      idx === playerIndex ? { ...p, chips } : p
                    )
                  }))
                  handleHanchansChange(newHanchans)
                }}
                onParlorFeeChange={(playerIndex, parlorFee) => {
                  const newHanchans = editableHanchans.map(h => ({
                    ...h,
                    players: h.players.map((p, idx) =>
                      idx === playerIndex ? { ...p, parlorFee } : p
                    )
                  }))
                  handleHanchansChange(newHanchans)
                }}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* テンプレート保存ダイアログ */}
    <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>テンプレートとして保存</DialogTitle>
          <DialogDescription>
            このセッションの設定をテンプレートとして保存します
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <label className="text-sm font-medium">テンプレート名</label>
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="例: 金曜麻雀会"
            maxLength={50}
            className="mt-1"
            autoFocus
          />
          {sessionData && (
            <p className="text-xs text-muted-foreground mt-2">
              保存される設定: {sessionData.session.mode === '4-player' ? '4人打ち' : '3人打ち'} •
              R{sessionData.session.rate}/U{sessionData.session.umaValue}/C{sessionData.session.chipRate} •
              メンバー{sessionData.hanchans[0]?.players.length || 0}名
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleConfirmSaveTemplate} disabled={isSavingTemplate}>
            {isSavingTemplate ? '保存中...' : '保存'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
