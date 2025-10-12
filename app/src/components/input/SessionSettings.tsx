import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { UmaRule } from '@/lib/db-utils'

export interface SessionSettings {
  date: string
  rate: number
  umaValue: number
  chipRate: number
  umaRule: UmaRule
}

interface SessionSettingsProps {
  settings: SessionSettings
  onSettingsChange: (settings: SessionSettings) => void
  onModeChange: () => void
  onSave: () => void
}

export function SessionSettingsCard({
  settings,
  onSettingsChange,
  onModeChange,
  onSave,
}: SessionSettingsProps) {
  return (
    <Card className="py-0 shrink-0">
      <CardContent className="p-3 pb-2">
        {/* 1行目: 日付、モード変更ボタン、保存ボタン */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-0.5 flex-1">
            <span className="text-muted-foreground text-xs">📅</span>
            <Input
              type="date"
              value={settings.date}
              onChange={(e) =>
                onSettingsChange({ ...settings, date: e.target.value })
              }
              className="h-7 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs px-1.5"
            onClick={onModeChange}
          >
            モード変更
          </Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700 h-7 text-sm"
            onClick={onSave}
          >
            保存
          </Button>
        </div>

        {/* 2行目: レート、ウマ、チップ */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-xs shrink-0">レート</span>
            <Input
              type="number"
              value={settings.rate}
              onChange={(e) =>
                onSettingsChange({ ...settings, rate: Number(e.target.value) })
              }
              className="h-7 text-sm text-center flex-1 min-w-0"
              min={1}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-xs shrink-0">ウマ</span>
            <Input
              type="number"
              value={settings.umaValue}
              onChange={(e) =>
                onSettingsChange({ ...settings, umaValue: Number(e.target.value) })
              }
              className="h-7 text-sm text-center flex-1 min-w-0"
              min={1}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-xs shrink-0">チップ</span>
            <Input
              type="number"
              value={settings.chipRate}
              onChange={(e) =>
                onSettingsChange({ ...settings, chipRate: Number(e.target.value) })
              }
              className="h-7 text-sm text-center flex-1 min-w-0"
              min={1}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
