import type { GameMode } from '@/lib/db'
import type { Rankings, SessionCountFilter } from '@/hooks/useAllUsersRanking'
import { RankingSection } from './RankingSection'

interface UserRankingViewProps {
  rankings: Rankings
  userCount: number
  mode: GameMode | 'all'
  sessionCountFilter: SessionCountFilter
}

export function UserRankingView({ rankings, userCount, mode, sessionCountFilter }: UserRankingViewProps) {
  // ユーザーが1人以下の場合
  if (userCount <= 1) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        ランキングを表示するには2人以上のユーザーが必要です
      </div>
    )
  }

  // データがない場合
  const hasAnyData = rankings.totalRevenue.length > 0

  if (!hasAnyData) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        表示できるデータがありません
      </div>
    )
  }

  const isAllMode = mode === 'all'

  return (
    <div className="space-y-4">
      {/* 基本成績ランキング（mode='all'以外のみ） */}
      {!isAllMode && (
        <RankingSection
          title="基本成績ランキング"
          icon="📊"
          rankings={[
            { label: '平均着順', entries: rankings.averageRank },
            { label: 'トップ率', entries: rankings.topRate },
            // 3人打ちでは連対率=ラス回避率なので非表示
            ...(mode === '4-player' ? [{ label: '連対率', entries: rankings.rentaiRate }] : []),
            { label: 'ラス回避率', entries: rankings.lastAvoidRate }
          ]}
          sessionCountFilter={sessionCountFilter}
        />
      )}

      {/* 収支ランキング */}
      <RankingSection
        title="収支ランキング"
        icon="💰"
        rankings={[
          { label: '通算収支', entries: rankings.totalRevenue },
          { label: '平均収支/セッション', entries: rankings.averageRevenue }
        ]}
        sessionCountFilter={sessionCountFilter}
      />

      {/* 記録ランキング */}
      <RankingSection
        title="記録ランキング"
        icon="🏆"
        rankings={[
          { label: '半荘最高得点', entries: rankings.maxScore },
          { label: '1日最高収支', entries: rankings.maxRevenueInSession },
          { label: '1日最高チップ', entries: rankings.maxChipsInSession },
          { label: '最大連続トップ', entries: rankings.maxConsecutiveTop }
        ]}
        sessionCountFilter={sessionCountFilter}
      />
    </div>
  )
}
