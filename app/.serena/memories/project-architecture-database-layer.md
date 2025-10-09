# データベース層アーキテクチャ（2025-10-09更新）

**最終更新**: 2025-10-09 20:19

## 概要

麻雀アプリのデータベース層は、Dexie.js（IndexedDB wrapper）を使用したクライアントサイドストレージで構成されています。Phase 2リファクタリング（2025-10-09）により、モジュール化された構造に改善されました。

## アーキテクチャ構造

### ファイル構成

```
src/lib/
├── db.ts                    # Dexieスキーマ定義 + 型定義
├── db-utils.ts             # 後方互換レイヤー（re-export）
├── db/                     # モジュール化されたDB操作層
│   ├── index.ts           # 公開API統一エクスポート
│   ├── validation.ts      # データ検証機能
│   ├── hanchans.ts        # 半荘・プレイヤー結果管理
│   ├── analysis.ts        # 統計計算・フィルター
│   ├── sessions.ts        # セッション管理
│   └── users.ts           # ユーザー管理
└── session-utils.ts        # セッションサマリー計算
```

## データモデル（4層構造）

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

### 主要テーブル

#### User
- `id`: string (PK)
- `name`: string
- `isArchived`: boolean (論理削除)
- `archivedAt`: number | null
- `createdAt`: number

**特殊ユーザー**:
- メインユーザー: 固定ID `main-user-fixed-id`

#### Session
- `id`: string (PK)
- `date`: string (YYYY-MM-DD)
- `mode`: '4-player' | '3-player'
- `rate`: number
- `umaValue`: number
- `chipRate`: number
- `umaRule`: 'standard' | 'second-minus'
- `summary`: SessionSummary | null (事前計算サマリー)
- `createdAt`: number

#### Hanchan
- `id`: string (PK)
- `sessionId`: string (FK → Session)
- `hanchanNumber`: number
- `createdAt`: number

#### PlayerResult
- `id`: string (PK)
- `hanchanId`: string (FK → Hanchan)
- `userId`: string | null (FK → User, nullable)
- `playerName`: string
- `score`: number (±形式)
- `umaMark`: UmaMark ('○○○' | '○○' | '○' | '' | '✗' | '✗✗' | '✗✗✗')
- `chips`: number
- `parlorFee`: number
- `isSpectator`: boolean
- `position`: number (列順保持)
- `createdAt`: number

## モジュール別責務

### 1. validation.ts (40行)
**責務**: データ整合性検証

**エクスポート関数**:
- `validateZeroSum(hanchanId)`: ゼロサム原則チェック
- `validateUmaMarks(hanchanId)`: ウママーク合計0チェック

**依存**: db.ts, uma-utils.ts

### 2. hanchans.ts (160行)
**責務**: 半荘・プレイヤー結果のCRUD操作

**エクスポート関数**:
- `createHanchan(sessionId, hanchanNumber)`
- `getHanchansBySession(sessionId)`
- `createPlayerResult(hanchanId, userId, playerName, score, umaMark, position)`
- `getPlayerResultsByHanchan(hanchanId)` ※position順ソート
- `getSessionWithDetails(sessionId)` ※複雑クエリ
- `getUserStats(userId)`

**依存**: db.ts, logger.ts, errors.ts

### 3. analysis.ts (350行)
**責務**: 統計計算・フィルター・型定義

**エクスポート型**:
- `PeriodType`: 期間フィルター
- `AnalysisFilter`: フィルター条件
- `RankStatistics`: 着順統計
- `RevenueStatistics`: 収支統計
- `PointStatistics`: ポイント統計
- `ChipStatistics`: チップ統計
- `AnalysisStatistics`: 統合型

**エクスポート関数**:
- `calculateRankStatistics(hanchans, targetUserId, mode)` ※点数ベース着順判定
- `calculateRevenueStatistics(sessions)`
- `calculatePointStatistics(playerResults)`
- `calculateChipStatistics(playerResults)`
- `filterSessionsByPeriod(sessions, period)`
- `filterSessionsByMode(sessions, mode)`

**依存**: db.ts

**重要**: 着順はウママークではなく点数降順で判定（session-utils.tsと同じロジック）

### 4. sessions.ts (700行)
**責務**: セッション管理・保存・更新・削除

**エクスポート型**:
- `SessionSaveData`: DB保存用データ
- `UIHanchan`: UI層の半荘データ
- `UIPlayerResult`: UI層のプレイヤーデータ

**エクスポート関数**:
- `createSession(date, mode)`
- `getSessionsByDate(date)`
- `getAllSessions()`
- `saveSession(data)` ※一括作成 + バリデーション
- `deleteSession(sessionId)` ※カスケード削除
- `updateSession(sessionId, data, mainUserId)` ※カスケード更新
- `sessionToSettings(session)`: DB → UI変換
- `dbHanchansToUIHanchans(dbHanchans)`: DB → UI変換
- `uiDataToSaveData(settings, hanchans, mode)`: UI → DB変換

**依存**: db.ts, validation.ts, logger.ts, errors.ts

### 5. users.ts (320行)
**責務**: ユーザー管理・アーカイブシステム

**エクスポート関数**:
- `getMainUser()`: メインユーザー取得
- `getAllUsers()`: 全ユーザー取得
- `getRegisteredUsers()`: 登録ユーザー取得（アクティブのみ）
- `addUser(name)`: 新規ユーザー追加
- `updateUser(userId, name)`: ユーザー名変更
- `archiveUser(userId)`: 論理削除
- `restoreUser(userId)`: アーカイブ復元
- `getActiveUsers()`: アクティブユーザー取得
- `getArchivedUsers()`: アーカイブ済みユーザー取得
- `deleteUser(userId)`: **非推奨** - archiveUser()を使用推奨

