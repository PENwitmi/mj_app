import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { umaMarkToValue, type PlayerResult } from '@/lib/uma-utils'
import type { SessionSettings } from './SessionSettings'

export interface Hanchan {
  hanchanNumber: number
  players: PlayerResult[]
  autoCalculated: boolean
}

interface PlayerTotals {
  scoreTotal: number
  umaTotal: number
  subtotal: number
  chips: number
  payout: number
  parlorFee: number
  finalPayout: number
}

function calculatePlayerTotals(
  playerIndex: number,
  hanchans: Hanchan[],
  settings: SessionSettings
): PlayerTotals {
  let scoreTotal = 0
  let umaTotal = 0
  let chips = 0
  let parlorFee = 0

  hanchans.forEach((hanchan) => {
    const player = hanchan.players[playerIndex]
    if (!player.isSpectator && player.score !== null) {
      scoreTotal += player.score
      umaTotal += umaMarkToValue(player.umaMark)
    }
    chips = player.chips
    parlorFee = player.parlorFee
  })

  const subtotal = scoreTotal + umaTotal * settings.umaValue
  const payout = subtotal * settings.rate + chips * settings.chipRate
  const finalPayout = payout - parlorFee

  return {
    scoreTotal,
    umaTotal,
    subtotal,
    chips,
    payout,
    parlorFee,
    finalPayout,
  }
}

interface TotalsPanelProps {
  hanchans: Hanchan[]
  settings: SessionSettings
  onChipsChange: (playerIndex: number, chips: number) => void
  onParlorFeeChange: (playerIndex: number, parlorFee: number) => void
}

export function TotalsPanel({
  hanchans,
  settings,
  onChipsChange,
  onParlorFeeChange,
}: TotalsPanelProps) {
  if (hanchans.length === 0 || !hanchans[0]?.players) return null

  return (
    <div className="shrink-0">
      <Card className="py-0 shadow-lg mb-2">
        <CardContent className="p-2">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs table-fixed">
              <tbody className="text-xs">
                {/* 小計行 */}
                <tr className="bg-muted/50">
                  <td className="p-0.5 font-medium text-center text-[10px] w-4">小計</td>
                  {hanchans[0].players.map((_, playerIdx) => {
                    const totals = calculatePlayerTotals(playerIdx, hanchans, settings)
                    const sign = totals.subtotal >= 0 ? '+' : ''
                    return (
                      <td key={playerIdx} className="p-1 text-center">
                        <div className="font-semibold text-sm">
                          {sign}
                          {totals.subtotal}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          ({sign}
                          {totals.scoreTotal}+{totals.umaTotal * settings.umaValue})
                        </div>
                      </td>
                    )
                  })}
                </tr>

                {/* チップ入力行 */}
                <tr>
                  <td className="p-0.5 font-medium text-center text-[10px] w-4">CP</td>
                  {hanchans[0].players.map((player, playerIdx) => (
                    <td key={playerIdx} className="p-1">
                      <Input
                        type="number"
                        value={player.chips || ''}
                        onChange={(e) => {
                          const chipValue = e.target.value === '' ? 0 : Number(e.target.value)
                          onChipsChange(playerIdx, chipValue)
                        }}
                        className="text-center h-9 text-base leading-tight"
                        placeholder="0"
                      />
                    </td>
                  ))}
                </tr>

                {/* 収支行 */}
                <tr className="bg-muted/30">
                  <td className="p-0.5 font-medium text-center text-[10px] w-4">収支</td>
                  {hanchans[0].players.map((_, playerIdx) => {
                    const totals = calculatePlayerTotals(playerIdx, hanchans, settings)
                    const sign = totals.payout >= 0 ? '+' : ''
                    return (
                      <td key={playerIdx} className="p-1 text-center font-semibold">
                        {sign}
                        {totals.payout}
                      </td>
                    )
                  })}
                </tr>

                {/* 場代入力行 */}
                <tr>
                  <td className="p-0.5 font-medium text-center text-[10px] w-4">場代</td>
                  {hanchans[0].players.map((player, playerIdx) => (
                    <td key={playerIdx} className="p-1">
                      <Input
                        type="number"
                        value={player.parlorFee || ''}
                        onChange={(e) => {
                          const parlorFeeValue = e.target.value === '' ? 0 : Number(e.target.value)
                          onParlorFeeChange(playerIdx, parlorFeeValue)
                        }}
                        className="text-center h-9 text-base leading-tight"
                        placeholder="0"
                      />
                    </td>
                  ))}
                </tr>

                {/* 最終収支行 */}
                <tr className="bg-primary/10 border-t">
                  <td className="p-0.5 font-bold text-center text-[10px] w-4">最終</td>
                  {hanchans[0].players.map((_, playerIdx) => {
                    const totals = calculatePlayerTotals(playerIdx, hanchans, settings)
                    const sign = totals.finalPayout >= 0 ? '+' : ''
                    const textColor =
                      totals.finalPayout > 0
                        ? 'text-green-600'
                        : totals.finalPayout < 0
                          ? 'text-red-600'
                          : ''
                    return (
                      <td
                        key={playerIdx}
                        className={`p-1 text-center font-bold text-base ${textColor}`}
                      >
                        {sign}
                        {totals.finalPayout}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
