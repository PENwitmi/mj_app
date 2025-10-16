# データベース実装詳細

Last updated: 2025-10-12

## Dexie.js 設定

### テーブル定義 (db.ts)
```typescript
// Version 1: Initial schema
db.version(1).stores({
  users: 'id, name, createdAt',
  sessions: 'id, date, mode, createdAt, updatedAt',
  hanchans: 'id, sessionId, hanchanNumber, createdAt',
  playerResults: 'id, hanchanId, userId, playerName, createdAt'
});

// Version 2: Added Session.summary for performance optimization
db.version(2).stores({
  users: 'id, name, createdAt',
  sessions: 'id, date, mode, createdAt, updatedAt',
  hanchans: 'id, sessionId, hanchanNumber, createdAt',
  playerResults: 'id, hanchanId, userId, playerName, createdAt'
});
```

## ドメイン別モジュール構成（2025-10-09リファクタリング）

**元の状態**: db-utils.ts（1,380行の単一ファイル）
**リファクタリング後**: 5つのモジュールに分割

### app/src/lib/db/

1. **index.ts**: 公開API re-export
   - 各モジュールの関数をまとめて提供
   - クリーンな外部インターフェース

2. **users.ts**: ユーザー管理（~200行）
   - CRUD操作: getMainUser, getAllUsers, getRegisteredUsers
   - アーカイブシステム: archiveUser, restoreUser, getActiveUsers, getArchivedUsers
   - 更新: addUser, updateUser
   - 削除: deleteUser (deprecated、内部でarchiveUser呼び出し)

3. **sessions.ts**: セッション管理（~400行）
   - CRUD操作: createSession, getSessionsByDate, getAllSessions
   - 保存: saveSession（トランザクション処理）
   - 更新・削除: updateSession, deleteSession（カスケード削除）
   - UI変換: sessionToSettings, dbHanchansToUIHanchans, uiDataToSaveData

4. **hanchans.ts**: 半荘・プレイヤー結果管理（~300行）
   - 半荘操作: createHanchan, getHanchansBySession
   - プレイヤー結果: createPlayerResult, getPlayerResultsByHanchan（position順ソート）
   - 複合クエリ: getSessionWithDetails（セッション+半荘+プレイヤー結果）
   - 統計: getUserStats（ユーザー別統計）

5. **validation.ts**: バリデーション（~100行）
   - validateZeroSum: ゼロサム検証（見学者除外、誤差許容）
   - validateUmaMarks: ウママーク合計検証（必ず0）

6. **analysis.ts**: 分析統計（~400行）
   - 統計計算: calculateRankStatistics, calculateRevenueStatistics, calculatePointStatistics, calculateChipStatistics
   - フィルター: filterSessionsByPeriod, filterSessionsByMode
   - 着順判定: 点数ベース（umaMark依存から脱却）

### 後方互換性
- **db-utils.ts**: 各モジュールから関数をre-export
- 既存コードはそのまま動作（import pathの変更不要）

## 重要な実装パターン

### 1. メインユーザー初期化（固定ID方式）
```typescript
const MAIN_USER_ID = 'main-user-fixed-id';
```
- React 19 Strict Modeでの2重実行対策
- 固定IDで重複作成を防止
- 既存チェック → 存在すれば返す → なければ作成

### 2. EntityTable パターン
```typescript
export const db = new Dexie('MahjongDB') as Dexie & {
  users: EntityTable<User, 'id'>;
  sessions: EntityTable<Session, 'id'>;
  hanchans: EntityTable<Hanchan, 'id'>;
  playerResults: EntityTable<PlayerResult, 'id'>;
};
```

### 3. Boolean値の扱い
- **禁止**: Boolean値をインデックスに使用
- **理由**: IndexedDBの制限
- **対策**: `toArray()` → in-memory filtering
```typescript
const allUsers = await db.users.toArray();
const mainUser = allUsers.find(user => user.isMainUser);
```

## バリデーション

### ゼロサム検証（db/validation.ts）
```typescript
export async function validateZeroSum(hanchanId: string): Promise<boolean> {
  const playerResults = await db.playerResults
    .where('hanchanId')
    .equals(hanchanId)
    .filter(pr => !pr.isSpectator) // 見学者を除く
    .toArray();
  
  const total = playerResults.reduce((sum, pr) => sum + pr.score, 0);
  return Math.abs(total) < 0.01; // 誤差許容
}
```

