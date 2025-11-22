import { test, expect } from '@playwright/test';
import {
  getScoreInputTable,
  getScoreInput,
} from './helpers/selectors';

/**
 * Chips/ParlorFee修正検証テスト
 * 修正後: chips/parlorFeeがセッション全体で1回のみカウントされることを確認
 */

test.describe('Chips/ParlorFee Fix Verification', () => {
  test('5半荘セッションでchips/parlorFeeが1回のみカウントされることを確認', async ({ page, context }) => {
    // DB完全クリア
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('MahjongDB');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve(); // エラーでも続行
      });
    });
    await page.reload();
    await expect(page.getByRole('tab', { name: '新規入力' })).toBeVisible({ timeout: 10000 });

    // ===================================
    // Step 1: モード選択
    // ===================================
    await page.getByRole('button', { name: '4人打ち麻雀' }).click();
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);

    const scoreTable = getScoreInputTable(page);

    // ===================================
    // Step 2: 5半荘分の点数を入力
    // ===================================

    const hanchanScores = [
      [10, 10, 10, -30],   // 半荘1
      [20, 10, -10, -20],  // 半荘2
      [15, 5, -5, -15],    // 半荘3
      [10, 10, 10, -30],   // 半荘4
      [14, 0, 0, -14],     // 半荘5
    ];

    // 半荘を2つ追加（デフォルトは3つ）
    await page.getByRole('button', { name: /半荘を追加/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /半荘を追加/i }).click();
    await page.waitForTimeout(300);

    // 各半荘のスコアを入力
    for (let h = 1; h <= 5; h++) {
      const scores = hanchanScores[h - 1];

      // P1〜P3を入力（P4は自動計算）
      for (let p = 1; p <= 3; p++) {
        const input = getScoreInput(page, scoreTable, h, p);
        await input.clear();
        await input.fill(String(scores[p - 1]));
      }

      const lastInput = getScoreInput(page, scoreTable, h, 3);
      await lastInput.blur();
      await page.waitForTimeout(300);
    }

    // ===================================
    // Step 3: チップと場代を入力
    // ===================================

    // プレイヤー1（自分）にCP=-2を入力
    const cpInputs = await page.locator('tr:has(td:text("CP")) input').all();
    await cpInputs[0].clear();
    await cpInputs[0].fill('-2');

    // プレイヤー1（自分）に場代=2000を入力
    const parlorInputs = await page.locator('tr:has(td:text("場代")) input').all();
    await parlorInputs[0].clear();
    await parlorInputs[0].fill('2000');

    await page.waitForTimeout(500);

    // ===================================
    // Step 4: TotalsPanelの値を確認（保存前）
    // ===================================
    const totalsPanel = page.locator('[class*="rounded-lg border"]').filter({ hasText: '小計' }).first();
    const totalsPanelText = await totalsPanel.textContent();
    console.log('=== TotalsPanel (保存前) ===');
    console.log(totalsPanelText);

    // ===================================
    // Step 5: 保存
    // ===================================

    await page.getByRole('button', { name: /保存/i }).click();
    await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 6: 履歴タブで確認
    // ===================================

    const historyTab = page.getByRole('tab', { name: '履歴' });
    await expect(historyTab).toHaveAttribute('data-state', 'active', { timeout: 3000 });

    // セッションカードをクリック
    const sessionCard = page.locator('[class*="border"]').filter({ hasText: today }).first();
    await expect(sessionCard).toBeVisible();

    // カード内のサマリー情報を取得
    const cardText = await sessionCard.textContent();
    console.log('\n=== Session Card (履歴タブ) ===');
    console.log(cardText);

    // 詳細ダイアログを開く
    await sessionCard.click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const dialogText = await dialog.textContent();
    console.log('\n=== Dialog (詳細) ===');
    console.log(dialogText);

    // ===================================
    // Step 7: IndexedDBから直接確認
    // ===================================

    const dbData = await page.evaluate(async () => {
      // Dexieを使わず、直接IndexedDBを開く（バージョン指定なし）
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('MahjongDB');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const getAll = (storeName: string) => {
        return new Promise((resolve) => {
          const tx = db.transaction([storeName], 'readonly');
          const store = tx.objectStore(storeName);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result);
        });
      };

      const sessions = await getAll('sessions') as any[];

      return {
        sessionSummary: sessions[0]?.summary,
        sessionRate: sessions[0]?.rate,
        sessionChipRate: sessions[0]?.chipRate,
        sessionParlorFee: sessions[0]?.parlorFee
      };
    });

    console.log('\n=== IndexedDB Session Data ===');
    console.log('totalChips:', dbData.sessionSummary?.totalChips);
    console.log('totalPayout:', dbData.sessionSummary?.totalPayout);
    console.log('rate:', dbData.sessionRate);
    console.log('chipRate:', dbData.sessionChipRate);
    console.log('sessionParlorFee:', dbData.sessionParlorFee);

    // ===================================
    // Step 8: 期待値計算と検証
    // ===================================

    // 期待値計算:
    // スコア合計: 10+20+15+10+14 = 69
    // ウマ合計（全て1位○○○）: 5 * 10 = 50
    // 小計: 69 + 50 = 119
    // 収支: 119 * 30 = 3570
    // チップ: -2 * 100 = -200
    // 収支+チップ: 3570 - 200 = 3370
    // 場代: -2000
    // 最終: 3370 - 2000 = 1370

    const totalChips = dbData.sessionSummary?.totalChips;
    const totalPayout = dbData.sessionSummary?.totalPayout;

    console.log('\n=== Fix Verification ===');

    // チップが-2であることを確認（-10ではない）
    if (totalChips === -2) {
      console.log('✅ SUCCESS: totalChips = -2 (chips counted once)');
    } else {
      console.log(`❌ FAILED: totalChips = ${totalChips} (expected: -2)`);
    }

    // 収支が期待値付近であることを確認
    // 期待値: 1370（小計119 * rate30 + chips(-2*100) - parlorFee2000）
    const expectedPayout = 1370;
    const payoutDiff = Math.abs((totalPayout || 0) - expectedPayout);

    if (payoutDiff < 10) {
      console.log(`✅ SUCCESS: totalPayout = ${totalPayout} (expected: ~${expectedPayout})`);
    } else {
      console.log(`❌ FAILED: totalPayout = ${totalPayout} (expected: ~${expectedPayout}, diff: ${payoutDiff})`);
    }

    // Playwrightアサーション
    expect(totalChips).toBe(-2);
    expect(payoutDiff).toBeLessThan(10);
  });
});
