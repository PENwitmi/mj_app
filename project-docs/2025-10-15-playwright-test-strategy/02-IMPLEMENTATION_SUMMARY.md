# テスト戦略実装サマリー

**作成日**: 2025-10-15 16:31
**対象フェーズ**: Phase 7 - テスト・最適化

---

## 📊 調査結果概要

### プロジェクト現状
- **総ファイル数**: 44ファイル（src配下 TypeScript/TSX）
- **総コード行数**: 7,336行
- **ビルドサイズ**: 961KB (minified) / 283KB (gzip)
- **テストカバレッジ**: 0%（テストコード未実装）

### テスト対象の分類

#### 1. ビジネスロジック層
- **uma-utils.ts**: ウママーク計算、ゼロサム自動計算（23テストケース）
- **session-utils.ts**: 収支計算、着順判定、サマリー計算（28テストケース）
- **db/validation.ts**: ゼロサム検証、ウママーク検証（9テストケース）

#### 2. データベース操作層
- **db/users.ts**: ユーザー管理、アーカイブシステム（10テストケース）
- **db/sessions.ts**: セッション保存、削除、取得（8テストケース）
- **db/hanchans.ts**: 半荘・プレイヤー結果管理（5テストケース）

#### 3. UI層（Playwright E2E）
- **10カテゴリ**: アプリ初期化、ユーザー管理、新規入力、履歴、分析、設定、クロスタブ、エラーハンドリング、パフォーマンス、iOS対応
- **合計**: 約40テストケース

---

## 🎯 重要な発見事項

### 1. 空ハンチャンフィルタリング実装済み（2025-10-07）
- **三層防御アーキテクチャ**: InputTab→db-utils→統計計算
- **Playwrightテスト実績**: TC-1, TC-2, TC-3, TC-7で検証済み
- **参考**: `.serena/memories/empty-hanchan-filtering-implementation-2025-10-07`

### 2. Phase 6完了済み（iOS対応）
- **safe-area対応**: CSS変数使用、二重計算修正
- **レイアウト調整**: タブ切り替え、スクロール対応
- **トースト通知**: bottom-center → top-center変更

### 3. データモデル複雑性
- **4層構造**: User → Session → Hanchan → PlayerResult
- **ゼロサム原則**: 各半荘で点数合計0（見学者除く）
- **ウママーク合計**: 必ず0になる（ゼロサム）
- **プレイヤー個別場代**: Phase 6拡張機能（2025-10-12追加）

### 4. パフォーマンス最適化実装済み
- **サマリー事前計算**: Session.summary フィールド追加（Version 2）
- **効果**: DB読み取り95%削減（300-800倍高速化）
- **参考**: `project-docs/2025-10-04-phase4-history-tab/04-SUMMARY_PRE_CALCULATION.md`

---

## 🔍 エッジケース詳細分析

### 最重要エッジケース（P0）

1. **ゼロサム関連**（5ケース）
   - 全員0点、浮動小数点誤差、見学者含む、点数null
   - **リスク**: データ整合性崩壊、統計精度低下

2. **ウママーク関連**（5ケース）
   - 同点時の着順、2位マイナス境界値、手動ウママーク
   - **リスク**: 収支計算ミス、プレイヤー不信

3. **セッション・半荘関連**（6ケース）
   - 半荘0個、空半荘のみ、中間空半荘、日付境界
   - **リスク**: 保存失敗、データロス、統計誤差

4. **ユーザー管理関連**（6ケース）
   - メインユーザー削除試行、アーカイブ済み選択、仮名入力
   - **リスク**: データ破壊、UI不整合

### 高リスクエッジケース（P1）

5. **統計・分析関連**（6ケース）
   - セッション0件、期間フィルタ結果0件、選択ユーザー不参加
   - **対策**: Phase 5-7で修正済み（3層フィルター）

6. **UI/UX関連**（6ケース）
   - タブ切り替え（状態保持）、長時間放置、iOS safe-area
   - **対策**: forceMount + 条件付きレンダリング実装済み

### 監視対象エッジケース（P2）

