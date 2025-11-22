import { test, expect } from '@playwright/test';
import {
  getScoreInputTable,
  getScoreInput,
} from './helpers/selectors';
import fs from 'fs';
import path from 'path';

test.describe('IndexedDB Simple Debug', () => {
  test('チップ・場代のデータ保存確認', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => { indexedDB.deleteDatabase('MahjongDB'); });
    await page.reload();
    await expect(page.getByRole('tab', { name: '新規入力' })).toBeVisible({ timeout: 10000 });

    // モード選択
    await page.getByRole('button', { name: '4人打ち麻雀' }).click();
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);

    const scoreTable = getScoreInputTable(page);

    // 半荘1の点数入力
    await getScoreInput(page, scoreTable, 1, 1).fill('40');
    await getScoreInput(page, scoreTable, 1, 2).fill('10');
    const h1p3 = getScoreInput(page, scoreTable, 1, 3);
    await h1p3.fill('-20');
    await h1p3.blur();
    await page.waitForTimeout(500);

    // 半荘2の点数入力
    await getScoreInput(page, scoreTable, 2, 1).fill('30');
    await getScoreInput(page, scoreTable, 2, 2).fill('20');
    const h2p3 = getScoreInput(page, scoreTable, 2, 3);
    await h2p3.fill('-10');
    await h2p3.blur();
    await page.waitForTimeout(500);

    // チップと場代を入力
    const cpInputs = await page.locator('tr:has(td:text("CP")) input').all();
    await cpInputs[0].fill('5');
    const parlorInputs = await page.locator('tr:has(td:text("場代")) input').all();
    await parlorInputs[0].fill('500');
    await page.waitForTimeout(500);

    // 保存
    await page.getByRole('button', { name: /保存/i }).click();
    await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });

    // IndexedDBデータ取得
    const dbData = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('MahjongDB', 2);  // version 2
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

      const [sessions, hanchans, playerResults] = await Promise.all([
        getAll('sessions'),
        getAll('hanchans'),
        getAll('playerResults')
      ]);

      return { sessions, hanchans, playerResults };
    });

    // ファイルに出力
    const outputPath = path.join(__dirname, '../../test-results/indexeddb-debug.json');
    fs.writeFileSync(outputPath, JSON.stringify(dbData, null, 2));

    console.log('\n=== IndexedDB Data saved to:', outputPath);
    console.log('Sessions count:', (dbData.sessions as any[]).length);
    console.log('Hanchans count:', (dbData.hanchans as any[]).length);
    console.log('PlayerResults count:', (dbData.playerResults as any[]).length);

    // 簡易検証
    const playerResults = dbData.playerResults as any[];
    expect(playerResults.length).toBeGreaterThan(0);
  });
});
