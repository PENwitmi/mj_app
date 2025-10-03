import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function HistoryTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>履歴</CardTitle>
          <CardDescription>過去のセッション一覧</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg mb-2">セッション履歴</p>
            <p className="text-sm">実装予定: 日付ごとのカードリスト</p>
            <p className="text-sm">実装予定: 詳細表示・編集機能</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
