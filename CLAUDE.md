# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

麻雀（Mahjong）点数記録・計算アプリ。iOS向けのネイティブアプリを想定（Capacitor使用予定）。

**Tech Stack:**
- Vite + React 19 + TypeScript
- Tailwind CSS v4 (Vite plugin使用)
- Dexie.js (IndexedDB wrapper)
- Future: shadcn/ui, Capacitor

## Development Commands

```bash
# 開発サーバー起動 (localhost:5173)
npm run dev

# ビルド (TypeScriptコンパイル → Vite build)
npm run build

# Lint実行
npm run lint

# ビルドプレビュー
npm run preview
```

### Dev Server Startup (Claude Code)

**重要**: Claude Codeで`npm run dev`を実行する際は、タイムアウト問題を回避するため専用のサブエージェント/コマンドを使用してください。

**推奨方法**:

1. **サブエージェント使用**:
   ```
   @agent-npm-run-dev dev serverを起動して
   ```

2. **スラッシュコマンド使用**:
   ```
   /run
   ```

**仕組み**:
- screenセッションでdev serverを分離実行
- Claude Codeの2分タイムアウトを回避
- ポート5173で起動、バックグラウンド実行

**セッション管理**:
```bash
# ログ確認
screen -r dev-server

# デタッチ (Ctrl+A → D)

# サーバー停止
screen -X -S dev-server quit
```

**理由**: Claude Codeの`run_in_background`機能はViteの起動を正しく検知できず、プロセスが途中で終了する問題があります。screenセッションを使用することで確実に起動できます。

## Architecture

### Data Model (4層構造)

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

**Key Entities:**
- `User`: メインユーザー(固定ID: `main-user-fixed-id`)と登録ユーザー
  - **アーカイブシステム**: isArchived/archivedAtで論理削除管理
  - 物理削除は使用せず、データ整合性を確保
- `Session`: 日付単位の麻雀記録。rate、umaValue、chipRate等の設定を保持
- `Hanchan`: 個別ゲーム。半荘番号でソート
- `PlayerResult`: 各プレイヤーの点数(±形式)、ウママーク、チップ数

**Important Types:**
- `GameMode`: `'4-player' | '3-player'`
- `UmaRule`: `'standard' | 'second-minus'`
- `UmaMark`: `'○○○' | '○○' | '○' | '' | '✗' | '✗✗' | '✗✗✗'`

### Database (Dexie.js / IndexedDB)

**Location:** `src/lib/db.ts`, `src/lib/db-utils.ts`

**Critical Constraints:**
- ゼロサム原則: 各半荘の点数合計は0（見学者を除く）
- ウママーク合計: 各半荘で必ず0になる
- Boolean値はIndexedDBのインデックスに使用不可 → in-memory filteringで対応

**Key Functions:**
- `initializeApp()`: メインユーザー初期化（固定IDで重複防止）
- `archiveUser(userId)`: ユーザーアーカイブ（論理削除）
- `restoreUser(userId)`: アーカイブ済みユーザー復元
- `getActiveUsers()`: アクティブユーザーのみ取得
- `getArchivedUsers()`: アーカイブ済みユーザー取得
- `getRegisteredUsers()`: 登録ユーザー取得（アクティブのみ、メインユーザー除く）
- `deleteUser()`: **非推奨** - 内部でarchiveUserを呼ぶ
- `saveSession(data)`: セッション保存（Session + Hanchan + PlayerResult一括作成）
- `saveSessionWithSummary(data, mainUserId)`: セッション保存＋サマリー事前計算（パフォーマンス最適化版）
- `deleteSession(sessionId)`: セッション削除（カスケード削除）
- `validateZeroSum(hanchanId)`: ゼロサム検証
- `validateUmaMarks(hanchanId)`: ウママーク合計検証
- `getSessionWithDetails(sessionId)`: セッション+半荘+プレイヤー結果を一括取得
- `calculateSessionSummary(sessionId, mainUserId)`: セッションサマリー計算

### Error Handling & Logging

**統一システム** (`src/lib/logger.ts`, `src/lib/errors.ts`, `src/components/ErrorBoundary.tsx`)

**Log Levels:**
- `DEBUG`: 開発環境のみ（本番では非表示）
- `INFO`: 一般的な情報
- `WARN`: 警告（動作影響なし）
- `ERROR`: エラー（動作影響あり）

**Usage:**
```typescript
import { logger } from '@/lib/logger';
import { DatabaseError, ValidationError } from '@/lib/errors';

logger.debug('処理開始', { context: 'module.function', data: { ... } });

try {
  // ...
} catch (err) {
  const error = new DatabaseError('エラーメッセージ', { originalError: err });
  logger.error(error.message, { context: 'module.function', error });
  throw error;
}
```

