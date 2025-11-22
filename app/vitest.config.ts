import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitestユニット・統合テスト設定
 * @see https://vitest.dev/config/
 */
export default defineConfig({
  plugins: [react()],

  test: {
    // グローバル変数を有効化（describe, it, expect等）
    globals: true,

    // テスト環境（jsdom = ブラウザ環境エミュレーション）
    environment: 'jsdom',

    // セットアップファイル
    setupFiles: ['./tests/setup.ts'],

    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.ts',
        '**/ui/**', // shadcn/uiコンポーネント除外
        '**/*.d.ts',
        '**/types.ts',
      ],
      // カバレッジ閾値
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },

    // テストタイムアウト
    testTimeout: 10000,
  },

  // パスエイリアス解決
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
