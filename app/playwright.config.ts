import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2Eテスト設定
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',

  // すべてのテストを並列実行
  fullyParallel: true,

  // CI環境では.only()の使用を禁止
  forbidOnly: !!process.env.CI,

  // CI環境では失敗時に2回リトライ
  retries: process.env.CI ? 2 : 0,

  // CI環境ではworkerを1つに制限（安定性向上）
  workers: process.env.CI ? 1 : undefined,

  // レポーター設定
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  // 共通設定
  use: {
    // ベースURL
    baseURL: 'http://localhost:5173',

    // 失敗時のトレース記録
    trace: 'on-first-retry',

    // 失敗時のスクリーンショット
    screenshot: 'only-on-failure',

    // 失敗時のビデオ記録
    video: 'retain-on-failure',
  },

  // テストプロジェクト（複数ブラウザ/デバイス）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13 Pro'] },
    },
  ],

  // 開発サーバー設定
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2分
  },
});
