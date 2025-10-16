# プロジェクト構造

Last updated: 2025-10-12

## ディレクトリレイアウト

```
/Users/nishimototakashi/claude_code/mj_app/
├── app/                          # メインアプリケーション
│   ├── src/
│   │   ├── lib/                  # コアライブラリ
│   │   │   ├── db.ts             # Dexieスキーマ定義（DBバージョン2）
│   │   │   ├── db-utils.ts       # DB操作re-export（後方互換性）
│   │   │   ├── db-utils.ts.backup # リファクタリング前バックアップ
│   │   │   ├── db/               # ドメイン別モジュール（2025-10-09分割）
│   │   │   │   ├── index.ts      # 公開API re-export
│   │   │   │   ├── users.ts      # ユーザー管理
│   │   │   │   ├── sessions.ts   # セッション管理
│   │   │   │   ├── hanchans.ts   # 半荘・プレイヤー結果管理
│   │   │   │   ├── validation.ts # バリデーション
│   │   │   │   └── analysis.ts   # 分析統計
│   │   │   ├── session-utils.ts  # セッション関連ユーティリティ
│   │   │   ├── uma-utils.ts      # ウママーク変換ロジック
│   │   │   ├── logger.ts         # 統一ロガー
│   │   │   ├── errors.ts         # カスタムエラークラス
│   │   │   └── utils.ts          # ユーティリティ（cn, getDefaultUmaRule等）
│   │   ├── components/
│   │   │   ├── tabs/             # タブコンポーネント
│   │   │   │   ├── InputTab.tsx      # 新規入力タブ（完成）
│   │   │   │   ├── HistoryTab.tsx    # 履歴タブ（完成）
│   │   │   │   ├── AnalysisTab.tsx   # 分析タブ（完成）
│   │   │   │   ├── SettingsTab.tsx   # 設定タブ（完成）
│   │   │   │   └── TestTab.tsx       # テストタブ（プレースホルダー）
│   │   │   ├── input/            # 入力タブサブコンポーネント
│   │   │   │   ├── ScoreInputTable.tsx # 点数入力表
│   │   │   │   ├── SessionSettings.tsx # セッション設定カード
│   │   │   │   └── TotalsPanel.tsx     # 集計パネル（flexbox化）
│   │   │   ├── analysis/         # 分析タブサブコンポーネント
│   │   │   │   ├── AnalysisFilters.tsx        # フィルターコンポーネント
│   │   │   │   ├── RankStatisticsChart.tsx    # 着順統計グラフ
│   │   │   │   └── RevenueTimelineChart.tsx   # 収支推移グラフ
│   │   │   ├── test/             # テストコンポーネント
│   │   │   │   └── RankStatisticsChartPiePrototype.tsx
│   │   │   ├── ui/               # UIコンポーネント (shadcn/ui style)
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── chart.tsx        # Recharts wrapper
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   ├── accordion.tsx
│   │   │   │   ├── alert-dialog.tsx
│   │   │   │   └── sonner.tsx       # toast通知コンポーネント
│   │   │   ├── ErrorBoundary.tsx         # エラーバウンダリ
│   │   │   ├── PlayerSelect.tsx          # プレイヤー選択コンポーネント
│   │   │   ├── NewPlayerDialog.tsx       # 新規ユーザー登録ダイアログ
│   │   │   └── SessionDetailDialog.tsx   # セッション詳細ダイアログ
│   │   ├── hooks/                # カスタムフック
│   │   │   ├── useUsers.ts       # ユーザー一覧管理フック
│   │   │   └── useSessions.ts    # セッション一覧管理フック
│   │   ├── App.tsx               # ルートコンポーネント（タブレイアウト）
│   │   ├── main.tsx              # エントリーポイント
│   │   ├── index.css             # グローバルCSS（Tailwind CSS v4 + safe-area対応）
│   │   └── App.css               # アプリ固有CSS
│   ├── ios/                      # iOS Capacitor設定（Phase 6）
│   │   └── App/                  # Xcodeプロジェクト
│   ├── package.json              # 依存関係定義
│   ├── capacitor.config.ts       # Capacitor設定
│   ├── vite.config.ts            # Vite設定（パスエイリアス設定）
│   ├── eslint.config.js          # ESLint設定
│   ├── tsconfig.json             # TypeScript設定（ルート）
│   ├── tsconfig.app.json         # TypeScript設定（アプリ）
│   └── tsconfig.node.json        # TypeScript設定（Vite）
├── project-docs/                 # プロジェクトドキュメント
│   ├── 2025-10-03-initial-discussion/
│   ├── 2025-10-03-phase1-basic-implementation/
│   ├── 2025-10-03-phase2-ui-implementation/
│   ├── 2025-10-04-phase2.5-user-archive-system/
│   ├── 2025-10-04-phase4-history-tab/
│   ├── 2025-10-07-empty-hanchan-filtering/
│   ├── 2025-10-09-db-utils-refactoring/
│   ├── 2025-10-10-history-overall-rank-feature/
│   └── 2025-10-12-parlor-fee-per-player-feature/
├── .serena/                      # Serenaメモリ
├── CLAUDE.md                     # Claude Code ガイド
└── MASTER_STATUS_DASHBOARD.md    # プロジェクト進捗管理
```

