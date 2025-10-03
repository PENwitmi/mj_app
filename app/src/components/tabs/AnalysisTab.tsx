import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function AnalysisTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>分析</CardTitle>
          <CardDescription>成績統計・ダッシュボード</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg mb-2">成績分析</p>
            <p className="text-sm">実装予定: ユーザー・期間・モード選択</p>
            <p className="text-sm">実装予定: 着順統計</p>
            <p className="text-sm">実装予定: 収支・ポイント・チップ統計</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
