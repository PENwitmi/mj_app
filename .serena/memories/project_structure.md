Last updated: 2025-10-05

# プロジェクト構造

## ディレクトリレイアウト

```
/Users/nishimototakashi/claude_code/mj_app/
├── app/                          # メインアプリケーション
│   ├── src/
│   │   ├── lib/                  # コアライブラリ
│   │   │   ├── db.ts             # Dexieスキーマ定義（DBバージョン2）
│   │   │   ├── db-utils.ts       # DB操作ヘルパー
│   │   │   ├── session-utils.ts  # セッション関連ユーティリティ
│   │   │   ├── logger.ts         # 統一ロガー
│   │   │   ├── errors.ts         # カスタムエラークラス
│   │   │   └── utils.ts          # ユーティリティ（cn, getDefaultUmaRule等）
│   │   ├── components/
│   │   │   ├── tabs/             # タブコンポーネント
│   │   │   │   ├── InputTab.tsx      # 新規入力タブ（実装済み）
│   │   │   │   ├── HistoryTab.tsx    # 履歴タブ（実装済み）
│   │   │   │   ├── AnalysisTab.tsx   # 分析タブ（未実装）
│   │   │   │   └── SettingsTab.tsx   # 設定タブ（実装済み）
│   │   │   ├── ui/               # UIコンポーネント (shadcn/ui style)
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   ├── accordion.tsx
│   │   │   │   └── sonner.tsx    # toast通知コンポーネント
│   │   │   ├── ErrorBoundary.tsx         # エラーバウンダリ
│   │   │   ├── PlayerSelect.tsx          # プレイヤー選択コンポーネント
│   │   │   ├── NewPlayerDialog.tsx       # 新規ユーザー登録ダイアログ
│   │   │   └── SessionDetailDialog.tsx   # セッション詳細ダイアログ
│   │   ├── hooks/                # カスタムフック
│   │   │   ├── useUsers.ts       # ユーザー一覧管理フック
│   │   │   └── useSessions.ts    # セッション一覧管理フック
│   │   ├── App.tsx               # ルートコンポーネント（タブレイアウト）
│   │   ├── main.tsx              # エントリーポイント
│   │   ├── index.css             # グローバルCSS（Tailwind CSS v4）
│   │   └── App.css               # アプリ固有CSS
│   ├── package.json              # 依存関係定義
│   ├── vite.config.ts            # Vite設定（パスエイリアス設定）
│   ├── tsconfig.app.json         # TypeScript設定（アプリ）
│   └── tsconfig.node.json        # TypeScript設定（Vite）
├── project-docs/                 # プロジェクトドキュメント
│   ├── 2025-10-03-initial-discussion/
│   ├── 2025-10-03-phase1-basic-implementation/
│   ├── 2025-10-03-phase2-ui-implementation/
│   ├── 2025-10-04-phase2.5-user-archive-system/
│   └── 2025-10-04-phase4-history-tab/
├── .serena/                      # Serenaメモリ
├── CLAUDE.md                     # Claude Code ガイド
└── MASTER_STATUS_DASHBOARD.md    # プロジェクト進捗管理

```

## 主要ファイルの役割

### データベース層 (app/src/lib/)
- **db.ts**: Dexieスキーマ定義、テーブル定義、初期化関数（DBバージョン2）
  - `initializeMainUser()`: メインユーザー初期化（固定ID使用）
  - `initializeApp()`: アプリ全体の初期化
  - `clearAllData()`: データベース全削除（開発用）
- **db-utils.ts**: DB操作ヘルパー関数、バリデーション
  - User操作: `getMainUser()`, `getRegisteredUsers()`, `addUser()`, `updateUser()`, `deleteUser()` (deprecated)
  - **ユーザーアーカイブ**: `archiveUser()`, `restoreUser()`, `getActiveUsers()`, `getArchivedUsers()`
  - Session操作: `createSession()`, `getSessionsByDate()`, `getAllSessions()`, `deleteSession()`
  - **セッション保存**: `saveSession()`, `saveSessionWithSummary()` (パフォーマンス最適化版)
  - Hanchan操作: `createHanchan()`, `getHanchansBySession()`
  - PlayerResult操作: `createPlayerResult()`, `getPlayerResultsByHanchan()` (position順ソート)
  - バリデーション: `validateZeroSum()`, `validateUmaMarks()`
  - 複合クエリ: `getSessionWithDetails()`, `getUserStats()`
