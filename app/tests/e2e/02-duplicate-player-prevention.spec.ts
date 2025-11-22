import { test, expect } from '@playwright/test';
import {
  getScoreInputTable,
  getPlayerHeader,
} from './helpers/selectors';

/**
 * E2Eテスト: プレイヤー重複防止機能
 *
 * Phase 1（UI層）での重複防止機能を検証
 * - 選択中のユーザーが他の列から除外される
 * - メインユーザーが列2-4から除外される
 * - 新規プレイヤー登録フロー
 */

test.describe('Duplicate Player Prevention', () => {
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

  test('TC-E2E-004: プレイヤー選択時の動的除外（Phase 1防止）', async ({ page }) => {
    // ===================================
    // Step 0: 登録ユーザー「田中」を作成
    // ===================================

    // 設定タブを開く
    await page.getByRole('tab', { name: '設定' }).click();

    // ユーザー管理をクリック
    await page.getByText('👤 ユーザー管理').click();

    // 新規ユーザー登録ボタンをクリック
    await page.getByRole('button', { name: /新しいユーザーを登録/i }).click();

    // ダイアログで名前入力（複数Dialogあるので最後を取得）
    const dialog = page.locator('[role="dialog"]').last();
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('プレイヤー名').fill('田中');
    await dialog.getByRole('button', { name: /保存/ }).click();
    await page.waitForTimeout(500); // Dialog閉じるのを待つ

    // ユーザー管理Dialogを閉じる（ESCキー）
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 新規入力タブに戻る
    await page.getByRole('tab', { name: '新規入力' }).click();

    // ===================================
    // Step 1: モード選択
    // ===================================

    await page.getByRole('button', { name: '4人打ち麻雀' }).click();

    // ===================================
    // Step 2: ScoreInputTable特定
    // ===================================

    const scoreTable = getScoreInputTable(page);

    // ===================================
    // Step 3: 列2（プレイヤー2）で「田中」を選択
    // ===================================

    const player2Header = getPlayerHeader(scoreTable, 2);

    // Selectを開く
    await player2Header.getByRole('combobox').click();

    // 「田中」を選択（exact: trueで完全一致）
    await page.getByRole('option', { name: '田中', exact: true }).click();

    // 選択されたことを確認（combobox内に表示）
    await expect(player2Header.getByText('田中')).toBeVisible();

    // ===================================
    // Step 4: 列3（プレイヤー3）のSelectを開く
    // ===================================

    const player3Header = getPlayerHeader(scoreTable, 3);
    await player3Header.getByRole('combobox').click();

    // ===================================
    // Step 5: 列3の選択肢に「田中」が存在しないことを確認
    // ===================================

    // 「田中」オプションが表示されない（Phase 1除外）
    await expect(page.getByRole('option', { name: '田中', exact: true })).not.toBeVisible();
  });

  test('TC-E2E-005: メインユーザーの除外（列1以外）', async ({ page }) => {
    // ===================================
    // Step 1: モード選択
    // ===================================

    await page.getByRole('button', { name: '4人打ち麻雀' }).click();

    // ===================================
    // Step 2: ScoreInputTable特定
    // ===================================

    const scoreTable = getScoreInputTable(page);

    // ===================================
    // Step 3: 列1（自分）にPlayerSelectが存在しないことを確認
    // ===================================

    const player1Header = scoreTable.locator('thead tr th:nth-child(2)');

    // 「自分」テキストが表示されている
    await expect(player1Header.getByText(/自分/)).toBeVisible();

    // comboboxが存在しない（固定表示）
    await expect(player1Header.getByRole('combobox')).not.toBeVisible();

    // ===================================
    // Step 4: 列2のSelectを開き、「自分」が選択肢に存在しないことを確認
    // ===================================

    const player2Header = getPlayerHeader(scoreTable, 2);
    await player2Header.getByRole('combobox').click();

    // メインユーザーは除外される（Phase 1除外）
    await expect(page.getByRole('option', { name: '自分', exact: true })).not.toBeVisible();

    // ===================================
    // Step 5: 列3, 4でも同様に確認
    // ===================================

    // 列2を閉じる（ESCキー）
    await page.keyboard.press('Escape');

    // 列3確認
    const player3Header = getPlayerHeader(scoreTable, 3);
    await player3Header.getByRole('combobox').click();
    await expect(page.getByRole('option', { name: '自分', exact: true })).not.toBeVisible();
    await page.keyboard.press('Escape');

    // 列4確認
    const player4Header = getPlayerHeader(scoreTable, 4);
    await player4Header.getByRole('combobox').click();
    await expect(page.getByRole('option', { name: '自分', exact: true })).not.toBeVisible();
  });

  test('TC-E2E-006: 新規プレイヤー登録フロー', async ({ page }) => {
    // ===================================
    // Step 1: モード選択
    // ===================================

    await page.getByRole('button', { name: '4人打ち麻雀' }).click();

    // ===================================
    // Step 2: ScoreInputTable特定
    // ===================================

    const scoreTable = getScoreInputTable(page);

    // ===================================
    // Step 3: 列2のSelectを開く
    // ===================================

    const player2Header = getPlayerHeader(scoreTable, 2);
    await player2Header.getByRole('combobox').click();

    // ===================================
    // Step 4: 「＋ 新しいプレイヤーを登録」を選択
    // ===================================

    await page.getByRole('option', { name: /新しいプレイヤーを登録/ }).click();

    // ===================================
    // Step 5: ダイアログで名前を入力
    // ===================================

    // ダイアログ（複数ある場合は最後）
    const dialog = page.locator('[role="dialog"]').last();
    await expect(dialog).toBeVisible();

    // 名前入力（placeholderで特定）
    await dialog.getByPlaceholder('プレイヤー名').fill('田中');

    // 保存ボタンをクリック
    await dialog.getByRole('button', { name: /保存/ }).click();

    // ===================================
    // Step 6: ダイアログが閉じることを確認
    // ===================================

    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    // ===================================
    // Step 7: 列2に「田中」が選択されていることを確認
    // ===================================

    await expect(player2Header.getByText('田中')).toBeVisible();
  });

  test('TC-E2E-007: 複数プレイヤー登録後の動的除外確認', async ({ page }) => {
    // ===================================
    // Step 0: 登録ユーザー3人を作成
    // ===================================

    // 設定タブを開く
    await page.getByRole('tab', { name: '設定' }).click();

    // ユーザー管理をクリック
    await page.getByText('👤 ユーザー管理').click();

    // 田中を登録
    await page.getByRole('button', { name: /新しいユーザーを登録/i }).click();
    let dialog = page.locator('[role="dialog"]').last(); // 最後のDialogを取得（NewPlayerDialog）
    await dialog.getByPlaceholder('プレイヤー名').fill('田中');
    await dialog.getByRole('button', { name: /保存/ }).click();
    await page.waitForTimeout(500); // Dialog閉じるのを待つ

    // 佐藤を登録
    await page.getByRole('button', { name: /新しいユーザーを登録/i }).click();
    dialog = page.locator('[role="dialog"]').last();
    await dialog.getByPlaceholder('プレイヤー名').fill('佐藤');
    await dialog.getByRole('button', { name: /保存/ }).click();
    await page.waitForTimeout(500);

    // 鈴木を登録
    await page.getByRole('button', { name: /新しいユーザーを登録/i }).click();
    dialog = page.locator('[role="dialog"]').last();
    await dialog.getByPlaceholder('プレイヤー名').fill('鈴木');
    await dialog.getByRole('button', { name: /保存/ }).click();
    await page.waitForTimeout(500);

    // ユーザー管理Dialogを閉じる（ESCキー）
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 新規入力タブに戻る
    await page.getByRole('tab', { name: '新規入力' }).click();

    // ===================================
    // Step 1: モード選択
    // ===================================

    await page.getByRole('button', { name: '4人打ち麻雀' }).click();

    // ===================================
    // Step 2: ScoreInputTable特定
    // ===================================

    const scoreTable = getScoreInputTable(page);

    // ===================================
    // Step 3: 列2で「田中」を選択
    // ===================================

    const player2Header = getPlayerHeader(scoreTable, 2);
    await player2Header.getByRole('combobox').click();
    await page.getByRole('option', { name: '田中', exact: true }).click();
    await expect(player2Header.getByText('田中')).toBeVisible();

    // ===================================
    // Step 4: 列3で「佐藤」を選択
    // ===================================

    const player3Header = getPlayerHeader(scoreTable, 3);
    await player3Header.getByRole('combobox').click();
    await page.getByRole('option', { name: '佐藤', exact: true }).click();
    await expect(player3Header.getByText('佐藤')).toBeVisible();

    // ===================================
    // Step 5: 列4のSelectを開く
    // ===================================

    const player4Header = getPlayerHeader(scoreTable, 4);
    await player4Header.getByRole('combobox').click();

    // ===================================
    // Step 6: 列4の選択肢を確認
    // ===================================

    // 「田中」は除外されている（列2で選択中）
    await expect(page.getByRole('option', { name: '田中', exact: true })).not.toBeVisible();

    // 「佐藤」は除外されている（列3で選択中）
    await expect(page.getByRole('option', { name: '佐藤', exact: true })).not.toBeVisible();

    // 「鈴木」は表示されている（未選択）
    await expect(page.getByRole('option', { name: '鈴木', exact: true })).toBeVisible();

    // 「自分」は除外されている（列1固定）
    await expect(page.getByRole('option', { name: '自分', exact: true })).not.toBeVisible();

    // ===================================
    // Step 7: 「鈴木」を選択
    // ===================================

    await page.getByRole('option', { name: '鈴木', exact: true }).click();
    await expect(player4Header.getByText('鈴木')).toBeVisible();

    // ===================================
    // Step 8: 列3のSelectを再度開き、除外状態を確認
    // ===================================

    await player3Header.getByRole('combobox').click();

    // 「田中」除外（列2選択中）
    await expect(page.getByRole('option', { name: '田中', exact: true })).not.toBeVisible();

    // 「鈴木」除外（列4選択中）
    await expect(page.getByRole('option', { name: '鈴木', exact: true })).not.toBeVisible();

    // 「佐藤」は表示される（列3自身が選択中だが、変更可能）
    await expect(page.getByRole('option', { name: '佐藤', exact: true })).toBeVisible();
  });
});
