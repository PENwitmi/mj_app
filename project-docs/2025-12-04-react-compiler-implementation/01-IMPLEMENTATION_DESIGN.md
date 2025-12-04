# React Compiler 導入設計書

## 概要

Issue #23に基づき、React Compilerを本プロジェクトに導入するための詳細設計書。

**作成日**: 2025-12-04
**関連Issue**: #23 [最適化] React Compiler 導入

---

## 1. 現状分析

### 1.1 技術スタック

| 項目 | 現在のバージョン | 備考 |
|------|------------------|------|
| React | 19.1.1 | Compiler対応済み |
| Vite | 7.1.7 | 最新 |
| @vitejs/plugin-react | 5.0.4 | Babel統合あり |
| TypeScript | 5.9.3 | 最新 |
| eslint-plugin-react-hooks | 5.2.0 | 最新（Compiler対応） |

### 1.2 手動メモ化の現状

**影響分析結果（Issue #23コメントより）**:

| カテゴリ | 個数 | 主要ファイル |
|----------|------|--------------|
| useMemo | 22個 | AnalysisTab.tsx (8), DetailStatsTabs.tsx (4), TestTab.tsx (4) |
| useCallback | 9個 | useTemplates.ts (4), useMigration.ts (3) |
| React.memo | 1個 | RankStatisticsChartPiePrototype.tsx |

**リスク評価**: 低リスク（純粋性違反なし、副作用は適切に隔離）

---

## 2. 導入方針

### 2.1 アプローチ選択

**推奨**: 段階的導入（Phase 1 → Phase 2 → Phase 3）

```
Phase 1: 環境構築 + 動作確認（Compiler有効化のみ）
    ↓
Phase 2: 高影響コンポーネントのuseMemo/useCallback削除
    ↓
Phase 3: 全コンポーネントのクリーンアップ
```

**理由**:
- 問題発生時の切り分けが容易
- 各フェーズで動作確認可能
- ロールバックポイントが明確

### 2.2 導入しない選択肢（却下）

- **一括導入**: リスクが高く、問題発生時の原因特定が困難
- **見送り**: React 19導入済みであり、導入コストが低い

---

## 3. 実装設計

### Phase 1: 環境構築（推定: 15分）

#### Step 1.1: パッケージインストール

```bash
npm install -D babel-plugin-react-compiler@latest
```

**注意**:
- `eslint-plugin-react-hooks`は既に5.2.0がインストール済み（Compiler対応版）
- `react-compiler-runtime`はReact 19では不要

#### Step 1.2: vite.config.ts 更新

