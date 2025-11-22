import { test, expect } from '@playwright/test';
import {
  getScoreInputTable,
  getHanchanRow,
  getScoreInput,
} from './helpers/selectors';

/**
 * E2Eテスト: セッション作成フロー
 *
 * 実装との完全一致を保証したテストケース
 * - モード選択: Buttonコンポーネント
 * - 点数入力: Tableコンポーネント内
 * - プレイヤー選択: shadcn/ui Select
 */

test.describe('Session Creation Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // クリーンな状態でテスト開始
    await context.clearCookies();

    // IndexedDBをクリア（Dexieの既存データをリセット）
    await page.goto('/');
    await page.evaluate(() => {
      indexedDB.deleteDatabase('MahjongAppDB');
    });

    // リロードして初期化
    await page.reload();

    // アプリが読み込まれるまで待機（新規入力タブが表示される）
    await expect(page.getByRole('tab', { name: '新規入力' })).toBeVisible({ timeout: 10000 });
  });

  test('TC-E2E-001: 4人打ちセッションの作成・保存・履歴確認', async ({ page }) => {
    // ===================================
    // Step 1: モード選択（Button）
    // ===================================

    // 4人打ちボタンをクリック
    await page.getByRole('button', { name: '4人打ち麻雀' }).click();

    // モード選択後、セッション入力画面が表示されることを確認
    await expect(page.locator('input[type="date"]')).toBeVisible();

    // ===================================
    // Step 2: セッション設定を入力
    // ===================================

    // 日付を入力（今日の日付を使用）
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);

    // ===================================
    // Step 3: ScoreInputTable特定
    // ===================================

    const scoreTable = getScoreInputTable(page);

    // ===================================
    // Step 4: 半荘1の点数入力
    // ===================================

    // プレイヤー1（自分）
    const player1Input = getScoreInput(page, scoreTable, 1, 1);
    await player1Input.clear();
    await player1Input.fill('40');

    // プレイヤー2
    const player2Input = getScoreInput(page, scoreTable, 1, 2);
    await player2Input.clear();
    await player2Input.fill('10');

    // プレイヤー3（最後の入力）
    const player3Input = getScoreInput(page, scoreTable, 1, 3);
    await player3Input.clear();
    await player3Input.fill('-20');

    // プレイヤー3からフォーカスを外す（onBlurイベント発火）
    await player3Input.blur();

    // React状態更新を待機
    await page.waitForTimeout(500);

    // プレイヤー4の値は自動計算される（-30）
    const player4Input = getScoreInput(page, scoreTable, 1, 4);
    await expect(player4Input).toHaveValue('-30');

    // ===================================
    // Step 5: ウママーク自動割り当て確認
    // ===================================

    const hanchan1Row = getHanchanRow(page, scoreTable, 1);

    // ○○マークが表示されることを確認（トップ: 40点）
    await expect(hanchan1Row.getByText('○○').first()).toBeVisible({ timeout: 5000 });

    // ✗✗マークが表示されることを確認（ラス: -30点）
    await expect(hanchan1Row.getByText('✗✗').first()).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 6: セッションを保存
    // ===================================

    const saveButton = page.getByRole('button', { name: /保存/i });
    await saveButton.click();

    // ===================================
    // Step 7: トースト通知確認
    // ===================================

    await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 8: 履歴タブ自動遷移確認
    // ===================================

    // 履歴タブがアクティブになることを確認
    const historyTab = page.getByRole('tab', { name: '履歴' });
    await expect(historyTab).toHaveAttribute('data-state', 'active', { timeout: 3000 });

    // ===================================
    // Step 9: セッションカード表示確認
    // ===================================

    // セッションカードが表示される
    const sessionCard = page.locator('[class*="border"]').filter({ hasText: today }).first();
    await expect(sessionCard).toBeVisible();

    // 日付が表示されている
    await expect(sessionCard.locator(`text=${today}`)).toBeVisible();

    // ゲームモード「4人打ち」が表示されている
    await expect(sessionCard.locator('text=4人打ち')).toBeVisible();

    // 半荘数が表示されている
    await expect(sessionCard).toContainText('1半荘');

    // ===================================
    // Step 10: セッション詳細を開く
    // ===================================

    await sessionCard.click();

    // ダイアログが開く
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // ===================================
    // Step 11: 詳細情報を確認
    // ===================================

    // 日付が表示されている
    await expect(dialog).toContainText(today);

    // モードが表示されている
    await expect(dialog.getByText('モード: 4人打ち')).toBeVisible();

    // プレイヤー名と点数が表示されている
    await expect(dialog.locator('text=自分')).toBeVisible();
    await expect(dialog).toContainText('40');
    await expect(dialog).toContainText('10');
    await expect(dialog).toContainText('-20');
    await expect(dialog).toContainText('-30');

    // ウママークが表示されている
    await expect(dialog.locator('text=○○').first()).toBeVisible();
    await expect(dialog.locator('text=✗✗').first()).toBeVisible();
  });

  test('TC-E2E-002: 3人打ちセッションの作成', async ({ page }) => {
    // ===================================
    // Step 1: モード選択（3人打ちButton）
    // ===================================

    await page.getByRole('button', { name: '3人打ち麻雀' }).click();

    // ===================================
    // Step 2: セッション設定を入力
    // ===================================

    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);

    // ===================================
    // Step 3: 3人分の点数を入力
    // ===================================

    // ScoreInputTableを特定
    const scoreTable = getScoreInputTable(page);

    // プレイヤー1
    const player1Input = getScoreInput(page, scoreTable, 1, 1);
    await player1Input.clear();
    await player1Input.fill('40');

    // プレイヤー2（最後の入力）
    const player2Input = getScoreInput(page, scoreTable, 1, 2);
    await player2Input.clear();
    await player2Input.fill('0');

    // プレイヤー2からフォーカスを外す（onBlurイベント発火）
    await player2Input.blur();

    // React状態更新を待機
    await page.waitForTimeout(500);

    // プレイヤー3の値は自動計算される（-40）
    const player3Input = getScoreInput(page, scoreTable, 1, 3);
    await expect(player3Input).toHaveValue('-40');

    // ===================================
    // Step 4: テーブル列数確認（3人打ち）
    // ===================================

    // テーブルヘッダーの列数を確認（#列 + 3プレイヤー列 = 4列）
    const headerCells = scoreTable.locator('thead tr th');
    await expect(headerCells).toHaveCount(4); // #, P1, P2, P3

    // ===================================
    // Step 5: 保存して履歴確認
    // ===================================

    await page.getByRole('button', { name: /保存/i }).click();
    await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

    // 履歴タブで確認
    await expect(page.getByRole('tab', { name: '履歴' })).toHaveAttribute('data-state', 'active');

    const sessionCard = page.locator('[class*="border"]').filter({ hasText: today }).first();
    await expect(sessionCard).toBeVisible();
    await expect(sessionCard.locator('text=3人打ち')).toBeVisible();
  });

  test('TC-E2E-003: 複数半荘セッションの作成', async ({ page }) => {
    // ===================================
    // Step 1: モード選択
    // ===================================

    await page.getByRole('button', { name: '4人打ち麻雀' }).click();

    // ===================================
    // Step 2: セッション設定
    // ===================================

    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);

    // ===================================
    // Step 3: 半荘1の点数を入力
    // ===================================

    // ScoreInputTableを特定
    const scoreTable = getScoreInputTable(page);

    // 半荘1: プレイヤー1-3の点数を入力
    const h1p1 = getScoreInput(page, scoreTable, 1, 1);
    await h1p1.clear();
    await h1p1.fill('30');

    const h1p2 = getScoreInput(page, scoreTable, 1, 2);
    await h1p2.clear();
    await h1p2.fill('10');

    const h1p3 = getScoreInput(page, scoreTable, 1, 3);
    await h1p3.clear();
    await h1p3.fill('-10');

    // プレイヤー3からフォーカスを外す（onBlurイベント発火）
    await h1p3.blur();

    // React状態更新を待機
    await page.waitForTimeout(500);

    // プレイヤー4の値は自動計算される（-30）
    const h1p4 = getScoreInput(page, scoreTable, 1, 4);
    await expect(h1p4).toHaveValue('-30');

    // ===================================
    // Step 4: 半荘を追加
    // ===================================

    const addHanchanButton = page.getByRole('button', { name: /半荘を追加/i });
    await addHanchanButton.click();

    // 半荘2の行が追加されたことを確認（半荘番号で特定）
    const hanchan2Row = getHanchanRow(page, scoreTable, 2);
    await expect(hanchan2Row).toBeVisible();

    // 半荘番号「2」が表示されている
    await expect(hanchan2Row.locator('td:nth-child(1)')).toContainText('2');

    // ===================================
    // Step 5: 半荘2の点数を入力
    // ===================================

    // 半荘2: プレイヤー1-3の点数を入力
    const h2p1 = getScoreInput(page, scoreTable, 2, 1);
    await h2p1.clear();
    await h2p1.fill('20');

    const h2p2 = getScoreInput(page, scoreTable, 2, 2);
    await h2p2.clear();
    await h2p2.fill('15');

    const h2p3 = getScoreInput(page, scoreTable, 2, 3);
    await h2p3.clear();
    await h2p3.fill('-15');

    // プレイヤー3からフォーカスを外す（onBlurイベント発火）
    await h2p3.blur();

    // React状態更新を待機
    await page.waitForTimeout(500);

    // プレイヤー4の値は自動計算される（-20）
    const h2p4 = getScoreInput(page, scoreTable, 2, 4);
    await expect(h2p4).toHaveValue('-20');

    // ===================================
    // Step 6: 保存
    // ===================================

    await page.getByRole('button', { name: /保存/i }).click();
    await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 7: 履歴タブで2半荘分が表示されることを確認
    // ===================================

    const sessionCard = page.locator('[class*="border"]').filter({ hasText: today }).first();
    await sessionCard.click();

    // ダイアログで2半荘分のデータが表示される
    const dialog = page.locator('[role="dialog"]');

    // 半荘1の点数を確認
    const row1 = dialog.locator('table tbody tr:nth-child(1)');
    await expect(row1).toContainText('30');
    await expect(row1).toContainText('10');
    await expect(row1).toContainText('-10');
    await expect(row1).toContainText('-30');

    // 半荘2の点数を確認
    const row2 = dialog.locator('table tbody tr:nth-child(2)');
    await expect(row2).toContainText('20');
    await expect(row2).toContainText('15');
    await expect(row2).toContainText('-15');
    await expect(row2).toContainText('-20');
  });
});
