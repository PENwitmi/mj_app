import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RankStatisticsChartPiePrototype } from '@/components/test/RankStatisticsChartPiePrototype'
import { AnalysisFilters, type ViewMode } from '@/components/analysis/AnalysisFilters'
import { useSessions } from '@/hooks/useSessions'
import type { SessionCountFilter } from '@/hooks/useAllUsersRanking'
import type { RankStatistics, GameMode, User } from '@/lib/db-utils'
import type { PeriodType } from '@/lib/db-utils'
import {
  filterSessionsByPeriod,
  filterSessionsByMode,
  calculateRankStatistics
} from '@/lib/db-utils'

interface TestTabProps {
  mainUser: User | null
  users: User[]
  addNewUser: (name: string) => Promise<User>
}

/**
 * TESTタブ - 円グラフプロトタイプのテスト用
 * - モックデータテスト
 * - 実データテスト
 */
export function TestTab({ mainUser, users, addNewUser: _addNewUser }: TestTabProps) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const { sessions, loading, error } = useSessions(mainUser?.id || '', true)

  // フィルターState
  const [viewMode, setViewMode] = useState<ViewMode>('personal')
  const [selectedUserId, setSelectedUserId] = useState<string>(mainUser?.id || '')
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('all-time')
  const [selectedMode, setSelectedMode] = useState<GameMode | 'all'>('4-player')
  const [sessionCountFilter, setSessionCountFilter] = useState<SessionCountFilter>('all')

  // 利用可能な年リストを生成（セッションデータから）
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    sessions.forEach(s => {
      const year = parseInt(s.session.date.substring(0, 4))
      years.add(year)
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [sessions])

  // フィルター適用
  const filteredSessions = useMemo(() => {
    let filtered = sessions
    filtered = filterSessionsByPeriod(filtered, selectedPeriod)
    filtered = filterSessionsByMode(filtered, selectedMode)

    // 選択ユーザーが参加しているセッションのみに絞る
    filtered = filtered.filter(({ hanchans }) => {
      if (!hanchans) return false
      return hanchans.some(hanchan =>
        hanchan.players.some(p =>
          p.userId === selectedUserId && !p.isSpectator
        )
      )
    })

    return filtered
  }, [sessions, selectedPeriod, selectedMode, selectedUserId])

  // hanchans収集
  const hanchans = useMemo(() => {
    const allHanchans: Array<{ players: any[] }> = []
    filteredSessions.forEach(({ hanchans }) => {
      if (hanchans) {
        hanchans.forEach(hanchan => {
          allHanchans.push({ players: hanchan.players })
        })
      }
    })
    return allHanchans
  }, [filteredSessions])

  // 実データの統計計算
  const realRankStats = useMemo(() => {
    if (selectedMode === 'all') return undefined
    if (hanchans.length === 0) return undefined
    return calculateRankStatistics(hanchans, selectedUserId, selectedMode)
  }, [hanchans, selectedUserId, selectedMode])
  // テストデータ1: 4人打ち - バランスの取れた分布
  const test4PlayerBalanced: RankStatistics = {
    totalGames: 42,
    rankCounts: { first: 15, second: 10, third: 10, fourth: 7 },
    rankRates: { first: 35.7, second: 23.8, third: 23.8, fourth: 16.7 },
    averageRank: 2.21
  }

  // テストデータ2: 4人打ち - 極端な偏り（1位多い）
  const test4PlayerSkewed: RankStatistics = {
    totalGames: 50,
    rankCounts: { first: 30, second: 10, third: 7, fourth: 3 },
    rankRates: { first: 60.0, second: 20.0, third: 14.0, fourth: 6.0 },
    averageRank: 1.68
  }

  // テストデータ3: 3人打ち - バランスの取れた分布
  const test3PlayerBalanced: RankStatistics = {
    totalGames: 30,
    rankCounts: { first: 12, second: 10, third: 8 },
    rankRates: { first: 40.0, second: 33.3, third: 26.7 },
    averageRank: 1.87
  }

  // テストデータ4: 3人打ち - 極端な偏り（3位多い）
  const test3PlayerSkewed: RankStatistics = {
    totalGames: 30,
    rankCounts: { first: 3, second: 7, third: 20 },
    rankRates: { first: 10.0, second: 23.3, third: 66.7 },
    averageRank: 2.57
  }

  // テストデータ5: 4人打ち - 均等分布
  const test4PlayerEqual: RankStatistics = {
    totalGames: 40,
    rankCounts: { first: 10, second: 10, third: 10, fourth: 10 },
    rankRates: { first: 25.0, second: 25.0, third: 25.0, fourth: 25.0 },
    averageRank: 2.50
  }

  // テストデータ6: データなし（エラーハンドリングテスト）
  const testNoData: RankStatistics = {
    totalGames: 0,
    rankCounts: { first: 0, second: 0, third: 0 },
    rankRates: { first: 0, second: 0, third: 0 },
    averageRank: 0
  }

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
    <div className="space-y-4 pb-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🧪 円グラフプロトタイプテスト</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>着順分布グラフの円グラフ実装をテストしています。</p>
          <p><strong>実データテスト</strong>と<strong>モックデータテスト</strong>の2セクションがあります。</p>
        </CardContent>
      </Card>

      {/* ========== 実データテストセクション ========== */}
      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle className="text-lg text-primary">📊 実データテスト</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            実際のデータベースから取得したセッションデータを使用しています。
            フィルターで期間・モード・ユーザーを選択できます。
          </div>

          {/* フィルター */}
          <AnalysisFilters
            viewMode={viewMode}
            selectedUserId={selectedUserId}
            selectedPeriod={selectedPeriod}
            selectedMode={selectedMode}
            sessionCountFilter={sessionCountFilter}
            mainUser={mainUser}
            users={users}
            availableYears={availableYears}
            onViewModeChange={setViewMode}
            onUserChange={setSelectedUserId}
            onPeriodChange={setSelectedPeriod}
            onModeChange={setSelectedMode}
            onSessionCountFilterChange={setSessionCountFilter}
          />

          {/* 実データグラフ */}
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
          ) : selectedMode === 'all' ? (
            <Card>
              <CardContent className="p-3 text-center text-sm text-muted-foreground">
                ⚠️ 着順統計は表示されません。4人打ちと3人打ちでは着順の意味が異なるため、個別のモードを選択してください。
              </CardContent>
            </Card>
          ) : realRankStats ? (
            <RankStatisticsChartPiePrototype
              statistics={realRankStats}
              mode={selectedMode}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* ========== モックデータテストセクション ========== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🧪 モックデータテスト（6ケース）</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>以下の6つのテストケースで動作を確認：</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>4人打ち：バランス分布（1位率35.7%）</li>
            <li>4人打ち：極端な偏り（1位率60%）</li>
            <li>3人打ち：バランス分布（1位率40%）</li>
            <li>3人打ち：極端な偏り（3位率66.7%）</li>
            <li>4人打ち：完全均等（各25%）</li>
            <li>データなし（エラーハンドリング）</li>
          </ul>
        </CardContent>
      </Card>

      {/* テストケース1: 4人打ち - バランス */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ケース1: 4人打ち - バランス分布</CardTitle>
        </CardHeader>
        <CardContent>
          <RankStatisticsChartPiePrototype
            statistics={test4PlayerBalanced}
            mode="4-player"
          />
        </CardContent>
      </Card>

      {/* テストケース2: 4人打ち - 極端な偏り */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ケース2: 4人打ち - 極端な偏り（1位多い）</CardTitle>
        </CardHeader>
        <CardContent>
          <RankStatisticsChartPiePrototype
            statistics={test4PlayerSkewed}
            mode="4-player"
          />
        </CardContent>
      </Card>

      {/* テストケース3: 3人打ち - バランス */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ケース3: 3人打ち - バランス分布</CardTitle>
        </CardHeader>
        <CardContent>
          <RankStatisticsChartPiePrototype
            statistics={test3PlayerBalanced}
            mode="3-player"
          />
        </CardContent>
      </Card>

      {/* テストケース4: 3人打ち - 極端な偏り */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ケース4: 3人打ち - 極端な偏り（3位多い）</CardTitle>
        </CardHeader>
        <CardContent>
          <RankStatisticsChartPiePrototype
            statistics={test3PlayerSkewed}
            mode="3-player"
          />
        </CardContent>
      </Card>

      {/* テストケース5: 4人打ち - 完全均等 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ケース5: 4人打ち - 完全均等分布</CardTitle>
        </CardHeader>
        <CardContent>
          <RankStatisticsChartPiePrototype
            statistics={test4PlayerEqual}
            mode="4-player"
          />
        </CardContent>
      </Card>

      {/* テストケース6: データなし */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ケース6: データなし（エラーハンドリング）</CardTitle>
        </CardHeader>
        <CardContent>
          <RankStatisticsChartPiePrototype
            statistics={testNoData}
            mode="4-player"
          />
        </CardContent>
      </Card>
    </div>
  )
}
