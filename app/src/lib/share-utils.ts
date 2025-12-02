import type { Session } from './db'

interface PlayerTotal {
  playerName: string
  finalPayout: number
}

/**
 * セッション結果をクリップボード用テキストに整形
 */
export function formatSessionForClipboard(
  session: Session,
  playerTotals: PlayerTotal[]
): string {
  const modeLabel = session.mode === '4-player' ? '4人打ち' : '3人打ち'
  const ruleLabel = session.umaRule === 'standard' ? '標準' : '2位マイナス'

  const lines: string[] = [
    `📊 ${session.date}${session.memo ? ` ${session.memo}` : ''}`,
    `${modeLabel}・R${session.rate}/U${session.umaValue}/C${session.chipRate}・${ruleLabel}`,
    ''
  ]

  // プレイヤー結果（収支順でソート）
  const sorted = [...playerTotals].sort((a, b) => b.finalPayout - a.finalPayout)
  sorted.forEach((p, idx) => {
    const sign = p.finalPayout >= 0 ? '+' : ''
    lines.push(`${idx + 1}位 ${p.playerName}  ${sign}${p.finalPayout.toLocaleString()}円`)
  })

  lines.push('')
  lines.push('麻雀記録アプリで記録')

  return lines.join('\n')
}

/**
 * クリップボードにコピー
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // フォールバック（古いブラウザ用）
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const result = document.execCommand('copy')
    document.body.removeChild(textarea)
    return result
  } catch {
    return false
  }
}
