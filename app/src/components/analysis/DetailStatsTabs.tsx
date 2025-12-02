import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { RankStatisticsChartPiePrototype } from '@/components/test/RankStatisticsChartPiePrototype'
import { RevenueTimelineChart } from '@/components/analysis/RevenueTimelineChart'
import type { RankStatistics, ExtendedRevenueStatistics, PointStatistics, ChipStatistics, GameMode } from '@/lib/db-utils'
import type { SessionWithSummary } from '@/hooks/useSessions'

interface DetailStatsTabsProps {
  rankStats: RankStatistics | undefined
  revenueStats: ExtendedRevenueStatistics | null
  pointStats: PointStatistics | null
  chipStats: ChipStatistics | null
  sessions: SessionWithSummary[]
  userId: string
  mode: GameMode | 'all'
}

export function DetailStatsTabs({
  rankStats,
  revenueStats,
  pointStats,
  chipStats,
  sessions,
  userId,
  mode
}: DetailStatsTabsProps) {
  // 全体モード時は収支タブをデフォルトに
  const defaultTab = mode === 'all' ? 'revenue' : 'rank'

  return (
    <Card className="py-3">
      <CardContent className="p-3">
        <div className="text-base font-semibold mb-2">📊 詳細データ</div>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="grid w-full grid-cols-4 mb-3">
            <TabsTrigger value="rank" disabled={mode === 'all'}>
              着順
            </TabsTrigger>
            <TabsTrigger value="revenue">収支</TabsTrigger>
            <TabsTrigger value="score">スコア</TabsTrigger>
            <TabsTrigger value="chip">チップ</TabsTrigger>
          </TabsList>

          {/* 着順タブ */}
          <TabsContent value="rank" className="space-y-3 mt-0">
            {mode === 'all' ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">
                  ⚠️ 半荘着順統計は表示されません。
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  （人数によって着順の意味が異なるため）
                </p>
              </div>
            ) : rankStats ? (
              <>
                {/* 着順統計グリッド */}
                <div className={`grid ${mode === '4-player' ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">1位</span>
                    <span className="text-xl font-bold">{rankStats.rankCounts.first}回</span>
                    <span className="text-xs text-muted-foreground">
                      {rankStats.rankRates.first.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">2位</span>
                    <span className="text-xl font-bold">{rankStats.rankCounts.second}回</span>
                    <span className="text-xs text-muted-foreground">
                      {rankStats.rankRates.second.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">3位</span>
                    <span className="text-xl font-bold">{rankStats.rankCounts.third}回</span>
                    <span className="text-xs text-muted-foreground">
                      {rankStats.rankRates.third.toFixed(1)}%
                    </span>
                  </div>
                  {mode === '4-player' && rankStats.rankCounts.fourth !== undefined && (
                    <div className="flex flex-col items-center py-2">
                      <span className="text-xs text-muted-foreground mb-1">4位</span>
                      <span className="text-xl font-bold">{rankStats.rankCounts.fourth}回</span>
                      <span className="text-xs text-muted-foreground">
                        {rankStats.rankRates.fourth?.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* 平均着順 */}
                <div className="flex justify-center py-2 border-t">
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-muted-foreground mb-1">平均着順</span>
                    <span className="text-2xl font-bold">{rankStats.averageRank.toFixed(2)}位</span>
                  </div>
                </div>

                {/* 着順円グラフ */}
                <RankStatisticsChartPiePrototype statistics={rankStats} mode={mode} />
              </>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                データがありません
              </div>
            )}
          </TabsContent>

          {/* 収支タブ */}
          <TabsContent value="revenue" className="space-y-3 mt-0">
            {revenueStats ? (
              <>
                {/* 収支統計グリッド（2行×2列） */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">プラス</span>
                    <span className="text-xl font-bold text-blue-600">
                      +{revenueStats.totalIncome.toLocaleString()}pt
                    </span>
                  </div>
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">マイナス</span>
                    <span className="text-xl font-bold text-red-600">
                      {revenueStats.totalExpense.toLocaleString()}pt
                    </span>
                  </div>
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">合計</span>
                    <span className={`text-xl font-bold ${
                      revenueStats.totalBalance >= 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {revenueStats.totalBalance >= 0 ? '+' : ''}{revenueStats.totalBalance.toLocaleString()}pt
                    </span>
                  </div>
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">うち場代</span>
                    <span className="text-xl font-bold text-muted-foreground">
                      {revenueStats.totalParlorFee > 0 ? '-' : revenueStats.totalParlorFee < 0 ? '+' : ''}
                      {Math.abs(revenueStats.totalParlorFee).toLocaleString()}pt
                    </span>
                  </div>
                </div>

                {/* 収支推移グラフ */}
                <RevenueTimelineChart sessions={sessions} userId={userId} />
              </>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                データがありません
              </div>
            )}
          </TabsContent>

          {/* スコアタブ */}
          <TabsContent value="score" className="space-y-3 mt-0">
            {pointStats ? (
              <>
                {/* スコア統計グリッド */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">プラス</span>
                    <span className="text-xl font-bold text-blue-600">
                      +{pointStats.plusPoints.toLocaleString()}点
                    </span>
                  </div>
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">マイナス</span>
                    <span className="text-xl font-bold text-red-600">
                      {pointStats.minusPoints.toLocaleString()}点
                    </span>
                  </div>
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">合計</span>
                    <span className={`text-xl font-bold ${
                      pointStats.pointBalance >= 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {pointStats.pointBalance >= 0 ? '+' : ''}{pointStats.pointBalance.toLocaleString()}点
                    </span>
                  </div>
                </div>

                {/* グラフは#14で実装予定 */}
                <div className="text-center py-4 text-xs text-muted-foreground border-t">
                  （グラフは今後実装予定）
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                データがありません
              </div>
            )}
          </TabsContent>

          {/* チップタブ */}
          <TabsContent value="chip" className="space-y-3 mt-0">
            {chipStats ? (
              <>
                {/* チップ統計グリッド */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">プラス</span>
                    <span className="text-xl font-bold text-blue-600">
                      +{chipStats.plusChips.toLocaleString()}枚
                    </span>
                  </div>
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">マイナス</span>
                    <span className="text-xl font-bold text-red-600">
                      {chipStats.minusChips.toLocaleString()}枚
                    </span>
                  </div>
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">合計</span>
                    <span className={`text-xl font-bold ${
                      chipStats.chipBalance >= 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {chipStats.chipBalance >= 0 ? '+' : ''}{chipStats.chipBalance.toLocaleString()}枚
                    </span>
                  </div>
                </div>

                {/* グラフは#14で実装予定 */}
                <div className="text-center py-4 text-xs text-muted-foreground border-t">
                  （グラフは今後実装予定）
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                データがありません
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
