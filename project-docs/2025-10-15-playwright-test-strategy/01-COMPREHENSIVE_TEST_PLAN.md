# 麻雀アプリ 包括的テスト計画書

**作成日**: 2025-10-15 23:45
**バージョン**: 1.0
**対象**: Phase 7 - テスト・最適化フェーズ

---

## 📋 目次

1. [テスト戦略概要](#テスト戦略概要)
2. [テスト対象の分類](#テスト対象の分類)
3. [ビジネスロジックテスト](#ビジネスロジックテスト)
4. [エッジケース定義](#エッジケース定義)
5. [Playwrightテスト設計](#playwrightテスト設計)
6. [テスト環境構築](#テスト環境構築)
7. [実装ロードマップ](#実装ロードマップ)

---

## テスト戦略概要

### テストピラミッド

```
      /\
     /E2E\         <- Playwright (10-15個)
    /------\
   /Integration\   <- DB連携テスト (15-20個)
  /------------\
 /Unit Tests   \  <- ビジネスロジック (30-40個)
/----------------\
```

### 優先順位

1. **Critical (P0)**: ビジネスロジック、ゼロサム検証、データ整合性
2. **High (P1)**: ユーザーフロー、DB操作、状態管理
3. **Medium (P2)**: UI表示、エラーハンドリング、エッジケース
4. **Low (P3)**: パフォーマンス、アクセシビリティ

---

## テスト対象の分類

### 1. ビジネスロジック層 (Unit Tests)

#### 1.1 ウママーク計算 (`uma-utils.ts`)

**関数**: `umaMarkToValue()`
- **テストケース**:
  - TC-UMA-001: '○○○' → 3
  - TC-UMA-002: '○○' → 2
  - TC-UMA-003: '○' → 1
  - TC-UMA-004: '' → 0
  - TC-UMA-005: '✗' → -1
  - TC-UMA-006: '✗✗' → -2
  - TC-UMA-007: '✗✗✗' → -3
  - TC-UMA-008: 不正値 → 0 (default)

**関数**: `assignUmaMarks()`
- **テストケース**:
  - TC-UMA-010: 4人打ち標準ルール（○○, ○, ✗, ✗✗）
  - TC-UMA-011: 4人打ち2位マイナス（○○○, 無印, ✗, ✗✗）
  - TC-UMA-012: 3人打ち標準ルール（○○, ○, ✗✗✗）
  - TC-UMA-013: 3人打ち2位マイナス（○○○, ✗, ✗✗）
  - TC-UMA-014: 見学者を除外（3人打ち+見学1人）
  - TC-UMA-015: 同点処理（点数同じ場合の着順）

**関数**: `calculateAutoScore()`
- **テストケース**:
  - TC-UMA-020: ゼロサム計算（+30, +10, -40 → 0）
  - TC-UMA-021: 見学者除外（+30, +10, 見学, -40 → 0）
  - TC-UMA-022: 全員未入力 → null
  - TC-UMA-023: 小数点含む計算（+15.5, +10.5, -26.0 → 0）

#### 1.2 収支計算 (`session-utils.ts`)

**関数**: `calculatePayout()`
- **テストケース**:
  - TC-PAY-001: 基本計算（score=30, uma=○○, chip=2, rate=100, umaValue=10, chipRate=500, parlorFee=300）
  - TC-PAY-002: マイナス点数（score=-40, uma=✗✗）
  - TC-PAY-003: ゼロ点（score=0, uma=無印）
  - TC-PAY-004: チップなし（chip=0）
  - TC-PAY-005: 場代なし（parlorFee=0）
  - TC-PAY-006: プレイヤー個別場代（parlorFee=500）
  - TC-PAY-007: 3人打ち2位マイナス（uma=○○○）
  - TC-PAY-008: 極端な値（score=±100, chip=10, parlorFee=1000）

**関数**: `calculateRanks()`
- **テストケース**:
  - TC-RANK-001: 4人打ち通常（+40, +10, -20, -30）
  - TC-RANK-002: 同点処理（+30, +30, -30, -30）
  - TC-RANK-003: 見学者除外（+30, +10, 見学, -40）
  - TC-RANK-004: 3人打ち（+40, 0, -40）
  - TC-RANK-005: 点数null含む（+30, null, -10, -20）

**関数**: `calculateSessionSummary()`
- **テストケース**:
  - TC-SUM-001: 単一半荘セッション
  - TC-SUM-002: 複数半荘セッション（3半荘）
  - TC-SUM-003: 空半荘含む（全員0点半荘をスキップ）
  - TC-SUM-004: 平均着順計算（1位2回、2位1回 → 1.33位）
  - TC-SUM-005: 総合順位計算（4人中2位）
  - TC-SUM-006: メインユーザー不参加半荘含む
  - TC-SUM-007: チップ合計計算

#### 1.3 バリデーション (`db/validation.ts`)

**関数**: `validateZeroSum()`
- **テストケース**:
  - TC-VAL-001: ゼロサム成立（+30, +10, -40 → true）
  - TC-VAL-002: ゼロサム不成立（+30, +10, -30 → false）
  - TC-VAL-003: 誤差許容（+30, +10, -39.99 → true）
  - TC-VAL-004: 見学者除外（+30, 見学, -30 → true）
  - TC-VAL-005: 小数点含む（+15.5, +10.5, -26.0 → true）

**関数**: `validateUmaMarks()`
- **テストケース**:
  - TC-VAL-010: 4人打ち標準（○○, ○, ✗, ✗✗ → 0）
  - TC-VAL-011: 4人打ち2位マイナス（○○○, 無印, ✗, ✗✗ → 0）
  - TC-VAL-012: 3人打ち標準（○○, ○, ✗✗✗ → 0）
  - TC-VAL-013: 不正ウママーク（○○, ○, ○, ✗ → false）
  - TC-VAL-014: 見学者除外（○○, 見学, ✗✗ → 0）

### 2. データベース操作層 (Integration Tests)

#### 2.1 ユーザー管理 (`db/users.ts`)

**関数**: `addUser()`, `updateUser()`, `archiveUser()`, `restoreUser()`
- **テストケース**:
  - TC-DB-USER-001: ユーザー追加（正常系）
  - TC-DB-USER-002: 重複名チェック（許可される）
  - TC-DB-USER-003: 空名前（ValidationError）
  - TC-DB-USER-004: ユーザー更新
  - TC-DB-USER-005: ユーザーアーカイブ（論理削除）
  - TC-DB-USER-006: アーカイブ復元
  - TC-DB-USER-007: getActiveUsers()（アーカイブ除外）
  - TC-DB-USER-008: getArchivedUsers()
  - TC-DB-USER-009: メインユーザー取得（固定ID）
  - TC-DB-USER-010: メインユーザー重複作成防止

#### 2.2 セッション管理 (`db/sessions.ts`)

**関数**: `saveSession()`, `getSessionWithDetails()`, `deleteSession()`
- **テストケース**:
  - TC-DB-SES-001: セッション保存（トランザクション）
  - TC-DB-SES-002: 複数半荘セッション保存
  - TC-DB-SES-003: 空半荘フィルタリング（InputTab→保存）
  - TC-DB-SES-004: セッション詳細取得（session+hanchans+players）
  - TC-DB-SES-005: セッション削除（カスケード削除）
  - TC-DB-SES-006: サマリー事前計算（saveSessionWithSummary）
  - TC-DB-SES-007: 日付フィルタリング
  - TC-DB-SES-008: モードフィルタリング（4人打ち/3人打ち）

#### 2.3 半荘・プレイヤー結果 (`db/hanchans.ts`)

**関数**: `createHanchan()`, `createPlayerResult()`, `getPlayerResultsByHanchan()`
- **テストケース**:
  - TC-DB-HAN-001: 半荘作成
  - TC-DB-HAN-002: プレイヤー結果作成（position順）
  - TC-DB-HAN-003: プレイヤー結果取得（position順ソート）
  - TC-DB-HAN-004: 見学者フラグ処理
  - TC-DB-HAN-005: プレイヤー個別場代保存

### 3. UI層 (E2E Tests with Playwright)

後述の「Playwrightテスト設計」セクションで詳細説明

---

## エッジケース定義

### カテゴリ1: ゼロサム関連

| ID | ケース | 期待動作 |
|----|--------|----------|
| EDGE-001 | 全員0点 | 空半荘として保存前にフィルタリング |
| EDGE-002 | 浮動小数点誤差 | ±0.01以内はゼロサムとみなす |
| EDGE-003 | 見学者含むゼロサム | 見学者を除外して検証 |
| EDGE-004 | 3人打ち+見学1人 | 3人のみでゼロサム検証 |
| EDGE-005 | 点数未入力（null） | 統計から除外、サマリーに含まない |

### カテゴリ2: ウママーク関連

| ID | ケース | 期待動作 |
|----|--------|----------|
| EDGE-010 | 同点時の着順 | 点数降順で着順決定、同点なら前者優先 |
| EDGE-011 | 2位マイナス境界値 | 2位score=-0.01でも2位マイナス発動 |
| EDGE-012 | 手動ウママーク | 自動計算を上書き、合計0検証なし |
| EDGE-013 | 見学者のウママーク | 常に空（''）、計算に含まない |
| EDGE-014 | ウママーク不正値 | フロント側で制限、入力不可 |

### カテゴリ3: セッション・半荘関連

| ID | ケース | 期待動作 |
|----|--------|----------|
| EDGE-020 | 半荘0個セッション | バリデーションエラー、保存不可 |
| EDGE-021 | 有効半荘0個（全て空） | バリデーションエラー、保存不可 |
| EDGE-022 | 中間空半荘 | フィルタリング＋自動採番（1,2,4 → 1,2,3） |
| EDGE-023 | 半荘数上限 | UI制限なし（実用上10-20半荘程度） |
| EDGE-024 | 日付境界（日付変更） | 日付別にセッション分離 |
| EDGE-025 | 同日複数セッション | createdAtタイムスタンプでソート |

### カテゴリ4: ユーザー管理関連

| ID | ケース | 期待動作 |
|----|--------|----------|
| EDGE-030 | メインユーザー削除試行 | UI非表示、削除不可 |
| EDGE-031 | アーカイブ済みユーザー選択 | プレイヤー選択に表示されない |
| EDGE-032 | 仮名入力（userId=null） | 保存可能、統計でplayerNameをキーに集計 |
| EDGE-033 | 未登録ユーザーの総合順位 | playerNameをキーに集計 |
| EDGE-034 | 長いユーザー名 | UI: 20文字程度で省略表示 |
| EDGE-035 | 特殊文字含む名前 | 保存可能（サニタイズ不要、表示のみ） |

### カテゴリ5: 統計・分析関連

| ID | ケース | 期待動作 |
|----|--------|----------|
| EDGE-040 | セッション0件 | 「データなし」表示 |
| EDGE-041 | 期間フィルタ結果0件 | 「該当データなし」表示 |
| EDGE-042 | 選択ユーザー不参加セッション | 3層フィルター（期間→モード→参加）で除外 |
| EDGE-043 | 平均着順NaN | totalHanchans=0の場合、0表示 |
| EDGE-044 | 総合順位0 | メインユーザー不参加の場合、順位なし表示 |
| EDGE-045 | 累積収支モード | y=0参照線表示、マイナス転落明示 |

### カテゴリ6: UI/UX関連

| ID | ケース | 期待動作 |
|----|--------|----------|
| EDGE-050 | タブ切り替え（状態保持） | InputTab/HistoryTab: 状態保持、Analysis/Settings: リセット |
| EDGE-051 | 長時間放置後の操作 | IndexedDB接続維持、操作可能 |
| EDGE-052 | オフライン状態 | 全機能動作（ローカルDBのみ） |
| EDGE-053 | iOS safe-area | 下部タブとコンテンツが重ならない |
| EDGE-054 | 横画面回転 | レイアウト崩れなし |
| EDGE-055 | ダークモード切替 | 準備中（Phase 7以降） |

### カテゴリ7: パフォーマンス関連

| ID | ケース | 期待動作 |
|----|--------|----------|
| EDGE-060 | 大量セッション（100件） | サマリー事前計算で高速表示（<100ms） |
| EDGE-061 | 大量半荘（50半荘） | InputTab: スクロール対応、保存<500ms |
| EDGE-062 | 分析タブ大量データ | グラフ描画<300ms、統計計算<100ms |
| EDGE-063 | IndexedDB容量上限 | 実用上問題なし（1年分で<10MB） |

### カテゴリ8: エラーハンドリング関連

| ID | ケース | 期待動作 |
|----|--------|----------|
| EDGE-070 | DB初期化失敗 | エラー画面表示、リロード促進 |
| EDGE-071 | トランザクション失敗 | ロールバック、エラートースト表示 |
| EDGE-072 | 不正なセッションデータ | ValidationError、保存ブロック |
| EDGE-073 | ネットワークエラー（Capacitor） | ローカルDB動作継続 |
| EDGE-074 | 予期しないエラー | ErrorBoundary catch、エラーログ記録 |

---

## Playwrightテスト設計

### テスト環境構成

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13 Pro'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### テストケースカテゴリ

#### 1. アプリ初期化テスト

**TC-E2E-001: アプリ起動と初期化**
```typescript
test('アプリ起動時にメインユーザーが作成される', async ({ page }) => {
  await page.goto('/');

  // 初期化完了を待機
  await expect(page.locator('text=初期化中')).toHaveCount(0, { timeout: 5000 });

  // 新規入力タブが表示される
  await expect(page.locator('[data-testid="input-tab"]')).toBeVisible();

  // メインユーザーが存在する（設定タブで確認）
  await page.click('button:has-text("設定")');
  await expect(page.locator('text=自分')).toBeVisible();
});
```

**TC-E2E-002: IndexedDB初期化確認**
```typescript
test('IndexedDBが正しく初期化される', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // IndexedDBの存在確認
  const dbExists = await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    return dbs.some(db => db.name === 'MahjongDB');
  });

  expect(dbExists).toBe(true);
});
```

#### 2. ユーザー管理テスト

**TC-E2E-010: 新規ユーザー登録**
```typescript
test('新規ユーザーを登録できる', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("設定")');

  // 新規登録ボタンクリック
  await page.click('button:has-text("新規登録")');

  // ダイアログ表示確認
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // ユーザー名入力
  await page.fill('input[placeholder*="名前"]', 'テストユーザー1');
  await page.click('button:has-text("保存")');

  // ユーザーリストに追加確認
  await expect(page.locator('text=テストユーザー1')).toBeVisible();
});
```

**TC-E2E-011: ユーザーアーカイブ**
```typescript
test('ユーザーをアーカイブできる', async ({ page }) => {
  // 前提: テストユーザー1が登録済み
  await page.goto('/');
  await page.click('button:has-text("設定")');

  // アーカイブボタンクリック
  await page.click('button[aria-label="テストユーザー1をアーカイブ"]');

  // 確認ダイアログ
  await page.click('button:has-text("アーカイブ")');

  // アクティブリストから消える
  await expect(page.locator('text=テストユーザー1')).toHaveCount(0);

  // アーカイブタブに移動
  await page.click('button:has-text("アーカイブ済み")');
  await expect(page.locator('text=テストユーザー1')).toBeVisible();
});
```

**TC-E2E-012: ユーザー復元**
```typescript
test('アーカイブ済みユーザーを復元できる', async ({ page }) => {
  // 前提: テストユーザー1がアーカイブ済み
  await page.goto('/');
  await page.click('button:has-text("設定")');
  await page.click('button:has-text("アーカイブ済み")');

  // 復元ボタンクリック
  await page.click('button[aria-label="テストユーザー1を復元"]');

  // アクティブタブに戻る
  await page.click('button:has-text("アクティブ")');
  await expect(page.locator('text=テストユーザー1')).toBeVisible();
});
```

#### 3. 新規入力タブテスト

**TC-E2E-020: 基本的なセッション入力（4人打ち）**
```typescript
test('4人打ちセッションを入力・保存できる', async ({ page }) => {
  await page.goto('/');

  // モード選択
  await page.click('button:has-text("4人打ち")');

  // プレイヤー選択
  await page.selectOption('[data-testid="player-select-0"]', '自分');
  await page.selectOption('[data-testid="player-select-1"]', 'テストユーザー1');
  await page.selectOption('[data-testid="player-select-2"]', 'temp'); // 仮名入力
  await page.fill('[data-testid="temp-name-2"]', '一時ユーザーA');
  await page.selectOption('[data-testid="player-select-3"]', 'temp');
  await page.fill('[data-testid="temp-name-3"]', '一時ユーザーB');

  // 点数入力（半荘1）
  await page.fill('[data-testid="score-input-0-0"]', '40');
  await page.fill('[data-testid="score-input-1-0"]', '10');
  await page.fill('[data-testid="score-input-2-0"]', '-20');
  // score-input-3-0は自動計算される（-30）

  // ウママーク確認（自動割り当て）
  await expect(page.locator('[data-testid="uma-mark-0-0"]')).toHaveText('○○');
  await expect(page.locator('[data-testid="uma-mark-1-0"]')).toHaveText('○');
  await expect(page.locator('[data-testid="uma-mark-2-0"]')).toHaveText('✗');
  await expect(page.locator('[data-testid="uma-mark-3-0"]')).toHaveText('✗✗');

  // 保存
  await page.click('button:has-text("保存")');

  // トースト通知確認
  await expect(page.locator('text=保存しました')).toBeVisible();

  // 履歴タブに自動遷移
  await expect(page.locator('[data-testid="history-tab"]')).toBeVisible();
});
```

**TC-E2E-021: 複数半荘入力**
```typescript
test('複数半荘を入力できる', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("4人打ち")');

  // プレイヤー選択（省略）

  // 半荘1入力
  await page.fill('[data-testid="score-input-0-0"]', '30');
  await page.fill('[data-testid="score-input-1-0"]', '10');
  await page.fill('[data-testid="score-input-2-0"]', '-40');

  // 半荘追加
  await page.click('button:has-text("半荘を追加")');

  // 半荘2入力
  await page.fill('[data-testid="score-input-0-1"]', '-10');
  await page.fill('[data-testid="score-input-1-1"]', '20');
  await page.fill('[data-testid="score-input-2-1"]', '-10');

  // 保存
  await page.click('button:has-text("保存")');

  // 履歴で2半荘確認
  await expect(page.locator('text=4人打ち | 2半荘')).toBeVisible();
});
```

**TC-E2E-022: 空半荘フィルタリング**
```typescript
test('空半荘が自動的にフィルタリングされる', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("4人打ち")');

  // プレイヤー選択（省略）

  // 半荘1: 有効
  await page.fill('[data-testid="score-input-0-0"]', '30');
  await page.fill('[data-testid="score-input-1-0"]', '10');
  await page.fill('[data-testid="score-input-2-0"]', '-40');

  // 半荘2: 空（全員0点）
  await page.click('button:has-text("半荘を追加")');
  // 点数入力せず

  // 半荘3: 有効
  await page.click('button:has-text("半荘を追加")');
  await page.fill('[data-testid="score-input-0-2"]', '20');
  await page.fill('[data-testid="score-input-1-2"]', '-10');
  await page.fill('[data-testid="score-input-2-2"]', '-10');

  // 保存
  await page.click('button:has-text("保存")');

  // 履歴で2半荘確認（空半荘除外）
  await expect(page.locator('text=4人打ち | 2半荘')).toBeVisible();

  // セッション詳細確認
  await page.click('[data-testid="session-item-0"]');
  await expect(page.locator('text=半荘1')).toBeVisible();
  await expect(page.locator('text=半荘2')).toBeVisible();
  await expect(page.locator('text=半荘3')).toHaveCount(0); // 元の半荘3（空）は保存されない
});
```

**TC-E2E-023: ゼロサム自動計算**
```typescript
test('最後のプレイヤー点数が自動計算される', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("4人打ち")');

  // プレイヤー選択（省略）

  // 3人分の点数入力
  await page.fill('[data-testid="score-input-0-0"]', '35');
  await page.fill('[data-testid="score-input-1-0"]', '15');
  await page.fill('[data-testid="score-input-2-0"]', '-25');

  // 4人目は自動計算される
  const autoScore = await page.locator('[data-testid="score-input-3-0"]').inputValue();
  expect(autoScore).toBe('-25'); // -(35+15-25) = -25
});
```

**TC-E2E-024: チップ入力**
```typescript
test('チップを入力できる', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("4人打ち")');

  // プレイヤー選択・点数入力（省略）

  // チップ入力
  await page.fill('[data-testid="chips-input-0-0"]', '3');
  await page.fill('[data-testid="chips-input-1-0"]', '1');
  await page.fill('[data-testid="chips-input-2-0"]', '-2');
  await page.fill('[data-testid="chips-input-3-0"]', '-2');

  // トータルパネルでチップ収支確認
  const chipRevenue = await page.locator('[data-testid="total-chip-revenue"]').textContent();
  expect(chipRevenue).toContain('1500'); // 3チップ×500円/チップ
});
```

**TC-E2E-025: プレイヤー個別場代**
```typescript
test('プレイヤー個別場代を設定できる', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("4人打ち")');

  // プレイヤー選択・点数入力（省略）

  // プレイヤー個別場代入力
  await page.fill('[data-testid="parlor-fee-input-0-0"]', '300');
  await page.fill('[data-testid="parlor-fee-input-1-0"]', '300');
  await page.fill('[data-testid="parlor-fee-input-2-0"]', '0'); // 場代なし
  await page.fill('[data-testid="parlor-fee-input-3-0"]', '300');

  // トータルパネルで場代反映確認
  const finalRevenue = await page.locator('[data-testid="total-final-revenue"]').textContent();
  // 計算: (点数+ウマ)×レート + チップ - 場代300
  // 例: (40+20)×100 + 0 - 300 = 5700
  expect(finalRevenue).not.toBe('6000'); // 場代なしの場合
});
```

**TC-E2E-026: 見学者設定**
```typescript
test('見学者を設定できる', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("4人打ち")');

  // プレイヤー選択（省略）

  // プレイヤー3を見学者に設定
  await page.click('[data-testid="spectator-checkbox-2-0"]');

  // 見学者の点数・ウママーク入力欄が無効化
  await expect(page.locator('[data-testid="score-input-2-0"]')).toBeDisabled();
  await expect(page.locator('[data-testid="uma-mark-button-2-0"]')).toBeDisabled();

  // 3人でゼロサム（見学者除く）
  await page.fill('[data-testid="score-input-0-0"]', '30');
  await page.fill('[data-testid="score-input-1-0"]', '10');
  await page.fill('[data-testid="score-input-3-0"]', '-40');

  // 保存可能
  await page.click('button:has-text("保存")');
  await expect(page.locator('text=保存しました')).toBeVisible();
});
```

**TC-E2E-027: 手動ウママーク変更**
```typescript
test('ウママークを手動変更できる', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("4人打ち")');

  // プレイヤー選択・点数入力（省略、自動ウママーク割り当て）

  // 初期状態確認（○○）
  await expect(page.locator('[data-testid="uma-mark-0-0"]')).toHaveText('○○');

  // ウママークボタンクリック
  await page.click('[data-testid="uma-mark-button-0-0"]');

  // ○○○に変更
  await page.click('button:has-text("○○○")');

  // 変更確認
  await expect(page.locator('[data-testid="uma-mark-0-0"]')).toHaveText('○○○');

  // トータルパネルで収支再計算確認
  const finalRevenue = await page.locator('[data-testid="total-final-revenue"]').textContent();
  // ○○→○○○でウマ+1000（umaValue=10, rate=100の場合）
});
```

**TC-E2E-028: セッション設定変更**
```typescript
test('セッション設定を変更できる', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("4人打ち")');

  // セッション設定展開
  await page.click('[data-testid="session-settings-toggle"]');

  // レート変更
  await page.fill('[data-testid="rate-input"]', '200');

  // ウマ値変更
  await page.fill('[data-testid="uma-value-input"]', '20');

  // チップレート変更
  await page.fill('[data-testid="chip-rate-input"]', '1000');

  // セッション場代変更
  await page.fill('[data-testid="parlor-fee-input"]', '500');

  // 2位マイナスルール選択
  await page.selectOption('[data-testid="uma-rule-select"]', 'second-minus');

  // トータルパネルで反映確認（省略）

  // 保存後、履歴で設定確認
  // プレイヤー選択・点数入力（省略）
  await page.click('button:has-text("保存")');

  await page.click('[data-testid="session-item-0"]');
  await expect(page.locator('text=レート: 200')).toBeVisible();
  await expect(page.locator('text=ウマ: 20')).toBeVisible();
});
```

#### 4. 履歴タブテスト

**TC-E2E-040: セッション一覧表示**
```typescript
test('セッション一覧が表示される', async ({ page }) => {
  // 前提: 複数セッション保存済み
  await page.goto('/');
  await page.click('button:has-text("履歴")');

  // セッション一覧表示確認
  await expect(page.locator('[data-testid="session-item"]')).toHaveCount(3); // 3セッション

  // 各セッション情報確認
  await expect(page.locator('text=4人打ち | 2半荘')).toBeVisible();
  await expect(page.locator('text=総収支: +3300')).toBeVisible();
  await expect(page.locator('text=平均: 1.50位')).toBeVisible();
  await expect(page.locator('text=総合: 2位')).toBeVisible();
});
```

**TC-E2E-041: セッション詳細表示**
```typescript
test('セッション詳細が表示される', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("履歴")');

  // 最初のセッションクリック
  await page.click('[data-testid="session-item-0"]');

  // ダイアログ表示確認
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // セッション情報確認
  await expect(page.locator('text=2025-10-15')).toBeVisible();
  await expect(page.locator('text=4人打ち')).toBeVisible();
  await expect(page.locator('text=レート: 100')).toBeVisible();

  // 半荘詳細確認
  await expect(page.locator('text=半荘1')).toBeVisible();
  await expect(page.locator('text=半荘2')).toBeVisible();

  // プレイヤー結果確認（テーブル形式）
  await expect(page.locator('text=自分')).toBeVisible();
  await expect(page.locator('text=+40')).toBeVisible(); // 点数
  await expect(page.locator('text=○○')).toBeVisible(); // ウママーク
  await expect(page.locator('text=+6000')).toBeVisible(); // 収支
});
```

**TC-E2E-042: セッション削除**
```typescript
test('セッションを削除できる', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("履歴")');

  const initialCount = await page.locator('[data-testid="session-item"]').count();

  // 削除ボタンクリック
  await page.click('[data-testid="delete-session-button-0"]');

  // 確認ダイアログ
  await page.click('button:has-text("削除")');

  // トースト通知確認
  await expect(page.locator('text=削除しました')).toBeVisible();

  // セッション数減少確認
  await expect(page.locator('[data-testid="session-item"]')).toHaveCount(initialCount - 1);
});
```

**TC-E2E-043: セッション編集**
```typescript
test('セッションを編集できる', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("履歴")');

  // セッション詳細を開く
  await page.click('[data-testid="session-item-0"]');

  // 編集ボタンクリック
  await page.click('button:has-text("編集")');

  // 新規入力タブに遷移、データがロード済み
  await expect(page.locator('[data-testid="input-tab"]')).toBeVisible();
  await expect(page.locator('[data-testid="score-input-0-0"]')).toHaveValue('40');

  // 点数修正
  await page.fill('[data-testid="score-input-0-0"]', '50');

  // 保存
  await page.click('button:has-text("更新")');

  // 履歴で反映確認
  await page.click('[data-testid="session-item-0"]');
  await expect(page.locator('text=+50')).toBeVisible();
});
```

#### 5. 分析タブテスト

**TC-E2E-050: 統計カード表示**
```typescript
test('統計カードが正しく表示される', async ({ page }) => {
  // 前提: 複数セッション保存済み
  await page.goto('/');
  await page.click('button:has-text("分析")');

  // 統計カード表示確認
  await expect(page.locator('[data-testid="total-hanchans"]')).toContainText('6'); // 6半荘
  await expect(page.locator('[data-testid="total-revenue"]')).toContainText('+9300'); // 総収支
  await expect(page.locator('[data-testid="average-rank"]')).toContainText('1.67'); // 平均着順

  // 着順内訳
  await expect(page.locator('[data-testid="rank-count-1"]')).toContainText('3'); // 1位3回
  await expect(page.locator('[data-testid="rank-count-2"]')).toContainText('2'); // 2位2回
  await expect(page.locator('[data-testid="rank-count-3"]')).toContainText('1'); // 3位1回
});
```

**TC-E2E-051: 着順統計グラフ**
```typescript
test('着順統計グラフが表示される', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("分析")');

  // Rechartsグラフ表示確認
  await expect(page.locator('[data-testid="rank-statistics-chart"]')).toBeVisible();

  // 横棒グラフ（BarChart layout="vertical"）
  await expect(page.locator('svg .recharts-bar')).toHaveCount(4); // 4つの棒（1-4位）

  // データラベル確認
  await expect(page.locator('text=1位')).toBeVisible();
  await expect(page.locator('text=50%')).toBeVisible(); // 3/6 = 50%
});
```

**TC-E2E-052: 収支推移グラフ**
```typescript
test('収支推移グラフが表示される', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("分析")');

  // 収支推移グラフ表示確認
  await expect(page.locator('[data-testid="revenue-timeline-chart"]')).toBeVisible();

  // 折れ線グラフ（LineChart）
  await expect(page.locator('svg .recharts-line')).toBeVisible();

  // 個別モード（デフォルト）
  await expect(page.locator('text=+3300')).toBeVisible(); // セッション1

  // 累積モード切替
  await page.click('button:has-text("累積")');

  // y=0参照線表示
  await expect(page.locator('svg .recharts-reference-line')).toBeVisible();

  // 累積値表示
  await expect(page.locator('text=+9300')).toBeVisible(); // 累積総収支
});
```

**TC-E2E-053: 期間フィルタリング**
```typescript
test('期間でフィルタリングできる', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("分析")');

  // 初期状態: 全期間
  const initialHanchans = await page.locator('[data-testid="total-hanchans"]').textContent();

  // 期間フィルタ変更: 今月
  await page.selectOption('[data-testid="period-filter"]', 'this-month');

  // 統計更新確認
  const filteredHanchans = await page.locator('[data-testid="total-hanchans"]').textContent();
  expect(filteredHanchans).not.toBe(initialHanchans);

  // グラフも更新される
  await expect(page.locator('[data-testid="rank-statistics-chart"]')).toBeVisible();
});
```

**TC-E2E-054: モードフィルタリング**
```typescript
test('モードでフィルタリングできる', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("分析")');

  // 初期状態: 全モード
  await expect(page.locator('[data-testid="total-hanchans"]')).toContainText('6');

  // モードフィルタ変更: 4人打ちのみ
  await page.selectOption('[data-testid="mode-filter"]', '4-player');

  // 統計更新（4人打ちのみ）
  await expect(page.locator('[data-testid="total-hanchans"]')).toContainText('4');

  // モードフィルタ変更: 3人打ちのみ
  await page.selectOption('[data-testid="mode-filter"]', '3-player');

  // 統計更新（3人打ちのみ）
  await expect(page.locator('[data-testid="total-hanchans"]')).toContainText('2');
});
```

**TC-E2E-055: ユーザーフィルタリング**
```typescript
test('ユーザーでフィルタリングできる', async ({ page }) => {
  // 前提: テストユーザー1が複数セッションに参加
  await page.goto('/');
  await page.click('button:has-text("分析")');

  // 初期状態: メインユーザー
  await expect(page.locator('[data-testid="total-hanchans"]')).toContainText('6');

  // ユーザーフィルタ変更: テストユーザー1
  await page.selectOption('[data-testid="user-filter"]', 'test-user-1-id');

  // 統計更新（テストユーザー1参加セッションのみ）
  await expect(page.locator('[data-testid="total-hanchans"]')).toContainText('3');

  // 不参加セッションは除外される
  // Phase 5-7で修正済み（3層フィルター）
});
```

**TC-E2E-056: データなし状態**
```typescript
test('データなし状態が正しく表示される', async ({ page }) => {
  // 前提: セッションが1件もない状態
  await page.goto('/');
  await page.click('button:has-text("分析")');

  // データなしメッセージ
  await expect(page.locator('text=データがありません')).toBeVisible();

  // グラフ非表示
  await expect(page.locator('[data-testid="rank-statistics-chart"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="revenue-timeline-chart"]')).toHaveCount(0);
});
```

#### 6. 設定タブテスト

**TC-E2E-060: ユーザー一覧表示**
```typescript
test('アクティブユーザー一覧が表示される', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("設定")');

  // アクティブユーザータブ（デフォルト）
  await expect(page.locator('[data-testid="active-users-tab"]')).toBeVisible();

  // メインユーザー表示
  await expect(page.locator('text=自分')).toBeVisible();
  await expect(page.locator('text=(メイン)')).toBeVisible();

  // 登録ユーザー表示
  await expect(page.locator('text=テストユーザー1')).toBeVisible();

  // アクションボタン確認
  await expect(page.locator('button[aria-label*="編集"]')).toHaveCount(2); // 2人分
  await expect(page.locator('button[aria-label*="アーカイブ"]')).toHaveCount(1); // メイン除く
});
```

**TC-E2E-061: ユーザー編集**
```typescript
test('ユーザー名を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("設定")');

  // 編集ボタンクリック
  await page.click('button[aria-label="テストユーザー1を編集"]');

  // ダイアログ表示
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await expect(page.locator('input[value="テストユーザー1"]')).toBeVisible();

  // 名前変更
  await page.fill('input[placeholder*="名前"]', 'テストユーザー1（編集済み）');
  await page.click('button:has-text("保存")');

  // 一覧で反映確認
  await expect(page.locator('text=テストユーザー1（編集済み）')).toBeVisible();
});
```

**TC-E2E-062: メインユーザー編集**
```typescript
test('メインユーザー名を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("設定")');

  // メインユーザー編集ボタンクリック
  await page.click('button[aria-label="自分を編集"]');

  // 名前変更
  await page.fill('input[placeholder*="名前"]', 'プレイヤーA');
  await page.click('button:has-text("保存")');

  // 一覧で反映確認
  await expect(page.locator('text=プレイヤーA')).toBeVisible();
  await expect(page.locator('text=(メイン)')).toBeVisible();

  // 新規入力タブで反映確認
  await page.click('button:has-text("新規入力")');
  await page.click('button:has-text("4人打ち")');
  await expect(page.locator('[data-testid="player-select-0"] option[selected]')).toHaveText('プレイヤーA');
});
```

**TC-E2E-063: アーカイブ済みタブ切替**
```typescript
test('アーカイブ済みタブに切り替えられる', async ({ page }) => {
  // 前提: テストユーザー2がアーカイブ済み
  await page.goto('/');
  await page.click('button:has-text("設定")');

  // アーカイブ済みタブクリック
  await page.click('button:has-text("アーカイブ済み")');

  // アーカイブ済みユーザー表示
  await expect(page.locator('text=テストユーザー2')).toBeVisible();

  // 復元ボタン確認
  await expect(page.locator('button[aria-label*="復元"]')).toBeVisible();

  // アクティブタブに戻る
  await page.click('button:has-text("アクティブ")');
  await expect(page.locator('text=テストユーザー2')).toHaveCount(0);
});
```

#### 7. クロスタブ統合テスト

**TC-E2E-070: 新規入力→履歴→分析フロー**
```typescript
test('新規入力から履歴・分析まで一貫して動作する', async ({ page }) => {
  await page.goto('/');

  // 1. 新規入力タブでセッション入力
  await page.click('button:has-text("4人打ち")');
  // プレイヤー選択・点数入力（省略）
  await page.click('button:has-text("保存")');

  // 2. 履歴タブに自動遷移
  await expect(page.locator('[data-testid="history-tab"]')).toBeVisible();
  await expect(page.locator('[data-testid="session-item-0"]')).toBeVisible();

  // 3. セッション詳細確認
  await page.click('[data-testid="session-item-0"]');
  await expect(page.locator('text=半荘1')).toBeVisible();
  await page.click('button:has-text("閉じる")');

  // 4. 分析タブで統計確認
  await page.click('button:has-text("分析")');
  await expect(page.locator('[data-testid="total-hanchans"]')).toContainText('1');
  await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible();
  await expect(page.locator('[data-testid="rank-statistics-chart"]')).toBeVisible();
});
```

**TC-E2E-071: ユーザー登録→入力→統計確認**
```typescript
test('ユーザー登録後すぐに使用できる', async ({ page }) => {
  await page.goto('/');

  // 1. 設定タブで新規ユーザー登録
  await page.click('button:has-text("設定")');
  await page.click('button:has-text("新規登録")');
  await page.fill('input[placeholder*="名前"]', 'テストユーザーZ');
  await page.click('button:has-text("保存")');

  // 2. 新規入力タブでセッション入力
  await page.click('button:has-text("新規入力")');
  await page.click('button:has-text("4人打ち")');

  // プレイヤー選択: 新規登録したユーザーが選択肢にある
  await expect(page.locator('[data-testid="player-select-1"] option:has-text("テストユーザーZ")')).toBeVisible();
  await page.selectOption('[data-testid="player-select-1"]', 'test-user-z-id');

  // 点数入力・保存（省略）

  // 3. 分析タブでユーザーフィルタに登場
  await page.click('button:has-text("分析")');
  await expect(page.locator('[data-testid="user-filter"] option:has-text("テストユーザーZ")')).toBeVisible();
});
```

**TC-E2E-072: アーカイブ→プレイヤー選択に非表示**
```typescript
test('アーカイブ済みユーザーは選択できない', async ({ page }) => {
  await page.goto('/');

  // 1. 設定タブでユーザーアーカイブ
  await page.click('button:has-text("設定")');
  await page.click('button[aria-label="テストユーザー1をアーカイブ"]');
  await page.click('button:has-text("アーカイブ")');

  // 2. 新規入力タブでプレイヤー選択
  await page.click('button:has-text("新規入力")');
  await page.click('button:has-text("4人打ち")');

  // アーカイブ済みユーザーは選択肢にない
  await expect(page.locator('[data-testid="player-select-1"] option:has-text("テストユーザー1")')).toHaveCount(0);
});
```

#### 8. エラーハンドリングテスト

**TC-E2E-080: バリデーションエラー（空半荘のみ）**
```typescript
test('空半荘のみの場合、バリデーションエラーが表示される', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("4人打ち")');

  // プレイヤー選択のみ、点数入力なし
  await page.selectOption('[data-testid="player-select-0"]', '自分');
  await page.selectOption('[data-testid="player-select-1"]', 'test-user-1-id');
  await page.selectOption('[data-testid="player-select-2"]', 'temp');
  await page.selectOption('[data-testid="player-select-3"]', 'temp');

  // 保存試行
  await page.click('button:has-text("保存")');

  // エラートースト表示
  await expect(page.locator('text=点数が入力されていません')).toBeVisible();

  // 履歴タブに遷移しない
  await expect(page.locator('[data-testid="input-tab"]')).toBeVisible();
});
```

**TC-E2E-081: ゼロサムエラー（手動入力時）**
```typescript
test('ゼロサムが崩れている場合、エラーが表示される', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("4人打ち")');

  // プレイヤー選択（省略）

  // 4人全員に手動で点数入力（ゼロサム崩れ）
  await page.fill('[data-testid="score-input-0-0"]', '30');
  await page.fill('[data-testid="score-input-1-0"]', '10');
  await page.fill('[data-testid="score-input-2-0"]', '-20');
  await page.fill('[data-testid="score-input-3-0"]', '-10'); // 本来は-20

  // 保存試行
  await page.click('button:has-text("保存")');

  // ゼロサムエラー表示
  await expect(page.locator('text=点数合計が0になりません')).toBeVisible();
});
```

**TC-E2E-082: ネットワークエラー（IndexedDB失敗）**
```typescript
test('IndexedDBエラー時にエラー画面が表示される', async ({ page, context }) => {
  // IndexedDBを無効化（モック）
  await context.addInitScript(() => {
    // @ts-ignore
    window.indexedDB.open = () => {
      throw new Error('IndexedDB disabled');
    };
  });

  await page.goto('/');

  // エラー画面表示
  await expect(page.locator('text=エラーが発生しました')).toBeVisible();
  await expect(page.locator('text=初期化エラー')).toBeVisible();
});
```

**TC-E2E-083: ErrorBoundaryキャッチ**
```typescript
test('予期しないエラーをErrorBoundaryがキャッチする', async ({ page }) => {
  // 意図的にエラーを発生させる（例: 不正なデータを挿入）
  await page.goto('/');

  // ローカルストレージに不正なデータ挿入
  await page.evaluate(() => {
    localStorage.setItem('test-error-trigger', 'true');
  });

  // ページリロード
  await page.reload();

  // ErrorBoundary表示（実装次第）
  // await expect(page.locator('text=エラーが発生しました')).toBeVisible();
  // await expect(page.locator('button:has-text("リロード")')).toBeVisible();
});
```

#### 9. パフォーマンステスト

**TC-E2E-090: 大量セッション読み込み**
```typescript
test('100件のセッションでも快適に動作する', async ({ page }) => {
  // 前提: 100件のセッションを事前作成（フィクスチャー）

  await page.goto('/');
  await page.click('button:has-text("履歴")');

  // 読み込み時間計測
  const startTime = Date.now();
  await page.waitForSelector('[data-testid="session-item"]', { timeout: 5000 });
  const loadTime = Date.now() - startTime;

  // 100ms以内に表示（サマリー事前計算の効果）
  expect(loadTime).toBeLessThan(100);

  // スクロール動作確認
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });

  // 最後のセッション表示
  await expect(page.locator('[data-testid="session-item-99"]')).toBeVisible();
});
```

**TC-E2E-091: 分析タブグラフ描画速度**
```typescript
test('分析タブのグラフが300ms以内に描画される', async ({ page }) => {
  // 前提: 50件のセッション

  await page.goto('/');
  await page.click('button:has-text("分析")');

  // グラフ描画時間計測
  const startTime = Date.now();
  await page.waitForSelector('[data-testid="rank-statistics-chart"] svg', { timeout: 5000 });
  const renderTime = Date.now() - startTime;

  // 300ms以内に描画
  expect(renderTime).toBeLessThan(300);

  // 折れ線グラフも確認
  await expect(page.locator('[data-testid="revenue-timeline-chart"] svg')).toBeVisible();
});
```

#### 10. iOS対応テスト

**TC-E2E-100: iOS safe-area表示**
```typescript
test('iOSデバイスでsafe-areaが正しく適用される', async ({ page, context }) => {
  // iPhone 13 Proデバイスエミュレーション
  const device = devices['iPhone 13 Pro'];
  const iosPage = await context.newPage({
    ...device,
  });

  await iosPage.goto('/');

  // タブナビゲーションが下部safe-area内に表示
  const tabsList = await iosPage.locator('.bottom-tab-nav');
  const tabsBottom = await tabsList.evaluate((el) => {
    return window.getComputedStyle(el).paddingBottom;
  });

  // safe-area-inset-bottom が適用されている
  expect(tabsBottom).not.toBe('0px');

  // コンテンツがタブナビゲーションと重ならない
  const content = await iosPage.locator('[data-testid="input-tab"]');
  const contentPaddingBottom = await content.evaluate((el) => {
    return window.getComputedStyle(el).paddingBottom;
  });

  expect(contentPaddingBottom).toContain('rem'); // pb-tab-safe適用
});
```

**TC-E2E-101: タッチ操作**
```typescript
test('タッチ操作が正しく動作する', async ({ page }) => {
  // モバイルデバイス設定
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');

  // タッチでボタンクリック
  await page.locator('button:has-text("4人打ち")').tap();

  // タッチでプレイヤー選択
  await page.locator('[data-testid="player-select-0"]').tap();

  // スワイプ（スクロール）
  await page.evaluate(() => {
    window.scrollBy(0, 300);
  });

  // ピンチズーム無効化確認（meta viewport設定）
  const viewport = await page.evaluate(() => {
    return document.querySelector('meta[name="viewport"]')?.getAttribute('content');
  });

  expect(viewport).toContain('user-scalable=no');
});
```

---

## テスト環境構築

### 必要パッケージのインストール

```bash
cd /Users/nishimototakashi/claude_code/mj_app/app

# Playwrightインストール
npm install -D @playwright/test

# ブラウザインストール
npx playwright install

# Vitest（ユニットテスト用）
npm install -D vitest @vitest/ui

# Testing Library（Reactコンポーネントテスト用）
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event

# fake-indexeddb（モック用）
npm install -D fake-indexeddb
```

### ディレクトリ構成

```
app/
├── tests/
│   ├── unit/                    # ユニットテスト
│   │   ├── uma-utils.test.ts
│   │   ├── session-utils.test.ts
│   │   ├── validation.test.ts
│   │   └── ...
│   ├── integration/             # 統合テスト
│   │   ├── db-users.test.ts
│   │   ├── db-sessions.test.ts
│   │   └── ...
│   ├── e2e/                     # E2Eテスト
│   │   ├── app-initialization.spec.ts
│   │   ├── user-management.spec.ts
│   │   ├── input-tab.spec.ts
│   │   ├── history-tab.spec.ts
│   │   ├── analysis-tab.spec.ts
│   │   ├── settings-tab.spec.ts
│   │   ├── cross-tab.spec.ts
│   │   ├── error-handling.spec.ts
│   │   ├── performance.spec.ts
│   │   └── ios-support.spec.ts
│   ├── fixtures/                # テストデータ
│   │   ├── users.ts
│   │   ├── sessions.ts
│   │   └── ...
│   └── helpers/                 # テストヘルパー
│       ├── db-setup.ts
│       ├── page-objects/
│       └── ...
├── playwright.config.ts
└── vitest.config.ts
```

### 設定ファイル

**playwright.config.ts**
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

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

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

**vitest.config.ts**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.ts',
        '**/ui/**', // shadcn/uiコンポーネント除外
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**tests/setup.ts**
```typescript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// 各テスト後にクリーンアップ
afterEach(() => {
  cleanup();
});
```

### Page Objectパターン

**tests/helpers/page-objects/InputTabPage.ts**
```typescript
import { Page, Locator } from '@playwright/test';

export class InputTabPage {
  readonly page: Page;
  readonly mode4PlayerButton: Locator;
  readonly mode3PlayerButton: Locator;
  readonly saveButton: Locator;
  readonly addHanchanButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mode4PlayerButton = page.locator('button:has-text("4人打ち")');
    this.mode3PlayerButton = page.locator('button:has-text("3人打ち")');
    this.saveButton = page.locator('button:has-text("保存")');
    this.addHanchanButton = page.locator('button:has-text("半荘を追加")');
  }

  async selectMode(mode: '4-player' | '3-player') {
    if (mode === '4-player') {
      await this.mode4PlayerButton.click();
    } else {
      await this.mode3PlayerButton.click();
    }
  }

  async selectPlayer(column: number, userId: string) {
    await this.page.selectOption(`[data-testid="player-select-${column}"]`, userId);
  }

  async enterScore(column: number, hanchan: number, score: string) {
    await this.page.fill(`[data-testid="score-input-${column}-${hanchan}"]`, score);
  }

  async enterChips(column: number, hanchan: number, chips: string) {
    await this.page.fill(`[data-testid="chips-input-${column}-${hanchan}"]`, chips);
  }

  async save() {
    await this.saveButton.click();
  }

  async addHanchan() {
    await this.addHanchanButton.click();
  }
}
```

### テストデータフィクスチャー

**tests/fixtures/sessions.ts**
```typescript
import type { SessionSaveData } from '@/lib/db-utils';

export const create4PlayerSession = (): SessionSaveData => ({
  date: '2025-10-15',
  mode: '4-player',
  rate: 100,
  umaValue: 10,
  chipRate: 500,
  parlorFee: 300,
  umaRule: 'standard',
  hanchans: [
    {
      hanchanNumber: 1,
      autoCalculated: true,
      players: [
        {
          playerName: '自分',
          userId: 'main-user-fixed-id',
          score: 40,
          umaMark: '○○',
          chips: 0,
          parlorFee: 300,
          isSpectator: false,
          position: 0,
        },
        {
          playerName: 'テストユーザー1',
          userId: 'test-user-1-id',
          score: 10,
          umaMark: '○',
          chips: 0,
          parlorFee: 300,
          isSpectator: false,
          position: 1,
        },
        {
          playerName: '一時ユーザーA',
          userId: null,
          score: -20,
          umaMark: '✗',
          chips: 0,
          parlorFee: 0,
          isSpectator: false,
          position: 2,
        },
        {
          playerName: '一時ユーザーB',
          userId: null,
          score: -30,
          umaMark: '✗✗',
          chips: 0,
          parlorFee: 0,
          isSpectator: false,
          position: 3,
        },
      ],
    },
  ],
});

export const create3PlayerSession = (): SessionSaveData => {
  // 3人打ちセッションデータ生成
};

export const createMultiHanchanSession = (hanchanCount: number): SessionSaveData => {
  // 複数半荘セッションデータ生成
};
```

---

## 実装ロードマップ

### Phase 7-1: ユニットテスト実装（2-3日）

**Day 1: ウママーク・収支計算**
- [ ] uma-utils.test.ts（15テストケース）
- [ ] session-utils.test.ts - calculatePayout（8テストケース）
- [ ] session-utils.test.ts - calculateRanks（5テストケース）

**Day 2: セッションサマリー・バリデーション**
- [ ] session-utils.test.ts - calculateSessionSummary（7テストケース）
- [ ] validation.test.ts（9テストケース）

**Day 3: カバレッジ向上**
- [ ] エッジケースの追加テスト
- [ ] カバレッジ80%以上達成

### Phase 7-2: 統合テスト実装（2-3日）

**Day 4-5: DB操作テスト**
- [ ] db-users.test.ts（10テストケース）
- [ ] db-sessions.test.ts（8テストケース）
- [ ] db-hanchans.test.ts（5テストケース）

**Day 6: 統合テスト完成**
- [ ] トランザクションテスト
- [ ] カスケード削除テスト
- [ ] エラーハンドリングテスト

### Phase 7-3: E2Eテスト実装（4-5日）

**Day 7-8: 基本フローテスト**
- [ ] app-initialization.spec.ts（2テストケース）
- [ ] user-management.spec.ts（3テストケース）
- [ ] input-tab.spec.ts（8テストケース）

**Day 9: タブテスト**
- [ ] history-tab.spec.ts（4テストケース）
- [ ] analysis-tab.spec.ts（7テストケース）
- [ ] settings-tab.spec.ts（4テストケース）

**Day 10-11: 統合・エラー・パフォーマンステスト**
- [ ] cross-tab.spec.ts（3テストケース）
- [ ] error-handling.spec.ts（4テストケース）
- [ ] performance.spec.ts（2テストケース）
- [ ] ios-support.spec.ts（2テストケース）

### Phase 7-4: CI/CD統合（1日）

**Day 12: CI/CDパイプライン構築**
- [ ] GitHub Actions設定
- [ ] 自動テスト実行
- [ ] カバレッジレポート
- [ ] Playwrightレポート公開

---

## 成功基準

### カバレッジ目標
- **ユニットテスト**: 80%以上（ビジネスロジック）
- **統合テスト**: 70%以上（DB操作）
- **E2Eテスト**: 主要フロー100%カバー

### パフォーマンス目標
- **ユニットテスト**: 全体<5秒
- **統合テスト**: 全体<30秒
- **E2Eテスト**: 全体<5分

### 品質目標
- **バグ検出**: リリース前にクリティカルバグ0件
- **リグレッション防止**: 既存機能の破壊検知
- **ドキュメント**: 全テストケースに説明コメント付与

---

## 付録

### テスト実行コマンド

```bash
# ユニットテスト
npm run test:unit

# 統合テスト
npm run test:integration

# E2Eテスト（全ブラウザ）
npm run test:e2e

# E2Eテスト（特定ブラウザ）
npm run test:e2e:chrome
npm run test:e2e:mobile

# カバレッジ付き実行
npm run test:coverage

# UI付き実行（Vitest）
npm run test:ui

# Playwrightレポート表示
npx playwright show-report
```

### package.json追加スクリプト

```json
{
  "scripts": {
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:e2e:chrome": "playwright test --project=chromium",
    "test:e2e:mobile": "playwright test --project='Mobile Safari'",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:watch": "vitest watch",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e"
  }
}
```

---

**次のステップ**:
1. Phase 7-1の実装開始（ユニットテスト）
2. テスト環境構築（Playwright/Vitest設定）
3. 最初のテストケース実装（uma-utils.test.ts）

**関連ドキュメント**:
- `02-UNIT_TEST_IMPLEMENTATION.md` - ユニットテスト実装詳細
- `03-PLAYWRIGHT_E2E_EXAMPLES.md` - E2Eテストコード例
- `04-CI_CD_SETUP.md` - CI/CD構築手順