7. **パフォーマンス関連**（4ケース）
   - 大量セッション（100件）、大量半荘（50半荘）
   - **目標**: サマリー事前計算で高速表示（<100ms）

8. **エラーハンドリング関連**（5ケース）
   - DB初期化失敗、トランザクション失敗、不正データ
   - **対策**: ErrorBoundary実装済み

---

## 📝 Playwrightテスト設計のポイント

### テストピラミッド構成

```
      /\
     /E2E\         <- 40個（Playwright）
    /------\
   /Integration\   <- 23個（Vitest + fake-indexeddb）
  /------------\
 /Unit Tests   \  <- 60個（Vitest）
/----------------\
```

### 重要なテストパターン

#### 1. Page Objectパターン
```typescript
export class InputTabPage {
  async selectMode(mode: '4-player' | '3-player') { ... }
  async selectPlayer(column: number, userId: string) { ... }
  async enterScore(column: number, hanchan: number, score: string) { ... }
  async save() { ... }
}
```

**メリット**:
- テストコードの再利用性向上
- UI変更時の修正箇所最小化
- 可読性向上

#### 2. フィクスチャーパターン
```typescript
export const create4PlayerSession = (): SessionSaveData => ({
  date: '2025-10-15',
  mode: '4-player',
  hanchans: [...]
});
```

**メリット**:
- テストデータの一貫性
- セットアップコードの簡潔化
- バリエーション生成の容易さ

#### 3. data-testid属性戦略
```tsx
<Input data-testid="score-input-0-0" />
<Button data-testid="save-button">保存</Button>
```

**ガイドライン**:
- 命名規則: `{component}-{action}-{index}`
- 安定したセレクタ（classやtextは変更されやすい）
- アクセシビリティと併用（aria-label等）

#### 4. 非同期処理の待機戦略
```typescript
// ❌ 固定待機（アンチパターン）
await page.waitForTimeout(1000);

// ✅ 要素待機
await expect(page.locator('text=保存しました')).toBeVisible();

// ✅ ネットワーク待機
await page.waitForLoadState('networkidle');

// ✅ 状態変化待機
await page.waitForSelector('[data-testid="session-item"]', { state: 'visible' });
```

---

## 🛠️ 実装ロードマップ詳細

### Phase 7-1: ユニットテスト（2-3日、見積: 18-24時間）

**優先度**: P0（最重要）

#### Day 1: ウママーク・収支計算（6-8時間）
- [ ] `tests/unit/uma-utils.test.ts`
  - `umaMarkToValue()`: 8テストケース
  - `assignUmaMarks()`: 6テストケース
  - `calculateAutoScore()`: 4テストケース
  - `getInitialPlayerNames()`: 2テストケース
  - `createInitialPlayerResult()`: 2テストケース

- [ ] `tests/unit/session-utils.test.ts` - Part 1
  - `calculatePayout()`: 8テストケース

**目標**: カバレッジ70%達成

#### Day 2: セッションサマリー・バリデーション（6-8時間）
- [ ] `tests/unit/session-utils.test.ts` - Part 2
  - `calculateRanks()`: 5テストケース
  - `calculateSessionSummary()`: 7テストケース

- [ ] `tests/unit/validation.test.ts`
  - `validateZeroSum()`: 5テストケース
  - `validateUmaMarks()`: 5テストケース

**目標**: カバレッジ80%達成

#### Day 3: カバレッジ向上（6-8時間）
- [ ] エッジケース追加テスト
- [ ] エラーケーステスト
- [ ] カバレッジレポート確認・改善

**目標**: カバレッジ85%以上達成

### Phase 7-2: 統合テスト（2-3日、見積: 18-24時間）

**優先度**: P1（高）

#### Day 4: ユーザー管理DB操作（6-8時間）
- [ ] `tests/integration/db-users.test.ts`
  - `addUser()`: 3テストケース
  - `updateUser()`: 2テストケース
  - `archiveUser()` / `restoreUser()`: 4テストケース
  - `getActiveUsers()` / `getArchivedUsers()`: 2テストケース
  - メインユーザー管理: 2テストケース

