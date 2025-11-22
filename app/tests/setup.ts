import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

/**
 * Vitestテストセットアップファイル
 *
 * 各テスト実行前後の共通処理を定義
 */

// 各テスト後にReactコンポーネントのクリーンアップ
afterEach(() => {
  cleanup();
});

// fake-indexeddb: IndexedDBのモック環境を自動構築
// グローバルスコープでindexedDBが利用可能になる
