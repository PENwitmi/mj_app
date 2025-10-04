import { useEffect, useState } from 'react'
import './App.css'
import { initializeApp } from './lib/db'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { InputTab } from '@/components/tabs/InputTab'
import { HistoryTab } from '@/components/tabs/HistoryTab'
import { AnalysisTab } from '@/components/tabs/AnalysisTab'
import { SettingsTab } from '@/components/tabs/SettingsTab'
import { useUsers } from '@/hooks/useUsers'

function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('input')

  // ユーザー管理を一箇所で行い、全タブで共有
  const { mainUser, activeUsers, archivedUsers, addNewUser, editUser, archiveUser, restoreUser } = useUsers()

  useEffect(() => {
    const init = async () => {
      try {
        // アプリ初期化（メインユーザー作成）
        await initializeApp()
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : '初期化エラー')
        setLoading(false)
      }
    }

    init()
  }, [])

  // DB初期化 または mainUser取得が完了するまで待機
  if (loading || !mainUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg font-medium">初期化中...</div>
          <div className="text-sm text-muted-foreground mt-2">
            {loading ? 'データベースを準備しています' : 'ユーザー情報を読み込んでいます'}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg font-medium text-destructive">エラーが発生しました</div>
          <div className="text-sm text-muted-foreground mt-2">{error}</div>
        </div>
      </div>
    )
  }

  // ここから先は mainUser が確実に存在する（上記の条件分岐で保証済み）
  return (
    <div className="flex flex-col h-screen">
      <Toaster />
      {/* メインコンテンツエリア */}
      <div className="flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full gap-0">
          <TabsContent value="input" className="overflow-hidden px-2 pt-1 pb-12 data-[state=inactive]:hidden" forceMount>
            <InputTab
              mainUser={mainUser}
              users={activeUsers}
              addNewUser={addNewUser}
              onSaveSuccess={() => setActiveTab('history')}
            />
          </TabsContent>

          <TabsContent value="history" className="overflow-hidden px-2 pt-1 pb-12 data-[state=inactive]:hidden" forceMount>
            <HistoryTab mainUser={mainUser} />
          </TabsContent>

          <TabsContent value="analysis" className="overflow-hidden px-2 pt-1 pb-12 data-[state=inactive]:hidden" forceMount>
            <AnalysisTab />
          </TabsContent>

          <TabsContent value="settings" className="overflow-hidden px-2 pt-1 pb-12 data-[state=inactive]:hidden" forceMount>
            <SettingsTab
              mainUser={mainUser}
              activeUsers={activeUsers}
              archivedUsers={archivedUsers}
              addNewUser={addNewUser}
              editUser={editUser}
              archiveUser={archiveUser}
              restoreUser={restoreUser}
            />
          </TabsContent>

          {/* 下部固定タブナビゲーション */}
          <div className="fixed bottom-0 left-0 right-0 border-t bg-[#1a5c3a]">
            <TabsList className="grid w-full grid-cols-4 h-12 rounded-none">
              <TabsTrigger value="input" className="flex flex-col gap-0 py-1">
                <span className="text-base leading-none">✏️</span>
                <span className="text-xs leading-none">新規入力</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex flex-col gap-0 py-1">
                <span className="text-base leading-none">📋</span>
                <span className="text-xs leading-none">履歴</span>
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex flex-col gap-0 py-1">
                <span className="text-base leading-none">📊</span>
                <span className="text-xs leading-none">分析</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex flex-col gap-0 py-1">
                <span className="text-base leading-none">⚙️</span>
                <span className="text-xs leading-none">設定</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>
    </div>
  )
}

export default App