**依存**: db.ts, logger.ts, errors.ts

### 6. index.ts (60行)
**責務**: 公開API統一エクスポート

全モジュールの関数・型を統一してre-export。

### 7. db-utils.ts (12行)
**責務**: 後方互換レイヤー

```typescript
// db.ts から型定義とインスタンスをre-export
export { db } from './db';
export type { User, Session, Hanchan, PlayerResult, UmaMark, UmaRule, GameMode } from './db';

// 新モジュールから全てをre-export
export * from './db/index';
```

既存コードの`@/lib/db-utils`インポートをそのまま維持。

## データフロー

### 新規セッション保存
```
InputTab (UI)
  ↓ SessionSaveData作成
saveSession() (sessions.ts)
  ↓ バリデーション
  ├→ validateZeroSum() (validation.ts)
  └→ validateUmaMarks() (validation.ts)
  ↓ Dexieトランザクション
  ├→ Session作成
  ├→ Hanchan作成（複数）
  └→ PlayerResult作成（複数×半荘数）
  ↓ サマリー計算
calculateSessionSummary() (session-utils.ts)
  ↓ Session.summary更新
完了 → toast通知 → 履歴タブ遷移
```

### セッション読み込み（最適化版）
```
HistoryTab / AnalysisTab
  ↓
useSessions() hook
  ↓
getAllSessions() (sessions.ts)
  ↓ Session.summaryチェック
  ├→ あり → そのまま使用 ⚡ (高速)
  └→ なし → calculateSessionSummary() (後方互換)
  ↓
SessionWithSummary[]
```

### セッション詳細読み込み
```
SessionDetailDialog
  ↓
getSessionWithDetails() (hanchans.ts)
  ↓ 複雑クエリ（1回のDB操作）
  ├→ Session取得
  ├→ Hanchan[] 取得
  └→ PlayerResult[][] 取得（各半荘）
  ↓ position順ソート
詳細表示
```

## パフォーマンス最適化

### 1. サマリー事前計算（Phase 4 Stage 3）
- `Session.summary`フィールドに事前計算結果を保存
- 履歴タブ表示: 300-800ms → 1-2ms (約400倍高速化)
- DB読み取り: 理論上95%削減

### 2. キャッシュ利用
```
[LOG] ✅ 履歴タブ: 読み込み完了 (2.4ms)
  {total: 3, cached: 2, calculated: 1, performance: 🚀 キャッシュ利用}
```

### 3. 条件付き半荘読み込み
- AnalysisTab: `useSessions({ includeHanchans: true })`
- HistoryTab: `useSessions()` (半荘不要)

## 重要な制約・原則

### 1. ゼロサム原則
各半荘の点数合計は必ず0（見学者を除く）
- InputTab: 最後の1人を自動計算
- saveSession: バリデーションで確認

### 2. ウママーク合計0原則
各半荘のウママーク合計値は必ず0
- ○○○=+3, ○○=+2, ○=+1, 空=0, ✗=-1, ✗✗=-2, ✗✗✗=-3

### 3. アーカイブシステム（論理削除）
- 物理削除は使用禁止
- `archiveUser()`で論理削除
- PlayerResult.userIdが孤立参照にならない

### 4. Boolean値インデックス問題
IndexedDBではBoolean値をインデックスに使用不可
→ in-memory filteringで対応

### 5. React 19 Strict Mode対応
メインユーザー重複作成防止 → 固定ID使用

## エラーハンドリング

### カスタムエラークラス
- `DatabaseError`: DB操作エラー
- `ValidationError`: データ検証エラー
- `NotFoundError`: データ未検出
- `ConflictError`: データ競合

### ロギング
```typescript
import { logger } from '@/lib/logger';

logger.debug('処理開始', { context: 'module.function', data: {...} });
logger.error(error.message, { context: 'module.function', error });
```

## 使用例

### 基本的な使用方法
```typescript
import { 
  getMainUser, 
  saveSession, 
  getAllSessions,
  calculateRankStatistics 
} from '@/lib/db-utils'; // 後方互換

// または新しいパス
import { getMainUser } from '@/lib/db/users';
import { saveSession } from '@/lib/db/sessions';
```

### カスタムフック
```typescript
// src/hooks/useUsers.ts
import { getMainUser, getRegisteredUsers, addUser } from '@/lib/db-utils';

// src/hooks/useSessions.ts
import { getAllSessions } from '@/lib/db-utils';
```

## 今後の拡張可能性

### 推奨される追加モジュール
1. `export-import.ts`: CSV/JSONエクスポート・インポート
2. `backup.ts`: バックアップ・復元機能
3. `migration.ts`: データマイグレーション管理

### モジュール分割候補
- `session-utils.ts`を`sessions.ts`に統合検討
- `analysis.ts`をさらに細分化（統計計算 vs フィルター）

## 参照ドキュメント

- `project-docs/2025-10-03-initial-discussion/09-DATA_MODEL_DESIGN.md`
- `project-docs/2025-10-09-db-utils-refactoring/01-REFACTORING_PLAN.md`
- `project-docs/2025-10-09-db-utils-refactoring/02-INTEGRATION_TEST_REPORT.md`
- `CLAUDE.md` (Database セクション)

---

**作成日時**: 2025-10-09 20:19
**作成者**: Claude Code
**プロジェクト**: 麻雀アプリ
