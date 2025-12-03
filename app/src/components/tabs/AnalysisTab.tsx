import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { AnalysisFilters, type ViewMode } from '@/components/analysis/AnalysisFilters'
import { DetailStatsTabs } from '@/components/analysis/DetailStatsTabs'
import { UserRankingView } from '@/components/analysis/UserRankingView'
import { useSessions } from '@/hooks/useSessions'
import { useAllUsersRanking } from '@/hooks/useAllUsersRanking'
import type { GameMode, PlayerResult, User } from '@/lib/db-utils'
import type { PeriodType } from '@/lib/db-utils'
import {
  filterSessionsByPeriod,
  filterSessionsByMode,
  calculateRankStatistics,
  calculateRecordStatistics,
  calculateAllStatistics
} from '@/lib/db-utils'
import { logger } from '@/lib/logger'

interface AnalysisTabProps {
  mainUser: User | null
  users: User[]  // activeUsers (登録ユーザーのみ)
  addNewUser: (name: string) => Promise<User>  // 将来の拡張用
}

export function AnalysisTab({ mainUser, users, addNewUser: _addNewUser }: AnalysisTabProps) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const { sessions, loading, error } = useSessions(mainUser?.id || '', { includeHanchans: true })

  // フィルターState
  const [viewMode, setViewMode] = useState<ViewMode>('personal')
  const [selectedUserId, setSelectedUserId] = useState<string>(mainUser?.id || '')
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('all-time')
  const [selectedMode, setSelectedMode] = useState<GameMode | 'all'>('4-player')

  // 利用可能な年リストを生成（セッションデータから）
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    sessions.forEach(s => {
      const year = parseInt(s.session.date.substring(0, 4))
      years.add(year)
    })
    return Array.from(years).sort((a, b) => b - a) // 降順
  }, [sessions])

  // フィルター適用
  const filteredSessions = useMemo(() => {
    let filtered = sessions
    filtered = filterSessionsByPeriod(filtered, selectedPeriod)
    filtered = filterSessionsByMode(filtered, selectedMode)

    // 選択ユーザーが参加しているセッションのみに絞る
    filtered = filtered.filter(({ hanchans }) => {
      if (!hanchans) return false

      // 半荘内の少なくとも1つに、選択ユーザーが参加していればOK
      return hanchans.some(hanchan =>
        hanchan.players.some(p =>
          p.userId === selectedUserId && !p.isSpectator
        )
      )
    })

    logger.debug('ユーザー参加フィルター適用', {
      context: 'AnalysisTab.filteredSessions',
      data: {
        userId: selectedUserId,
        period: selectedPeriod,
        mode: selectedMode,
        resultCount: filtered.length
      }
    })

    return filtered
  }, [sessions, selectedPeriod, selectedMode, selectedUserId])

  // hanchans収集（着順統計用）
  const hanchans = useMemo(() => {
    const allHanchans: Array<{ players: PlayerResult[] }> = []
    filteredSessions.forEach(({ hanchans }) => {
      if (hanchans) {
        hanchans.forEach(hanchan => {
          allHanchans.push({ players: hanchan.players })
        })
      }
    })
    return allHanchans
  }, [filteredSessions])

  // 着順統計（calculateAllStatisticsで使用するため先に計算）
  const rankStats = useMemo(() => {
    if (selectedMode === 'all') return undefined
    if (hanchans.length === 0) return undefined
    return calculateRankStatistics(hanchans, selectedUserId, selectedMode)
  }, [hanchans, selectedUserId, selectedMode])

  // 統合統計計算（Issue #11: 4回のループ → 1回に最適化）
  const allStats = useMemo(() => {
    if (filteredSessions.length === 0) return null
    const stats = calculateAllStatistics(filteredSessions, selectedUserId, selectedMode, rankStats)
    return stats
  }, [filteredSessions, selectedUserId, selectedMode, rankStats])

  // 個別統計へのアクセス用（既存JSXとの互換性のため）
  const revenueStats = allStats?.revenue ?? null
  const pointStats = allStats?.point ?? null
  const chipStats = allStats?.chip ?? null
  const basicStats = allStats?.basic ?? null

  // 記録統計（Issue #5）
  const recordStats = useMemo(() => {
    if (filteredSessions.length === 0) return null

    const stats = calculateRecordStatistics(filteredSessions, selectedUserId, selectedMode)
    logger.debug('記録統計計算完了', { context: 'AnalysisTab.recordStats', data: stats })
    return stats
  }, [filteredSessions, selectedUserId, selectedMode])

  // ランキング用セッション（期間とモードでフィルタ、ユーザーフィルタなし）
  const rankingFilteredSessions = useMemo(() => {
    let filtered = sessions
    filtered = filterSessionsByPeriod(filtered, selectedPeriod)
    // モードフィルタはuseAllUsersRanking内で処理
    return filtered
  }, [sessions, selectedPeriod])

  // 全ユーザーランキング（Issue #16）
  const { rankings, userCount } = useAllUsersRanking(
    rankingFilteredSessions,
    selectedMode,
    mainUser,
    users
  )

  // ローディング・エラー表示
  if (loading) {
    return (
      <div className="h-full overflow-auto">
        <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-lg font-medium">読み込み中...</div>
          <div className="text-sm text-muted-foreground mt-2">データを取得しています</div>
        </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full overflow-auto">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-lg font-medium text-destructive">エラーが発生しました</div>
            <div className="text-sm text-muted-foreground mt-2">{error.message}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <div className="space-y-3">
      {/* フィルターエリア */}
      <AnalysisFilters
        viewMode={viewMode}
        selectedUserId={selectedUserId}
        selectedPeriod={selectedPeriod}
        selectedMode={selectedMode}
        mainUser={mainUser}
        users={users}
        availableYears={availableYears}
        onViewModeChange={setViewMode}
        onUserChange={setSelectedUserId}
        onPeriodChange={setSelectedPeriod}
        onModeChange={setSelectedMode}
      />

      {/* 統計表示エリア */}
      {viewMode === 'comparison' ? (
        // 全ユーザー比較モード
        <UserRankingView
          rankings={rankings}
          userCount={userCount}
          mode={selectedMode}
        />
      ) : filteredSessions.length === 0 ? (
        <Card className="py-3">
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium text-muted-foreground mb-2">
              データがありません
            </p>
            <p className="text-sm text-muted-foreground">
              選択した条件に一致するセッションが見つかりませんでした
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 基本成績セクション（Issue #4） */}
          {basicStats && (
            <Card className="py-3">
              <CardContent className="p-3">
                <div className="text-base font-semibold mb-2">📌 基本成績</div>
                <div className="grid grid-cols-3 gap-3">
                  {/* 総半荘数 */}
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-muted-foreground mb-1">半荘</span>
                    <span className="text-xl font-bold">{basicStats.totalHanchans}半荘</span>
                  </div>

                  {/* 平均着順 */}
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-muted-foreground mb-1">平均着順</span>
                    {basicStats.averageRank !== undefined ? (
                      <span className="text-xl font-bold">{basicStats.averageRank.toFixed(2)}位</span>
                    ) : (
                      <span className="text-xl text-muted-foreground">-</span>
                    )}
                  </div>

                  {/* 平均スコア（半荘あたり） */}
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-muted-foreground mb-1">平均スコア</span>
                    <span className={`text-xl font-bold ${
                      basicStats.averageScorePerHanchan >= 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {basicStats.averageScorePerHanchan >= 0 ? '+' : ''}
                      {Math.round(basicStats.averageScorePerHanchan)}点
                    </span>
                  </div>

                  {/* 総セッション数 */}
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-muted-foreground mb-1">セッション</span>
                    <span className="text-xl font-bold">{basicStats.totalSessions}回</span>
                  </div>

                  {/* 平均収支（セッションあたり） */}
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-muted-foreground mb-1">平均収支</span>
                    <span className={`text-xl font-bold ${
                      basicStats.averageRevenuePerSession >= 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {basicStats.averageRevenuePerSession >= 0 ? '+' : ''}
                      {Math.round(basicStats.averageRevenuePerSession)}pt
                    </span>
                  </div>

                  {/* 平均チップ（セッションあたり） */}
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-muted-foreground mb-1">平均チップ</span>
                    <span className={`text-xl font-bold ${
                      basicStats.averageChipsPerSession >= 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {basicStats.averageChipsPerSession >= 0 ? '+' : ''}
                      {basicStats.averageChipsPerSession.toFixed(2)}枚
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 記録セクション（Issue #5） */}
          {recordStats && (
            <Card className="py-3">
              <CardContent className="p-3">
                <div className="text-base font-semibold mb-2">🏆 記録</div>
                <div className="grid grid-cols-2 gap-2">
                  {/* 半荘最高得点 */}
                  <div className="flex flex-col items-center py-1">
                    <span className="text-xs text-muted-foreground mb-0.5">半荘最高得点</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {recordStats.maxScoreInHanchan.value >= 0 ? '+' : ''}
                      {recordStats.maxScoreInHanchan.value.toLocaleString()}点
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {recordStats.maxScoreInHanchan.date}
                    </span>
                  </div>

                  {/* 半荘最低得点 */}
                  <div className="flex flex-col items-center py-1">
                    <span className="text-xs text-muted-foreground mb-0.5">半荘最低得点</span>
                    <span className="text-2xl font-bold text-red-600">
                      {recordStats.minScoreInHanchan.value >= 0 ? '+' : ''}
                      {recordStats.minScoreInHanchan.value.toLocaleString()}点
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {recordStats.minScoreInHanchan.date}
                    </span>
                  </div>

                  {/* 1日最高収支 */}
                  <div className="flex flex-col items-center py-1">
                    <span className="text-xs text-muted-foreground mb-0.5">1日最高収支</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {recordStats.maxRevenueInSession.value >= 0 ? '+' : ''}
                      {Math.round(recordStats.maxRevenueInSession.value).toLocaleString()}pt
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {recordStats.maxRevenueInSession.date}
                    </span>
                  </div>

                  {/* 1日最低収支 */}
                  <div className="flex flex-col items-center py-1">
                    <span className="text-xs text-muted-foreground mb-0.5">1日最低収支</span>
                    <span className="text-2xl font-bold text-red-600">
                      {recordStats.minRevenueInSession.value >= 0 ? '+' : ''}
                      {Math.round(recordStats.minRevenueInSession.value).toLocaleString()}pt
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {recordStats.minRevenueInSession.date}
                    </span>
                  </div>

                  {/* 1日最高チップ */}
                  <div className="flex flex-col items-center py-1">
                    <span className="text-xs text-muted-foreground mb-0.5">1日最高チップ</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {recordStats.maxChipsInSession.value >= 0 ? '+' : ''}
                      {recordStats.maxChipsInSession.value}枚
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {recordStats.maxChipsInSession.date}
                    </span>
                  </div>

                  {/* 1日最低チップ */}
                  <div className="flex flex-col items-center py-1">
                    <span className="text-xs text-muted-foreground mb-0.5">1日最低チップ</span>
                    <span className="text-2xl font-bold text-red-600">
                      {recordStats.minChipsInSession.value >= 0 ? '+' : ''}
                      {recordStats.minChipsInSession.value}枚
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {recordStats.minChipsInSession.date}
                    </span>
                  </div>

                  {/* 最大連続トップ */}
                  <div className="flex flex-col items-center py-1">
                    <span className="text-xs text-muted-foreground mb-0.5">最大連続トップ</span>
                    <span className="text-2xl font-bold text-amber-600">
                      {recordStats.maxConsecutiveTopStreak}連勝
                    </span>
                    {recordStats.currentTopStreak !== undefined && recordStats.currentTopStreak > 0 && (
                      <span className="text-xs text-amber-600 mt-0.5">
                        （現在{recordStats.currentTopStreak}連勝中）
                      </span>
                    )}
                  </div>

                  {/* 最大連続ラス */}
                  <div className="flex flex-col items-center py-1">
                    <span className="text-xs text-muted-foreground mb-0.5">最大連続ラス</span>
                    <span className="text-2xl font-bold text-gray-600">
                      {recordStats.maxConsecutiveLastStreak}連続
                    </span>
                    {recordStats.currentLastStreak !== undefined && recordStats.currentLastStreak > 0 && (
                      <span className="text-xs text-gray-600 mt-0.5">
                        （現在{recordStats.currentLastStreak}連続中）
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 詳細データタブ（着順・収支・スコア・チップ） */}
          <DetailStatsTabs
            rankStats={rankStats}
            revenueStats={revenueStats}
            pointStats={pointStats}
            chipStats={chipStats}
            sessions={filteredSessions}
            userId={selectedUserId}
            mode={selectedMode}
          />
        </>
      )}
      </div>
    </div>
  )
}
