import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { RankTimelineChart } from '@/components/analysis/RankTimelineChart'
import { TimelineAreaChart, type TimelineDataPoint } from '@/components/analysis/TimelineAreaChart'
import type { RankStatistics, ExtendedRevenueStatistics, PointStatistics, ChipStatistics, GameMode } from '@/lib/db-utils'
import type { SessionWithSummary } from '@/hooks/useSessions'
import { umaMarkToValue } from '@/lib/uma-utils'

interface DetailStatsTabsProps {
  rankStats: RankStatistics | undefined
  revenueStats: ExtendedRevenueStatistics | null
  pointStats: PointStatistics | null
  chipStats: ChipStatistics | null
  sessions: SessionWithSummary[]
  userId: string
  mode: GameMode | 'all'
  includeParlorFee: boolean
  onIncludeParlorFeeChange: (value: boolean) => void
}

/**
 * 日付文字列をラベル形式に変換
 */
function formatDateLabel(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${month}/${day}`
}

/**
 * 収支推移データを準備（面積+折れ線用）
 */
function prepareRevenueTimelineData(
  sessions: SessionWithSummary[],
  userId: string,
  includeParlorFee: boolean
): TimelineDataPoint[] {
  // 作成日時昇順ソート
  const sorted = [...sessions].sort((a, b) =>
    a.session.createdAt.getTime() - b.session.createdAt.getTime()
  )

  let cumulative = 0

  return sorted.map(({ session, hanchans }) => {
    let sessionRevenue = 0
    let sessionChips = 0
    let sessionParlorFee = 0
    let chipsInitialized = false

    hanchans?.forEach(hanchan => {
      const userResult = hanchan.players.find(p => p.userId === userId)
      if (!userResult || userResult.isSpectator || userResult.score === null) return

      if (!chipsInitialized) {
        sessionChips = userResult.chips || 0
        sessionParlorFee = userResult.parlorFee || 0
        chipsInitialized = true
      }

      const umaPoints = umaMarkToValue(userResult.umaMark)
      const subtotal = userResult.score + umaPoints * session.umaValue
      const scorePayout = subtotal * session.rate
      sessionRevenue += scorePayout
    })

    if (chipsInitialized) {
      const chipsPayout = includeParlorFee
        ? sessionChips * session.chipRate - sessionParlorFee
        : sessionChips * session.chipRate
      sessionRevenue += chipsPayout
    }

    cumulative += sessionRevenue

    return {
      label: formatDateLabel(session.date),
      value: sessionRevenue,
      cumulative
    }
  })
}

/**
 * スコア推移データを準備（面積+折れ線用）
 * ※ rate変換前の素点合計
 */
function prepareScoreTimelineData(
  sessions: SessionWithSummary[],
  userId: string
): TimelineDataPoint[] {
  const sorted = [...sessions].sort((a, b) =>
    a.session.createdAt.getTime() - b.session.createdAt.getTime()
  )

  let cumulative = 0

  return sorted.map(({ session, hanchans }) => {
    let sessionScore = 0

    hanchans?.forEach(hanchan => {
      const userResult = hanchan.players.find(p => p.userId === userId)
      if (!userResult || userResult.isSpectator || userResult.score === null) return
      sessionScore += userResult.score
    })

    cumulative += sessionScore

    return {
      label: formatDateLabel(session.date),
      value: sessionScore,
      cumulative
    }
  })
}

/**
 * チップ推移データを準備（面積+折れ線用）
 */
function prepareChipTimelineData(
  sessions: SessionWithSummary[],
  userId: string
): TimelineDataPoint[] {
  const sorted = [...sessions].sort((a, b) =>
    a.session.createdAt.getTime() - b.session.createdAt.getTime()
  )

  let cumulative = 0

  return sorted.map(({ session, hanchans }) => {
    let sessionChips = 0
    let found = false

    // 最初の半荘からチップ数を取得
    hanchans?.forEach(hanchan => {
      if (found) return
      const userResult = hanchan.players.find(p => p.userId === userId)
      if (!userResult || userResult.isSpectator) return
      sessionChips = userResult.chips || 0
      found = true
    })

    cumulative += sessionChips

    return {
      label: formatDateLabel(session.date),
      value: sessionChips,
      cumulative
    }
  })
}

export function DetailStatsTabs({
  rankStats,
  revenueStats,
  pointStats,
  chipStats,
  sessions,
  userId,
  mode,
  includeParlorFee,
  onIncludeParlorFeeChange
}: DetailStatsTabsProps) {
  // 全体モード時は収支タブをデフォルトに
  const defaultTab = mode === 'all' ? 'revenue' : 'rank'

  // 収支推移データ（場代オプション対応）
  const revenueChartData = sessions.length === 0
    ? []
    : prepareRevenueTimelineData(sessions, userId, includeParlorFee)

  // 収支統計（場代オプション対応） - グラフデータから計算
  const localRevenueStats = (() => {
    let totalIncome = 0
    let totalExpense = 0
    revenueChartData.forEach(d => {
      if (d.value >= 0) totalIncome += d.value
      else totalExpense += d.value
    })
    return {
      totalIncome,
      totalExpense,
      totalBalance: totalIncome + totalExpense,
      // 場代はrevenueStatsから取得（参考表示用）
      totalParlorFee: revenueStats?.totalParlorFee ?? 0
    }
  })()

  // スコア推移データ
  const scoreChartData = sessions.length === 0
    ? []
    : prepareScoreTimelineData(sessions, userId)

  // チップ推移データ
  const chipChartData = sessions.length === 0
    ? []
    : prepareChipTimelineData(sessions, userId)

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

                {/* 着順推移グラフ */}
                <RankTimelineChart sessions={sessions} userId={userId} mode={mode} />
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
                {/* 場代切り替えタブ */}
                <Tabs
                  value={includeParlorFee ? 'include' : 'exclude'}
                  onValueChange={(v) => onIncludeParlorFeeChange(v === 'include')}
                >
                  <TabsList className="grid w-full grid-cols-2 h-9">
                    <TabsTrigger value="exclude" className="text-xs">
                      場代抜き
                    </TabsTrigger>
                    <TabsTrigger value="include" className="text-xs">
                      場代込み
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* 収支統計グリッド（2行×2列） */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">プラス</span>
                    <span className="text-xl font-bold text-blue-600">
                      +{Math.round(localRevenueStats.totalIncome).toLocaleString()}pt
                    </span>
                  </div>
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">マイナス</span>
                    <span className="text-xl font-bold text-red-600">
                      {Math.round(localRevenueStats.totalExpense).toLocaleString()}pt
                    </span>
                  </div>
                  <div className="flex flex-col items-center py-2">
                    <span className="text-xs text-muted-foreground mb-1">合計</span>
                    <span className={`text-xl font-bold ${
                      localRevenueStats.totalBalance >= 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {localRevenueStats.totalBalance >= 0 ? '+' : ''}{Math.round(localRevenueStats.totalBalance).toLocaleString()}pt
                    </span>
                  </div>
                  <div className="flex flex-col items-center py-2">
                    <span className={`text-xs mb-1 ${includeParlorFee ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                      うち場代{!includeParlorFee && ' (参考)'}
                    </span>
                    <span className={`text-xl font-bold ${includeParlorFee ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                      {localRevenueStats.totalParlorFee > 0 ? '-' : localRevenueStats.totalParlorFee < 0 ? '+' : ''}
                      {Math.abs(Math.round(localRevenueStats.totalParlorFee)).toLocaleString()}pt
                    </span>
                  </div>
                </div>

                {/* 収支推移グラフ（面積+棒） */}
                <TimelineAreaChart
                  data={revenueChartData}
                  title="📈 収支推移"
                  unit="pt"
                />
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

                {/* スコア推移グラフ（面積+棒） */}
                <TimelineAreaChart
                  data={scoreChartData}
                  title="📈 スコア推移"
                  unit="点"
                  colors={{ area: "#f59e0b", bar: "#3b82f6" }}
                />
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

                {/* チップ推移グラフ（面積+棒） */}
                <TimelineAreaChart
                  data={chipChartData}
                  title="📈 チップ推移"
                  unit="枚"
                  colors={{ area: "#ec4899", bar: "#3b82f6" }}
                />
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
