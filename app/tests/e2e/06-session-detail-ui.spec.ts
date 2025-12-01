import { test, expect, Page } from '@playwright/test';

/**
 * E2Eテスト: Issue #15 SessionDetailDialog UI改善
 *
 * テストケース:
 * - TC-E2E-012: タブ切り替え（サマリー/半荘詳細）
 * - TC-E2E-013: 結果コピー機能
 * - TC-E2E-014: テンプレート保存機能
 */

/**
 * ダイアログを閉じるヘルパー関数
 */
async function closeDialog(page: Page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

/**
 * セッション作成のヘルパー関数
 */
async function createTestSession(page: Page) {
  // 4人打ちモード選択
  await page.getByRole('button', { name: '4人打ち麻雀' }).click();

  // 日付入力
  const today = new Date().toISOString().split('T')[0];
  await page.locator('input[type="date"]').fill(today);

  // 点数入力
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

  await page.waitForTimeout(500);

  // 保存
  await page.getByRole('button', { name: /保存/i }).click();
  await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

  return today;
}

test.describe('Session Detail Dialog UI (Issue #15)', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();

    // IndexedDBをクリア
    await page.goto('/');
    await page.evaluate(() => {
      indexedDB.deleteDatabase('MahjongDB');
    });

    await page.reload();
    await expect(page.getByRole('tab', { name: '新規入力' })).toBeVisible({ timeout: 10000 });
  });

  test('TC-E2E-012: タブ切り替え（サマリー/半荘詳細）', async ({ page }) => {
    // ===================================
    // Step 1: セッション作成
    // ===================================
    const today = await createTestSession(page);

    // ===================================
    // Step 2: セッション詳細を開く
    // ===================================
    const sessionCard = page.locator('[class*="border"]').filter({ hasText: today }).first();
    await sessionCard.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // ===================================
    // Step 3: タブが表示されることを確認
    // ===================================
    const tabList = dialog.locator('[role="tablist"]');
    await expect(tabList).toBeVisible();

    // サマリータブ（絵文字付き）
    const summaryTab = dialog.getByRole('tab', { name: /サマリー/ });
    await expect(summaryTab).toBeVisible();

    // 半荘詳細タブ（絵文字付き）
    const detailTab = dialog.getByRole('tab', { name: /半荘詳細/ });
    await expect(detailTab).toBeVisible();

    // ===================================
    // Step 4: デフォルトでサマリータブがアクティブ
    // ===================================
    await expect(summaryTab).toHaveAttribute('data-state', 'active');

    // アクティブなタブパネルが表示される
    const activePanel = dialog.locator('[role="tabpanel"][data-state="active"]');
    await expect(activePanel).toBeVisible();

    // ===================================
    // Step 5: 半荘詳細タブに切り替え
    // ===================================
    await detailTab.click();
    await page.waitForTimeout(200);
    await expect(detailTab).toHaveAttribute('data-state', 'active');

    // 半荘詳細タブがアクティブになっていることを確認
    await expect(summaryTab).toHaveAttribute('data-state', 'inactive');
    await expect(activePanel).toBeVisible();

    // ===================================
    // Step 6: サマリータブに戻る
    // ===================================
    await summaryTab.click();
    await page.waitForTimeout(200);
    await expect(summaryTab).toHaveAttribute('data-state', 'active');
    await expect(activePanel).toBeVisible();
  });

  test('TC-E2E-013: 結果コピー機能', async ({ page, context, browserName }) => {
    // Safari はクリップボード権限をサポートしないのでスキップ
    test.skip(browserName === 'webkit', 'Clipboard permissions not supported in Safari');

    // クリップボード権限を付与（Chromiumのみ）
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }

    // ===================================
    // Step 1: セッション作成
    // ===================================
    const today = await createTestSession(page);

    // ===================================
    // Step 2: セッション詳細を開く
    // ===================================
    const sessionCard = page.locator('[class*="border"]').filter({ hasText: today }).first();
    await sessionCard.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // ===================================
    // Step 3: コピーボタンを確認
    // ===================================
    const copyButton = dialog.getByRole('button', { name: /コピー/ });
    await expect(copyButton).toBeVisible();

    // ===================================
    // Step 4: コピーボタンをクリック
    // ===================================
    await copyButton.click();

    // 成功トースト確認
    await expect(page.locator('text=結果をコピーしました')).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 5: クリップボード内容を確認
    // ===================================
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    // クリップボード内容に必要な情報が含まれている
    expect(clipboardText).toContain(today);
    expect(clipboardText).toContain('4人打ち');
    expect(clipboardText).toContain('麻雀記録アプリで記録');
  });

  test('TC-E2E-014: テンプレート保存機能', async ({ page }) => {
    // ===================================
    // Step 1: セッション作成
    // ===================================
    const today = await createTestSession(page);

    // ===================================
    // Step 2: セッション詳細を開く
    // ===================================
    const sessionCard = page.locator('[class*="border"]').filter({ hasText: today }).first();
    await sessionCard.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // ===================================
    // Step 3: テンプレート保存ボタンを確認
    // ===================================
    const saveTemplateButton = dialog.getByRole('button', { name: /テンプレ保存/ });
    await expect(saveTemplateButton).toBeVisible();

    // ===================================
    // Step 4: テンプレート保存ダイアログを開く
    // ===================================
    await saveTemplateButton.click();

    // テンプレート名入力ダイアログが表示される（最後のダイアログ）
    await page.waitForTimeout(300);
    const templateDialog = page.locator('[role="dialog"]').last();
    await expect(templateDialog).toBeVisible();

    // ===================================
    // Step 5: テンプレート名を入力して保存
    // ===================================
    const templateNameInput = templateDialog.locator('input');
    await expect(templateNameInput).toBeVisible();

    const templateName = 'テスト用テンプレート';
    await templateNameInput.clear();
    await templateNameInput.fill(templateName);

    // 保存ボタンをクリック
    const confirmButton = templateDialog.getByRole('button', { name: '保存' });
    await confirmButton.click();

    // 成功トースト確認
    await expect(page.locator('text=テンプレートを保存しました')).toBeVisible({ timeout: 5000 });

    // テンプレート保存ダイアログが閉じたことを確認（セッション詳細ダイアログに戻る）
    await page.waitForTimeout(500);

    // セッション詳細ダイアログがまだ表示されていることを確認
    await expect(dialog).toBeVisible();
  });

  test('TC-E2E-015: アクションボタンの位置確認', async ({ page }) => {
    // ===================================
    // Step 1: セッション作成
    // ===================================
    const today = await createTestSession(page);

    // ===================================
    // Step 2: セッション詳細を開く
    // ===================================
    const sessionCard = page.locator('[class*="border"]').filter({ hasText: today }).first();
    await sessionCard.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // ===================================
    // Step 3: アクションボタンがタブコンテンツの下に配置されていることを確認
    // ===================================
    const copyButton = dialog.getByRole('button', { name: /コピー/ });
    const saveTemplateButton = dialog.getByRole('button', { name: /テンプレ保存/ });
    const tabList = dialog.locator('[role="tablist"]');

    // ボタンが表示される
    await expect(copyButton).toBeVisible();
    await expect(saveTemplateButton).toBeVisible();

    // アクションボタンがタブリストより下にあることを確認（Y座標比較）
    const copyButtonBox = await copyButton.boundingBox();
    const tabListBox = await tabList.boundingBox();

    expect(copyButtonBox).not.toBeNull();
    expect(tabListBox).not.toBeNull();

    if (copyButtonBox && tabListBox) {
      // コピーボタンのY座標がタブリストより大きい（下にある）
      expect(copyButtonBox.y).toBeGreaterThan(tabListBox.y);
    }
  });

  test('TC-E2E-016: テンプレート保存→新規入力タブで表示確認', async ({ page }) => {
    // ===================================
    // Step 1: セッション作成
    // ===================================
    const today = await createTestSession(page);

    // ===================================
    // Step 2: セッション詳細からテンプレート保存
    // ===================================
    const sessionCard = page.locator('[class*="border"]').filter({ hasText: today }).first();
    await sessionCard.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const saveTemplateButton = dialog.getByRole('button', { name: /テンプレ保存/ });
    await saveTemplateButton.click();

    // テンプレート名入力
    await page.waitForTimeout(300);
    const templateDialog = page.locator('[role="dialog"]').last();
    const templateNameInput = templateDialog.locator('input');
    const uniqueTemplateName = `E2E検証テンプレ_${Date.now()}`;
    await templateNameInput.clear();
    await templateNameInput.fill(uniqueTemplateName);

    // 保存
    const confirmButton = templateDialog.getByRole('button', { name: '保存' });
    await confirmButton.click();
    await expect(page.locator('text=テンプレートを保存しました')).toBeVisible({ timeout: 5000 });

    // ダイアログを閉じる
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // ===================================
    // Step 3: 新規入力タブに移動してテンプレート確認
    // ===================================
    await page.getByRole('tab', { name: '新規入力' }).click();
    await page.waitForTimeout(500);

    // テンプレートボタンが表示される
    const templateButton = page.getByRole('button', { name: uniqueTemplateName });
    await expect(templateButton).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 4: 設定タブでもテンプレート確認
    // ===================================
    await page.getByRole('tab', { name: '設定' }).click();
    await page.waitForTimeout(500);

    // テンプレート管理セクションの件数が更新されている
    await expect(page.locator('text=1件')).toBeVisible({ timeout: 5000 });

    // テンプレート管理をクリックしてダイアログを開く
    await page.getByRole('heading', { name: /テンプレート管理/ }).click();
    await page.waitForTimeout(500);

    // テンプレート管理ダイアログ内でテンプレート名が表示される
    const templateManagementDialog = page.locator('[role="dialog"]');
    await expect(templateManagementDialog).toBeVisible({ timeout: 5000 });
    await expect(templateManagementDialog.locator(`text=${uniqueTemplateName}`)).toBeVisible({ timeout: 5000 });
  });
});
