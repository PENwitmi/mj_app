import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { GameMode } from '@/lib/db-utils'
import type { PeriodType } from '@/lib/db-utils'
import type { User } from '@/lib/db-utils'
import type { SessionCountFilter } from '@/hooks/useAllUsersRanking'

export type ViewMode = 'personal' | 'comparison'

interface AnalysisFiltersProps {
  viewMode: ViewMode
  selectedUserId: string
  selectedPeriod: PeriodType
  selectedMode: GameMode | 'all'
  sessionCountFilter: SessionCountFilter
  mainUser: User | null
  users: User[]
  availableYears: number[]
  onViewModeChange: (mode: ViewMode) => void
  onUserChange: (userId: string) => void
  onPeriodChange: (period: PeriodType) => void
  onModeChange: (mode: GameMode | 'all') => void
  onSessionCountFilterChange: (filter: SessionCountFilter) => void
}

export function AnalysisFilters({
  viewMode,
  selectedUserId,
  selectedPeriod,
  selectedMode,
  sessionCountFilter,
  mainUser,
  users,
  availableYears,
  onViewModeChange,
  onUserChange,
  onPeriodChange,
  onModeChange,
  onSessionCountFilterChange
}: AnalysisFiltersProps) {
  return (
    <Card className="py-0">
      <CardContent className="p-3 space-y-3">
        {/* 表示モード切り替え */}
        <div>
          <Tabs value={viewMode} onValueChange={(value) => onViewModeChange(value as ViewMode)}>
            <TabsList
              className="grid w-full grid-cols-2 h-10"
              aria-label="表示モード選択"
            >
              <TabsTrigger value="personal" className="text-sm">
                個人統計
              </TabsTrigger>
              <TabsTrigger value="comparison" className="text-sm">
                全ユーザー比較
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* 個人統計モード: ユーザー選択・期間選択 */}
        {viewMode === 'personal' && (
          <div className="grid grid-cols-2 gap-2">
            {/* ユーザー選択 */}
            <div className="space-y-1">
              <label
                htmlFor="analysis-user-select"
                className="text-xs text-muted-foreground"
              >
                ユーザー
              </label>
              <select
                id="analysis-user-select"
                name="userId"
                value={selectedUserId}
                onChange={(e) => onUserChange(e.target.value)}
                className="w-full h-12 text-sm border rounded px-2"
                aria-label="分析対象ユーザーを選択"
              >
                {/* メインユーザー */}
                {mainUser && (
                  <option key={mainUser.id} value={mainUser.id}>
                    自分
                  </option>
                )}

                {/* 登録ユーザー */}
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 期間選択 */}
            <div className="space-y-1">
              <label
                htmlFor="analysis-period-select"
                className="text-xs text-muted-foreground"
              >
                期間
              </label>
              <select
                id="analysis-period-select"
                name="period"
                value={selectedPeriod}
                onChange={(e) => onPeriodChange(e.target.value as PeriodType)}
                className="w-full h-12 text-sm border rounded px-2"
                aria-label="分析期間を選択"
              >
                <option value="this-month">今月</option>
                <option value="this-year">今年</option>
                {availableYears.map((year) => (
                  <option key={year} value={`year-${year}`}>
                    {year}年
                  </option>
                ))}
                <option value="all-time">全期間</option>
              </select>
            </div>
          </div>
        )}

        {/* 比較モード: セッション数フィルタ */}
        {viewMode === 'comparison' && (
          <div>
            <Tabs
              value={sessionCountFilter}
              onValueChange={(value) => onSessionCountFilterChange(value as SessionCountFilter)}
            >
              <TabsList
                className="grid w-full grid-cols-3 h-10"
                aria-label="セッション数フィルタ選択"
              >
                <TabsTrigger value="last-5" className="text-sm">
                  直近5
                </TabsTrigger>
                <TabsTrigger value="last-10" className="text-sm">
                  直近10
                </TabsTrigger>
                <TabsTrigger value="all" className="text-sm">
                  全データ
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* モードタブ */}
        <div>
          <Tabs value={selectedMode} onValueChange={(value) => onModeChange(value as GameMode | 'all')}>
            <TabsList
              className="grid w-full grid-cols-3 h-12"
              aria-label="ゲームモード選択"
            >
              <TabsTrigger value="4-player" className="py-0 text-sm">
                4人打ち
              </TabsTrigger>
              <TabsTrigger value="3-player" className="py-0 text-sm">
                3人打ち
              </TabsTrigger>
              <TabsTrigger value="all" className="py-0 text-sm">
                全体
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  )
}
