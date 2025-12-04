import { ComposedChart, Area, Bar, CartesianGrid, XAxis, YAxis, ReferenceLine } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"

export interface TimelineDataPoint {
  label: string      // X軸ラベル（日付等）
  value: number      // 単発値
  cumulative: number // 累積値
}

interface TimelineAreaChartProps {
  data: TimelineDataPoint[]
  title: string
  unit: string       // 単位（pt, 点, 枚）
  height?: number
  colors?: {
    area?: string    // 面積の色（デフォルト: 緑系）
    bar?: string     // 棒の色（デフォルト: 青系）
  }
}

/**
 * 汎用タイムライン面積+棒グラフ
 * - 面積（Area）: 累積値を表示
 * - 棒（Bar）: 単発値を表示
 * - 同時表示で因果関係を可視化
 */
export function TimelineAreaChart({
  data,
  title,
  unit,
  height = 250,
  colors = {}
}: TimelineAreaChartProps) {
  const areaColor = colors.area || "#10b981" // 緑系
  const barColor = colors.bar || "#3b82f6"   // 青系

  // Chart設定
  const chartConfig = {
    value: {
      label: "単発",
      color: barColor
    },
    cumulative: {
      label: "累積",
      color: areaColor
    }
  } satisfies ChartConfig

  // エッジケース: データなし
  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        表示できるデータがありません
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-base font-semibold">{title}</div>

      <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
        <ComposedChart
          data={data}
          margin={{ left: 0, right: 10, top: 10, bottom: 10 }}
          accessibilityLayer
        >
          {/* グリッド */}
          <CartesianGrid strokeDasharray="3 3" vertical={false} />

          {/* X軸（日付） */}
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            tickLine={false}
            axisLine={false}
          />

          {/* Y軸 */}
          <YAxis
            width={55}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toLocaleString()}`}
            tickLine={false}
            axisLine={false}
          />

          {/* 参照線（y=0） */}
          <ReferenceLine
            y={0}
            stroke="#9ca3af"
            strokeDasharray="3 3"
          />

          {/* ツールチップ */}
          <ChartTooltip
            content={<ChartTooltipContent
              formatter={(val, name) => {
                const numValue = typeof val === 'number' ? val : Number(val)
                const formatted = `${numValue >= 0 ? '+' : ''}${numValue.toLocaleString()}${unit}`
                if (name === 'value') return [formatted, '単発']
                if (name === 'cumulative') return [formatted, '累積']
                return [val, name]
              }}
            />}
          />

          {/* 累積（面積） - 背景として先に描画 */}
          <Area
            type="monotone"
            dataKey="cumulative"
            fill={areaColor}
            fillOpacity={0.2}
            stroke={areaColor}
            strokeWidth={1.5}
          />

          {/* 単発（棒グラフ） - 前面に描画 */}
          <Bar
            dataKey="value"
            fill={barColor}
            fillOpacity={0.8}
            radius={[2, 2, 0, 0]}
          />
        </ComposedChart>
      </ChartContainer>

      {/* 凡例 */}
      <div className="flex justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 opacity-80" style={{ backgroundColor: barColor }} />
          <span>単発</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 opacity-30" style={{ backgroundColor: areaColor }} />
          <span>累積</span>
        </div>
      </div>
    </div>
  )
}
