import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { TemplateDialog } from '@/components/TemplateDialog'
import type { Template, User } from '@/lib/db'
import type { TemplateFormData } from '@/lib/db-utils'

interface TemplateManagementSectionProps {
  templates: Template[]
  users: User[]
  onCreateTemplate: (data: TemplateFormData) => Promise<Template | void>
  onUpdateTemplate: (id: string, data: TemplateFormData) => Promise<Template | void>
  onDeleteTemplate: (id: string) => Promise<void>
}

/**
 * テンプレート管理セクション（設定タブ内で使用）
 */
export function TemplateManagementSection({
  templates,
  users,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
}: TemplateManagementSectionProps) {
  const [managementDialogOpen, setManagementDialogOpen] = useState(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null)

  // プレイヤー名を取得するヘルパー
  const getPlayerNames = (playerIds: string[]): string[] => {
    return playerIds
      .map(id => users.find(u => u.id === id)?.name)
      .filter((name): name is string => !!name)
  }

  // 新規作成ボタン
  const handleCreate = () => {
    setEditingTemplate(null)
    setTemplateDialogOpen(true)
  }

  // 編集ボタン
  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setTemplateDialogOpen(true)
  }

  // 削除ボタン
  const handleDeleteClick = (template: Template) => {
    setDeletingTemplate(template)
    setDeleteConfirmOpen(true)
  }

  // 削除確認
  const handleDeleteConfirm = async () => {
    if (deletingTemplate) {
      await onDeleteTemplate(deletingTemplate.id)
      setDeleteConfirmOpen(false)
      setDeletingTemplate(null)
    }
  }

  // 保存処理
  const handleSave = async (data: TemplateFormData) => {
    if (editingTemplate) {
      await onUpdateTemplate(editingTemplate.id, data)
    } else {
      await onCreateTemplate(data)
    }
  }

  return (
    <>
      {/* セクションカード（クリックで管理ダイアログを開く） */}
      <div
        className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors"
        onClick={() => setManagementDialogOpen(true)}
      >
        <h3 className="font-semibold mb-1">📋 テンプレート管理</h3>
        <p className="text-sm text-muted-foreground">
          よく使う設定の保存・管理
          {templates.length > 0 && (
            <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
              {templates.length}件
            </span>
          )}
        </p>
      </div>

      {/* 管理ダイアログ */}
      <Dialog open={managementDialogOpen} onOpenChange={setManagementDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>テンプレート管理</DialogTitle>
            <DialogDescription>
              テンプレートの一覧・追加・編集・削除
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* テンプレート一覧 */}
            {templates.length > 0 ? (
              <div className="space-y-2">
                {templates.map(template => {
                  const playerNames = getPlayerNames(template.playerIds)
                  const modeLabel = template.gameMode === '4-player' ? '4人打ち' : '3人打ち'

                  return (
                    <div
                      key={template.id}
                      className="border rounded-lg p-3 bg-gray-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{template.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {modeLabel}
                            {playerNames.length > 0 && (
                              <>・{playerNames.length}名（{playerNames.join(', ')}）</>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            レート{template.rate} / ウマ{template.umaValue} / チップ{template.chipRate}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(template)
                            }}
                          >
                            編集
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteClick(template)
                            }}
                          >
                            削除
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-2">テンプレートがありません</p>
                <p className="text-sm">
                  テンプレートを作成すると、よく使う設定を<br />
                  すぐに呼び出せます
                </p>
              </div>
            )}

            {/* 新規作成ボタン */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleCreate}
            >
              ＋ 新しいテンプレートを作成
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* テンプレート作成/編集ダイアログ */}
      <TemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onSave={handleSave}
        editingTemplate={editingTemplate}
        availableUsers={users}
      />

      {/* 削除確認ダイアログ */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>テンプレートを削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deletingTemplate?.name}」を削除しますか？
              <br />
              この操作は取り消せません。
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
