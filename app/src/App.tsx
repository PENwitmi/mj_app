import { useEffect, useState } from 'react'
import './App.css'
import { initializeApp, clearAllData } from './lib/db'
import { getMainUser, getAllUsers, addUser } from './lib/db-utils'
import type { User } from './lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function App() {
  const [mainUser, setMainUser] = useState<User | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [newUserName, setNewUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        // アプリ初期化（メインユーザー作成）
        await initializeApp()

        // メインユーザー取得
        const main = await getMainUser()
        setMainUser(main || null)

        // 全ユーザー取得
        const users = await getAllUsers()
        setAllUsers(users)

        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : '初期化エラー')
        setLoading(false)
      }
    }

    init()
  }, [])

  const handleAddUser = async () => {
    if (!newUserName.trim()) return

    try {
      await addUser(newUserName)
      setNewUserName('')

      // ユーザー一覧を再取得
      const users = await getAllUsers()
      setAllUsers(users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ユーザー追加エラー')
    }
  }

  const handleClearData = async () => {
    if (!confirm('全データを削除してリセットしますか？')) return

    try {
      await clearAllData()
      // ページをリロードして再初期化
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データ削除エラー')
    }
  }

  if (loading) {
    return <div className="p-8">初期化中...</div>
  }

  if (error) {
    return <div className="p-8 text-red-500">エラー: {error}</div>
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">麻雀アプリ - shadcn/ui テスト</h1>
        <Button variant="destructive" size="sm" onClick={handleClearData}>
          全データ削除
        </Button>
      </div>

      <Tabs defaultValue="db-test" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="db-test">DBテスト</TabsTrigger>
          <TabsTrigger value="ui-test">UIテスト</TabsTrigger>
        </TabsList>

        <TabsContent value="db-test" className="space-y-4">
          {/* メインユーザー表示 */}
          <Card>
            <CardHeader>
              <CardTitle>メインユーザー</CardTitle>
              <CardDescription>アプリのメインユーザー情報</CardDescription>
            </CardHeader>
            <CardContent>
              {mainUser ? (
                <div>
                  <p>名前: {mainUser.name}</p>
                  <p className="text-sm text-muted-foreground">ID: {mainUser.id}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">メインユーザーが見つかりません</p>
              )}
            </CardContent>
          </Card>

          {/* ユーザー追加フォーム */}
          <Card>
            <CardHeader>
              <CardTitle>新規ユーザー追加</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="ユーザー名を入力"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
                />
                <Button onClick={handleAddUser}>追加</Button>
              </div>
            </CardContent>
          </Card>

          {/* 全ユーザー一覧 */}
          <Card>
            <CardHeader>
              <CardTitle>登録ユーザー一覧 ({allUsers.length}名)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {allUsers.map((user) => (
                  <li key={user.id} className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.name}</span>
                      {user.isMainUser && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          メイン
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">ID: {user.id}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ui-test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>shadcn/ui コンポーネントテスト</CardTitle>
              <CardDescription>追加したコンポーネントの動作確認</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Button バリアント</h3>
                <div className="flex gap-2 flex-wrap">
                  <Button>Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="link">Link</Button>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Input</h3>
                <Input placeholder="テキスト入力..." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default App