**セットアップ**: fake-indexeddb使用

#### Day 5: セッション・半荘DB操作（6-8時間）
- [ ] `tests/integration/db-sessions.test.ts`
  - `saveSession()`: 3テストケース
  - `getSessionWithDetails()`: 2テストケース
  - `deleteSession()`: 2テストケース（カスケード削除）
  - サマリー事前計算: 2テストケース

- [ ] `tests/integration/db-hanchans.test.ts`
  - `createHanchan()`: 2テストケース
  - `createPlayerResult()`: 2テストケース
  - `getPlayerResultsByHanchan()`: 2テストケース（position順）

#### Day 6: トランザクション・エラーテスト（6-8時間）
- [ ] トランザクションロールバックテスト
- [ ] DB制約違反テスト
- [ ] エラーハンドリングテスト

**目標**: DB操作の安定性保証

### Phase 7-3: E2Eテスト（4-5日、見積: 30-40時間）

**優先度**: P1（高）

#### Day 7: 基本フロー（6-8時間）
- [ ] `tests/e2e/app-initialization.spec.ts`（2ケース）
- [ ] `tests/e2e/user-management.spec.ts`（3ケース）
- [ ] Page Objectパターン実装
- [ ] フィクスチャー実装

#### Day 8: 新規入力タブ（6-8時間）
- [ ] `tests/e2e/input-tab.spec.ts`（8ケース）
  - 基本入力、複数半荘、空半荘フィルタリング
  - ゼロサム自動計算、チップ、場代、見学者
  - 手動ウママーク、セッション設定

**重要**: 最も複雑なテスト群

#### Day 9: 履歴・分析タブ（6-8時間）
- [ ] `tests/e2e/history-tab.spec.ts`（4ケース）
- [ ] `tests/e2e/analysis-tab.spec.ts`（7ケース）

**重点**: グラフ描画、フィルタリング、統計精度

#### Day 10: 設定・クロスタブ（6-8時間）
- [ ] `tests/e2e/settings-tab.spec.ts`（4ケース）
- [ ] `tests/e2e/cross-tab.spec.ts`（3ケース）

**重点**: タブ間データ連携、状態管理

#### Day 11: エラー・パフォーマンス・iOS（6-8時間）
- [ ] `tests/e2e/error-handling.spec.ts`（4ケース）
- [ ] `tests/e2e/performance.spec.ts`（2ケース）
- [ ] `tests/e2e/ios-support.spec.ts`（2ケース）

**重点**: エラーバウンダリ、パフォーマンス基準、モバイル対応

### Phase 7-4: CI/CD統合（1日、見積: 6-8時間）

**優先度**: P2（中）

#### Day 12: GitHub Actions設定（6-8時間）
- [ ] `.github/workflows/test.yml` 作成
- [ ] 自動テスト実行設定
- [ ] カバレッジレポート設定
- [ ] Playwrightレポート公開設定

**ゴール**: プッシュ時の自動テスト実行

---

## 📦 必要な追加パッケージ

### テスト関連
```bash
npm install -D @playwright/test
npm install -D vitest @vitest/ui
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D fake-indexeddb
```

### 推定サイズ
- **@playwright/test**: ~50MB
- **vitest + @vitest/ui**: ~15MB
- **testing-library**: ~5MB
- **fake-indexeddb**: ~2MB
- **合計**: ~72MB（devDependencies）

### ビルドサイズへの影響
- **本番ビルド**: 影響なし（devDependenciesのみ）
- **開発環境**: node_modules増加のみ

---

## 🎯 成功基準の詳細

### カバレッジ目標

#### ユニットテスト: 85%以上
- **uma-utils.ts**: 95%以上（重要度高）
- **session-utils.ts**: 90%以上（重要度高）
- **validation.ts**: 100%（重要度最高）

#### 統合テスト: 75%以上
- **db/users.ts**: 80%以上
- **db/sessions.ts**: 80%以上
- **db/hanchans.ts**: 70%以上

