# データモデル設計（Dexie.js）

**作成日**: 2025-10-03 02:27
**ステータス**: 設計完了

---

## 📊 エンティティ全体像

```
User（ユーザー）
  ↓ 1:N
Session（セッション - 1日の麻雀記録）
  ↓ 1:N
Hanchan（半荘 - 1ゲーム）
  ↓ 1:N
PlayerResult（プレイヤー結果 - 各半荘での各プレイヤーの成績）
  ↓ N:1（nullable）
User（登録ユーザー）
```

---

## 🗃️ Dexie.jsスキーマ定義

### データベースクラス

```typescript
import Dexie, { Table } from 'dexie';

// ========================================
// Type Definitions
// ========================================

export type GameMode = '4-player' | '3-player';
export type UmaRule = 'standard' | 'second-minus';
export type UmaMark = '○○○' | '○○' | '○' | '' | '✗' | '✗✗' | '✗✗✗';

// ========================================
// Entity Interfaces
// ========================================

export interface User {
  id: string;                // UUID
  name: string;              // ユーザー名
  isMainUser: boolean;       // メインユーザーフラグ
  createdAt: Date;           // 登録日時
}

export interface Session {
  id: string;                // UUID
  date: string;              // YYYY-MM-DD形式
  mode: GameMode;            // '4-player' | '3-player'
  rate: number;              // 点数レート（デフォルト: 30）
  umaValue: number;          // ウマ1個あたりの価値（デフォルト: 10）
  chipRate: number;          // チップレート（デフォルト: 100）
  parlorFee: number;         // 場代（デフォルト: 0）
  umaRule: UmaRule;          // 'standard' | 'second-minus'
  createdAt: Date;           // 作成日時
  updatedAt: Date;           // 更新日時
}

export interface Hanchan {
  id: string;                // UUID
  sessionId: string;         // 外部キー（Session.id）
  hanchanNumber: number;     // 半荘番号（1, 2, 3...）
  autoCalculated: boolean;   // 自動計算済みフラグ（初回のみtrue）
  createdAt: Date;           // 作成日時
}

export interface PlayerResult {
  id: string;                // UUID
  hanchanId: string;         // 外部キー（Hanchan.id）
  userId: string | null;     // 外部キー（User.id）、null = 未登録ユーザー
  playerName: string;        // 表示名（登録ユーザーの名前 or 仮名）
  score: number;             // ±点数（例: +10, -5）
  umaMark: UmaMark;          // ウママーク
  isSpectator: boolean;      // 見学フラグ
  chips: number;             // チップ枚数（セッション終了後に入力）
  createdAt: Date;           // 作成日時
}

// ========================================
// Dexie Database Class
// ========================================

class MahjongDB extends Dexie {
  users!: Table<User, string>;
  sessions!: Table<Session, string>;
  hanchans!: Table<Hanchan, string>;
  playerResults!: Table<PlayerResult, string>;

  constructor() {
    super('MahjongDB');

    this.version(1).stores({
      users: 'id, name, isMainUser, createdAt',
      sessions: 'id, date, mode, createdAt, updatedAt',
      hanchans: 'id, sessionId, hanchanNumber, createdAt',
      playerResults: 'id, hanchanId, userId, playerName, createdAt'
    });
  }
}

export const db = new MahjongDB();
```

---

## 🔑 インデックス設計

### users テーブル
- **主キー**: `id`
- **インデックス**:
  - `name` - プレイヤー名検索用
  - `isMainUser` - メインユーザー検索用
  - `createdAt` - 登録順ソート用

### sessions テーブル
- **主キー**: `id`
- **インデックス**:
  - `date` - 日付検索・ソート用（最重要）
  - `mode` - モード別フィルタリング用
  - `createdAt` - 作成順ソート用
  - `updatedAt` - 更新順ソート用

### hanchans テーブル
- **主キー**: `id`
- **インデックス**:
  - `sessionId` - セッションとの紐付け（最重要）
  - `hanchanNumber` - 半荘番号順ソート用
  - `createdAt` - 作成順ソート用

### playerResults テーブル
- **主キー**: `id`
- **インデックス**:
  - `hanchanId` - 半荘との紐付け（最重要）
  - `userId` - ユーザー統計用（最重要）
  - `playerName` - プレイヤー名検索用
  - `createdAt` - 作成順ソート用

---

## 🔗 リレーションシップ

### User → PlayerResult（1:N、nullable）
- `User.id` ← `PlayerResult.userId`
- **NULL許可**: 未登録ユーザーの場合はnull

### Session → Hanchan（1:N）
- `Session.id` ← `Hanchan.sessionId`

### Hanchan → PlayerResult（1:N）
- `Hanchan.id` ← `PlayerResult.hanchanId`

---

## 📝 サンプルクエリ

### 1. メインユーザーの取得

```typescript
const mainUser = await db.users
  .where('isMainUser')
  .equals(true)
  .first();
```

### 2. 特定日付のセッション取得

```typescript
const sessions = await db.sessions
  .where('date')
  .equals('2025-10-03')
  .toArray();
```

