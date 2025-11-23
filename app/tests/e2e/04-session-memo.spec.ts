import { test, expect, Page } from '@playwright/test';

/**
 * E2Eテスト: セッションメモ機能
 *
 * テストケース:
 * - TC-E2E-008: セッションメモの追加・表示
 * - TC-E2E-009: セッションメモの編集
 * - TC-E2E-010: セッションメモの削除
 * - TC-E2E-011: メモ文字数制限
 */

/**
 * ダイアログを閉じるヘルパー関数
 * オーバーレイをクリックしてダイアログを閉じる
 */
async function closeDialog(page: Page) {
  // オーバーレイ（背景）を明示的にクリック
  const overlay = page.locator('[data-state="open"]').locator('..').locator('[style*="position: fixed"]').first();
  if (await overlay.isVisible()) {
    await overlay.click({ position: { x: 10, y: 10 } });
  } else {
    // フォールバック: Escapeキー
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(300);
}

test.describe('Session Memo Feature', () => {
  test.beforeEach(async ({ page, context }) => {
    // クリーンな状態でテスト開始
    await context.clearCookies();

    // IndexedDBをクリア
    await page.goto('/');
    await page.evaluate(() => {
      indexedDB.deleteDatabase('MahjongDB');
    });

    // リロードして初期化
    await page.reload();

    // アプリが読み込まれるまで待機
    await expect(page.getByRole('tab', { name: '新規入力' })).toBeVisible({ timeout: 10000 });
  });

  test('TC-E2E-008: セッションメモの追加・表示', async ({ page }) => {
    // ===================================
    // Step 1: セッション作成
    // ===================================

    // 4人打ちモード選択
    await page.getByRole('button', { name: '4人打ち麻雀' }).click();

    // 日付入力
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);

    // 点数入力（簡易版）
    const scoreTable = page.locator('table').filter({ has: page.locator('thead th', { hasText: '#' }) });
    const h1p1 = scoreTable.locator('tbody tr:nth-child(1) td:nth-child(2) input[type="number"]');
    await h1p1.clear();
    await h1p1.fill('40');

    const h1p2 = scoreTable.locator('tbody tr:nth-child(1) td:nth-child(3) input[type="number"]');
    await h1p2.clear();
    await h1p2.fill('10');

    const h1p3 = scoreTable.locator('tbody tr:nth-child(1) td:nth-child(4) input[type="number"]');
    await h1p3.clear();
    await h1p3.fill('-20');
    await h1p3.blur();

    // React状態更新を待機
    await page.waitForTimeout(500);

    // 保存
    await page.getByRole('button', { name: /保存/i }).click();
    await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

    // 履歴タブに遷移
    await expect(page.getByRole('tab', { name: '履歴' })).toHaveAttribute('data-state', 'active');

    // ===================================
    // Step 2: セッション詳細を開く
    // ===================================

    const sessionCard = page.locator('[class*="border"]').filter({ hasText: today }).first();
    await sessionCard.click();

    // ダイアログが開く
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // ===================================
    // Step 3: メモ入力エリアの確認
    // ===================================

    // メモラベルが表示される
    await expect(dialog.locator('label', { hasText: '💬 メモ' })).toBeVisible();

    // Textareaが存在する
    const memoTextarea = dialog.locator('textarea');
    await expect(memoTextarea).toBeVisible();
    await expect(memoTextarea).toHaveAttribute('placeholder', /役満達成！/);
    await expect(memoTextarea).toHaveAttribute('maxLength', '200');

    // 文字数カウンターが表示される
    await expect(dialog.locator('text=0/200')).toBeVisible();

    // ===================================
    // Step 4: メモ入力
    // ===================================

    const testMemo = '役満達成！次回は来週土曜日に開催します';
    await memoTextarea.fill(testMemo);

    // 文字数カウンター更新確認
    await expect(dialog.locator(`text=${testMemo.length}/200`)).toBeVisible();

    // フォーカスを外す（onBlur保存）
    await memoTextarea.blur();

    // 保存完了トースト確認
    await expect(page.locator('text=メモを保存しました').first()).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 5: ダイアログを閉じて履歴タブで確認
    // ===================================

    await closeDialog(page);
    await expect(dialog).not.toBeVisible();

    // 履歴タブでメモが表示される
    await expect(sessionCard.locator('text=💬')).toBeVisible();
    await expect(sessionCard.locator(`text=${testMemo}`)).toBeVisible();

    // ===================================
    // Step 6: 再度ダイアログを開いてメモが保持されていることを確認
    // ===================================

    // ダイアログが閉じるまで待機
    await page.waitForTimeout(300);

    await sessionCard.click();
    await expect(dialog).toBeVisible();

    // メモが保持されている
    await expect(memoTextarea).toHaveValue(testMemo);
    await expect(dialog.locator(`text=${testMemo.length}/200`)).toBeVisible();
  });

  test('TC-E2E-009: セッションメモの編集', async ({ page }) => {
    // ===================================
    // 事前準備: メモ付きセッション作成
    // ===================================

    await page.getByRole('button', { name: '4人打ち麻雀' }).click();
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);

    const scoreTable = page.locator('table').filter({ has: page.locator('thead th', { hasText: '#' }) });
    const h1p1 = scoreTable.locator('tbody tr:nth-child(1) td:nth-child(2) input[type="number"]');
    await h1p1.clear();
    await h1p1.fill('30');

    const h1p2 = scoreTable.locator('tbody tr:nth-child(1) td:nth-child(3) input[type="number"]');
    await h1p2.clear();
    await h1p2.fill('20');

    const h1p3 = scoreTable.locator('tbody tr:nth-child(1) td:nth-child(4) input[type="number"]');
    await h1p3.clear();
    await h1p3.fill('-30');
    await h1p3.blur();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: /保存/i }).click();
    await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

    // セッションを開く
    const sessionCard = page.locator('[class*="border"]').filter({ hasText: today }).first();
    await sessionCard.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // 初期メモ入力
    const memoTextarea = dialog.locator('textarea');
    const initialMemo = '初回のメモ';
    await memoTextarea.fill(initialMemo);
    await memoTextarea.blur();
    await expect(page.locator('text=メモを保存しました')).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 1: メモ編集
    // ===================================

    // メモを編集
    const updatedMemo = '編集後のメモ：来週は参加できません';
    await memoTextarea.clear();
    await memoTextarea.fill(updatedMemo);

    // 文字数カウンター更新確認
    await expect(dialog.locator(`text=${updatedMemo.length}/200`)).toBeVisible();

    // 保存
    await memoTextarea.blur();
    await expect(page.locator('text=メモを保存しました').first()).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 2: ダイアログを閉じて再度開いて確認
    // ===================================

    await closeDialog(page);
    await expect(dialog).not.toBeVisible();

    // 履歴タブで編集後のメモが表示される
    await expect(sessionCard.locator(`text=${updatedMemo}`)).toBeVisible();

    // 再度開く
    await sessionCard.click();
    await expect(dialog).toBeVisible();

    // 編集後のメモが保持されている
    await expect(memoTextarea).toHaveValue(updatedMemo);
  });

  test('TC-E2E-010: セッションメモの削除', async ({ page }) => {
    // ===================================
    // 事前準備: メモ付きセッション作成
    // ===================================

    await page.getByRole('button', { name: '4人打ち麻雀' }).click();
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);

    const scoreTable = page.locator('table').filter({ has: page.locator('thead th', { hasText: '#' }) });
    const h1p1 = scoreTable.locator('tbody tr:nth-child(1) td:nth-child(2) input[type="number"]');
    await h1p1.clear();
    await h1p1.fill('20');

    const h1p2 = scoreTable.locator('tbody tr:nth-child(1) td:nth-child(3) input[type="number"]');
    await h1p2.clear();
    await h1p2.fill('15');

    const h1p3 = scoreTable.locator('tbody tr:nth-child(1) td:nth-child(4) input[type="number"]');
    await h1p3.clear();
    await h1p3.fill('-25');
    await h1p3.blur();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: /保存/i }).click();
    await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

    const sessionCard = page.locator('[class*="border"]').filter({ hasText: today }).first();
    await sessionCard.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // メモ入力
    const memoTextarea = dialog.locator('textarea');
    const testMemo = '削除予定のメモ';
    await memoTextarea.fill(testMemo);
    await memoTextarea.blur();
    await expect(page.locator('text=メモを保存しました').first()).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 1: メモを空にして削除
    // ===================================

    // 全文削除
    await memoTextarea.clear();

    // 文字数カウンターが0になる
    await expect(dialog.locator('text=0/200')).toBeVisible();

    // 保存
    await memoTextarea.blur();
    await expect(page.locator('text=メモを保存しました').first()).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 2: ダイアログを閉じて履歴タブで確認
    // ===================================

    await closeDialog(page);
    await expect(dialog).not.toBeVisible();

    // 履歴タブでメモアイコンが表示されない（空メモは非表示）
    await expect(sessionCard.locator('text=💬')).not.toBeVisible();

    // ===================================
    // Step 3: 再度開いてメモが空であることを確認
    // ===================================

    // ダイアログが閉じるまで待機
    await page.waitForTimeout(300);

    await sessionCard.click();
    await expect(dialog).toBeVisible();

    // メモが空
    await expect(memoTextarea).toHaveValue('');
    await expect(dialog.locator('text=0/200')).toBeVisible();
  });

  test('TC-E2E-011: メモ文字数制限', async ({ page }) => {
    // ===================================
    // 事前準備: セッション作成
    // ===================================

    await page.getByRole('button', { name: '4人打ち麻雀' }).click();
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);

    const scoreTable = page.locator('table').filter({ has: page.locator('thead th', { hasText: '#' }) });
    const h1p1 = scoreTable.locator('tbody tr:nth-child(1) td:nth-child(2) input[type="number"]');
    await h1p1.clear();
    await h1p1.fill('25');

    const h1p2 = scoreTable.locator('tbody tr:nth-child(1) td:nth-child(3) input[type="number"]');
    await h1p2.clear();
    await h1p2.fill('5');

    const h1p3 = scoreTable.locator('tbody tr:nth-child(1) td:nth-child(4) input[type="number"]');
    await h1p3.clear();
    await h1p3.fill('-15');
    await h1p3.blur();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: /保存/i }).click();
    await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

    const sessionCard = page.locator('[class*="border"]').filter({ hasText: today }).first();
    await sessionCard.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // ===================================
    // Step 1: 200文字のメモ入力
    // ===================================

    const memoTextarea = dialog.locator('textarea');

    // 200文字ちょうどのメモ
    const memo200 = 'あ'.repeat(200);
    await memoTextarea.fill(memo200);

    // 文字数カウンター確認
    await expect(dialog.locator('text=200/200')).toBeVisible();

    // maxLength属性の確認
    await expect(memoTextarea).toHaveAttribute('maxLength', '200');

    // 201文字を入力しようとしても200文字までしか入らない
    const memo201 = 'あ'.repeat(201);
    await memoTextarea.fill(memo201);
    await expect(memoTextarea).toHaveValue(memo200); // 200文字に切り詰められる

    // ===================================
    // Step 2: 保存確認
    // ===================================

    await memoTextarea.blur();
    await expect(page.locator('text=メモを保存しました').first()).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 3: 再読み込みで200文字が保持されることを確認
    // ===================================

    await closeDialog(page);
    await expect(dialog).not.toBeVisible();

    // ダイアログが閉じるまで待機
    await page.waitForTimeout(300);

    await sessionCard.click();
    await expect(dialog).toBeVisible();

    await expect(memoTextarea).toHaveValue(memo200);
    await expect(dialog.locator('text=200/200')).toBeVisible();

    // ===================================
    // Step 4: 履歴タブでline-clamp-1による省略表示確認
    // ===================================

    await closeDialog(page);
    await expect(dialog).not.toBeVisible();

    // メモアイコンは表示される
    await expect(sessionCard.locator('text=💬')).toBeVisible();

    // line-clamp-1により省略されている（全文は表示されない）
    const memoDisplay = sessionCard.locator('span.line-clamp-1');
    await expect(memoDisplay).toBeVisible();

    // CSSのline-clampが適用されていることを確認
    const hasLineClamp = await memoDisplay.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.getPropertyValue('-webkit-line-clamp') === '1' ||
             styles.getPropertyValue('display') === '-webkit-box';
    });
    expect(hasLineClamp).toBeTruthy();
  });
});
