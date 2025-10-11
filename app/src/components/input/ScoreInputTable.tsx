import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PlayerSelect } from '@/components/PlayerSelect'
import {
  assignUmaMarks,
  calculateAutoScore,
  UMA_MARK_OPTIONS,
} from '@/lib/uma-utils'
import type { GameMode, UmaMark, User } from '@/lib/db-utils'
import type { SessionSettings } from './SessionSettings'
import type { Hanchan } from './TotalsPanel'

interface ScoreInputTableProps {
  hanchans: Hanchan[]
  selectedMode: GameMode
  settings: SessionSettings
  mainUser: User | null
  users: User[]
  onHanchansChange: (hanchans: Hanchan[]) => void
  onPlayerChange: (playerIndex: number, userId: string | null, playerName: string) => void
  onAddNewUser: (name: string) => Promise<User>
}

export function ScoreInputTable({
  hanchans,
  selectedMode,
  settings,
  mainUser,
  users,
  onHanchansChange,
  onPlayerChange,
  onAddNewUser,
}: ScoreInputTableProps) {
  const playerCount = hanchans[0]?.players.length || 0

  const handleScoreChange = (hanchanNumber: number, playerIdx: number, value: string) => {
    const newHanchans = [...hanchans]
    const hanchanIdx = hanchans.findIndex((h) => h.hanchanNumber === hanchanNumber)
    const currentHanchan = newHanchans[hanchanIdx]
    currentHanchan.players[playerIdx].score = value === '' ? null : Number(value)
    onHanchansChange(newHanchans)
  }

  const handleScoreBlur = (hanchanNumber: number) => {
    const newHanchans = [...hanchans]
    const hanchanIdx = hanchans.findIndex((h) => h.hanchanNumber === hanchanNumber)
    const currentHanchan = newHanchans[hanchanIdx]

    // 自動計算判定（初回のみ）
    if (!currentHanchan.autoCalculated) {
      const activePlayers = currentHanchan.players.filter((p) => !p.isSpectator)
      const expectedCount = selectedMode === '4-player' ? 4 : 3
      const filledCount = activePlayers.filter((p) => p.score !== null).length

      // 必要人数-1人が入力済みの場合、最後の1人を自動計算
      if (filledCount === expectedCount - 1) {
        const lastPlayerIdx = activePlayers.findIndex((p) => p.score === null)
        if (lastPlayerIdx !== -1) {
          const globalLastIdx = currentHanchan.players.findIndex(
            (p) => p === activePlayers[lastPlayerIdx]
          )
          const autoScore = calculateAutoScore(currentHanchan.players)
          if (autoScore !== null) {
            currentHanchan.players[globalLastIdx].score = autoScore
            currentHanchan.autoCalculated = true
          }
        }
      }
    }

    // ウママーク自動割り当て（手動変更されていない場合のみ）
    const umaMarks = assignUmaMarks(currentHanchan.players, selectedMode, settings.umaRule)
    currentHanchan.players.forEach((p, idx) => {
      if (!p.umaMarkManual) {
        p.umaMark = umaMarks[idx]
      }
    })

    onHanchansChange(newHanchans)
  }

  const handleUmaMarkChange = (hanchanNumber: number, playerIdx: number, value: string) => {
    const newHanchans = [...hanchans]
    const hanchanIdx = hanchans.findIndex((h) => h.hanchanNumber === hanchanNumber)
    const umaValue = value === 'none' ? '' : (value as UmaMark)
    newHanchans[hanchanIdx].players[playerIdx].umaMark = umaValue
    newHanchans[hanchanIdx].players[playerIdx].umaMarkManual = true
    onHanchansChange(newHanchans)
  }

  const handleAddHanchan = () => {
    const lastHanchan = hanchans[hanchans.length - 1]
    const newHanchan: Hanchan = {
      hanchanNumber: hanchans.length + 1,
      players: lastHanchan.players.map((p) => ({
        playerName: p.playerName,
        userId: p.userId,
        score: null,
        umaMark: '',
        chips: 0,
        parlorFee: 0,
        isSpectator: false,
        umaMarkManual: false,
      })),
      autoCalculated: false,
    }
    onHanchansChange([...hanchans, newHanchan])
  }

  if (hanchans.length === 0) return null

  return (
    <Card className="py-0 overflow-hidden flex-1 min-h-0">
      <CardContent className="p-2 flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse text-xs table-fixed">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b">
                <th className="p-0.5 text-center w-4 text-muted-foreground text-[10px]">#</th>
                {hanchans[0].players.map((player, idx) => (
                  <th key={idx} className="p-1">
                    {idx === 0 ? (
                      <div className="text-sm font-medium text-center">
                        {mainUser?.name || '自分'}
                      </div>
                    ) : (
                      <PlayerSelect
                        value={player.userId ?? '__default__'}
                        playerName={player.playerName}
                        onChange={(userId, playerName) => onPlayerChange(idx, userId, playerName)}
                        position={idx + 1}
                        mainUser={mainUser}
                        users={users}
                        onAddUser={onAddNewUser}
                        excludeMainUser={true}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hanchans.map((hanchan) => (
                <tr key={hanchan.hanchanNumber} className="border-b">
                  <td className="p-0.5 text-center text-[10px] font-medium text-muted-foreground">
                    {hanchan.hanchanNumber}
                  </td>
                  {hanchan.players.map((player, playerIdx) => (
                    <td key={playerIdx} className="p-0.5">
                      <div className="flex gap-0.5 items-center">
                        <Input
                          type="number"
                          placeholder="±"
                          value={player.score ?? ''}
                          className="h-10 text-lg text-center flex-1 min-w-0 px-0"
                          onChange={(e) =>
                            handleScoreChange(hanchan.hanchanNumber, playerIdx, e.target.value)
                          }
                          onBlur={() => handleScoreBlur(hanchan.hanchanNumber)}
                        />
                        <Select
                          value={player.umaMark || 'none'}
                          onValueChange={(value) =>
                            handleUmaMarkChange(hanchan.hanchanNumber, playerIdx, value)
                          }
                        >
                          <SelectTrigger className="h-14 text-xs border border-input bg-white hover:bg-accent w-5 px-0 [&>svg]:hidden whitespace-pre-line leading-[0.9] py-0.5 text-center ml-0.5 justify-center">
                            <SelectValue placeholder="─">
                              {player.umaMark
                                ? UMA_MARK_OPTIONS.find((o) => o.value === player.umaMark)?.display
                                : '─'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {UMA_MARK_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value || 'none'}
                                value={option.value || 'none'}
                                className="whitespace-pre-line leading-[0.9] text-center py-1"
                              >
                                {option.display}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
              {/* 半荘追加ボタン行 */}
              <tr>
                <td colSpan={playerCount + 1} className="p-0">
                  <Button
                    variant="ghost"
                    className="w-full h-10 text-sm rounded-none border-t hover:bg-accent"
                    onClick={handleAddHanchan}
                  >
                    + 半荘を追加
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
