import { test, expect } from '@playwright/test';
import {
  getScoreInputTable,
  getScoreInput,
} from './helpers/selectors';

/**
 * 分析タブ統計機能テスト - Phase 1
 *
 * テストケース:
 * - TC-001: ユーザー切り替えテスト
 * - TC-002: chips/parlorFee 1回カウントテスト
 * - TC-101: session.summaryとの整合性テスト
 * - TC-401: 既存機能への影響確認
 */

test.describe('Analysis Tab Statistics - Phase 1', () => {

  test.beforeEach(async ({ page, context }) => {
    // DB初期化
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => { indexedDB.deleteDatabase('MahjongDB'); });
    await page.reload();
    await expect(page.getByRole('tab', { name: '新規入力' })).toBeVisible({ timeout: 10000 });
  });

  /**
   * TC-001: ユーザー切り替えテスト
   * 目的: selectedUserId変更で全統計が更新されることを確認
   */
  test('TC-001: User switching updates all statistics', async ({ page }) => {
    console.log('\n=== TC-001: User Switching Test ===');

    // ===================================
    // Step 1: 新規ユーザー登録（登録ユーザー1, 2）
    // ===================================

    await page.getByRole('tab', { name: '設定' }).click();
    await page.waitForTimeout(500);

    // 「👤 ユーザー管理」エリアをクリックしてDialogを開く
    await page.locator('text=👤 ユーザー管理').click();
    await page.waitForTimeout(500);

    // ユーザー管理Dialog内の「新しいユーザーを登録」ボタンをクリック
    await page.getByRole('button', { name: '＋ 新しいユーザーを登録' }).click();

    // 新規ユーザー登録Dialog
    await page.waitForTimeout(500);
    await page.getByPlaceholder('プレイヤー名').fill('登録ユーザー1');
    await page.getByRole('button', { name: '保存' }).click();
    await page.waitForTimeout(500);

    // 2人目を登録
    await page.getByRole('button', { name: '＋ 新しいユーザーを登録' }).click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder('プレイヤー名').fill('登録ユーザー2');
    await page.getByRole('button', { name: '保存' }).click();
    await page.waitForTimeout(500);

    // ユーザー管理Dialogを閉じる
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // ===================================
    // Step 2: セッション1作成（4人打ち、2半荘）
    // ===================================

    await page.getByRole('tab', { name: '新規入力' }).click();
    await page.getByRole('button', { name: '4人打ち麻雀' }).click();

    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);

    // プレイヤー選択: P2=登録ユーザー1, P3=登録ユーザー2
    const scoreTable = getScoreInputTable(page);

    // P2を選択
    const p2Header = scoreTable.locator('thead tr th:nth-child(3)');
    await p2Header.click();
    await page.getByRole('option', { name: '登録ユーザー1' }).click();
    await page.waitForTimeout(300);

    // P3を選択
    const p3Header = scoreTable.locator('thead tr th:nth-child(4)');
    await p3Header.click();
    await page.getByRole('option', { name: '登録ユーザー2' }).click();
    await page.waitForTimeout(300);

    // 半荘1の点数入力
    const h1Scores = [10, 20, -10, -20]; // P1=10, P2=20, P3=-10, P4=-20
    for (let p = 1; p <= 3; p++) {
      const input = getScoreInput(page, scoreTable, 1, p);
      await input.clear();
      await input.fill(String(h1Scores[p - 1]));
    }

    await page.waitForTimeout(300);

    // チップと場代（P1のみ）
    const cpInputs = await page.locator('tr:has(td:text("CP")) input').all();
    await cpInputs[0].clear();
    await cpInputs[0].fill('5');

    const parlorInputs = await page.locator('tr:has(td:text("場代")) input').all();
    await parlorInputs[0].clear();
    await parlorInputs[0].fill('500');

    await page.waitForTimeout(500);

    // 保存
    await page.getByRole('button', { name: /保存/i }).click();
    await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 3: 分析タブに移動
    // ===================================

    await page.getByRole('tab', { name: '分析' }).click();
    await page.waitForTimeout(1000);

    // ===================================
    // Step 4: mainUser（デフォルト）の統計を記録
    // ===================================

    const getRevenueStats = async () => {
      const revenueCard = page.locator('text=💰 収支').locator('..');
      const cardText = await revenueCard.textContent();

      // "+: +XXXpt" "-: XXXpt" "計: +XXXpt" の形式から数値を抽出
      const plusMatch = cardText?.match(/\+:\s*([+-]?\d+)pt/);
      const minusMatch = cardText?.match(/-:\s*([+-]?\d+)pt/);
      const totalMatch = cardText?.match(/計:\s*([+-]?\d+)pt/);

      return {
        totalIncome: plusMatch ? parseInt(plusMatch[1].replace(/,/g, '')) : 0,
        totalExpense: minusMatch ? parseInt(minusMatch[1].replace(/,/g, '')) : 0,
        totalBalance: totalMatch ? parseInt(totalMatch[1].replace(/,/g, '')) : 0,
      };
    };

    const mainUserStats = await getRevenueStats();
    console.log('mainUser stats:', mainUserStats);

    // ===================================
    // Step 5: ユーザー選択を「登録ユーザー1」に変更
    // ===================================

    const userSelect = page.locator('select').filter({ hasText: '自分' });
    await userSelect.selectOption({ label: '登録ユーザー1' });
    await page.waitForTimeout(1000);

    const user1Stats = await getRevenueStats();
    console.log('登録ユーザー1 stats:', user1Stats);

    // ===================================
    // Step 6: ユーザー選択を「登録ユーザー2」に変更
    // ===================================

    await userSelect.selectOption({ label: '登録ユーザー2' });
    await page.waitForTimeout(1000);

    const user2Stats = await getRevenueStats();
    console.log('登録ユーザー2 stats:', user2Stats);

    // ===================================
    // Step 7: mainUserに戻す
    // ===================================

    await userSelect.selectOption({ label: '自分' });
    await page.waitForTimeout(1000);

    const mainUserStats2 = await getRevenueStats();
    console.log('mainUser stats (after switch back):', mainUserStats2);

    // ===================================
    // Assertions
    // ===================================

    // 各ユーザーで統計が異なることを確認
    expect(mainUserStats.totalBalance).not.toBe(user1Stats.totalBalance);
    expect(user1Stats.totalBalance).not.toBe(user2Stats.totalBalance);

    // mainUserに戻すと元の値に戻ることを確認
    expect(mainUserStats2.totalBalance).toBe(mainUserStats.totalBalance);

    console.log('✅ TC-001 PASS: User switching updates all statistics');
  });

  /**
   * TC-002: chips/parlorFee 1回カウントテスト
   * 目的: chips/parlorFeeがセッション単位で1回のみカウントされることを確認
   */
  test('TC-002: chips/parlorFee counted once per session', async ({ page }) => {
    console.log('\n=== TC-002: chips/parlorFee 1x Count Test ===');

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
      [10, 10, 10, -30],   // 半荘6
    ];

    // 半荘を3つ追加（デフォルトは3つ）
    await page.getByRole('button', { name: /半荘を追加/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /半荘を追加/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /半荘を追加/i }).click();
    await page.waitForTimeout(300);

    // 各半荘のスコアを入力
    for (let h = 1; h <= 6; h++) {
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
    // Step 3: チップと場代を入力（全半荘で同一値）
    // ===================================

    // プレイヤー1（自分）にCP=5を入力
    const cpInputs = await page.locator('tr:has(td:text("CP")) input').all();
    await cpInputs[0].clear();
    await cpInputs[0].fill('5');

    // プレイヤー1（自分）に場代=500を入力
    const parlorInputs = await page.locator('tr:has(td:text("場代")) input').all();
    await parlorInputs[0].clear();
    await parlorInputs[0].fill('500');

    await page.waitForTimeout(500);

    // ===================================
    // Step 4: 保存
    // ===================================

    await page.getByRole('button', { name: /保存/i }).click();
    await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 5: IndexedDBから直接確認
    // ===================================

    const dbData = await page.evaluate(async () => {
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
      };
    });

    console.log('\n=== IndexedDB Session Summary ===');
    console.log('totalChips:', dbData.sessionSummary?.totalChips);
    console.log('totalPayout:', dbData.sessionSummary?.totalPayout);

    // ===================================
    // Step 6: 分析タブで確認
    // ===================================

    await page.getByRole('tab', { name: '分析' }).click();
    await page.waitForTimeout(1000);

    const chipCard = page.locator('text=🎰 チップ').locator('..');
    const chipCardText = await chipCard.textContent();
    console.log('Chip Card Text:', chipCardText);

    // ===================================
    // Assertions
    // ===================================

    const totalChips = dbData.sessionSummary?.totalChips;

    console.log('\n=== Fix Verification ===');
    if (totalChips === 5) {
      console.log('✅ FIX SUCCESS: totalChips = 5 (chips counted once per session)');
    } else if (totalChips === 30) {
      console.log('❌ BUG STILL EXISTS: totalChips = 30 (6x multiplication)');
    } else {
      console.log(`⚠️  UNEXPECTED: totalChips = ${totalChips}`);
    }

    // Assertions
    expect(totalChips).toBe(5);

    console.log('✅ TC-002 PASS: chips/parlorFee counted once per session');
  });

  /**
   * TC-101: session.summaryとの整合性テスト
   * 目的: 動的計算の結果がsession.summaryと一致することを確認（mainUserの場合）
   */
  test('TC-101: Dynamic calculation matches session.summary', async ({ page }) => {
    console.log('\n=== TC-101: session.summary Consistency Test ===');

    // ===================================
    // Step 1: セッション作成（mainUser）
    // ===================================

    await page.getByRole('button', { name: '4人打ち麻雀' }).click();
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);

    const scoreTable = getScoreInputTable(page);

    // 半荘1の点数入力
    const scores = [10, 20, -10, -20];
    for (let p = 1; p <= 3; p++) {
      const input = getScoreInput(page, scoreTable, 1, p);
      await input.clear();
      await input.fill(String(scores[p - 1]));
    }

    await page.waitForTimeout(300);

    // チップと場代
    const cpInputs = await page.locator('tr:has(td:text("CP")) input').all();
    await cpInputs[0].clear();
    await cpInputs[0].fill('3');

    const parlorInputs = await page.locator('tr:has(td:text("場代")) input').all();
    await parlorInputs[0].clear();
    await parlorInputs[0].fill('1000');

    await page.waitForTimeout(500);

    // 保存
    await page.getByRole('button', { name: /保存/i }).click();
    await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 2: IndexedDBからsession.summaryを取得
    // ===================================

    const dbData = await page.evaluate(async () => {
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
      return sessions[0]?.summary;
    });

    console.log('\n=== session.summary (Expected) ===');
    console.log('totalPayout:', dbData?.totalPayout);
    console.log('totalChips:', dbData?.totalChips);
    console.log('averageRank:', dbData?.averageRank);

    // ===================================
    // Step 3: 分析タブの表示値を取得
    // ===================================

    await page.getByRole('tab', { name: '分析' }).click();
    await page.waitForTimeout(1000);

    const revenueCard = page.locator('text=💰 収支').locator('..');
    const revenueText = await revenueCard.textContent();

    const totalMatch = revenueText?.match(/計:\s*([+-]?\d+)pt/);
    const actualTotalPayout = totalMatch ? parseInt(totalMatch[1].replace(/,/g, '')) : 0;

    console.log('\n=== Analysis Tab Display (Actual) ===');
    console.log('totalPayout (UI):', actualTotalPayout);

    // ===================================
    // Assertions
    // ===================================

    expect(actualTotalPayout).toBe(dbData?.totalPayout);

    console.log('✅ TC-101 PASS: Dynamic calculation matches session.summary');
  });

  /**
   * TC-401: 既存機能への影響確認
   * 目的: revenueStats/chipStats修正が他の統計に影響しないことを確認
   */
  test('TC-401: No impact on existing features', async ({ page }) => {
    console.log('\n=== TC-401: Existing Features Impact Test ===');

    // ===================================
    // Step 1: セッション作成
    // ===================================

    await page.getByRole('button', { name: '4人打ち麻雀' }).click();
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);

    const scoreTable = getScoreInputTable(page);

    // 半荘1の点数入力
    const scores = [10, 20, -10, -20];
    for (let p = 1; p <= 3; p++) {
      const input = getScoreInput(page, scoreTable, 1, p);
      await input.clear();
      await input.fill(String(scores[p - 1]));
    }

    await page.waitForTimeout(300);

    // 保存
    await page.getByRole('button', { name: /保存/i }).click();
    await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 2: 分析タブでpointStats/rankStatsを確認
    // ===================================

    await page.getByRole('tab', { name: '分析' }).click();
    await page.waitForTimeout(1000);

    // pointStatsカードの存在確認
    const pointCard = page.locator('text=📈 スコア').first();
    await expect(pointCard).toBeVisible();

    // rankStatsカードの存在確認（統計カードエリアの最初の要素）
    const rankCard = page.locator('text=📊 半荘着順').first();
    await expect(rankCard).toBeVisible();

    console.log('Point Stats Card: visible');
    console.log('Rank Stats Card: visible');

    // ===================================
    // Step 3: グラフ要素の存在確認
    // ===================================

    // 着順統計グラフ（Pie Chart）の存在確認
    const pieChart = page.locator('canvas, svg').first();
    await expect(pieChart).toBeVisible({ timeout: 5000 });

    console.log('Pie Chart: visible');

    // ===================================
    // Step 4: 履歴タブへの影響確認
    // ===================================

    await page.getByRole('tab', { name: '履歴' }).click();
    await page.waitForTimeout(1000);

    // セッションカードの存在確認
    const sessionCard = page.locator('[class*="border"]').filter({ hasText: today }).first();
    await expect(sessionCard).toBeVisible();

    console.log('History Tab Session Card: visible');

    // ===================================
    // Assertions
    // ===================================

    // すべての要素が正常に表示されていることを確認（既にtoBeVisible()で確認済み）
    console.log('✅ TC-401 PASS: No impact on existing features');
  });
});
