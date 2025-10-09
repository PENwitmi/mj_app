import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  getSessionWithDetails,
  sessionToSettings,
  dbHanchansToUIHanchans,
  uiDataToSaveData,
  updateSession,
  type UIHanchan
} from '@/lib/db-utils'
import type { Session, Hanchan, PlayerResult, User } from '@/lib/db-utils'
import type { SessionSettings } from '@/components/input/SessionSettings'
import { ScoreInputTable } from '@/components/input/ScoreInputTable'
import { TotalsPanel } from '@/components/input/TotalsPanel'

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
        console.log(`[DEBUG] 🔍 詳細ダイアログ: セッション詳細読み込み開始 (sessionId=${sessionId})`)
        const startTime = performance.now()

        const data = await getSessionWithDetails(sessionId)

        const totalTime = performance.now() - startTime

        console.log(`[DEBUG] ✅ 詳細ダイアログ: 読み込み完了 (${totalTime.toFixed(1)}ms)`, {
          sessionId,
          date: data?.session.date,
          hanchanCount: data?.hanchans.length,
          playerCount: data?.hanchans[0]?.players.length
        })

        setSessionData(data)
      } catch (err) {
        console.error('Failed to load session:', err)
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

  // 変更検知
  const handleSettingsChange = (settings: SessionSettings) => {
    setEditableSettings(settings)
    setHasUnsavedChanges(true)
  }

  const handleHanchansChange = (hanchans: UIHanchan[]) => {
    setEditableHanchans(hanchans)
    setHasUnsavedChanges(true)
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
          <DialogDescription>
            {session.mode === '4-player' ? '4人打ち' : '3人打ち'} • {hanchans.length}半荘
            {isEditMode && ' • 編集モード'}
          </DialogDescription>
        </DialogHeader>

        {!isEditMode ? (
          <>
            {/* 閲覧モード: セッション設定表示 */}
            <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 p-3 rounded-md">
              <div>モード: {session.mode === '4-player' ? '4人打ち' : '3人打ち'}</div>
              <div>レート: {session.rate}</div>
              <div>ウマ: {session.umaValue}</div>
              <div>チップレート: {session.chipRate}</div>
              <div>場代: {session.parlorFee}</div>
              <div>ルール: {session.umaRule === 'standard' ? '標準' : '2位マイナス'}</div>
            </div>

            {/* 閲覧モード: 半荘テーブル */}
            <Card className="py-0">
              <CardContent className="p-2">
                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
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
                <div>場代: {session.parlorFee}</div>
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
  )
}
