import { Page, Locator } from '@playwright/test';

/**
 * ScoreInputTableを取得
 * 識別方法: thead th:first-child に "#" テキストを持つテーブル
 */
export function getScoreInputTable(page: Page): Locator {
  return page.locator('table').filter({
    has: page.locator('thead th').first().getByText('#')
  });
}

/**
 * TotalsPanelテーブルを取得（使用頻度低）
 * 識別方法: tbody td:first-child に "CP" テキストを持つテーブル
 */
export function getTotalsTable(page: Page): Locator {
  return page.locator('table').filter({
    has: page.locator('tbody td').first().getByText('CP')
  });
}

/**
 * 指定された半荘番号の行を取得
 * 重要: tbody tr:nth-child()は使用しない（追加ボタン行混在のため）
 *
 * @param page - Pageオブジェクト
 * @param scoreTable - getScoreInputTable()で取得したLocator
 * @param hanchanNumber - 半荘番号（1, 2, 3, ...）
 */
export function getHanchanRow(
  page: Page,
  scoreTable: Locator,
  hanchanNumber: number
): Locator {
  return scoreTable.locator('tbody tr').filter({
    has: page.locator('td').first().getByText(String(hanchanNumber))
  });
}

/**
 * 指定された半荘・プレイヤーの点数入力フィールドを取得
 *
 * @param page - Pageオブジェクト
 * @param scoreTable - getScoreInputTable()で取得したLocator
 * @param hanchanNumber - 半荘番号（1, 2, 3, ...）
 * @param playerIndex - プレイヤーインデックス（1-based: 1,2,3,4）
 */
export function getScoreInput(
  page: Page,
  scoreTable: Locator,
  hanchanNumber: number,
  playerIndex: number
): Locator {
  const hanchanRow = getHanchanRow(page, scoreTable, hanchanNumber);
  // td:nth-child は 1-based、playerIndex も 1-based
  // セル構成: td:nth-child(1)=半荘番号、td:nth-child(2)=P1、td:nth-child(3)=P2、...
  return hanchanRow.locator(`td:nth-child(${playerIndex + 1}) input[type="number"]`);
}

/**
 * 指定されたプレイヤー列のヘッダー（PlayerSelect）を取得
 *
 * @param scoreTable - getScoreInputTable()で取得したLocator
 * @param playerIndex - プレイヤーインデックス（1-based: 2,3,4）
 *                      注: 1は「自分」固定表示のためPlayerSelectなし
 */
export function getPlayerHeader(
  scoreTable: Locator,
  playerIndex: number
): Locator {
  // th:nth-child は 1-based
  // th構成: th:nth-child(1)=#、th:nth-child(2)=自分、th:nth-child(3)=P2、...
  return scoreTable.locator(`thead tr th:nth-child(${playerIndex + 1})`);
}
