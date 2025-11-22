import { test, expect } from '@playwright/test';
import {
  getScoreInputTable,
  getScoreInput,
} from './helpers/selectors';

/**
 * IndexedDBデバッグ用テスト
 * chips/parlorFeeの保存状態を確認
 */

test.describe('IndexedDB Debug', () => {
  test('チップ・場代が各半荘にどう保存されているか確認', async ({ page, context }) => {
    // クリーンな状態でテスト開始
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      indexedDB.deleteDatabase('MahjongAppDB');
    });
    await page.reload();
    await expect(page.getByRole('tab', { name: '新規入力' })).toBeVisible({ timeout: 10000 });

    // ===================================
    // Step 1: モード選択
    // ===================================
    await page.getByRole('button', { name: '4人打ち麻雀' }).click();

    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);

    // ScoreInputTableを特定
    const scoreTable = getScoreInputTable(page);

    // ===================================
    // Step 2: 2半荘分の点数を入力
    // ===================================

    // 半荘1
    const h1p1 = getScoreInput(page, scoreTable, 1, 1);
    await h1p1.clear();
    await h1p1.fill('40');

    const h1p2 = getScoreInput(page, scoreTable, 1, 2);
    await h1p2.clear();
    await h1p2.fill('10');

    const h1p3 = getScoreInput(page, scoreTable, 1, 3);
    await h1p3.clear();
    await h1p3.fill('-20');
    await h1p3.blur();
    await page.waitForTimeout(500);

    // 半荘2
    const h2p1 = getScoreInput(page, scoreTable, 2, 1);
    await h2p1.clear();
    await h2p1.fill('30');

    const h2p2 = getScoreInput(page, scoreTable, 2, 2);
    await h2p2.clear();
    await h2p2.fill('20');

    const h2p3 = getScoreInput(page, scoreTable, 2, 3);
    await h2p3.clear();
    await h2p3.fill('-10');
    await h2p3.blur();
    await page.waitForTimeout(500);

    // ===================================
    // Step 3: チップと場代を入力（プレイヤー1のみ）
    // ===================================

    // CPセクションを探す
    const cpInputs = await page.locator('tr:has(td:text("CP")) input').all();
    if (cpInputs.length > 0) {
      await cpInputs[0].clear();
      await cpInputs[0].fill('5'); // プレイヤー1に5チップ
    }

    // 場代セクションを探す
    const parlorFeeInputs = await page.locator('tr:has(td:text("場代")) input').all();
    if (parlorFeeInputs.length > 0) {
      await parlorFeeInputs[0].clear();
      await parlorFeeInputs[0].fill('500'); // プレイヤー1に500場代
    }

    await page.waitForTimeout(500);

    // ===================================
    // Step 4: 保存
    // ===================================
    await page.getByRole('button', { name: /保存/i }).click();
    await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

    // ===================================
    // Step 5: IndexedDBの中身を確認
    // ===================================

    const dbData = await page.evaluate(async () => {
      const dbRequest = indexedDB.open('MahjongAppDB', 1);

      return new Promise((resolve, reject) => {
        dbRequest.onsuccess = async (event: any) => {
          const db = event.target.result;

          // Sessions
          const sessionsTx = db.transaction(['sessions'], 'readonly');
          const sessionsStore = sessionsTx.objectStore('sessions');
          const sessionsRequest = sessionsStore.getAll();

          sessionsRequest.onsuccess = async () => {
            const sessions = sessionsRequest.result;

            // Hanchans
            const hanchansTx = db.transaction(['hanchans'], 'readonly');
            const hanchansStore = hanchansTx.objectStore('hanchans');
            const hanchansRequest = hanchansStore.getAll();

            hanchansRequest.onsuccess = async () => {
              const hanchans = hanchansRequest.result;

              // PlayerResults
              const resultsTx = db.transaction(['playerResults'], 'readonly');
              const resultsStore = resultsTx.objectStore('playerResults');
              const resultsRequest = resultsStore.getAll();

              resultsRequest.onsuccess = () => {
                const results = resultsRequest.result;

                resolve({
                  sessions,
                  hanchans,
                  playerResults: results
                });
              };
            };
          };
        };

        dbRequest.onerror = () => reject(dbRequest.error);
      });
    });

    // ===================================
    // Step 6: コンソール出力
    // ===================================

    console.log('=== IndexedDB Data ===');
    console.log('Sessions:', JSON.stringify(dbData.sessions, null, 2));
    console.log('Hanchans:', JSON.stringify(dbData.hanchans, null, 2));
    console.log('PlayerResults:', JSON.stringify(dbData.playerResults, null, 2));

    // ===================================
    // Step 7: chips/parlorFeeの検証
    // ===================================

    const playerResults = dbData.playerResults as any[];
    const mainUserResults = playerResults.filter((r: any) => r.playerName === '自分');

    console.log('\n=== Main User Results ===');
    mainUserResults.forEach((r: any, i: number) => {
      console.log(`[半荘${i + 1}]`, {
        score: r.score,
        scoreType: typeof r.score,
        chips: r.chips,
        chipsType: typeof r.chips,
        parlorFee: r.parlorFee,
        parlorFeeType: typeof r.parlorFee,
        umaMark: r.umaMark
      });
    });

    // チップと場代が各半荘に保存されているか確認
    expect(mainUserResults.length).toBe(2); // 2半荘

    // 各半荘のchips/parlorFeeを確認
    mainUserResults.forEach((r: any, i: number) => {
      console.log(`\n半荘${i + 1}のchips: ${r.chips} (type: ${typeof r.chips})`);
      console.log(`半荘${i + 1}のparlorFee: ${r.parlorFee} (type: ${typeof r.parlorFee})`);
    });

    // セッションサマリーの確認
    const session = dbData.sessions[0] as any;
    if (session.summary) {
      console.log('\n=== Session Summary ===');
      console.log('totalChips:', session.summary.totalChips, `(type: ${typeof session.summary.totalChips})`);
      console.log('totalPayout:', session.summary.totalPayout, `(type: ${typeof session.summary.totalPayout})`);
    }
  });
});
