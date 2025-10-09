# 麻雀アプリ - プロジェクト概要

**最終更新**: 2025-10-09 20:25  
**プロジェクト開始**: 2025-10-03 00:17  
**現在のステータス**: Phase 5完了、db-utils.tsリファクタリング完了

---

## 📋 プロジェクト基本情報

### 目的
麻雀（Mahjong）の点数記録・計算・分析アプリケーション。  
iOS/Android向けネイティブアプリを目指す（Capacitor使用予定）。

### ターゲット
- 個人・グループの麻雀記録管理
- 詳細な統計分析
- モバイルファースト設計

---

## 🛠️ 技術スタック

### フロントエンド
- **React 19.1.1**: 最新のReactバージョン（Strict Mode対応）
- **TypeScript 5.9.3**: 厳密な型チェック
- **Vite 7.1.7**: 高速ビルドツール
- **Tailwind CSS v4.1.14**: Viteプラグイン使用（PostCSS不要）

### データベース・状態管理
- **Dexie.js 4.2.0**: IndexedDBラッパー（クライアントサイドDB）
- **dexie-react-hooks**: React統合
- カスタムフック: `useUsers`, `useSessions`

### UIライブラリ
- **shadcn/ui**: Radix UI ベースのコンポーネント
  - @radix-ui/react-dialog, select, tabs, accordion等
  - Tailwind CSS統合
- **Recharts 2.15.4**: データビジュアライゼーション
- **Lucide React 0.544.0**: アイコンセット
- **sonner 2.0.7**: Toast通知

### 開発ツール
- **ESLint 9.36.0**: コード品質チェック
- **TypeScript ESLint**: 型安全性強化
- **Vite React Plugin**: HMR対応

### 将来の統合予定
- **Capacitor**: iOS/Androidネイティブアプリ化

---

## 📊 プロジェクト統計（2025-10-09時点）

| 項目 | 数値 |
|------|------|
| **総コード行数** | 6,587行（TypeScript/TSX） |
| **総ファイル数** | 40ファイル（.ts/.tsx） |
| **開発期間** | 7日間（2025-10-03 〜 2025-10-09） |
| **完了フェーズ** | Phase 1-5 + バグ修正1件 + リファクタリング |
| **総ドキュメント数** | 27件（設計9 + 実装14 + バグ修正3 + 開発知見1） |
| **Gitコミット** | b9864ed（最新: Phase 5-6完了） |

---

## ✅ 完了フェーズサマリー

### Phase 0: 初期設計・要件定義（2025-10-03）
- **期間**: 約2時間11分
- **成果**: 設計ドキュメント9件
- データモデル設計、UI設計（4タブ）、デフォルト値・ルール定義

### Phase 1: 基本実装（2025-10-03）
- **期間**: 約2時間36分
- **成果**:
  - Vite + React 19 + TypeScript セットアップ
  - Dexie.js データベース層実装（4層構造）
  - 統一エラーハンドリング・ログシステム（logger.ts, errors.ts, ErrorBoundary.tsx）
  - shadcn/ui セットアップ

### Phase 2: UI実装フル完成（2025-10-03 〜 2025-10-04）
- **期間**: 約28時間
- **成果**:
  - タブレイアウト構築（4タブ: 新規入力、履歴、分析、設定）
  - InputTab フル実装（688行）
    - モード選択、セッション設定、プレイヤー選択
    - ウママーク自動割り当て（2位マイナス判定対応）
    - ゼロサム自動計算
    - リアルタイム集計表示
  - SettingsTab フル実装（314行）
    - ユーザー管理（追加・編集・削除）
    - デフォルトウマルール設定
  - カスタムフック: useUsers

### Phase 2.5: ユーザーアーカイブシステム（2025-10-04）
- **期間**: 約35分
- **成果**:
  - 論理削除システム実装（isArchived/archivedAt）
  - archiveUser(), restoreUser() 関数
  - データ整合性確保（物理削除廃止）

