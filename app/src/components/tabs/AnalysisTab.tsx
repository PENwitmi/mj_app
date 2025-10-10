import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { AnalysisFilters } from '@/components/analysis/AnalysisFilters'
// import { RankStatisticsChart } from '@/components/analysis/RankStatisticsChart'  // 横向き棒グラフ（円グラフに移行）
import { RankStatisticsChartPiePrototype } from '@/components/test/RankStatisticsChartPiePrototype'  // 円グラフ
import { RevenueTimelineChart } from '@/components/analysis/RevenueTimelineChart'
import { useSessions } from '@/hooks/useSessions'
import type { GameMode, PlayerResult, User } from '@/lib/db-utils'
import type { PeriodType } from '@/lib/db-utils'
import {
  filterSessionsByPeriod,
  filterSessionsByMode,
  calculateRankStatistics,
  calculatePointStatistics,
  calculateChipStatistics
} from '@/lib/db-utils'
import { calculatePayout } from '@/lib/session-utils'
import { logger } from '@/lib/logger'

interface AnalysisTabProps {
  mainUser: User | null
  users: User[]  // activeUsers (登録ユーザーのみ)
  addNewUser: (name: string) => Promise<User>  // 将来の拡張用
}

export function AnalysisTab({ mainUser, users, addNewUser: _addNewUser }: AnalysisTabProps) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const { sessions, loading, error } = useSessions(mainUser?.id || '', { includeHanchans: true })

  // フィルターState
  const [selectedUserId, setSelectedUserId] = useState<string>(mainUser?.id || '')
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('this-month')
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

  // 各統計を個別に計算
  const rankStats = useMemo(() => {
    if (selectedMode === 'all') return undefined
    if (hanchans.length === 0) return undefined
    return calculateRankStatistics(hanchans, selectedUserId, selectedMode)
  }, [hanchans, selectedUserId, selectedMode])

  const revenueStats = useMemo(() => {
    if (filteredSessions.length === 0) return null

    let totalIncome = 0
    let totalExpense = 0

    // 各セッションの各半荘からselectedUserIdの収支を計算
    filteredSessions.forEach(({ session, hanchans }) => {
      if (hanchans) {
        hanchans.forEach(hanchan => {
          const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
          if (userResult) {
            // calculatePayoutで正確な収支（円）を計算
            const payout = calculatePayout(
              userResult.score,
              userResult.umaMark,
              userResult.chips,
              session.rate,
              session.umaValue,
              session.chipRate,
              session.parlorFee
            )

            if (payout > 0) {
              totalIncome += payout
            } else {
              totalExpense += payout  // 負の値
            }
          }
        })
      }
    })

    return {
      totalIncome,
      totalExpense,
      totalBalance: totalIncome + totalExpense
    }
  }, [filteredSessions, selectedUserId])

  const pointStats = useMemo(() => {
    if (filteredSessions.length === 0) return null
    const playerResults: PlayerResult[] = []
    filteredSessions.forEach(({ hanchans }) => {
      if (hanchans) {
        hanchans.forEach(hanchan => {
          const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
          if (userResult) playerResults.push(userResult)
        })
      }
    })
    return calculatePointStatistics(playerResults)
  }, [filteredSessions, selectedUserId])

  const chipStats = useMemo(() => {
    if (filteredSessions.length === 0) return null

    // selectedUserIdのplayerResultsを収集
    const playerResults: PlayerResult[] = []
    filteredSessions.forEach(({ hanchans }) => {
      if (hanchans) {
        hanchans.forEach(hanchan => {
          const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
          if (userResult) playerResults.push(userResult)
        })
      }
    })

    return calculateChipStatistics(playerResults)
  }, [filteredSessions, selectedUserId])

  // ローディング・エラー表示
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-lg font-medium">読み込み中...</div>
          <div className="text-sm text-muted-foreground mt-2">データを取得しています</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-lg font-medium text-destructive">エラーが発生しました</div>
          <div className="text-sm text-muted-foreground mt-2">{error.message}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* フィルターエリア */}
      <AnalysisFilters
        selectedUserId={selectedUserId}
        selectedPeriod={selectedPeriod}
        selectedMode={selectedMode}
        mainUser={mainUser}
        users={users}
        availableYears={availableYears}
        onUserChange={setSelectedUserId}
        onPeriodChange={setSelectedPeriod}
        onModeChange={setSelectedMode}
      />

      {/* 統計表示エリア */}
      {filteredSessions.length === 0 ? (
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
          {/* 統合統計カード（着順・収支・ポイント・チップ） */}
          {(revenueStats || pointStats || chipStats || rankStats) && (
            <Card className="py-3">
              <CardContent className="p-3">
                <div className="grid grid-cols-[11fr_9fr] gap-3">
                  {/* 半荘着順統計 */}
                  {selectedMode !== 'all' && rankStats ? (
                    <div className="border-r pl-2 pr-3">
                      <div className="text-base font-semibold mb-2">📊 半荘着順</div>
                      <div className="space-y-1 text-base">
                        <div className="flex">
                          <span className="w-12">1位:</span>
                          <span className="flex-1 text-right">{rankStats.rankCounts.first}回 ({rankStats.rankRates.first.toFixed(1)}%)</span>
                        </div>
                        <div className="flex">
                          <span className="w-12">2位:</span>
                          <span className="flex-1 text-right">{rankStats.rankCounts.second}回 ({rankStats.rankRates.second.toFixed(1)}%)</span>
                        </div>
                        <div className="flex">
                          <span className="w-12">3位:</span>
                          <span className="flex-1 text-right">{rankStats.rankCounts.third}回 ({rankStats.rankRates.third.toFixed(1)}%)</span>
                        </div>
                        {selectedMode === '4-player' && rankStats.rankCounts.fourth !== undefined && (
                          <div className="flex">
                            <span className="w-12">4位:</span>
                            <span className="flex-1 text-right">{rankStats.rankCounts.fourth}回 ({rankStats.rankRates.fourth?.toFixed(1)}%)</span>
                          </div>
                        )}
                        <div className="flex pt-1 border-t font-bold">
                          <span className="w-12">平均:</span>
                          <span className="flex-1 text-right">{rankStats.averageRank.toFixed(2)}位</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-r pr-3">
                      <div className="text-xs text-muted-foreground text-center pt-6">
                        半荘着順統計は個別モードで表示
                      </div>
                    </div>
                  )}

                  {/* 収支統計 */}
                  {revenueStats && (
                    <div className="pl-2 pr-2">
                      <div className="text-base font-semibold mb-2">💰 収支</div>
                      <div className="space-y-1 text-lg">
                        <div className="flex">
                          <span className="w-8">+:</span>
                          <span className="flex-1 text-right text-blue-600">+{revenueStats.totalIncome}円</span>
                        </div>
                        <div className="flex">
                          <span className="w-8">-:</span>
                          <span className="flex-1 text-right text-red-600">{revenueStats.totalExpense}円</span>
                        </div>
                        <div className="flex pt-1 border-t font-bold">
                          <span className="w-8">計:</span>
                          <span className={`flex-1 text-right ${revenueStats.totalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {revenueStats.totalBalance >= 0 ? '+' : ''}{revenueStats.totalBalance}円
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ポイント統計 */}
                  {pointStats && (
                    <div className="pt-3 border-t border-r pl-2 pr-3">
                      <div className="text-base font-semibold mb-2">📈 ポイント</div>
                      <div className="space-y-1 text-lg">
                        <div className="flex">
                          <span className="w-8">+:</span>
                          <span className="flex-1 text-right text-blue-600">+{pointStats.plusPoints}pt</span>
                        </div>
                        <div className="flex">
                          <span className="w-8">-:</span>
                          <span className="flex-1 text-right text-red-600">{pointStats.minusPoints}pt</span>
                        </div>
                        <div className="flex pt-1 border-t font-bold">
                          <span className="w-8">計:</span>
                          <span className={`flex-1 text-right ${pointStats.pointBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {pointStats.pointBalance >= 0 ? '+' : ''}{pointStats.pointBalance}pt
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* チップ統計 */}
                  {chipStats && (
                    <div className="pt-3 border-t pl-2 pr-2">
                      <div className="text-base font-semibold mb-2">🎰 チップ</div>
                      <div className="space-y-1 text-lg">
                        <div className="flex">
                          <span className="w-8">+:</span>
                          <span className="flex-1 text-right text-blue-600">+{chipStats.plusChips}枚</span>
                        </div>
                        <div className="flex">
                          <span className="w-8">-:</span>
                          <span className="flex-1 text-right text-red-600">{chipStats.minusChips}枚</span>
                        </div>
                        <div className="flex pt-1 border-t font-bold">
                          <span className="w-8">計:</span>
                          <span className={`flex-1 text-right ${chipStats.chipBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {chipStats.chipBalance >= 0 ? '+' : ''}{chipStats.chipBalance}枚
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 半荘着順統計グラフ（全体モード時は非表示） */}
          {/* 横向き棒グラフ（円グラフに移行）
          {selectedMode !== 'all' && rankStats && (
            <RankStatisticsChart statistics={rankStats} mode={selectedMode} />
          )}
          */}
          {/* 円グラフ */}
          {selectedMode !== 'all' && rankStats && (
            <RankStatisticsChartPiePrototype statistics={rankStats} mode={selectedMode} />
          )}
          {selectedMode === 'all' && (
            <Card className="py-3">
              <CardContent className="p-3 text-center text-sm text-muted-foreground">
                ⚠️ 半荘着順統計は表示されません。4人打ちと3人打ちでは半荘着順の意味が異なるため、個別のモードタブをご覧ください。
              </CardContent>
            </Card>
          )}

          {/* 収支推移グラフ */}
          <RevenueTimelineChart
            sessions={filteredSessions}
            userId={selectedUserId}
          />
        </>
      )}
    </div>
  )
}