**Custom Errors:**
- `AppError`: 基底クラス
- `DatabaseError`: データベースエラー
- `ValidationError`: バリデーションエラー
- `NotFoundError`: データ未検出
- `ConflictError`: データ競合

**ErrorBoundary:** Reactコンポーネントツリーのエラーをキャッチ。App全体をラップ。

## File Structure

```
src/
├── lib/
│   ├── db.ts              # Dexieスキーマ定義
│   ├── db-utils.ts        # DB操作ヘルパー
│   ├── session-utils.ts   # セッション計算・保存ロジック
│   ├── logger.ts          # 統一ロガー
│   ├── errors.ts          # カスタムエラークラス
│   └── utils.ts           # ユーティリティ
├── components/
│   ├── tabs/
│   │   ├── InputTab.tsx   # 新規入力タブ
│   │   ├── HistoryTab.tsx # 履歴タブ
│   │   ├── AnalysisTab.tsx # 分析タブ（プレースホルダー）
│   │   └── SettingsTab.tsx # 設定タブ
│   ├── SessionDetailDialog.tsx # セッション詳細ダイアログ
│   ├── PlayerSelect.tsx   # プレイヤー選択コンポーネント
│   ├── NewPlayerDialog.tsx # 新規プレイヤー登録ダイアログ
│   ├── ErrorBoundary.tsx  # エラーバウンダリ
│   └── ui/                # shadcn/uiコンポーネント
├── hooks/
│   ├── useUsers.ts        # ユーザー管理フック
│   └── useSessions.ts     # セッション管理フック
├── App.tsx                # ルートコンポーネント（タブレイアウト）
└── main.tsx               # エントリーポイント
```

## Configuration

### Path Aliasing
- `@/*` → `src/*` (vite.config.ts で設定済み)

### Tailwind CSS v4
- **重要**: Vite plugin使用 (`@tailwindcss/vite`)
- PostCSS config不要、tailwind.config.js不要
- `src/index.css`: `@import "tailwindcss";` のみ

### TypeScript
- `tsconfig.app.json`: アプリコード用
- `tsconfig.node.json`: Vite設定用

## Critical Implementation Notes

### React 19 Strict Mode
- `useEffect`が2回実行される → 競合状態(race condition)に注意
- メインユーザー初期化: 固定ID (`main-user-fixed-id`) で重複作成を防止

### Dexie.js Best Practices
- EntityTable パターン使用: `EntityTable<Type, 'primaryKey'>`
- Boolean値をインデックスに使用しない
- 外部キー検索: `.where('foreignKey').equals(id)`
- 複数ID検索: `.where('id').anyOf([id1, id2, ...])`

### Error Handling Pattern
全ての非同期関数で:
1. バリデーション → `ValidationError`
2. try-catch → `DatabaseError` 等
3. logger.error() でログ出力
4. throw error

## Development Workflow

**完了済み:**
1. ✅ DB層実装 (Phase 1)
2. ✅ UIコンポーネント実装 (Phase 2)
   - 新規入力タブ（InputTab）
   - 設定タブ（SettingsTab）
3. ✅ ユーザーアーカイブシステム (Phase 2.5)
4. ✅ DB保存機能 (Phase 3)
5. ✅ 履歴タブ基本機能 (Phase 4 Stage 1-3)
   - セッション一覧・詳細表示
   - 削除機能
   - パフォーマンス最適化（サマリー事前計算）

**次のステップ:**
- Phase 4 Stage 4-5: 編集機能、UI/UX改善
- Phase 5: 分析タブ実装
- Phase 6: Capacitor統合（iOS/Androidアプリ化）

## Documentation

詳細な設計・仕様は `project-docs/` 参照:
- `2025-10-03-initial-discussion/`: 初期設計・要件定義
- `2025-10-03-phase1-basic-implementation/`: Phase 1実装ドキュメント
- `2025-10-03-phase2-ui-implementation/`: Phase 2 UI実装ドキュメント
- `2025-10-04-phase2.5-user-archive-system/`: Phase 2.5アーカイブシステム
- `2025-10-04-phase4-history-tab/`: Phase 4履歴タブ実装ドキュメント

**Key Docs:**
- `09-DATA_MODEL_DESIGN.md`: データモデル詳細
- `01-DEBUG_ERROR_HANDLING_STRATEGY.md`: エラーハンドリング方針
- `03-PLAYER_ORDER_FIX.md`: プレイヤー列順修正
- `04-SUMMARY_PRE_CALCULATION.md`: サマリー事前計算（パフォーマンス最適化）

**進捗管理:**
- `MASTER_STATUS_DASHBOARD.md`: プロジェクト全体の進捗状況