### Phase 3: InputTab DB保存機能（2025-10-04）
- **期間**: 約6時間30分
- **成果**:
  - saveSession() 関数実装（Session + Hanchan + PlayerResult一括作成）
  - toast通知システム（sonner統合）
  - タブ切り替え機能（保存後 → 履歴タブ自動遷移）
  - IndexedDB永続化成功

### Phase 4: 履歴タブ実装（2025-10-04 〜 2025-10-05）
- **期間**: 約21時間（Stage 1-5）
- **成果**:
  - **Stage 1**: セッション一覧・詳細表示、削除機能
  - **Stage 2**: Player Order Fix（position フィールド追加）
  - **Stage 3**: Summary Pre-calculation（パフォーマンス300-800倍高速化）
  - **Stage 4-5**: 編集機能実装（updateSession, 型変換層）
  - カスタムフック: useSessions

### Phase 5: 分析タブ実装（2025-10-05 〜 2025-10-09）
- **期間**: 約13時間10分（Stage 1-6）
- **成果**:
  - **Stage 1**: 型定義6つ + 統計計算関数4つ
    - PeriodType, RankStatistics, RevenueStatistics, PointStatistics, ChipStatistics
    - calculateRankStatistics()（点数ベース着順判定）
  - **Stage 2**: フィルター関数 + AnalysisFilters コンポーネント
  - **Stage 3**: RankStatisticsChart（横棒グラフ）
  - **Stage 4**: RevenueTimelineChart（折れ線グラフ、Rechartsバグ修正2件）
  - **Stage 5**: タブ切り替えエラー修正（forceMount + 条件付きレンダリング）
  - **Stage 6**: 分析タブUI最適化（統計カード統合、モバイルファースト）

### バグ修正: 空ハンチャンフィルタリング（2025-10-07）
- **期間**: 約38分（テスト含む約2時間）
- **成果**:
  - isEmptyHanchan() 関数追加
  - InputTab保存前フィルタリング
  - 統計計算の防御的修正
  - Playwrightテスト5/7 PASS

### リファクタリング: db-utils.ts モジュール分割（2025-10-09）
- **期間**: 約4時間（Phase 1-2 + 統合テスト）
- **成果**:
  - **Phase 1**: デバッグログ統一（console.log → logger.debug）
  - **Phase 2**: ドメイン別分割（1,380行 → 6モジュール）
    - validation.ts (40行)
    - hanchans.ts (160行)
    - analysis.ts (350行)
    - sessions.ts (700行)
    - users.ts (320行)
    - index.ts (60行)
  - **統合テスト**: Playwright 10/10項目PASS
  - 後方互換性完璧維持

---

## 🎯 主要機能一覧

### 1. 新規入力タブ（InputTab）
- **モード選択**: 4人打ち / 3人打ち
- **セッション設定**: 日付、レート、ウマ、チップレート
- **プレイヤー選択**: メインユーザー、登録ユーザー、デフォルト名
- **点数入力**: ±形式、ゼロサム自動計算
- **ウママーク**: 自動割り当て（2位マイナス判定対応）
- **リアルタイム集計**: 小計、収支、場代、最終収支
- **半荘追加**: 動的に半荘を追加可能
- **保存**: IndexedDB永続化 + toast通知 + 履歴タブ自動遷移

### 2. 履歴タブ（HistoryTab）
- **セッション一覧**: 日付降順、カードリスト形式
- **サマリー表示**: 収支、チップ、平均着順、着順内訳
- **詳細表示**: SessionDetailDialog（モーダル）
  - 全半荘の点数・ウママーク表示
  - プレイヤー列順保持
- **編集機能**: 点数・レート・ウマ・チップレート変更可能
- **削除機能**: カスケード削除（Session → Hanchan → PlayerResult）
- **パフォーマンス**: サマリー事前計算（1-2ms台）

### 3. 分析タブ（AnalysisTab）
- **フィルター**:
  - ユーザー選択（自分、登録ユーザー）
  - 期間選択（今月、今年、年別、全期間）
  - モード選択（4人打ち、3人打ち、全体）
- **グラフ**:
  - 着順分布グラフ（横棒グラフ、Recharts）
  - 収支推移グラフ（折れ線グラフ、累積収支）
