import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface SessionMemoInputProps {
  value: string
  onSave: (memo: string) => Promise<void>
}

/**
 * セッションメモ入力コンポーネント
 * - onBlur自動保存
 * - 変更検知（変更なしの場合は保存スキップ）
 * - 文字数カウンター（最大50文字）
 * - エラー時は元の値に戻す
 */
export function SessionMemoInput({ value, onSave }: SessionMemoInputProps) {
  const [memo, setMemo] = useState(value)
  const [isSaving, setIsSaving] = useState(false)

  const handleBlur = async () => {
    // 変更なし = スキップ
    if (memo === value) return

    setIsSaving(true)
    try {
      await onSave(memo)
      toast.success('メモを保存しました')
    } catch (error) {
      toast.error('保存に失敗しました')
      setMemo(value)  // エラー時は元に戻す
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium flex items-center justify-between">
        <span className="flex items-center gap-1">
          💬 メモ
          {isSaving && <span className="text-xs text-muted-foreground">(保存中...)</span>}
        </span>
        <span className="text-xs text-muted-foreground font-normal">
          {memo.length}/50
        </span>
      </label>
      <Textarea
        value={memo}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMemo(e.target.value)}
        onBlur={handleBlur}
        placeholder="役満達成！、次回11/30など"
        maxLength={50}
        rows={2}
        className="resize-none"
      />
    </div>
  )
}
