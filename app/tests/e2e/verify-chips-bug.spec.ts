import { test, expect } from '@playwright/test';
import {
  getScoreInputTable,
  getScoreInput,
} from './helpers/selectors';

/**
 * チップ・場代6倍バグの検証
 * 6半荘セッションで、chips=-2, parlorFee=2000を入力
 * 期待: 最終収支 +5370
 * バグ時: チップ-12 (6倍), 収支+14370
 */

test.describe('Chips/ParlorFee 6x Bug Verification', () => {
  test('Web版でchips/parlorFeeが6倍になるバグを確認', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => { indexedDB.deleteDatabase('MahjongDB'); });
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
    // Step 2: 6半荘分の点数を入力
    // ===================================

    const hanchanScores = [
      [10, 10, 10, -30],   // 半荘1
      [20, 10, -10, -20],  // 半荘2
      [15, 5, -5, -15],    // 半荘3
      [10, 10, 10, -30],   // 半荘4
      [14, 0, 0, -14],     // 半荘5
      [0, 0, 0, 0],        // 半荘6（後で追加）
    ];

    // 半荘を3つ追加（デフォルトは3つ）
    await page.getByRole('button', { name: /半荘を追加/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /半荘を追加/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /半荘を追加/i }).click();
    await page.waitForTimeout(300);

    // 各半荘のスコアを入力
    for (let h = 1; h <= 5; h++) {  // 半荘6は0点なのでスキップ
      const scores = hanchanScores[h - 1];

      // P1〜P3を入力（P4は自動計算）
      for (let p = 1; p <= 3; p++) {
        const input = getScoreInput(page, scoreTable, h, p);
        await input.clear();
        await input.fill(String(scores[p - 1]));
      }

      // 最後のプレイヤーからフォーカスを外す
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
    // Step 4: 保存
    // ===================================

    await page.getByRole('button', { name: /保存/i }).click();
    await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 5: 履歴タブで確認
    // ===================================

    const historyTab = page.getByRole('tab', { name: '履歴' });
    await expect(historyTab).toHaveAttribute('data-state', 'active', { timeout: 3000 });

    // セッションカードをクリック
    const sessionCard = page.locator('[class*="border"]').filter({ hasText: today }).first();
    await expect(sessionCard).toBeVisible();

    // カード内のサマリー情報を取得
    const cardText = await sessionCard.textContent();
    console.log('=== Session Card Text ===');
    console.log(cardText);

    // 詳細ダイアログを開く
    await sessionCard.click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // ダイアログ内のテキストを取得
    const dialogText = await dialog.textContent();
    console.log('\n=== Dialog Text ===');
    console.log(dialogText);

    // ===================================
    // Step 6: IndexedDBから直接確認
    // ===================================

    const dbData = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('MahjongDB', 2);
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
        sessionParlorFee: sessions[0]?.parlorFee
      };
    });

    console.log('\n=== IndexedDB Session Summary ===');
    console.log('totalChips:', dbData.sessionSummary?.totalChips);
    console.log('totalPayout:', dbData.sessionSummary?.totalPayout);
    console.log('sessionParlorFee:', dbData.sessionParlorFee);

    // ===================================
    // Step 7: バグ判定
    // ===================================

    const totalChips = dbData.sessionSummary?.totalChips;

    console.log('\n=== Fix Verification ===');
    if (totalChips === -2) {
      console.log('✅ FIX SUCCESS: totalChips = -2 (chips counted once per session)');
    } else if (totalChips === -10) {
      console.log('❌ BUG STILL EXISTS: totalChips = -10 (5x multiplication)');
    } else {
      console.log(`⚠️  UNEXPECTED: totalChips = ${totalChips}`);
    }

    // 期待値計算:
    // スコア合計: 10+20+15+10+14 = 69
    // 全員1位(○○○)と仮定 → ウマ: 5 * 10 = 50
    // 小計: 69 + 50 = 119
    // 収支: 119 * 30 = 3570
    // CP: -2 * 100 = -200
    // 収支+CP: 3570 - 200 = 3370
    // 場代: -2000
    // 最終: 3370 - 2000 = 1370

    // Assertions
    expect(totalChips).toBe(-2);

    // 収支の検証（許容誤差±50）
    const expectedPayout = 1370;
    const payoutDiff = Math.abs((totalPayout || 0) - expectedPayout);
    expect(payoutDiff).toBeLessThan(50);
  });
});