- **統計カード**（2x2グリッド統合）:
  - 📊 着順統計（総ゲーム数、着順回数・率、平均着順）
  - 💰 収支統計（総収入、総支出、総収支）
  - 📈 ポイント統計（プラス・マイナス・収支）
  - 🎰 チップ統計（プラス・マイナス・収支）
- **モバイルファースト**: 情報密度最適化

### 4. 設定タブ（SettingsTab）
- **ユーザー管理**:
  - 登録ユーザー追加・編集
  - アーカイブ（論理削除）・復元
- **デフォルトウマルール**: 標準 / 2位マイナス判定
- **開発者用**: 全データ削除

---

## 🏗️ データモデル（4層構造）

```
User (ユーザー)
  ↓ 1:N
Session (セッション - 1日の麻雀記録)
  ↓ 1:N
Hanchan (半荘 - 1ゲーム)
  ↓ 1:N
PlayerResult (プレイヤー結果)
  ↓ N:1 (nullable)
User (登録ユーザー)
```

### 主要エンティティ

#### User
- **固定ID**: `main-user-fixed-id`（メインユーザー、React 19 Strict Mode対応）
- **論理削除**: isArchived/archivedAt（物理削除禁止）

#### Session
- 日付、モード（4人打ち/3人打ち）、レート、ウマ、チップレート
- **summary**: SessionSummary（事前計算サマリー、パフォーマンス最適化）

#### Hanchan
- sessionId（FK）、hanchanNumber（ソート順）

#### PlayerResult
- hanchanId（FK）、userId（FK、nullable）
- score（±形式）、umaMark（○○○〜✗✗✗）、chips、parlorFee
- **position**: 列番号保持（表示順維持）
- isSpectator（見学者フラグ）

---

## 🔑 重要な技術的決定

### 1. データ整合性
- **ゼロサム原則**: 各半荘の点数合計は必ず0（見学者除く）
- **ウママーク合計0**: 各半荘で±のバランスを保証
- **空ハンチャンフィルタリング**: 全員0点の半荘は保存しない
- **論理削除**: ユーザーアーカイブでデータ整合性確保

### 2. パフォーマンス最適化
- **サマリー事前計算**: Session.summary に事前計算結果を保存
  - 履歴タブ表示: 300-800ms → 1-2ms（約400倍高速化）
  - DB読み取り削減: 理論上95%削減
- **条件付き半荘読み込み**: useSessions({ includeHanchans: true })
- **useMemo最適化**: AnalysisTabで6箇所使用

### 3. React 19対応
- **Strict Mode**: useEffectが2回実行される → 固定IDで重複防止
- **forceMount問題**: タブ切り替え時のグラフエラー → 条件付きレンダリングで解決

### 4. Dexie.js / IndexedDB
- **EntityTable パターン**: `EntityTable<Type, 'primaryKey'>`
- **Boolean インデックス不可**: in-memory filteringで対応
- **トランザクション**: カスケード操作で原子性保証

### 5. Rechartsの落とし穴
- **横棒グラフ**: layout="vertical"（直感に反する）
- **CartesianGrid**: horizontal={false}（水平線非表示）
- **CSS変数問題**: Lineのstrokeで効かない → 直接色指定

---

## 📂 ファイル構成（主要ディレクトリ）