## 主要ファイルの役割

### データベース層 (app/src/lib/)

#### 統合エントリーポイント
- **db.ts**: Dexieスキーマ定義、テーブル定義、初期化関数（DBバージョン2）
  - `initializeMainUser()`: メインユーザー初期化（固定ID使用）
  - `initializeApp()`: アプリ全体の初期化
  - `clearAllData()`: データベース全削除（開発用）

#### ドメイン別モジュール (app/src/lib/db/)
**2025-10-09にdb-utils.ts（1,380行）から分割**

- **db/index.ts**: 公開API re-export（各モジュールの関数をまとめて提供）

- **db/users.ts**: ユーザー管理
  - `getMainUser()`, `getAllUsers()`, `getRegisteredUsers()`
  - `addUser()`, `updateUser()`
  - `archiveUser()`, `restoreUser()`, `getActiveUsers()`, `getArchivedUsers()`
  - `deleteUser()` (deprecated)

- **db/sessions.ts**: セッション管理
  - `createSession()`, `getSessionsByDate()`, `getAllSessions()`
  - `saveSession()`, `updateSession()`, `deleteSession()`
  - `sessionToSettings()`, `dbHanchansToUIHanchans()`, `uiDataToSaveData()`

- **db/hanchans.ts**: 半荘・プレイヤー結果管理
  - `createHanchan()`, `getHanchansBySession()`
  - `createPlayerResult()`, `getPlayerResultsByHanchan()`
  - `getSessionWithDetails()`, `getUserStats()`

- **db/validation.ts**: バリデーション
  - `validateZeroSum()`: ゼロサム検証
  - `validateUmaMarks()`: ウママーク合計検証

- **db/analysis.ts**: 分析統計
  - `calculateRankStatistics()`: 着順統計計算
  - `calculateRevenueStatistics()`: 収支統計計算
  - `calculatePointStatistics()`: ポイント統計計算
  - `calculateChipStatistics()`: チップ統計計算
  - `filterSessionsByPeriod()`, `filterSessionsByMode()`: フィルター関数

#### 後方互換性
- **db-utils.ts**: 各モジュールからre-export（既存コードとの互換性維持）
- **db-utils.ts.backup**: リファクタリング前のバックアップ

#### その他ユーティリティ
- **session-utils.ts**: セッション関連ユーティリティ
  - `calculateSessionSummary()`: サマリー事前計算
  - `calculateRanks()`: 点数ベース着順計算
  - `calculatePayout()`: 収支計算
  - `saveSessionWithSummary()`: サマリー付き保存（パフォーマンス最適化版）

- **uma-utils.ts**: ウママーク変換ロジック
  - `umaMarkToValue()`: ウママーク→数値変換
  - `getInitialPlayerNames()`: 初期プレイヤー名生成
  - `createInitialPlayerResult()`: 初期プレイヤー結果生成

- **logger.ts**: 統一ロガー（DEBUG, INFO, WARN, ERROR）
- **errors.ts**: カスタムエラークラス（AppError, DatabaseError, ValidationError, NotFoundError, ConflictError）
- **utils.ts**: ヘルパー関数
  - `cn()`: クラス名マージ
  - `getDefaultUmaRule()`: localStorage からウマルール取得
  - `setDefaultUmaRule()`: localStorage にウマルール保存

### コンポーネント層 (app/src/components/)

#### メインタブ (components/tabs/)
- **InputTab.tsx**: 新規セッション入力画面（完成）
  - モード選択（4人/3人打ち）
  - セッション設定（SessionSettingsCard）
  - 点数入力表（ScoreInputTable）
  - 集計エリア（TotalsPanel）
  - DB保存機能（saveSessionWithSummary()使用）
  - 空ハンチャンフィルタリング（保存前自動除外）

