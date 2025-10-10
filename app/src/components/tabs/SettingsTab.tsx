import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { NewPlayerDialog } from '@/components/NewPlayerDialog'
import type { UmaRule, User } from '@/lib/db-utils'
import { getDefaultUmaRule, setDefaultUmaRule } from '@/lib/utils'

interface SettingsTabProps {
  mainUser: User | null
  activeUsers: User[]
  archivedUsers: User[]
  addNewUser: (name: string) => Promise<User>
  editUser: (userId: string, name: string) => Promise<User>
  archiveUser: (userId: string) => Promise<void>
  restoreUser: (userId: string) => Promise<void>
}

export function SettingsTab({ mainUser, activeUsers, archivedUsers, addNewUser, editUser, archiveUser, restoreUser }: SettingsTabProps) {
  const [defaultUmaRule, setDefaultUmaRuleState] = useState<UmaRule>('standard')
  const [userManagementOpen, setUserManagementOpen] = useState(false)
  const [newPlayerDialogOpen, setNewPlayerDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingName, setEditingName] = useState('')

  // 初期値をlocalStorageから取得
  useEffect(() => {
    setDefaultUmaRuleState(getDefaultUmaRule())
  }, [])

  // ウマルール変更時
  const handleUmaRuleChange = (value: string) => {
    const newRule = value as UmaRule
    setDefaultUmaRuleState(newRule)
    setDefaultUmaRule(newRule)
  }

  // ユーザーアーカイブ
  const handleArchiveUser = async (userId: string, userName: string) => {
    if (!confirm(
      `「${userName}」をアーカイブしますか？\n` +
      `アーカイブ後も過去の記録は保持され、いつでも復元できます。`
    )) {
      return
    }
    try {
      await archiveUser(userId)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'ユーザーのアーカイブに失敗しました')
    }
  }

  // ユーザー復元
  const handleRestoreUser = async (userId: string) => {
    try {
      await restoreUser(userId)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'ユーザーの復元に失敗しました')
    }
  }

  // 新規ユーザー追加
  const handleAddUser = async (name: string) => {
    return await addNewUser(name)
  }

  // 編集開始
  const handleEditStart = (user: User) => {
    setEditingUser(user)
    setEditingName(user.name)
    setEditDialogOpen(true)
  }

  // 編集保存
  const handleEditSave = async () => {
    if (!editingUser || !editingName.trim()) {
      alert('名前を入力してください')
      return
    }

    try {
      await editUser(editingUser.id, editingName.trim())
      setEditDialogOpen(false)
      setEditingUser(null)
      setEditingName('')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'ユーザー名の更新に失敗しました')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>設定</CardTitle>
          <CardDescription>ユーザー管理・各種設定</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors"
            onClick={() => setUserManagementOpen(true)}
          >
            <h3 className="font-semibold mb-1">👤 ユーザー管理</h3>
            <p className="text-sm text-muted-foreground">
              登録ユーザーの追加・編集・削除
            </p>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">🎲 デフォルトウマルール</h3>
            <p className="text-sm text-muted-foreground">
              新規セッション作成時のウマルール（既存セッションには影響しません）
            </p>
            <div className="pt-2">
              <Select value={defaultUmaRule} onValueChange={handleUmaRuleChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">標準ルール（1-2位プラス）</SelectItem>
                  <SelectItem value="second-minus">2位マイナス判定（2位が負の場合特殊ウマ）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 pt-2">
              <div>• 標準: 4人打ち（1位○○、2位○、3位✗、4位✗✗）、3人打ち（1位○○、2位○、3位✗✗✗）</div>
              <div>• 2位マイナス判定: 2位が負の場合、1位のウマが増加（1位○○○）</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ユーザー管理Dialog */}
      <Dialog open={userManagementOpen} onOpenChange={setUserManagementOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>ユーザー管理</DialogTitle>
            <DialogDescription>
              登録ユーザーの一覧・追加・削除
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* メインユーザー */}
            {mainUser && (
              <div className="border rounded-lg p-3 bg-accent/50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{mainUser.name}</div>
                    <div className="text-xs text-muted-foreground">メインユーザー（削除不可）</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditStart(mainUser)}
                  >
                    編集
                  </Button>
                </div>
              </div>
            )}

            {/* アクティブユーザーセクション */}
            <div className="space-y-2">
              <div className="text-sm font-medium">登録ユーザー</div>
              {activeUsers.length > 0 ? (
                activeUsers.map(user => (
                  <div key={user.id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{user.name}</div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditStart(user)}
                        >
                          編集
                        </Button>
                        <Button
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                          onClick={() => handleArchiveUser(user.id, user.name)}
                        >
                          アーカイブ
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  登録ユーザーはまだいません
                </div>
              )}
            </div>

            {/* アーカイブ済みユーザーセクション（アコーディオン） */}
            {archivedUsers.length > 0 && (
              <Accordion type="single" collapsible className="mt-6">
                <AccordionItem value="archived-users" className="border-0">
                  <AccordionTrigger className="text-sm font-medium text-muted-foreground hover:no-underline py-2">
                    <div className="flex items-center gap-2">
                      <span>🗄️ アーカイブ済みユーザー</span>
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                        {archivedUsers.length}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 pt-2">
                    {archivedUsers.map(user => (
                      <div key={user.id} className="border rounded-lg p-3 bg-gray-100/50">
                        <div className="flex items-center justify-between">
                          <div className="opacity-60">
                            <div className="font-medium text-gray-600">{user.name}</div>
                            <div className="text-xs text-gray-500">
                              {user.archivedAt && `アーカイブ: ${new Date(user.archivedAt).toLocaleDateString()}`}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-black"
                            onClick={() => handleRestoreUser(user.id)}
                          >
                            復元
                          </Button>
                        </div>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* 新規追加ボタン */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setNewPlayerDialogOpen(true)}
            >
              ＋ 新しいユーザーを登録
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 新規ユーザー登録Dialog */}
      <NewPlayerDialog
        open={newPlayerDialogOpen}
        onOpenChange={setNewPlayerDialogOpen}
        onSave={handleAddUser}
        existingUsers={[...(mainUser ? [mainUser] : []), ...activeUsers]}
      />

      {/* ユーザー名編集Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>ユーザー名を編集</DialogTitle>
            <DialogDescription>
              {editingUser?.isMainUser ? 'メインユーザー（自分）の表示名を変更できます。' : 'ユーザー名を変更できます。'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Input
                id="edit-name"
                placeholder="ユーザー名"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleEditSave()
                  }
                }}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false)
                setEditingUser(null)
                setEditingName('')
              }}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={handleEditSave}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
