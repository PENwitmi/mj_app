import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { AnalysisFilters } from '@/components/analysis/AnalysisFilters'
import { useSessions } from '@/hooks/useSessions'
import type { GameMode, PlayerResult, User } from '@/lib/db'
import type { PeriodType } from '@/lib/db-utils'
import {
  filterSessionsByPeriod,
  filterSessionsByMode,
  calculateRankStatistics,
  calculatePointStatistics
} from '@/lib/db-utils'
import { calculatePayout } from '@/lib/session-utils'

interface AnalysisTabProps {
  mainUser: User | null
  users: User[]  // activeUsers (登録ユーザーのみ)
  addNewUser: (name: string) => Promise<User>  // 将来の拡張用
}

export function AnalysisTab({ mainUser, users, addNewUser: _addNewUser }: AnalysisTabProps) {
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
    return filtered
  }, [sessions, selectedPeriod, selectedMode])

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

    // playerResultsからチップを計算
    const totalChips = playerResults.reduce((sum, pr) => sum + pr.chips, 0)

    return { totalChips }
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
        <Card>
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
          {/* 着順統計（全体モード時は非表示） */}
          {selectedMode !== 'all' && rankStats && (
            <Card>
              <CardContent className="p-3">
                <div className="text-sm font-semibold mb-2">
                  📊 着順統計（{rankStats.totalGames}半荘）
                </div>
                <div className="space-y-1 text-sm">
                  <div>1位: {rankStats.rankCounts.first}回 ({rankStats.rankRates.first.toFixed(1)}%)</div>
                  <div>2位: {rankStats.rankCounts.second}回 ({rankStats.rankRates.second.toFixed(1)}%)</div>
                  <div>3位: {rankStats.rankCounts.third}回 ({rankStats.rankRates.third.toFixed(1)}%)</div>
                  {selectedMode === '4-player' && rankStats.rankCounts.fourth !== undefined && (
                    <div>4位: {rankStats.rankCounts.fourth}回 ({rankStats.rankRates.fourth?.toFixed(1)}%)</div>
                  )}
                  <div className="pt-1 border-t">平均着順: {rankStats.averageRank.toFixed(2)}位</div>
                </div>
              </CardContent>
            </Card>
          )}
          {selectedMode === 'all' && (
            <Card>
              <CardContent className="p-3 text-center text-sm text-muted-foreground">
                ⚠️ 着順統計は表示されません。4人打ちと3人打ちでは着順の意味が異なるため、個別のモードタブをご覧ください。
              </CardContent>
            </Card>
          )}

          {/* 収支統計 */}
          {revenueStats && (
            <Card>
              <CardContent className="p-3">
                <div className="text-sm font-semibold mb-2">💰 収支統計</div>
                <div className="space-y-1 text-sm">
                  <div className="text-blue-600">総収入: +{revenueStats.totalIncome}円</div>
                  <div className="text-red-600">総支出: {revenueStats.totalExpense}円</div>
                  <div className="pt-1 border-t font-bold">
                    <span className={revenueStats.totalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}>
                      総収支: {revenueStats.totalBalance >= 0 ? '+' : ''}{revenueStats.totalBalance}円
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ポイント統計 */}
          {pointStats && (
            <Card>
              <CardContent className="p-3">
                <div className="text-sm font-semibold mb-2">📈 ポイント統計</div>
                <div className="space-y-1 text-sm">
                  <div className="text-blue-600">プラスポイント合計: +{pointStats.plusPoints}pt</div>
                  <div className="text-red-600">マイナスポイント合計: {pointStats.minusPoints}pt</div>
                  <div className="pt-1 border-t font-bold">
                    <span className={pointStats.pointBalance >= 0 ? 'text-blue-600' : 'text-red-600'}>
                      ポイント収支: {pointStats.pointBalance >= 0 ? '+' : ''}{pointStats.pointBalance}pt
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* チップ統計 */}
          {chipStats && (
            <Card>
              <CardContent className="p-3">
                <div className="text-sm font-semibold mb-2">🎰 チップ統計</div>
                <div className="text-sm">
                  <span className={chipStats.totalChips >= 0 ? 'text-blue-600' : 'text-red-600'}>
                    総チップ獲得: {chipStats.totalChips >= 0 ? '+' : ''}{chipStats.totalChips}枚
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