- **session-utils.ts**: セッション関連ユーティリティ（Phase 4追加）
  - `calculateSessionSummary()`: サマリー事前計算
  - `getRankForScore()`: 点数から着順を算出
  - `getPlayerSessionStats()`: プレイヤー別セッション統計

### コンポーネント層 (app/src/components/)
- **tabs/**: 4つのメインタブ
  - **InputTab.tsx**: 新規セッション入力画面（完成）
    - モード選択（4人/3人打ち）
    - セッション設定（日付、レート、ウマ、チップ）
    - 点数入力表（自動計算、ウママーク自動割り当て）
    - 集計エリア（小計、チップ、収支、場代、最終収支）
    - **DB保存機能**: saveSessionWithSummary() 使用、toast通知、履歴タブ自動遷移
  - **HistoryTab.tsx**: 過去のセッション一覧（実装済み）
    - セッション一覧表示（日付降順、カードリスト形式）
    - サマリー情報表示（収支、チップ、平均着順、着順内訳）
    - セッション詳細表示（SessionDetailDialogと連携）
    - セッション削除機能（カスケード削除、確認ダイアログ）
  - **AnalysisTab.tsx**: 統計・分析画面（未実装）
  - **SettingsTab.tsx**: 設定画面（実装済み）
    - ユーザー管理（追加・編集・アーカイブ・復元）
    - デフォルトウマルール設定（localStorage連携）
    - 開発者用機能（全データ削除）
- **ui/**: 再利用可能なUIコンポーネント（shadcn/ui: Radix UI + Tailwind CSS）
- **PlayerSelect.tsx**: プレイヤー選択ドロップダウン
  - 登録ユーザー選択
  - 仮名入力
  - 新規ユーザー登録ダイアログ呼び出し
- **NewPlayerDialog.tsx**: 新規ユーザー登録ダイアログ
- **SessionDetailDialog.tsx**: セッション詳細ダイアログ（Phase 4追加）
  - 全半荘の詳細表示（点数、ウママーク、チップ）
  - プレイヤー別統計表示（着順内訳、収支、チップ合計等）
  - 正しい列順での表示（position順）
- **ErrorBoundary.tsx**: React エラーバウンダリ

### カスタムフック (app/src/hooks/)
- **useUsers.ts**: ユーザー一覧管理
  - `mainUser`: メインユーザー
  - `activeUsers`: アクティブな登録ユーザー一覧
  - `archivedUsers`: アーカイブ済みユーザー一覧
  - `loading`: 読み込み状態
  - `addNewUser()`: 新規ユーザー追加
  - `editUser()`: ユーザー名更新
  - `archiveUser()`: ユーザーアーカイブ（論理削除）
  - `restoreUser()`: アーカイブ済みユーザー復元
- **useSessions.ts**: セッション一覧管理（Phase 4追加）
  - `sessions`: セッション一覧（リアルタイムDB監視、Dexie liveQuery）
  - `loading`: 読み込み状態
  - `deleteSession()`: セッション削除（カスケード削除）
  - パフォーマンス最適化: 保存済みサマリー優先使用

### ユーティリティ (app/src/lib/)
- **logger.ts**: 統一ロガー（DEBUG, INFO, WARN, ERROR）
- **errors.ts**: カスタムエラークラス（AppError, DatabaseError, ValidationError, NotFoundError, ConflictError）
- **utils.ts**: ヘルパー関数
  - `cn()`: クラス名マージ
  - `getDefaultUmaRule()`: localStorage からウマルール取得
  - `setDefaultUmaRule()`: localStorage にウマルール保存

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
  - `src/index.css`: `@import "tailwindcss";` のみ
- **TypeScript**: 
  - `tsconfig.app.json`: アプリコード用
  - `tsconfig.node.json`: Vite設定用
