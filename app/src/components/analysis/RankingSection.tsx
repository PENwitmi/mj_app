import { Card, CardContent } from '@/components/ui/card'
import type { RankingEntry } from '@/hooks/useAllUsersRanking'

interface RankingItemProps {
  entry: RankingEntry
}

function RankingItem({ entry }: RankingItemProps) {
  const { rank, user, formattedValue } = entry

  // メダルアイコン
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇'
      case 2: return '🥈'
      case 3: return '🥉'
      default: return null
    }
  }

  const icon = getRankIcon(rank)

  // 順位によるサイズ
  const sizeClass = rank === 1 ? 'text-xl' : rank <= 3 ? 'text-lg' : 'text-base'

  return (
    <div
      className={`flex items-center justify-between py-2.5 px-5 rounded ${
        user.isMainUser ? 'bg-primary/10' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        {/* 順位 */}
        <span className={`w-10 ${icon ? (rank === 1 ? 'text-2xl' : 'text-xl') : sizeClass} text-muted-foreground`}>
          {icon || `${rank}位`}
        </span>

        {/* ユーザー名 */}
        <span className={`${sizeClass} font-medium ${user.isMainUser ? 'text-primary' : ''}`}>
          {user.userName}
        </span>
      </div>

      {/* 値 */}
      <span className={`${rank === 1 ? 'text-2xl' : 'text-lg'} font-bold`}>
        {formattedValue}
      </span>
    </div>
  )
}

interface RankingSectionProps {
  title: string
  icon: string
  rankings: Array<{
    label: string
    entries: RankingEntry[] | null
  }>
}

export function RankingSection({ title, icon, rankings }: RankingSectionProps) {
  // 表示可能なランキングがあるかチェック
  const hasValidRankings = rankings.some(r => r.entries && r.entries.length > 0)

  if (!hasValidRankings) {
    return null
  }

  return (
    <Card className="py-3">
      <CardContent className="px-5 py-3">
        <div className="text-base font-semibold mb-3 flex items-center gap-2">
          <span>{icon}</span>
          <span>{title}</span>
        </div>
        <div className="space-y-4">
          {rankings.map(({ label, entries }) => {
            if (!entries || entries.length === 0) return null

            return (
              <div key={label} className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground border-b pb-1">
                  {label}
                </div>
                <div className="space-y-0.5">
                  {entries.map((entry) => (
                    <RankingItem
                      key={entry.user.userId}
                      entry={entry}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
