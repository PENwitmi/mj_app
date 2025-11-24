import { test, expect } from '@playwright/test';
import {
  getScoreInputTable,
  getScoreInput,
} from './helpers/selectors';

/**
 * 記録統計計算テスト
 *
 * テストケース:
 * - TC-001: 連続トップ記録計算テスト（10セッション）
 * - TC-002: 連続ラス記録計算テスト
 * - TC-003: 3人打ち/4人打ち混在での最下位判定
 * - TC-004: 時系列ソート検証
 * - TC-005: 最高/最低スコア・ポイント・収支の正確性
 */

test.describe('Record Statistics Calculation', () => {

  test.beforeEach(async ({ page, context }) => {
    // DB初期化
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => { indexedDB.deleteDatabase('MahjongDB'); });
    await page.reload();
    await expect(page.getByRole('tab', { name: '新規入力' })).toBeVisible({ timeout: 10000 });
  });

  /**
   * TC-001: 連続トップ/ラス記録計算テスト（10セッション）
   *
   * シナリオ:
   * S1 (01-01, 4人): 1位 (+50)   → 1連勝中
   * S2 (01-02, 4人): 1位 (+40)   → 2連勝中
   * S3 (01-03, 4人): 1位 (+60)   → 3連勝中（最大連続トップ）
   * S4 (01-04, 4人): 2位 (+20)   → 連勝途切れ
   * S5 (01-05, 3人): 3位 (-30)   → 1連続ラス（3人打ちの最下位）
   * S6 (01-06, 4人): 4位 (-40)   → 2連続ラス
   * S7 (01-07, 4人): 4位 (-50)   → 3連続ラス（最大連続ラス）
   * S8 (01-08, 4人): 2位 (+10)   → ラス途切れ
   * S9 (01-09, 4人): 1位 (+45)   → 1連勝中
   * S10 (01-10, 4人): 1位 (+55)  → 2連勝中（現在進行中）
   *
   * 期待値:
   * - maxConsecutiveTopStreak: 3
   * - maxConsecutiveLastStreak: 3
   * - currentTopStreak: 2
   * - currentLastStreak: undefined
   * - maxScoreInHanchan: +60 (S3)
   * - minScoreInHanchan: -50 (S7)
   */
  test('TC-001: Consecutive top/last streak calculation (10 sessions)', async ({ page }) => {
    test.setTimeout(60000); // 10セッション作成のため60秒に延長
    console.log('\n=== TC-001: 10 Session Consecutive Record Test ===');

    // ===================================
    // テストデータ定義
    // ===================================

    type SessionData = {
      date: string
      mode: '4-player' | '3-player'
      scores: number[]  // [P1, P2, P3, P4?] P1 = mainUser
      chips: number
      parlorFee: number
      expectedRank: number
    }

    const sessions: SessionData[] = [
      // S1: 1位 (+50) → 1連勝中
      { date: '2024-01-01', mode: '4-player', scores: [50, 10, -20, -40], chips: 2, parlorFee: 500, expectedRank: 1 },

      // S2: 1位 (+40) → 2連勝中
      { date: '2024-01-02', mode: '4-player', scores: [40, 20, -10, -50], chips: 3, parlorFee: 500, expectedRank: 1 },

      // S3: 1位 (+60) → 3連勝中（最大連続トップ）
      { date: '2024-01-03', mode: '4-player', scores: [60, 10, -30, -40], chips: 1, parlorFee: 500, expectedRank: 1 },

      // S4: 2位 (+20) → 連勝途切れ
      { date: '2024-01-04', mode: '4-player', scores: [20, 30, -10, -40], chips: 0, parlorFee: 500, expectedRank: 2 },

      // S5: 3人打ち 3位 (-30) → 1連続ラス
      { date: '2024-01-05', mode: '3-player', scores: [-30, 20, 10], chips: 0, parlorFee: 500, expectedRank: 3 },

      // S6: 4位 (-40) → 2連続ラス
      { date: '2024-01-06', mode: '4-player', scores: [-40, 10, 20, 10], chips: 0, parlorFee: 500, expectedRank: 4 },

      // S7: 4位 (-50) → 3連続ラス（最大連続ラス）、半荘最低得点
      { date: '2024-01-07', mode: '4-player', scores: [-50, 20, 10, 20], chips: 0, parlorFee: 500, expectedRank: 4 },

      // S8: 2位 (+10) → ラス途切れ
      { date: '2024-01-08', mode: '4-player', scores: [10, 40, -20, -30], chips: 1, parlorFee: 500, expectedRank: 2 },

      // S9: 1位 (+45) → 1連勝中
      { date: '2024-01-09', mode: '4-player', scores: [45, 15, -25, -35], chips: 2, parlorFee: 500, expectedRank: 1 },

      // S10: 1位 (+55) → 2連勝中（現在進行中）
      { date: '2024-01-10', mode: '4-player', scores: [55, 5, -20, -40], chips: 4, parlorFee: 500, expectedRank: 1 },
    ];

    // ===================================
    // セッション作成ループ
    // ===================================

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      console.log(`\nCreating Session ${i + 1}: ${session.date} (${session.mode})`);

      // 新規入力タブに移動
      await page.getByRole('tab', { name: '新規入力' }).click();
      await page.waitForTimeout(500);

      // モード選択
      const modeButton = session.mode === '4-player'
        ? page.getByRole('button', { name: '4人打ち麻雀' })
        : page.getByRole('button', { name: '3人打ち麻雀' });

      await modeButton.click();
      await page.waitForTimeout(300);

      // 日付入力
      await page.locator('input[type="date"]').fill(session.date);
      await page.waitForTimeout(300);

      const scoreTable = getScoreInputTable(page);

      // スコア入力（P1〜P3、P4は自動計算）
      const numPlayers = session.mode === '4-player' ? 3 : 2;
      for (let p = 1; p <= numPlayers; p++) {
        const input = getScoreInput(page, scoreTable, 1, p);
        await input.clear();
        await input.fill(String(session.scores[p - 1]));
        await page.waitForTimeout(100);
      }

      // 最後のプレイヤーからフォーカスを外す
      const lastInput = getScoreInput(page, scoreTable, 1, numPlayers);
      await lastInput.blur();
      await page.waitForTimeout(300);

      // チップと場代
      const cpInputs = await page.locator('tr:has(td:text("CP")) input').all();
      await cpInputs[0].clear();
      await cpInputs[0].fill(String(session.chips));

      const parlorInputs = await page.locator('tr:has(td:text("場代")) input').all();
      await parlorInputs[0].clear();
      await parlorInputs[0].fill(String(session.parlorFee));

      await page.waitForTimeout(300);

      // 保存
      await page.getByRole('button', { name: /保存/i }).click();
      await expect(page.locator('text=セッションを保存しました')).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(300);
    }

    // ===================================
    // 分析タブに移動して記録統計を確認
    // ===================================

    await page.getByRole('tab', { name: '分析' }).click();
    await page.waitForTimeout(1000);

    // ===================================
    // ヘルパー関数: 記録統計を抽出
    // ===================================

    const extractRecordStats = async (modeName: string) => {
      console.log(`\n=== Checking ${modeName} Mode ===`);

      // モード切り替え
      await page.getByRole('tab', { name: modeName }).click();
      await page.waitForTimeout(500);

      // 🏆 記録セクションを探す
      const recordSection = page.locator('text=🏆 記録').locator('..');
      await expect(recordSection).toBeVisible({ timeout: 5000 });

      // セクション全体のテキストを取得
      const recordText = await recordSection.textContent();

      // 半荘最高得点
      const maxScoreMatch = recordText?.match(/半荘最高得点\s*([+-]?\d+)点/);
      const maxScore = maxScoreMatch ? parseInt(maxScoreMatch[1]) : null;

      // 半荘最低得点
      const minScoreMatch = recordText?.match(/半荘最低得点\s*([+-]?\d+)点/);
      const minScore = minScoreMatch ? parseInt(minScoreMatch[1]) : null;

      // 最大連続トップ
      const maxTopStreakMatch = recordText?.match(/最大連続トップ[^\d]*(\d+)連勝/);
      const maxTopStreak = maxTopStreakMatch ? parseInt(maxTopStreakMatch[1]) : null;

      // 最大連続ラス
      const maxLastStreakMatch = recordText?.match(/最大連続ラス[^\d]*(\d+)連続/);
      const maxLastStreak = maxLastStreakMatch ? parseInt(maxLastStreakMatch[1]) : null;

      // 現在の連続トップ（"現在 X連勝中"）
      const currentTopStreakMatch = recordText?.match(/現在\s*(\d+)連勝中/);
      const currentTopStreak = currentTopStreakMatch ? parseInt(currentTopStreakMatch[1]) : null;

      // 現在の連続ラス（"現在 X連続中"）
      const currentLastStreakMatch = recordText?.match(/最大連続ラス.*?現在\s*(\d+)連続中/);
      const currentLastStreak = currentLastStreakMatch ? parseInt(currentLastStreakMatch[1]) : null;

      console.log('maxScore:', maxScore);
      console.log('minScore:', minScore);
      console.log('maxTopStreak:', maxTopStreak);
      console.log('maxLastStreak:', maxLastStreak);
      console.log('currentTopStreak:', currentTopStreak);
      console.log('currentLastStreak:', currentLastStreak);

      return { maxScore, minScore, maxTopStreak, maxLastStreak, currentTopStreak, currentLastStreak };
    };

    // ===================================
    // 4人打ちモードでの検証
    // ===================================

    const fourPlayerStats = await extractRecordStats('4人打ち');

    // 4人打ちモードの期待値（S1, S2, S3, S4, S6, S7, S8, S9, S10の9個）
    // S1:1位, S2:1位, S3:1位, S4:2位, S6:4位, S7:4位, S8:2位, S9:1位, S10:1位
    expect(fourPlayerStats.maxScore).toBe(60);  // S3
    expect(fourPlayerStats.minScore).toBe(-50); // S7
    expect(fourPlayerStats.maxTopStreak).toBe(3);  // S1→S2→S3
    expect(fourPlayerStats.maxLastStreak).toBe(2); // S6→S7
    expect(fourPlayerStats.currentTopStreak).toBe(2); // S9→S10
    expect(fourPlayerStats.currentLastStreak).toBeNull(); // 進行中のラスなし

    console.log('✅ 4人打ちモード: PASS');

    // ===================================
    // 3人打ちモードでの検証
    // ===================================

    const threePlayerStats = await extractRecordStats('3人打ち');

    // 3人打ちモードの期待値（S5の1個のみ）
    // S5: 3位（ラス）
    expect(threePlayerStats.maxScore).toBe(-30); // S5
    expect(threePlayerStats.minScore).toBe(-30); // S5
    expect(threePlayerStats.maxTopStreak).toBe(0);  // トップなし
    expect(threePlayerStats.maxLastStreak).toBe(1);    // S5のみ
    expect(threePlayerStats.currentTopStreak).toBeNull(); // 進行中のトップなし
    expect(threePlayerStats.currentLastStreak).toBe(1);   // S5以降3人打ちなし→進行中

    console.log('✅ 3人打ちモード: PASS');

    // ===================================
    // 全体モードでの検証
    // ===================================

    const allStats = await extractRecordStats('全体');

    // 全体モードの期待値（全10個）
    // S1:1位, S2:1位, S3:1位, S4:2位, S5:3位, S6:4位, S7:4位, S8:2位, S9:1位, S10:1位
    expect(allStats.maxScore).toBe(60);  // S3
    expect(allStats.minScore).toBe(-50); // S7
    expect(allStats.maxTopStreak).toBe(3);  // S1→S2→S3
    expect(allStats.maxLastStreak).toBe(3); // S5→S6→S7
    expect(allStats.currentTopStreak).toBe(2); // S9→S10
    expect(allStats.currentLastStreak).toBeNull(); // 進行中のラスなし

    console.log('✅ 全体モード: PASS');

    console.log('\n✅ TC-001 PASS: All game modes validated correctly');
  });

  /**
   * TC-002: 時系列ソート検証
   *
   * 目的: セッションを逆順で入力しても、正しく時系列順に処理されることを確認
   *
   * シナリオ:
   * - 2024-01-03に入力 → 1位
   * - 2024-01-01に入力 → 1位
   * - 2024-01-02に入力 → 1位
   *
   * 期待値: 3連勝として認識される（日付順にソートされているため）
   */
  test('TC-002: Time-series sorting validation', async ({ page }) => {
    console.log('\n=== TC-002: Time-Series Sorting Test ===');

    // ===================================
    // セッションを逆順で作成
    // ===================================

    const sessions = [
      { date: '2024-01-03', scores: [50, 10, -20, -40] },
      { date: '2024-01-01', scores: [40, 10, -20, -30] },
      { date: '2024-01-02', scores: [45, 15, -25, -35] },
    ];

    for (const session of sessions) {
      await page.getByRole('tab', { name: '新規入力' }).click();
      await page.waitForTimeout(300);

      await page.getByRole('button', { name: '4人打ち麻雀' }).click();
      await page.locator('input[type="date"]').fill(session.date);

      const scoreTable = getScoreInputTable(page);

      for (let p = 1; p <= 3; p++) {
        const input = getScoreInput(page, scoreTable, 1, p);
        await input.clear();
        await input.fill(String(session.scores[p - 1]));
      }

      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /保存/i }).click();
      await expect(page.locator('text=セッションを保存しました').first()).toBeVisible({ timeout: 5000 });
    }

    // ===================================
    // 分析タブで確認
    // ===================================

    await page.getByRole('tab', { name: '分析' }).click();
    await page.waitForTimeout(1000);

    const recordSection = page.locator('text=🏆 記録').locator('..');
    const recordText = await recordSection.textContent();

    const maxTopStreakMatch = recordText?.match(/最大連続トップ[^\d]*(\d+)連勝/);
    const maxTopStreak = maxTopStreakMatch ? parseInt(maxTopStreakMatch[1]) : null;

    console.log('maxTopStreak:', maxTopStreak);

    // ===================================
    // Assertions
    // ===================================

    // 日付順にソートされていれば3連勝になるはず
    expect(maxTopStreak).toBe(3);

    console.log('✅ TC-002 PASS: Time-series sorting works correctly');
  });

  /**
   * TC-003: 3人打ち/4人打ち混在での最下位判定
   *
   * シナリオ:
   * S1 (3人打ち): 3位（ラス）
   * S2 (4人打ち): 4位（ラス）
   * S3 (3人打ち): 3位（ラス）
   *
   * 期待値: 3連続ラスとして認識される
   */
  test('TC-003: 3-player and 4-player mixed last rank detection', async ({ page }) => {
    console.log('\n=== TC-003: Mixed Mode Last Rank Test ===');

    const sessions = [
      { date: '2024-01-01', mode: '3-player' as const, scores: [-30, 20, 10] },
      { date: '2024-01-02', mode: '4-player' as const, scores: [-40, 10, 20, 10] },
      { date: '2024-01-03', mode: '3-player' as const, scores: [-35, 25, 10] },
    ];

    for (const session of sessions) {
      await page.getByRole('tab', { name: '新規入力' }).click();
      await page.waitForTimeout(300);

      const modeButton = session.mode === '4-player'
        ? page.getByRole('button', { name: '4人打ち麻雀' })
        : page.getByRole('button', { name: '3人打ち麻雀' });

      await modeButton.click();
      await page.locator('input[type="date"]').fill(session.date);

      const scoreTable = getScoreInputTable(page);
      const numPlayers = session.mode === '4-player' ? 3 : 2;

      for (let p = 1; p <= numPlayers; p++) {
        const input = getScoreInput(page, scoreTable, 1, p);
        await input.clear();
        await input.fill(String(session.scores[p - 1]));
      }

      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /保存/i }).click();
      await expect(page.locator('text=セッションを保存しました').first()).toBeVisible({ timeout: 5000 });
    }

    await page.getByRole('tab', { name: '分析' }).click();
    await page.waitForTimeout(1000);

    // ゲームモードを「全体」に切り替え（3人打ち+4人打ちの混在データを見るため）
    await page.getByRole('tab', { name: '全体' }).click();
    await page.waitForTimeout(500);

    const recordSection = page.locator('text=🏆 記録').locator('..');
    const recordText = await recordSection.textContent();

    const maxLastStreakMatch = recordText?.match(/最大連続ラス[^\d]*(\d+)連続/);
    const maxLastStreak = maxLastStreakMatch ? parseInt(maxLastStreakMatch[1]) : null;

    console.log('maxLastStreak:', maxLastStreak);

    // ===================================
    // Assertions
    // ===================================

    // 3人打ち3位と4人打ち4位が両方ラスとして認識されるべき
    expect(maxLastStreak).toBe(3);

    console.log('✅ TC-003 PASS: Mixed mode last rank detection works correctly');
  });

  /**
   * TC-004: 同一日付での複数セッションソーティング検証
   *
   * 目的: 同じ日付に複数のセッションを作成した場合、session.createdAtで正しくソートされることを確認
   *
   * シナリオ:
   * - 2024-01-01に3つのセッションを作成
   *   - Session1: 1位
   *   - Session2: 1位
   *   - Session3: 1位
   * - さらに同じ日付に3つのセッションを作成
   *   - Session4: 4位
   *   - Session5: 4位
   *   - Session6: 4位
   *
   * 期待値:
   * - 最大連続トップ: 3 (Session1→Session2→Session3)
   * - 最大連続ラス: 3 (Session4→Session5→Session6)
   * - 現在の連続ラス: 3 (Session4→Session5→Session6)
   */
  test('TC-004: Same date multiple sessions sorting validation', async ({ page }) => {
    console.log('\n=== TC-004: Same Date Multiple Sessions Sorting Test ===');

    // ===================================
    // 同一日付に6つのセッションを作成
    // ===================================

    const sessions = [
      // トップ3連勝
      { date: '2024-01-01', scores: [50, 10, -20, -40], expectedRank: 1 },
      { date: '2024-01-01', scores: [45, 15, -25, -35], expectedRank: 1 },
      { date: '2024-01-01', scores: [40, 20, -30, -30], expectedRank: 1 },

      // ラス3連続
      { date: '2024-01-01', scores: [-50, 20, 10, 20], expectedRank: 4 },
      { date: '2024-01-01', scores: [-45, 25, 10, 10], expectedRank: 4 },
      { date: '2024-01-01', scores: [-40, 30, 5, 5], expectedRank: 4 },
    ];

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      console.log(`\nCreating Session ${i + 1}: ${session.date}, Expected Rank: ${session.expectedRank}`);

      await page.getByRole('tab', { name: '新規入力' }).click();
      await page.waitForTimeout(300);

      await page.getByRole('button', { name: '4人打ち麻雀' }).click();
      await page.locator('input[type="date"]').fill(session.date);

      const scoreTable = getScoreInputTable(page);

      // スコア入力（P1〜P3、P4は自動計算）
      for (let p = 1; p <= 3; p++) {
        const input = getScoreInput(page, scoreTable, 1, p);
        await input.clear();
        await input.fill(String(session.scores[p - 1]));
        await page.waitForTimeout(100);
      }

      // 最後のプレイヤーからフォーカスを外す
      const lastInput = getScoreInput(page, scoreTable, 1, 3);
      await lastInput.blur();
      await page.waitForTimeout(300);

      await page.getByRole('button', { name: /保存/i }).click();
      await expect(page.locator('text=セッションを保存しました').first()).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(300);
    }

    // ===================================
    // 分析タブで確認
    // ===================================

    await page.getByRole('tab', { name: '分析' }).click();
    await page.waitForTimeout(1000);

    // 🏆 記録セクションを探す
    const recordSection = page.locator('text=🏆 記録').locator('..');
    await expect(recordSection).toBeVisible({ timeout: 5000 });

    const recordText = await recordSection.textContent();
    console.log('\n=== Record Section Text ===');
    console.log(recordText);

    // ===================================
    // 記録統計の値を抽出
    // ===================================

    const maxTopStreakMatch = recordText?.match(/最大連続トップ[^\d]*(\d+)連勝/);
    const maxTopStreak = maxTopStreakMatch ? parseInt(maxTopStreakMatch[1]) : null;

    const maxLastStreakMatch = recordText?.match(/最大連続ラス[^\d]*(\d+)連続/);
    const maxLastStreak = maxLastStreakMatch ? parseInt(maxLastStreakMatch[1]) : null;

    const currentLastStreakMatch = recordText?.match(/最大連続ラス.*?現在\s*(\d+)連続中/);
    const currentLastStreak = currentLastStreakMatch ? parseInt(currentLastStreakMatch[1]) : null;

    console.log('\n=== Extracted Record Statistics ===');
    console.log('maxTopStreak:', maxTopStreak);
    console.log('maxLastStreak:', maxLastStreak);
    console.log('currentLastStreak:', currentLastStreak);

    // ===================================
    // Assertions
    // ===================================

    // 最大連続トップ: 3 (Session1→Session2→Session3)
    expect(maxTopStreak).toBe(3);

    // 最大連続ラス: 3 (Session4→Session5→Session6)
    expect(maxLastStreak).toBe(3);

    // 現在の連続ラス: 3 (Session4→Session5→Session6が進行中)
    expect(currentLastStreak).toBe(3);

    console.log('\n✅ TC-004 PASS: Same date multiple sessions sorting works correctly');
  });
});
