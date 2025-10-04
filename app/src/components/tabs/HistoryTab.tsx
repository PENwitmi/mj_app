import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useSessions } from '@/hooks/useSessions'
import type { User } from '@/lib/db'
import { cn } from '@/lib/utils'
import { deleteSession } from '@/lib/db-utils'
import { toast } from 'sonner'

interface HistoryTabProps {
  mainUser: User | null
}

export function HistoryTab({ mainUser }: HistoryTabProps) {
  const { sessions, loading, error } = useSessions(mainUser?.id || '')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)

  const handleDeleteClick = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation() // カードのクリックイベントを防ぐ
    setSessionToDelete(sessionId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!sessionToDelete) return

    try {
      await deleteSession(sessionToDelete)
      toast.success('セッションを削除しました')
      setDeleteDialogOpen(false)
      setSessionToDelete(null)
    } catch (err) {
      toast.error('削除に失敗しました')
      console.error('Failed to delete session:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-lg font-medium">読み込み中...</div>
          <div className="text-sm text-muted-foreground mt-2">セッション一覧を取得しています</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-lg font-medium text-destructive">エラーが発生しました</div>
          <div className="text-sm text-muted-foreground mt-2">{error.message}</div>
        </div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-lg font-medium text-muted-foreground mb-2">
            まだセッションがありません
          </p>
          <p className="text-sm text-muted-foreground">
            「新規入力」タブから麻雀の記録を追加しましょう
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-3 pb-2">
        {sessions.map(({ session, summary }) => (
          <Card
            key={session.id}
            className="cursor-pointer hover:shadow-lg transition-shadow relative gap-2 py-3"
            onClick={() => {
              // TODO: 詳細モーダルを開く (Stage 2で実装)
              console.log('Session clicked:', session.id)
            }}
          >
            <CardHeader className="px-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base text-muted-foreground font-normal">📅 {session.date}</CardTitle>
                  <span className="text-base text-muted-foreground">
                    {session.mode === '4-player' ? '4人打ち' : '3人打ち'} | {summary.hanchanCount}半荘
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => handleDeleteClick(session.id, e)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-3">
              <div className="flex gap-6">
                {/* 左側：基本情報 */}
                <div className="flex-1 space-y-1">
                  <div
                    className={cn(
                      'text-lg font-bold',
                      summary.totalPayout > 0
                        ? 'text-green-600'
                        : summary.totalPayout < 0
                          ? 'text-red-600'
                          : ''
                    )}
                  >
                    収支: {summary.totalPayout > 0 ? '+' : ''}
                    {summary.totalPayout}
                  </div>
                  <div className="text-base">
                    チップ: {summary.totalChips > 0 ? '+' : ''}
                    {summary.totalChips}枚
                  </div>
                  <div className="text-base">
                    平均: {summary.averageRank.toFixed(2)}位
                  </div>
                </div>
                {/* 右側：着順回数 */}
                <div className="flex-1 space-y-1">
                  <div className="text-base">1位: {summary.rankCounts.first}回</div>
                  <div className="text-base">2位: {summary.rankCounts.second}回</div>
                  <div className="text-base">3位: {summary.rankCounts.third}回</div>
                  {summary.rankCounts.fourth !== undefined && <div className="text-base">4位: {summary.rankCounts.fourth}回</div>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>セッションを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。このセッションに含まれる全ての半荘と結果が完全に削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
