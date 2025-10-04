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
import { getSessionWithDetails } from '@/lib/db-utils'
import type { Session, Hanchan, PlayerResult } from '@/lib/db'

// getSessionWithDetailsの戻り値の型
interface SessionWithDetails {
  session: Session
  hanchans: Array<Hanchan & { players: PlayerResult[] }>
}

interface SessionDetailDialogProps {
  sessionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SessionDetailDialog({
  sessionId,
  open,
  onOpenChange,
}: SessionDetailDialogProps) {
  const [sessionData, setSessionData] = useState<SessionWithDetails | null>(null)

  useEffect(() => {
    if (!sessionId || !open) {
      setSessionData(null)
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
            <Button variant="outline" size="sm" onClick={() => {
              // TODO: Stage 3で編集モード実装
              console.log('編集ボタンクリック')
            }}>
              編集
            </Button>
          </div>
          <DialogDescription>
            {session.mode === '4-player' ? '4人打ち' : '3人打ち'} • {hanchans.length}半荘
          </DialogDescription>
        </DialogHeader>

        {/* セッション設定表示 */}
        <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 p-3 rounded-md">
          <div>モード: {session.mode === '4-player' ? '4人打ち' : '3人打ち'}</div>
          <div>レート: {session.rate}</div>
          <div>ウマ: {session.umaValue}</div>
          <div>チップレート: {session.chipRate}</div>
          <div>場代: {session.parlorFee}</div>
          <div>ルール: {session.umaRule === 'standard' ? '標準' : '2位マイナス'}</div>
        </div>

        {/* 半荘テーブル（閲覧専用） */}
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
      </DialogContent>
    </Dialog>
  )
}