### ウママーク検証（db/validation.ts）
```typescript
export async function validateUmaMarks(hanchanId: string): Promise<boolean> {
  const playerResults = await db.playerResults
    .where('hanchanId')
    .equals(hanchanId)
    .filter(pr => !pr.isSpectator) // 見学者を除く
    .toArray();
  
  const umaValues: Record<UmaMark, number> = {
    '○○○': 3, '○○': 2, '○': 1, '': 0,
    '✗': -1, '✗✗': -2, '✗✗✗': -3
  };
  
  const total = playerResults.reduce(
    (sum, pr) => sum + umaValues[pr.umaMark],
    0
  );
  
  return total === 0; // 必ず0
}
```

## クエリパターン

### 外部キー検索
```typescript
// 単一IDで検索
await db.hanchans.where('sessionId').equals(sessionId).toArray();

// 複数IDで検索
await db.sessions.where('id').anyOf([id1, id2, id3]).toArray();
```

### 複合クエリ（db/hanchans.ts）
```typescript
export async function getSessionWithDetails(sessionId: string) {
  const session = await db.sessions.get(sessionId);
  if (!session) return null;
  
  const hanchans = await getHanchansBySession(sessionId);
  const hanchansWithPlayers = await Promise.all(
    hanchans.map(async (hanchan) => ({
      ...hanchan,
      players: await getPlayerResultsByHanchan(hanchan.id)
    }))
  );
  
  return { session, hanchans: hanchansWithPlayers };
}
```

### ソート
```typescript
// 単純なソート
await db.sessions.orderBy('date').reverse().toArray();

// 複雑なソート（メモリ内）
const hanchans = await db.hanchans
  .where('sessionId')
  .equals(sessionId)
  .toArray();
hanchans.sort((a, b) => a.hanchanNumber - b.hanchanNumber);
```

## エラーハンドリング

### 統一パターン（全モジュール共通）
```typescript
export async function addUser(name: string): Promise<User> {
  // 1. バリデーション
  if (!name.trim()) {
    const error = new ValidationError('ユーザー名が空です', 'name');
    logger.error(error.message, { context: 'db/users.addUser', error });
    throw error;
  }
  
  try {
    // 2. DB操作
    logger.debug('ユーザー追加開始', { 
      context: 'db/users.addUser', 
      data: { userName: name } 
    });
    
    const user: User = {
      id: crypto.randomUUID(),
      name,
      isMainUser: false,
      isArchived: false,
      createdAt: new Date()
    };
    
    await db.users.add(user);
    
    logger.info('ユーザー追加成功', {
      context: 'db/users.addUser',
      data: { userId: user.id, userName: user.name }
    });
    
    return user;
  } catch (err) {
    // 3. エラー変換とログ
    const error = new DatabaseError('ユーザーの追加に失敗しました', {
      userName: name,
      originalError: err
    });
    logger.error(error.message, { context: 'db/users.addUser', error });
    throw error;
  }
}
```

## 型定義

### エンティティ
```typescript
export interface User {
  id: string;                // UUID
  name: string;              // ユーザー名
  isMainUser: boolean;       // メインユーザーフラグ
  isArchived: boolean;       // アーカイブフラグ（論理削除）
  archivedAt?: Date;         // アーカイブ日時（オプショナル）
  createdAt: Date;           // 登録日時
}

export interface SessionSummary {
  sessionId: string;
  date: string;
  mode: GameMode;
  hanchanCount: number;      // 入力済み半荘数
  totalPayout: number;       // 最終収支合計
  totalChips: number;        // チップ合計
  averageRank: number;       // 平均着順
  rankCounts: {
    first: number;
    second: number;
    third: number;
    fourth?: number;         // 3人打ちの場合はundefined
  };
  overallRank: number;       // セッション内総合順位（2025-10-10追加）
}

export interface Session {
  id: string;                // UUID
  date: string;              // YYYY-MM-DD形式
  mode: GameMode;            // '4-player' | '3-player'
  rate: number;              // 点数レート
  umaValue: number;          // ウマ1個あたりの価値
  chipRate: number;          // チップレート
  parlorFee: number;         // 場代（セッション設定）
  umaRule: UmaRule;          // 'standard' | 'second-minus'
  summary?: SessionSummary;  // 事前計算されたサマリー（パフォーマンス最適化）
  createdAt: Date;
  updatedAt: Date;
}

export interface Hanchan {
  id: string;                // UUID
  sessionId: string;         // 外部キー
  hanchanNumber: number;     // 半荘番号（1, 2, 3...）
  autoCalculated: boolean;   // 自動計算済みフラグ
  createdAt: Date;
}

export interface PlayerResult {
  id: string;                // UUID
  hanchanId: string;         // 外部キー
  userId: string | null;     // 外部キー（null = 未登録）
  playerName: string;        // 表示名
  score: number;             // ±点数
  umaMark: UmaMark;          // ウママーク
  isSpectator: boolean;      // 見学フラグ
  chips: number;             // チップ枚数
  parlorFee: number;         // 場代（プレイヤー個別、2025-10-12追加）
  position: number;          // 列番号（0, 1, 2, 3） - InputTabでの列順を保持
  createdAt: Date;
}
```