```
src/
├── lib/
│   ├── db.ts                   # Dexieスキーマ定義
│   ├── db-utils.ts             # 後方互換レイヤー（re-export）
│   ├── db/                     # モジュール化されたDB層（Phase 2リファクタリング）
│   │   ├── index.ts           # 公開API統一エクスポート
│   │   ├── validation.ts      # ゼロサム・ウママーク検証
│   │   ├── hanchans.ts        # 半荘・プレイヤー結果CRUD
│   │   ├── analysis.ts        # 統計計算・フィルター・型定義
│   │   ├── sessions.ts        # セッション管理・保存・更新
│   │   └── users.ts           # ユーザー管理・アーカイブ
│   ├── session-utils.ts        # サマリー計算ロジック
│   ├── uma-utils.ts            # ウママーク計算
│   ├── logger.ts               # 統一ロガー（DEBUG/INFO/WARN/ERROR）
│   ├── errors.ts               # カスタムエラークラス
│   └── utils.ts                # ユーティリティ
├── components/
│   ├── tabs/
│   │   ├── InputTab.tsx       # 新規入力タブ（688行）
│   │   ├── HistoryTab.tsx     # 履歴タブ
│   │   ├── AnalysisTab.tsx    # 分析タブ（224行）
│   │   └── SettingsTab.tsx    # 設定タブ（314行）
│   ├── analysis/
│   │   ├── AnalysisFilters.tsx         # フィルターUI
│   │   ├── RankStatisticsChart.tsx     # 着順分布グラフ
│   │   └── RevenueTimelineChart.tsx    # 収支推移グラフ
│   ├── input/
│   │   ├── ScoreInputTable.tsx         # 点数入力テーブル
│   │   ├── SessionSettings.tsx         # セッション設定
│   │   └── TotalsPanel.tsx             # 集計パネル
│   ├── ui/                             # shadcn/ui コンポーネント
│   ├── PlayerSelect.tsx                # プレイヤー選択
│   ├── NewPlayerDialog.tsx             # 新規プレイヤー登録
│   ├── SessionDetailDialog.tsx         # セッション詳細・編集
│   └── ErrorBoundary.tsx               # エラーバウンダリ
├── hooks/
│   ├── useUsers.ts                     # ユーザー管理フック
│   └── useSessions.ts                  # セッション管理フック
├── App.tsx                              # ルートコンポーネント（タブレイアウト）
└── main.tsx                             # エントリーポイント
```

---

## 🎯 現在の状況

### 完了済み
- ✅ Phase 1-5完了（全主要機能実装済み）
- ✅ バグ修正（空ハンチャンフィルタリング）
- ✅ db-utils.tsリファクタリング完了（モジュール化）
- ✅ Playwright統合テスト全項目PASS

### 未コミット変更
- ⚠️ db-utils.tsリファクタリング（Phase 1-2 + 統合テスト）

### 次のステップ候補

**優先度高**:
1. **Gitコミット**: リファクタリング完了を確定
2. **Phase 6**: Capacitor統合（iOS/Androidネイティブアプリ化）

**優先度中**:
- Phase 4/5 UX最適化（データエクスポート、対戦相手別分析）
- 旧db-utils.ts削除検討（現在は互換レイヤー）

---

## 📚 ドキュメント参照

### プロジェクトルート
- **CLAUDE.md**: Claude Code向けガイド
- **MASTER_STATUS_DASHBOARD.md**: 進捗管理ダッシュボード（詳細履歴）

### project-docs/
- `2025-10-03-initial-discussion/`: Phase 0設計ドキュメント（9件）
- `2025-10-03-phase1-basic-implementation/`: Phase 1実装
- `2025-10-03-phase2-ui-implementation/`: Phase 2 UI実装
- `2025-10-04-phase2.5-user-archive-system/`: アーカイブシステム
- `2025-10-04-phase4-history-tab/`: Phase 4履歴タブ（5件）
- `2025-10-05-phase5-analysis-tab/`: Phase 5分析タブ（8件）
- `2025-10-07-empty-hanchan-issue/`: 空ハンチャンバグ修正（3件）
- `2025-10-09-db-utils-refactoring/`: リファクタリング（2件）

### development-insights/
- `charts/recharts-horizontal-bar-chart-guide.md`: Recharts横棒グラフ
- `charts/recharts-linechart-implementation-guide.md`: Recharts折れ線グラフ
- `charts/recharts-tab-switching-error-solution.md`: タブ切り替えエラー

---

## 🔗 開発コマンド

```bash
# 開発サーバー起動（screenセッション推奨）
/run                # Claude Code専用コマンド
npm run dev         # 通常起動（localhost:5173）

# ビルド
npm run build       # TypeScriptコンパイル + Vite build

# Lint
npm run lint

# プレビュー
npm run preview
```

---

**作成日時**: 2025-10-09 20:25  
**作成者**: Claude Code  
**バージョン**: v1.0  
**プロジェクトパス**: `/Users/nishimototakashi/claude_code/mj_app/app`