- **HistoryTab.tsx**: 過去のセッション一覧（完成）
  - セッション一覧表示（createdAt降順、カードリスト形式）
  - サマリー情報表示（収支、チップ、平均着順、総合順位等）
  - セッション詳細表示（SessionDetailDialog連携）
  - セッション削除・編集機能

- **AnalysisTab.tsx**: 統計・分析画面（完成）
  - フィルター（ユーザー・期間・モード）
  - 統合統計カード（着順・収支・ポイント・チップ）
  - グラフ表示（着順統計、収支推移）
  - タブ切り替えエラー対策（mountedTabs + 遅延レンダリング）

- **SettingsTab.tsx**: 設定画面（完成）
  - ユーザー管理（追加・編集・アーカイブ・復元）
  - デフォルトウマルール設定（localStorage連携）
  - 開発者用機能（全データ削除）

- **TestTab.tsx**: テストタブ（プレースホルダー、コメントアウト可能）

#### サブコンポーネント
**入力タブ (components/input/):**
- **ScoreInputTable.tsx**: 点数入力表
  - 点数入力、ウママーク自動割り当て
  - 自動計算（N-1人入力時）
  - プレイヤー選択（PlayerSelect連携）

- **SessionSettings.tsx**: セッション設定カード
  - 日付、レート、ウマ、チップ設定
  - モード変更・保存ボタン

- **TotalsPanel.tsx**: 集計パネル
  - 小計、チップ、収支、場代、最終収支表示
  - flexbox化（Phase 6、iOS対応）

**分析タブ (components/analysis/):**
- **AnalysisFilters.tsx**: フィルターコンポーネント
  - ユーザー選択、期間選択、モード選択

- **RankStatisticsChart.tsx**: 着順統計グラフ
  - 横棒グラフ（Recharts）
  - 着順内訳、平均着順表示

- **RevenueTimelineChart.tsx**: 収支推移グラフ
  - 折れ線グラフ（Recharts）
  - 個別/累積モード切替
  - y=0参照線（累積モード）

**共通コンポーネント:**
- **PlayerSelect.tsx**: プレイヤー選択ドロップダウン
- **NewPlayerDialog.tsx**: 新規ユーザー登録ダイアログ
- **SessionDetailDialog.tsx**: セッション詳細ダイアログ
- **ErrorBoundary.tsx**: React エラーバウンダリ

#### UIコンポーネント (components/ui/)
shadcn/ui style（Radix UI + Tailwind CSS）

### カスタムフック (app/src/hooks/)
- **useUsers.ts**: ユーザー一覧管理
  - `mainUser`, `activeUsers`, `archivedUsers`, `loading`
  - `addNewUser()`, `editUser()`, `archiveUser()`, `restoreUser()`
  - `refreshUsers()`: 手動リフレッシュ関数（Phase 6追加）

- **useSessions.ts**: セッション一覧管理
  - `sessions`, `loading`, `error`
  - リアルタイムDB監視（Dexie liveQuery）
  - パフォーマンス最適化（保存済みサマリー優先使用）

## パス設定
- `@/*` → `app/src/*` (vite.config.ts)
- 絶対パスインポート推奨

## 開発コマンド
```bash
cd app
npm run dev      # 開発サーバー起動 (localhost:5173)
npm run build    # ビルド (TypeScript → Vite)
npm run lint     # Lint実行
npm run preview  # ビルドプレビュー
```

## 設定ファイル
- **Tailwind CSS v4**: Vite plugin使用（`@tailwindcss/vite`）
  - PostCSS config不要、tailwind.config.js不要
  - `src/index.css`: `@import "tailwindcss";` + safe-area対応
- **TypeScript**: 
  - `tsconfig.json`: ルート設定（references）
  - `tsconfig.app.json`: アプリコード用
  - `tsconfig.node.json`: Vite設定用
- **Capacitor**: `capacitor.config.ts`（iOS設定完了）
- **ESLint**: `eslint.config.js`（React 19対応）

## iOS対応（Phase 6）
- **safe-area対応**: `--safe-area-inset-*` CSS変数使用
- **タブナビゲーション**: `env(safe-area-inset-bottom)` 加算
- **スクロール対応**: 各タブに適切なスクロール設定
- **トースト通知**: 上部配置（safe-area考慮）