### ユニオン型
```typescript
export type GameMode = '4-player' | '3-player';
export type UmaRule = 'standard' | 'second-minus';
export type UmaMark = '○○○' | '○○' | '○' | '' | '✗' | '✗✗' | '✗✗✗';
```

## 重要な実装機能

### 1. ユーザーアーカイブシステム（Phase 2.5、db/users.ts）
```typescript
// 論理削除
export async function archiveUser(userId: string): Promise<void> {
  const user = await db.users.get(userId);
  if (!user) throw new NotFoundError('User', userId);
  await db.users.update(userId, {
    isArchived: true,
    archivedAt: new Date()
  });
}

// 復元
export async function restoreUser(userId: string): Promise<void> {
  await db.users.update(userId, {
    isArchived: false,
    archivedAt: undefined
  });
}

// アクティブユーザー取得
export async function getActiveUsers(): Promise<User[]> {
  return await db.users
    .toArray()
    .then(users => users.filter(u => !u.isArchived));
}
```

### 2. セッション保存（Phase 3、session-utils.ts）
```typescript
// サマリー事前計算付き保存（パフォーマンス最適化）
export async function saveSessionWithSummary(
  data: SessionSaveData,
  mainUserId: string
): Promise<string> {
  // 1. セッションを保存
  const sessionId = await dbSaveSession(data);
  
  // 2. サマリーを計算
  const summary = await calculateSessionSummary(sessionId, mainUserId);
  
  // 3. セッションにサマリーを保存
  await db.sessions.update(sessionId, { summary });
  
  return sessionId;
}
```

### 3. 列順保持（Phase 4 Stage 2、db/hanchans.ts）
```typescript
// PlayerResult.position フィールドで列順を保持
export async function getPlayerResultsByHanchan(hanchanId: string): Promise<PlayerResult[]> {
  const results = await db.playerResults
    .where('hanchanId')
    .equals(hanchanId)
    .toArray();

  // position順にソート（InputTabでの列順を復元）
  return results.sort((a, b) => a.position - b.position);
}
```

### 4. 点数ベース着順計算（Phase 5、session-utils.ts）
```typescript
// umaMark依存から点数ベースへ変更（より正確な統計）
export function calculateRanks(playerResults: PlayerResult[]): Map<string, number> {
  const rankMap = new Map<string, number>();
  
  const activePlayers = playerResults
    .filter((p) => !p.isSpectator && p.score !== null)
    .sort((a, b) => b.score - a.score); // 点数降順
  
  let currentRank = 1;
  activePlayers.forEach((player, index) => {
    if (index > 0 && player.score < activePlayers[index - 1].score) {
      currentRank = index + 1;
    }
    rankMap.set(player.id, currentRank);
  });
  
  return rankMap;
}
```

### 5. 総合順位計算（Phase 4拡張、session-utils.ts）
```typescript
// セッション内全プレイヤーの総収支ベースで順位計算
const playerPayouts = new Map<string, number>();

for (const hanchan of hanchans) {
  for (const player of hanchan.players) {
    if (player.isSpectator || player.score === null || player.score === 0) {
      continue;
    }
    
    const payout = calculatePayout(
      player.score,
      player.umaMark,
      player.chips,
      session.rate,
      session.umaValue,
      session.chipRate,
      player.parlorFee  // プレイヤー個別場代
    );
    
    const playerKey = player.userId ?? player.playerName;
    playerPayouts.set(playerKey, (playerPayouts.get(playerKey) || 0) + payout);
  }
}

// 収支降順でソート、メインユーザーの順位を特定
const sortedPlayers = Array.from(playerPayouts.entries())
  .sort((a, b) => b[1] - a[1]);
const overallRank = sortedPlayers.findIndex(([id]) => id === mainUserId) + 1;
```

## ベストプラクティス

1. **UUID生成**: `crypto.randomUUID()`
2. **日付**: ISO形式文字列（YYYY-MM-DD）またはDateオブジェクト
3. **外部キー**: 文字列型のUUID、nullable可
4. **ログ**: 全操作でdebug/info/errorログ出力（構造化ログ）
5. **エラー**: カスタムエラークラス使用、元エラーを保持
6. **バリデーション**: DB操作前に実施、早期リターン
7. **論理削除**: isArchived/archivedAtで管理（物理削除は使用しない）
8. **パフォーマンス最適化**: サマリー事前計算でDB読み取りを95%削減
9. **モジュール分割**: ドメイン別に分割、後方互換性確保
10. **点数ベース計算**: umaMark依存を排除、より正確な統計