### 3. セッションの全データ取得（半荘・プレイヤー結果含む）

```typescript
async function getSessionWithDetails(sessionId: string) {
  const session = await db.sessions.get(sessionId);

  const hanchans = await db.hanchans
    .where('sessionId')
    .equals(sessionId)
    .sortBy('hanchanNumber');

  const hanchanIds = hanchans.map(h => h.id);
  const playerResults = await db.playerResults
    .where('hanchanId')
    .anyOf(hanchanIds)
    .toArray();

  return {
    session,
    hanchans: hanchans.map(hanchan => ({
      ...hanchan,
      players: playerResults.filter(pr => pr.hanchanId === hanchan.id)
    }))
  };
}
```

### 4. 特定ユーザーの全履歴取得

```typescript
async function getUserStats(userId: string) {
  // ユーザーが参加した全てのPlayerResult
  const playerResults = await db.playerResults
    .where('userId')
    .equals(userId)
    .toArray();

  // 各PlayerResultから半荘情報を取得
  const hanchanIds = [...new Set(playerResults.map(pr => pr.hanchanId))];
  const hanchans = await db.hanchans
    .where('id')
    .anyOf(hanchanIds)
    .toArray();

  // セッション情報を取得
  const sessionIds = [...new Set(hanchans.map(h => h.sessionId))];
  const sessions = await db.sessions
    .where('id')
    .anyOf(sessionIds)
    .toArray();

  return { playerResults, hanchans, sessions };
}
```

### 5. モード別統計取得（4人打ちのみ）

```typescript
async function get4PlayerStats(userId: string) {
  // 4人打ちセッションを取得
  const sessions = await db.sessions
    .where('mode')
    .equals('4-player')
    .toArray();

  const sessionIds = sessions.map(s => s.id);

  // セッション内の半荘を取得
  const hanchans = await db.hanchans
    .where('sessionId')
    .anyOf(sessionIds)
    .toArray();

  const hanchanIds = hanchans.map(h => h.id);

  // ユーザーのプレイヤー結果を取得
  const playerResults = await db.playerResults
    .where('hanchanId')
    .anyOf(hanchanIds)
    .filter(pr => pr.userId === userId)
    .toArray();

  return { playerResults, sessions };
}
```

### 6. 期間フィルター（今月のデータ）

```typescript
async function getThisMonthSessions() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const startDate = `${year}-${month}-01`;
  const endDate = `${year}-${month}-31`;

  return await db.sessions
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
}
```

---

## ✅ データ整合性チェック

### ゼロサム原則の検証

```typescript
async function validateZeroSum(hanchanId: string): Promise<boolean> {
  const playerResults = await db.playerResults
    .where('hanchanId')
    .equals(hanchanId)
    .filter(pr => !pr.isSpectator) // 見学者を除く
    .toArray();

  const total = playerResults.reduce((sum, pr) => sum + pr.score, 0);

  return Math.abs(total) < 0.01; // 誤差許容
}
```

### ウママークの合計チェック

```typescript
async function validateUmaMarks(hanchanId: string): Promise<boolean> {
  const playerResults = await db.playerResults
    .where('hanchanId')
    .equals(hanchanId)
    .filter(pr => !pr.isSpectator) // 見学者を除く
    .toArray();

  const umaValues: Record<UmaMark, number> = {
    '○○○': 3,
    '○○': 2,
    '○': 1,
    '': 0,
    '✗': -1,
    '✗✗': -2,
    '✗✗✗': -3
  };

  const total = playerResults.reduce(
    (sum, pr) => sum + umaValues[pr.umaMark],
    0
  );

  return total === 0; // 必ず0になる（ゼロサム）
}
```

---

## 🔧 初期データのセットアップ

### メインユーザーの自動作成

```typescript
async function initializeMainUser() {
  const existingMainUser = await db.users
    .where('isMainUser')
    .equals(true)
    .first();

  if (!existingMainUser) {
    await db.users.add({
      id: crypto.randomUUID(),
      name: '自分',
      isMainUser: true,
      createdAt: new Date()
    });
  }
}
```

---

## 💾 データの永続化

### IndexedDBの特性
- **オフライン完全対応**: ネットワーク不要
- **容量**: 数十MB〜数百MB（ブラウザ依存）
- **5年間のデータ**: 約60,000レコード → 数MB程度（余裕）
- **削除されない**: ブラウザキャッシュクリアでも残る

### バックアップ（将来実装予定）
- JSONエクスポート機能
- インポート機能
- 自動バックアップ（クラウド同期）

---

## 🚀 次のステップ

1. **データベースファイルの実装**
   - `src/lib/db.ts` - スキーマ定義
   - `src/lib/db-utils.ts` - ヘルパー関数

2. **カスタムフックの作成**
   - `useUsers()` - ユーザー管理
   - `useSessions()` - セッション管理
   - `useStats()` - 統計計算

3. **コンポーネントの実装**
   - 新規入力タブ
   - 履歴タブ
   - 分析タブ
   - 設定タブ

---

**更新履歴**:
- 2025-10-03 02:27: 初回作成、データモデル設計完了