#### E2Eテスト: 主要フロー100%
- **新規入力→保存**: 必須
- **履歴表示→詳細**: 必須
- **分析タブ統計**: 必須
- **ユーザー管理**: 必須

### パフォーマンス目標

#### テスト実行時間
- **ユニットテスト**: 全体<5秒（60ケース）
- **統合テスト**: 全体<30秒（23ケース）
- **E2Eテスト**: 全体<5分（40ケース）
  - Chromium: <3分
  - Mobile Safari: <2分

#### 並列実行
- **ユニット・統合**: 最大4ワーカー
- **E2E**: CI環境では1ワーカー（安定性優先）

### 品質目標

#### バグ検出率
- **リリース前**: クリティカルバグ0件
- **リグレッション**: 既存機能破壊0件
- **カバレッジ**: 未テストエリア<15%

#### ドキュメント品質
- **全テストケース**: 説明コメント付与
- **複雑なロジック**: Given-When-Then形式
- **エッジケース**: 背景・期待動作明記

---

## 🚨 リスクと対策

### リスク1: テスト実装時間の超過
- **原因**: 複雑なE2Eテスト、非同期処理の待機調整
- **対策**: Phase 7-3を2日延長可能、優先度の低いテスト後回し

### リスク2: IndexedDBモックの不完全性
- **原因**: fake-indexeddbとDexie.jsの互換性問題
- **対策**: 統合テスト前に検証、必要に応じて別ライブラリ検討

### リスク3: Rechartsグラフテストの難しさ
- **原因**: SVG要素の動的生成、描画タイミング
- **対策**: スナップショットテスト併用、視覚的回帰テスト検討

### リスク4: iOS実機テストの不足
- **原因**: Playwright Webkit ≠ 実機Safari
- **対策**: 手動テスト併用、BrowserStackなどのクラウドテスト検討

---

## 📚 参考資料

### プロジェクト内ドキュメント
- `CLAUDE.md`: プロジェクト概要、技術スタック
- `MASTER_STATUS_DASHBOARD.md`: 進捗状況、完了済みフェーズ
- `project-docs/2025-10-03-phase1-basic-implementation/`: DB設計
- `project-docs/2025-10-04-phase4-history-tab/04-SUMMARY_PRE_CALCULATION.md`: パフォーマンス最適化

### Serena Memory
- `project_overview`: プロジェクト全体像、統計
- `database_implementation`: DB実装詳細、ベストプラクティス
- `ui_implementation_patterns`: UIパターン、Recharts実装
- `empty-hanchan-filtering-implementation-2025-10-07`: 既存Playwrightテスト実績

### 外部リソース
- [Playwright公式ドキュメント](https://playwright.dev/)
- [Vitest公式ドキュメント](https://vitest.dev/)
- [Testing Library公式ドキュメント](https://testing-library.com/)
- [fake-indexeddb GitHub](https://github.com/dumbmatter/fakeIndexedDB)

---

## 🔄 次のアクション

### 即座に実行可能
1. **パッケージインストール**: `npm install -D @playwright/test vitest ...`
2. **設定ファイル作成**: `playwright.config.ts`, `vitest.config.ts`
3. **ディレクトリ構成作成**: `tests/unit`, `tests/integration`, `tests/e2e`

### 第1週（Day 1-3）
4. **ユニットテスト実装開始**: `uma-utils.test.ts` から開始
5. **カバレッジ測定**: `npm run test:coverage` で進捗確認

### 第2週（Day 4-7）
6. **統合テスト実装**: DB操作テスト
7. **E2Eテスト開始**: アプリ初期化、ユーザー管理

### 第3週（Day 8-12）
8. **E2Eテスト完成**: 全タブ、エラーハンドリング、パフォーマンス
9. **CI/CD統合**: GitHub Actions設定

---

**総見積時間**: 72-96時間（9-12営業日）
**推奨スケジュール**: 3週間（余裕を持った進行）

**作成者**: Claude Code (AI Assistant)
**レビュー**: 未実施（ユーザーレビュー待ち）
