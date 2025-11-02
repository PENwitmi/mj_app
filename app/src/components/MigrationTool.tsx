import { useEffect, useState } from 'react'
import { useMigration } from '@/hooks/useMigration'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { CheckCircle2, XCircle, AlertCircle, Database } from 'lucide-react'
import type { User } from '@/lib/db'
import { logger } from '@/lib/logger'

interface MigrationToolProps {
  mainUser: User | null
}

/**
 * データ再計算（マイグレーション）ツールコンポーネント
 */
export function MigrationTool({ mainUser }: MigrationToolProps) {
  const {
    status,
    progress,
    result,
    error,
    isNeeded,
    checkIfNeeded,
    executeMigration,
    reset
  } = useMigration()

  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // マウント時にマイグレーションが必要かチェック
  useEffect(() => {
    checkIfNeeded()
  }, [checkIfNeeded])

  // 実行ボタンクリック
  const handleExecuteClick = () => {
    setShowConfirmDialog(true)
  }

  // 確認ダイアログでOK
  const handleConfirmExecute = async () => {
    setShowConfirmDialog(false)

    if (!mainUser) {
      logger.error('メインユーザーが見つかりません', {
        context: 'MigrationTool.handleConfirmExecute'
      })
      return
    }

    await executeMigration(mainUser.id)
  }

  // リセットボタン
  const handleReset = () => {
    reset()
    checkIfNeeded()
  }

  // 進捗率の計算
  const progressPercentage = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          データ再計算
        </CardTitle>
        <CardDescription>
          chips/parlorFee修正に伴う既存データの再計算
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* チェック中 */}
        {status === 'checking' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>確認中...</AlertTitle>
            <AlertDescription>
              既存データの有無を確認しています
            </AlertDescription>
          </Alert>
        )}

        {/* データなし */}
        {status === 'idle' && !isNeeded && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>データがありません</AlertTitle>
            <AlertDescription>
              再計算が必要なデータはありません
            </AlertDescription>
          </Alert>
        )}

        {/* データあり（実行待機） */}
        {status === 'ready' && isNeeded && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>再計算が可能です</AlertTitle>
            <AlertDescription>
              既存のセッションデータを新しいロジックで再計算します。
              <br />
              この操作は元データを変更せず、計算結果のみを更新します。
            </AlertDescription>
          </Alert>
        )}

        {/* 実行中 */}
        {status === 'running' && (
          <div className="space-y-2">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>再計算実行中...</AlertTitle>
              <AlertDescription>
                {progress && (
                  <>
                    {progress.current} / {progress.total} セッション処理中
                  </>
                )}
              </AlertDescription>
            </Alert>
            {progress && (
              <div className="space-y-1">
                <Progress value={progressPercentage} />
                <p className="text-sm text-muted-foreground text-center">
                  {progressPercentage}%
                </p>
              </div>
            )}
          </div>
        )}

        {/* 成功 */}
        {status === 'success' && result && (
          <Alert className="border-green-500">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle>再計算完了</AlertTitle>
            <AlertDescription>
              <div className="space-y-1 mt-2">
                <p>✅ 処理完了: {result.successCount} / {result.totalSessions} セッション</p>
                <p className="text-xs text-muted-foreground">
                  実行時間: {(result.duration / 1000).toFixed(2)}秒
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* エラー */}
        {status === 'error' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>エラーが発生しました</AlertTitle>
            <AlertDescription>
              <div className="space-y-2 mt-2">
                <p>{error}</p>
                {result && result.failedSessions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="font-semibold">
                      成功: {result.successCount} / {result.totalSessions} セッション
                    </p>
                    <details className="text-xs">
                      <summary className="cursor-pointer">失敗したセッション詳細</summary>
                      <ul className="mt-1 space-y-1 list-disc list-inside">
                        {result.failedSessions.map((failed) => (
                          <li key={failed.sessionId}>
                            {failed.sessionId}: {failed.error}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        {/* 実行ボタン */}
        {(status === 'ready' || status === 'idle') && isNeeded && (
          <Button
            onClick={handleExecuteClick}
            disabled={status !== 'ready'}
            className="w-full"
          >
            データを再計算
          </Button>
        )}

        {/* 再チェックボタン */}
        {(status === 'success' || status === 'error') && (
          <Button
            onClick={handleReset}
            variant="outline"
            className="w-full"
          >
            再チェック
          </Button>
        )}
      </CardFooter>

      {/* 確認ダイアログ */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>データ再計算の確認</AlertDialogTitle>
            <AlertDialogDescription>
              全てのセッションデータを新しいロジックで再計算します。
              <br />
              <br />
              この操作により、chips/parlorFeeの計算が修正されます。
              元データは保持されますが、計算結果が更新されます。
              <br />
              <br />
              実行しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExecute}>
              実行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