**変更前**:
```typescript
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**変更後**:
```typescript
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const ReactCompilerConfig = {
  // 必要に応じて設定を追加
  // compilationMode: 'infer', // デフォルト
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [
          ['babel-plugin-react-compiler', ReactCompilerConfig],
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**選択理由**:
- `@vitejs/plugin-react`の`babel`オプションを使用（公式推奨）
- 別途`vite-plugin-babel`をインストールする必要がない
- 既存のプラグイン構成を最小限の変更で拡張

#### Step 1.3: 動作確認

```bash
# 開発サーバー起動
npm run dev

# ビルド確認
npm run build

# E2Eテスト実行
npm run test:e2e
```

**確認ポイント**:
- コンパイルエラーがないこと
- 各タブ（入力、履歴、分析、設定）が正常動作すること
- E2Eテストがパスすること

---

### Phase 2: 高影響コンポーネントのクリーンアップ（推定: 30分）

#### 対象ファイル（優先順位順）

| 優先度 | ファイル | useMemo | useCallback | 影響度 |
|--------|----------|---------|-------------|--------|
| 1 | AnalysisTab.tsx | 8 | 0 | 高 |
| 2 | useAllUsersRanking.ts | 2 | 0 | 高 |
| 3 | DetailStatsTabs.tsx | 4 | 0 | 中 |
| 4 | useTemplates.ts | 0 | 4 | 中 |
| 5 | useMigration.ts | 0 | 3 | 中 |

#### Step 2.1: AnalysisTab.tsx（最優先）

**削除対象**:
```typescript
// 削除前
const filteredSessions = useMemo(() => {
  return filterSessionsByPeriod(sessions, selectedPeriod)
}, [sessions, selectedPeriod])

// 削除後（単純な変数代入）
const filteredSessions = filterSessionsByPeriod(sessions, selectedPeriod)
```

**全8箇所のuseMemoを順次削除**

#### Step 2.2: useAllUsersRanking.ts

**削除対象**: 2箇所のuseMemo

#### Step 2.3: DetailStatsTabs.tsx

**削除対象**: 4箇所のuseMemo

#### Step 2.4: 各変更後の動作確認

各ファイル変更後に必ず:
1. 開発サーバーでの動作確認
2. 該当機能のE2Eテスト実行

---

### Phase 3: 残りのクリーンアップ（推定: 15分）

#### 対象ファイル

| ファイル | useMemo | useCallback | React.memo |
|----------|---------|-------------|------------|
| RevenueTimelineChart.tsx | 1 | 0 | 0 |
| RankTimelineChart.tsx | 1 | 0 | 0 |
| TimelineAreaChart.tsx | 1 | 0 | 0 |
| SessionDetailDialog.tsx | 0 | 1 | 0 |
| InputTab.tsx | 0 | 1 | 0 |
| chart.tsx (shadcn) | 1 | 0 | 0 |
| TestTab.tsx | 4 | 0 | 0 |
| RankStatisticsChartPiePrototype.tsx | 0 | 0 | 1 |

**注意**:
- `chart.tsx`はshadcn/uiのコンポーネント → 変更しない（再インストール時に上書きされる）
- `TestTab.tsx`、`RankStatisticsChartPiePrototype.tsx`はテスト用 → 低優先度

---

## 4. ロールバック計画

### 問題発生時の対応

#### Level 1: 特定コンポーネントの問題

**対応**: `"use no memo"`ディレクティブで個別無効化

```typescript
function ProblematicComponent() {
  "use no memo";
  // このコンポーネントはCompilerの最適化対象外
  return <div>...</div>
}
```

#### Level 2: 広範な問題

**対応**: vite.config.tsからCompiler設定を削除

```typescript
// babel設定を削除するだけ
react({
  // babel: { ... } を削除
})
```

#### Level 3: 完全ロールバック

**対応**: パッケージ削除

```bash
npm uninstall babel-plugin-react-compiler
git checkout vite.config.ts
```

---

## 5. 検証計画

### 5.1 機能テスト

| テスト項目 | 方法 | 合格基準 |
|------------|------|----------|
| 新規入力タブ | E2E | セッション作成・保存が正常 |
| 履歴タブ | E2E | セッション一覧・詳細・削除が正常 |
| 分析タブ | E2E + 手動 | フィルタ・統計・グラフが正常 |
| 設定タブ | 手動 | ユーザー管理・テンプレートが正常 |

### 5.2 パフォーマンステスト（任意）

**React DevTools Profilerを使用**:
- 導入前後のレンダリング回数比較
- 特にAnalysisTabのフィルタ切り替え時

### 5.3 ビルドテスト

```bash
npm run build
npm run preview
```

---

## 6. 実装チェックリスト

### Phase 1
- [ ] `babel-plugin-react-compiler`インストール
- [ ] `vite.config.ts`更新
- [ ] 開発サーバー起動確認
- [ ] ビルド確認
- [ ] E2Eテスト全パス確認

### Phase 2
- [ ] AnalysisTab.tsx: useMemo 8個削除
- [ ] useAllUsersRanking.ts: useMemo 2個削除
- [ ] DetailStatsTabs.tsx: useMemo 4個削除
- [ ] useTemplates.ts: useCallback 4個削除
- [ ] useMigration.ts: useCallback 3個削除
- [ ] 各変更後の動作確認

### Phase 3
- [ ] チャートコンポーネント: useMemo 3個削除
- [ ] SessionDetailDialog.tsx: useCallback 1個削除
- [ ] InputTab.tsx: useCallback 1個削除
- [ ] 最終E2Eテスト実行
- [ ] ビルド・デプロイ確認

### 完了後
- [ ] Issue #23クローズ
- [ ] CLAUDE.md更新（React Compiler導入済みの記載）

---

## 7. 見積もり

| フェーズ | 作業内容 | 推定時間 |
|----------|----------|----------|
| Phase 1 | 環境構築・動作確認 | 15分 |
| Phase 2 | 高影響コンポーネント | 30分 |
| Phase 3 | 残りのクリーンアップ | 15分 |
| **合計** | | **1時間** |

**リスク**: 極小
- React 19導入済み
- 副作用は適切に隔離済み
- 個別無効化ディレクティブで問題対応可能

---

## 8. 参考資料

- [React Compiler Documentation](https://react.dev/learn/react-compiler)
- [React Compiler Installation Guide](https://react.dev/learn/react-compiler/installation)
- [Issue #23 詳細影響分析コメント](https://github.com/nishimototakashi/mj-app/issues/23)
