import { useMemo, useState } from 'react'
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ReferenceLine } from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { SessionWithSummary } from '@/hooks/useSessions'
import type { ChartConfig } from "@/components/ui/chart"
import { calculatePayout } from '@/lib/session-utils'

type DisplayMode = 'session' | 'cumulative'

interface RevenueTimelineChartProps {
  sessions: SessionWithSummary[]
  userId: string
  showCumulative?: boolean  // 非推奨: 後方互換性のために残す
}

interface RevenueTimelineData {
  date: string
  revenue: number
  cumulative: number
  label: string
}

function formatDateLabel(dateStr: string): string {
  // "2025-10-05" → "10/05"
  const [, month, day] = dateStr.split('-')
  return `${month}/${day}`
}

function prepareTimelineData(
  sessions: SessionWithSummary[],
  userId: string
): RevenueTimelineData[] {
  // 1. 作成日時昇順ソート（入力順＝時系列順）
  const sorted = [...sessions].sort((a, b) =>
    a.session.createdAt.getTime() - b.session.createdAt.getTime()
  )

  let cumulative = 0

  // 2. 各セッションの収支計算
  return sorted.map(({ session, hanchans }) => {
    // hanchansから対象ユーザーの収支を計算
    let sessionRevenue = 0

    hanchans?.forEach(hanchan => {
      const userResult = hanchan.players.find(p => p.userId === userId)
      if (userResult) {
        // calculatePayoutで正確な収支計算（円）
        const payout = calculatePayout(
          userResult.score,
          userResult.umaMark,
          userResult.chips,
          session.rate,
          session.umaValue,
          session.chipRate,
          session.parlorFee
        )
        sessionRevenue += payout
      }
    })

    // 累積収支更新
    cumulative += sessionRevenue

    return {
      date: session.date,
      revenue: sessionRevenue,
      cumulative,
      label: formatDateLabel(session.date)
    }
  })
}

export function RevenueTimelineChart({
  sessions,
  userId,
  showCumulative: _showCumulative = true  // 使用しない（後方互換性のみ）
}: RevenueTimelineChartProps) {
  // 表示モード切り替え
  const [displayMode, setDisplayMode] = useState<DisplayMode>('session')

  // データ変換
  const chartData = useMemo(() => {
    return prepareTimelineData(sessions, userId)
  }, [sessions, userId])

  // Chart設定
  const chartConfig = {
    revenue: {
      label: "収支",
      color: "#3b82f6" // 青色
    },
    cumulative: {
      label: "累積収支",
      color: "#10b981" // 緑色
    }
  } satisfies ChartConfig

  // エッジケース: データなし
  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          表示できるデータがありません
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-3">
        {/* タイトルと切り替えタブ */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">📈 収支推移</div>
          <Tabs value={displayMode} onValueChange={(value) => setDisplayMode(value as DisplayMode)}>
            <TabsList className="h-7">
              <TabsTrigger value="session" className="text-xs h-6 px-3">
                個別
              </TabsTrigger>
              <TabsTrigger value="cumulative" className="text-xs h-6 px-3">
                累積
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* グラフ */}
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <LineChart
            data={chartData}
            margin={{ left: 0, right: 10, top: 10, bottom: 10 }}
            accessibilityLayer
          >
            {/* グリッド（水平線のみ） */}
            <CartesianGrid horizontal={false} />

            {/* X軸（日付） */}
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={false}
            />

            {/* Y軸（金額） */}
            <YAxis
              width={50}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${value >= 0 ? '+' : ''}${value}`}
              tickLine={false}
              axisLine={false}
            />

            {/* 参照線（y=0） */}
            <ReferenceLine
              y={0}
              stroke="#e5e7eb"
              strokeDasharray="3 3"
            />

            {/* ツールチップ */}
            <ChartTooltip
              content={<ChartTooltipContent
                formatter={(value, name) => {
                  const numValue = typeof value === 'number' ? value : Number(value)
                  if (name === 'revenue') return [`${numValue >= 0 ? '+' : ''}${numValue}円`, '収支']
                  if (name === 'cumulative') return [`${numValue >= 0 ? '+' : ''}${numValue}円`, '累積収支']
                  return [value, name]
                }}
              />}
            />

            {/* 単発収支線（実線） */}
            {displayMode === 'session' && (
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}

            {/* 累積収支線（実線） */}
            {displayMode === 'cumulative' && (
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
