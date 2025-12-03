import { useMemo } from 'react'
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import type { SessionWithSummary } from '@/hooks/useSessions'
import type { GameMode, PlayerResult } from '@/lib/db-utils'
import { umaMarkToValue } from '@/lib/uma-utils'

interface RankTimelineChartProps {
  sessions: SessionWithSummary[]
  userId: string
  mode: GameMode
  limit?: number // 表示する半荘数の上限（デフォルト: 20）
}

interface RankDataPoint {
  index: number    // 半荘インデックス（1から）
  rank: number     // 着順（1〜4）
  date: string     // 日付ラベル
}

/**
 * スコアから着順を計算（ローカル実装）
 * 同点の場合はウママークで判定（✗が多い方が下位）
 */
function calculateRanks(players: PlayerResult[]): Map<string, number> {
  const rankMap = new Map<string, number>()

  // 見学者を除外、かつ点数が入力されているプレイヤーのみを対象
  const activePlayers = players
    .filter((p) => !p.isSpectator && p.score !== null)
    .sort((a, b) => {
      // 点数降順（高い方が上位）
      if (b.score! !== a.score!) return b.score! - a.score!
      // 同点の場合、ウママーク値で比較（値が大きい方が上位）
      return umaMarkToValue(b.umaMark) - umaMarkToValue(a.umaMark)
    })

  // 着順を割り当て（ソート順に1位から順番に）
  activePlayers.forEach((player, index) => {
    rankMap.set(player.id, index + 1)
  })

  return rankMap
}

/**
 * 半荘単位の着順推移データを準備
 */
function prepareRankTimelineData(
  sessions: SessionWithSummary[],
  userId: string,
  mode: GameMode,
  limit: number
): RankDataPoint[] {
  const result: RankDataPoint[] = []

  // セッションを作成日時昇順でソート
  const sorted = [...sessions].sort((a, b) =>
    a.session.createdAt.getTime() - b.session.createdAt.getTime()
  )

  // 各セッションの半荘を処理
  for (const { session, hanchans } of sorted) {
    // モードが一致するセッションのみ
    if (session.mode !== mode) continue
    if (!hanchans) continue

    // 半荘番号順にソート
    const sortedHanchans = [...hanchans].sort((a, b) => a.hanchanNumber - b.hanchanNumber)

    for (const hanchan of sortedHanchans) {
      const userResult = hanchan.players.find(p => p.userId === userId)
      if (!userResult || userResult.isSpectator || userResult.score === null) continue

      // スコアから着順を計算
      const ranks = calculateRanks(hanchan.players)
      const userRank = ranks.get(userResult.id)

      if (userRank) {
        result.push({
          index: result.length + 1,
          rank: userRank,
          date: `${session.date.slice(5).replace('-', '/')}`
        })
      }
    }
  }

  // 直近N件のみ返す
  return result.slice(-limit)
}

/**
 * 着順推移グラフ
 * - Y軸反転（1位が上）
 * - 半荘単位
 * - 直近20件
 */
export function RankTimelineChart({
  sessions,
  userId,
  mode,
  limit = 20
}: RankTimelineChartProps) {
  // データ準備
  const chartData = useMemo(() => {
    return prepareRankTimelineData(sessions, userId, mode, limit)
  }, [sessions, userId, mode, limit])

  // Y軸の範囲（4人打ち: 1〜4、3人打ち: 1〜3）
  const maxRank = mode === '4-player' ? 4 : 3
  const ticks = mode === '4-player' ? [1, 2, 3, 4] : [1, 2, 3]

  // Chart設定
  const chartConfig = {
    rank: {
      label: "着順",
      color: "#8b5cf6" // 紫系
    }
  } satisfies ChartConfig

  // エッジケース: データなし
  if (chartData.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        表示できる半荘データがありません
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-base font-semibold">📈 着順推移（直近{chartData.length}半荘）</div>

      <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
        <LineChart
          data={chartData}
          margin={{ left: 0, right: 10, top: 10, bottom: 10 }}
          accessibilityLayer
        >
          {/* グリッド */}
          <CartesianGrid strokeDasharray="3 3" vertical={false} />

          {/* X軸（半荘インデックス） */}
          <XAxis
            dataKey="index"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            tickLine={false}
            axisLine={false}
          />

          {/* Y軸（着順、反転） */}
          <YAxis
            width={30}
            domain={[1, maxRank]}
            reversed={true}
            ticks={ticks}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v}位`}
            tickLine={false}
            axisLine={false}
          />

          {/* ツールチップ */}
          <ChartTooltip
            content={<ChartTooltipContent
              formatter={(val, _name, props) => {
                const dataPoint = props.payload as RankDataPoint
                return [`${val}位`, `${dataPoint.date}`]
              }}
            />}
          />

          {/* 着順線 */}
          <Line
            type="monotone"
            dataKey="rank"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ r: 4, fill: "#8b5cf6" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ChartContainer>

      {/* 補足 */}
      <div className="text-center text-xs text-muted-foreground">
        ※ 上が1位、下が{maxRank}位
      </div>
    </div>
  )
}
