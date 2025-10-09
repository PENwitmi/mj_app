import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { User } from '@/lib/db-utils'

interface NewPlayerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (name: string) => Promise<User>
  existingUsers: User[]
}

/**
 * 新規プレイヤー登録ダイアログ
 */
export function NewPlayerDialog({
  open,
  onOpenChange,
  onSave,
  existingUsers,
}: NewPlayerDialogProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    // バリデーション: 空文字チェック
    if (!name.trim()) {
      setError('名前を入力してください')
      return
    }

    // バリデーション: 重複チェック（警告のみ）
    const isDuplicate = existingUsers.some(u => u.name === name.trim())
    if (isDuplicate) {
      setError('同じ名前のユーザーが既に存在します（同姓同名の場合は続行できます）')
      // 強制的には防がない
    }

    try {
      setSaving(true)
      await onSave(name.trim())

      // 成功時はダイアログを閉じてリセット
      setName('')
      setError(null)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setName('')
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>新しいプレイヤーを登録</DialogTitle>
          <DialogDescription>
            プレイヤー名を入力してください。登録後、このプレイヤーの統計を記録できます。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Input
              id="name"
              placeholder="プレイヤー名"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null) // 入力時にエラーをクリア
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSave()
                }
              }}
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
