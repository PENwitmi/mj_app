import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function SettingsTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>設定</CardTitle>
          <CardDescription>ユーザー管理・各種設定</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors">
            <h3 className="font-semibold mb-1">👤 ユーザー管理</h3>
            <p className="text-sm text-muted-foreground">
              登録ユーザーの追加・編集・削除
            </p>
          </div>

          <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors">
            <h3 className="font-semibold mb-1">🎲 ウマルール設定</h3>
            <p className="text-sm text-muted-foreground">
              4人打ち・3人打ちのウマ割り当て
            </p>
          </div>

          <div className="border rounded-lg p-4 opacity-50">
            <h3 className="font-semibold mb-1">🎨 表示設定（今後実装予定）</h3>
            <p className="text-sm text-muted-foreground">
              テーマ、フォントサイズなど
            </p>
          </div>

          <div className="border rounded-lg p-4 opacity-50">
            <h3 className="font-semibold mb-1">💾 データ管理（今後実装予定）</h3>
            <p className="text-sm text-muted-foreground">
              バックアップ、エクスポートなど
            </p>
          </div>

          <div className="border rounded-lg p-4 opacity-50">
            <h3 className="font-semibold mb-1">ℹ️ アプリ情報（今後実装予定）</h3>
            <p className="text-sm text-muted-foreground">
              バージョン、利用規約など
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">開発者用</CardTitle>
          <CardDescription>デバッグ・テスト用機能</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (!confirm('全データを削除してリセットしますか？')) return
              const { clearAllData } = await import('@/lib/db')
              await clearAllData()
              window.location.reload()
            }}
          >
            全データ削除
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
