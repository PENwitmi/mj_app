import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { GameMode } from '@/lib/db-utils'
import type { PeriodType } from '@/lib/db-utils'
import type { User } from '@/lib/db-utils'

interface AnalysisFiltersProps {
  selectedUserId: string
  selectedPeriod: PeriodType
  selectedMode: GameMode | 'all'
  mainUser: User | null
  users: User[]
  availableYears: number[]
  onUserChange: (userId: string) => void
  onPeriodChange: (period: PeriodType) => void
  onModeChange: (mode: GameMode | 'all') => void
}

export function AnalysisFilters({
  selectedUserId,
  selectedPeriod,
  selectedMode,
  mainUser,
  users,
  availableYears,
  onUserChange,
  onPeriodChange,
  onModeChange
}: AnalysisFiltersProps) {
  return (
    <Card className="py-0">
      <CardContent className="p-3 space-y-3">
        {/* ユーザー選択・期間選択 */}
        <div className="grid grid-cols-2 gap-2">
          {/* ユーザー選択 */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">ユーザー</label>
            <select
              value={selectedUserId}
              onChange={(e) => onUserChange(e.target.value)}
              className="w-full h-12 text-sm border rounded px-2"
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
            <label className="text-xs text-muted-foreground">期間</label>
            <select
              value={selectedPeriod}
              onChange={(e) => onPeriodChange(e.target.value as PeriodType)}
              className="w-full h-12 text-sm border rounded px-2"
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

        {/* モードタブ */}
        <div>
          <Tabs value={selectedMode} onValueChange={(value) => onModeChange(value as GameMode | 'all')}>
            <TabsList className="grid w-full grid-cols-3 h-12">
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
