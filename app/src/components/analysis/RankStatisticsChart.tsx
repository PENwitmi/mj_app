import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart'
import { Card, CardContent } from '@/components/ui/card'
import type { RankStatistics } from '@/lib/db-utils'

interface RankStatisticsChartProps {
  statistics: RankStatistics
  mode: '4-player' | '3-player'
}

export function RankStatisticsChart({
  statistics,
  mode
}: RankStatisticsChartProps) {

  // エラーハンドリング: データなし
  if (statistics.totalGames === 0) {
    return (
      <Card>
        <CardContent className="p-3 text-center text-sm text-muted-foreground">
          📊 着順統計を表示するデータがありません
        </CardContent>
      </Card>
    )
  }

  // チャートデータ変換
  const chartData = [
    {
      rank: '1位',
      count: statistics.rankCounts.first,
      rate: statistics.rankRates.first
    },
    {
      rank: '2位',
      count: statistics.rankCounts.second,
      rate: statistics.rankRates.second
    },
    {
      rank: '3位',
      count: statistics.rankCounts.third,
      rate: statistics.rankRates.third
    }
  ]

  if (mode === '4-player' && statistics.rankCounts.fourth !== undefined) {
    chartData.push({
      rank: '4位',
      count: statistics.rankCounts.fourth,
      rate: statistics.rankRates.fourth || 0
    })
  }


  const chartConfig = {
    count: {
      label: '回数',
      color: 'hsl(var(--chart-1))'
    }
  } satisfies ChartConfig

  // モードに応じた動的な高さ設定（Tailwindクラス）
  const heightClass = mode === '4-player' ? 'h-[200px]' : 'h-[160px]'

  return (
    <Card>
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="text-sm font-semibold">
            📊 着順統計（{statistics.totalGames}半荘）
          </div>

          <ChartContainer config={chartConfig} className={`aspect-auto w-full ${heightClass}`}>
            <BarChart
              layout="vertical"
              data={chartData}
              accessibilityLayer
              margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" />
              <YAxis
                dataKey="rank"
                type="category"
                width={35}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>

          {/* 各着順の詳細情報 */}
          <div className="space-y-1 text-xs text-muted-foreground">
            {chartData.map(({ rank, count, rate }) => (
              <div key={rank}>
                {rank}: {count}回 ({rate.toFixed(1)}%)
              </div>
            ))}
            <div className="pt-1 border-t">
              平均着順: {statistics.averageRank.toFixed(2)}位
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
