import { memo } from 'react'
import { Pie, PieChart, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig
} from '@/components/ui/chart'
import { Card, CardContent } from '@/components/ui/card'
import type { RankStatistics } from '@/lib/db-utils'

interface RankStatisticsChartPiePrototypeProps {
  statistics: RankStatistics
  mode: '4-player' | '3-player'
}

const RADIAN = Math.PI / 180

/**
 * 色定義（色覚多様性対応版）
 * - 明度差を大きく
 * - 第1・第2色覚でも識別可能な配色
 */
const COLORS = {
  first: '#3b82f6',   // blue-500（明）
  second: '#059669',  // emerald-600（中明、彩度高め）
  third: '#d97706',   // amber-600（中暗）
  fourth: '#7c3aed'   // violet-600（暗、赤の代替）
} as const

interface ChartDataItem {
  name: string
  value: number
  count: number
  fill: string
}

// カスタムラベルのprops型定義
interface CustomLabelProps {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  percent: number
  name: string
}

/**
 * 円グラフ用半荘着順統計チャート（プロトタイプ）
 *
 * 妥当性検証書の改善提案を反映：
 * - TypeScript型の厳密化
 * - 色覚多様性対応
 * - ラベル閾値の動的調整
 * - アクセシビリティ強化
 */
export const RankStatisticsChartPiePrototype = memo(({
  statistics,
  mode
}: RankStatisticsChartPiePrototypeProps) => {

  // エラーハンドリング: データなし
  if (statistics.totalGames === 0) {
    return (
      <Card className="py-3">
        <CardContent className="p-3 text-center text-sm text-muted-foreground">
          📊 半荘着順統計を表示するデータがありません
        </CardContent>
      </Card>
    )
  }

  // チャートデータ変換
  const chartData: ChartDataItem[] = [
    {
      name: '1位',
      value: statistics.rankRates.first,
      count: statistics.rankCounts.first,
      fill: COLORS.first
    },
    {
      name: '2位',
      value: statistics.rankRates.second,
      count: statistics.rankCounts.second,
      fill: COLORS.second
    },
    {
      name: '3位',
      value: statistics.rankRates.third,
      count: statistics.rankCounts.third,
      fill: COLORS.third
    }
  ]

  if (mode === '4-player' && statistics.rankCounts.fourth !== undefined) {
    chartData.push({
      name: '4位',
      value: statistics.rankRates.fourth || 0,
      count: statistics.rankCounts.fourth,
      fill: COLORS.fourth
    })
  }

  const chartConfig = {
    first: { label: '1位', color: COLORS.first },
    second: { label: '2位', color: COLORS.second },
    third: { label: '3位', color: COLORS.third },
    fourth: { label: '4位', color: COLORS.fourth }
  } satisfies ChartConfig

  /**
   * ラベル閾値の動的調整
   * - 4人打ち（均等25%）: 3%で十分
   * - 3人打ち（均等33%）: 4%でバランス良い
   */
  const labelThreshold = mode === '4-player' ? 0.03 : 0.04

  /**
   * カスタムラベル（型安全版）
   * - 2行表示: 1行目=半荘着順名、2行目=パーセンテージ
   * - 白文字で視認性確保
   * - 閾値未満は非表示
   */
  const renderCustomLabel = (props: CustomLabelProps) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, name } = props

    // 型ガード
    if (typeof cx !== 'number' || typeof cy !== 'number') return null
    if (typeof percent !== 'number') return null

    // 閾値未満は非表示
    if (percent < labelThreshold) return null

    // ラベル位置計算
    // 係数0.6: 円の半径の60%の位置（やや外側寄り）
    // セクションが細い場合でも読みやすい位置
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-sm font-bold"
      >
        {name}
        <tspan x={x} dy="1.2em" className="text-xs">
          {`${(percent * 100).toFixed(1)}%`}
        </tspan>
      </text>
    )
  }

  /**
   * カスタムツールチップ（型安全版）
   * - 半荘着順名 + 回数 + パーセンテージ
   */
  const CustomTooltipContent = ({ active, payload }: {
    active?: boolean
    payload?: Array<{ payload: ChartDataItem }>
  }) => {
    if (!active || !payload || !payload.length) return null

    const data = payload[0].payload
    return (
      <div className="bg-background border rounded-lg p-2 shadow-lg">
        <div className="text-sm font-semibold">{data.name}</div>
        <div className="text-sm text-muted-foreground">
          {data.count}回 ({data.value.toFixed(1)}%)
        </div>
      </div>
    )
  }

  /**
   * 円のサイズ調整
   * - 半径130pxで統一（見やすさ優先）
   * - 3人打ち/4人打ちで差をつけない
   */
  const outerRadius = 130

  /**
   * 円グラフの配置方向
   * - startAngle={90}: 12時の位置（上）から開始
   * - endAngle={-270}: 時計回りに360度回転（90 - (-270) = 360）
   * - 結果: 1位→2位→3位→4位の順に時計回りで配置
   *
   * ラベル接続線の制御
   * - labelLine={false}: ラベル接続線を非表示
   *   （カスタムラベルを円の内側に配置しているため、接続線は不要）
   */

  return (
    <Card className="py-3">
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="text-base font-semibold">
            📊 半荘着順分布（{statistics.totalGames}半荘）
          </div>

          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <PieChart accessibilityLayer>
              <title>
                半荘着順分布円グラフ - {statistics.totalGames}半荘の統計
              </title>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={outerRadius}
                startAngle={90}
                endAngle={-270}
                label={renderCustomLabel}
                labelLine={false}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.fill}
                  />
                ))}
              </Pie>
              <ChartTooltip content={<CustomTooltipContent />} />
            </PieChart>
          </ChartContainer>

          {/* 平均半荘着順も表示 */}
          <div className="text-xs text-muted-foreground text-center">
            平均半荘着順: {statistics.averageRank.toFixed(2)}位
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

RankStatisticsChartPiePrototype.displayName = 'RankStatisticsChartPiePrototype'
