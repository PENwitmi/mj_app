import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Template, User, GameMode, UmaRule } from '@/lib/db'
import type { TemplateFormData } from '@/lib/db-utils'

interface TemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: TemplateFormData) => Promise<void>
  editingTemplate?: Template | null
  availableUsers: User[]
}

const DEFAULT_FORM_DATA: TemplateFormData = {
  name: '',
  gameMode: '4-player',
  playerIds: [],
  rate: 30,
  umaValue: 10,
  chipRate: 100,
  umaRule: 'standard',
}

/**
 * テンプレート作成/編集ダイアログ
 */
export function TemplateDialog({
  open,
  onOpenChange,
  onSave,
  editingTemplate,
  availableUsers,
}: TemplateDialogProps) {
  const [formData, setFormData] = useState<TemplateFormData>(DEFAULT_FORM_DATA)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isEditMode = !!editingTemplate

  // ダイアログ開閉時にフォームをリセット/初期化
  useEffect(() => {
    if (open) {
      if (editingTemplate) {
        setFormData({
          name: editingTemplate.name,
          gameMode: editingTemplate.gameMode,
          playerIds: editingTemplate.playerIds,
          rate: editingTemplate.rate,
          umaValue: editingTemplate.umaValue,
          chipRate: editingTemplate.chipRate,
          umaRule: editingTemplate.umaRule,
        })
      } else {
        setFormData(DEFAULT_FORM_DATA)
      }
      setError(null)
    }
  }, [open, editingTemplate])

  // プレイヤー選択のトグル
  const togglePlayer = (userId: string) => {
    setFormData(prev => {
      const maxPlayers = prev.gameMode === '4-player' ? 4 : 3
      const isSelected = prev.playerIds.includes(userId)

      if (isSelected) {
        // 選択解除
        return { ...prev, playerIds: prev.playerIds.filter(id => id !== userId) }
      } else if (prev.playerIds.length < maxPlayers) {
        // 選択追加（上限まで）
        return { ...prev, playerIds: [...prev.playerIds, userId] }
      }
      return prev
    })
  }

  // ゲームモード変更時
  const handleGameModeChange = (mode: GameMode) => {
    setFormData(prev => {
      const maxPlayers = mode === '4-player' ? 4 : 3
      // モード変更時にプレイヤー数が上限を超える場合は切り詰め
      const newPlayerIds = prev.playerIds.slice(0, maxPlayers)
      return { ...prev, gameMode: mode, playerIds: newPlayerIds }
    })
  }

  // 保存処理
  const handleSave = async () => {
    // バリデーション
    if (!formData.name.trim()) {
      setError('テンプレート名を入力してください')
      return
    }

    try {
      setSaving(true)
      await onSave(formData)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // キャンセル処理
  const handleCancel = () => {
    setFormData(DEFAULT_FORM_DATA)
    setError(null)
    onOpenChange(false)
  }

  const maxPlayers = formData.gameMode === '4-player' ? 4 : 3

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'テンプレートを編集' : '新しいテンプレートを作成'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'テンプレートの設定を変更できます。'
              : 'よく使う設定をテンプレートとして保存できます。'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* テンプレート名 */}
          <div className="grid gap-2">
            <label htmlFor="template-name" className="text-sm font-medium">
              テンプレート名 <span className="text-destructive">*</span>
            </label>
            <Input
              id="template-name"
              placeholder="例: 金曜麻雀会"
              value={formData.name}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, name: e.target.value }))
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSave()
                }
              }}
              autoFocus
            />
          </div>

          {/* ゲームモード */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">ゲームモード</label>
            <Select
              value={formData.gameMode}
              onValueChange={(value) => handleGameModeChange(value as GameMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4-player">4人打ち</SelectItem>
                <SelectItem value="3-player">3人打ち</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* メンバー選択 */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">
              メンバー（最大{maxPlayers}名）
            </label>
            <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
              {availableUsers.length > 0 ? (
                availableUsers.map(user => {
                  const isSelected = formData.playerIds.includes(user.id)
                  const isDisabled = !isSelected && formData.playerIds.length >= maxPlayers

                  return (
                    <div
                      key={user.id}
                      className={`
                        flex items-center justify-between p-2 rounded cursor-pointer transition-colors
                        ${isSelected ? 'bg-primary/10 border border-primary' : 'bg-gray-50 hover:bg-gray-100'}
                        ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                      onClick={() => !isDisabled && togglePlayer(user.id)}
                    >
                      <span className={isSelected ? 'font-medium' : ''}>
                        {user.name}
                        {user.isMainUser && (
                          <span className="text-xs text-muted-foreground ml-1">(自分)</span>
                        )}
                      </span>
                      {isSelected && (
                        <span className="text-xs text-primary">
                          {formData.playerIds.indexOf(user.id) + 1}番目
                        </span>
                      )}
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  登録ユーザーがいません
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              選択中: {formData.playerIds.length}/{maxPlayers}名
            </p>
          </div>

          {/* 設定値 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1">
              <label htmlFor="rate" className="text-sm font-medium">レート</label>
              <Input
                id="rate"
                type="number"
                min={1}
                value={formData.rate}
                onChange={(e) => setFormData(prev => ({ ...prev, rate: Number(e.target.value) || 1 }))}
                className="text-center"
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="uma" className="text-sm font-medium">ウマ</label>
              <Input
                id="uma"
                type="number"
                min={1}
                value={formData.umaValue}
                onChange={(e) => setFormData(prev => ({ ...prev, umaValue: Number(e.target.value) || 1 }))}
                className="text-center"
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="chip" className="text-sm font-medium">チップ</label>
              <Input
                id="chip"
                type="number"
                min={1}
                value={formData.chipRate}
                onChange={(e) => setFormData(prev => ({ ...prev, chipRate: Number(e.target.value) || 1 }))}
                className="text-center"
              />
            </div>
          </div>

          {/* ウマルール */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">ウマルール</label>
            <Select
              value={formData.umaRule}
              onValueChange={(value) => setFormData(prev => ({ ...prev, umaRule: value as UmaRule }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">標準ルール（1-2位プラス）</SelectItem>
                <SelectItem value="second-minus">2位マイナス判定</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* エラー表示 */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
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
            {saving ? '保存中...' : (isEditMode ? '更新' : '作成')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
