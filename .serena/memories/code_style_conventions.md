# コーディング規約

Last updated: 2025-10-12

## TypeScript規約

### 命名規則
- **ファイル名**: PascalCase（コンポーネント）、kebab-case（ユーティリティ）
  - `InputTab.tsx`, `session-utils.ts`
- **コンポーネント**: PascalCase
  - `function InputTab() {}`
- **関数**: camelCase
  - `calculateSessionSummary()`
- **定数**: UPPER_SNAKE_CASE（グローバル定数）
  - `const MAIN_USER_ID = 'main-user-fixed-id';`
- **型/インターフェース**: PascalCase
  - `interface User {}`, `type GameMode = ...`

### 型定義
```typescript
// ✅ 推奨
interface User {
  id: string;
  name: string;
  isMainUser: boolean;
}

// ❌ 禁止
let user: any;  // anyは禁止

// ✅ ユニオン型活用
type GameMode = '4-player' | '3-player';

// ✅ オプショナル型
interface Session {
  summary?: SessionSummary;  // オプショナル
}

// ✅ Nullable型
interface PlayerResult {
  userId: string | null;  // null許容
}
```

### 関数定義
```typescript
// ✅ 推奨: 明示的な戻り値型
export async function getMainUser(): Promise<User | undefined> {
  // ...
}

// ✅ 推奨: JSDocコメント（複雑な関数）
/**
 * セッションサマリーを計算
 * @param sessionId セッションID
 * @param mainUserId メインユーザーID
 * @returns セッションサマリー
 */
export async function calculateSessionSummary(
  sessionId: string,
  mainUserId: string
): Promise<SessionSummary> {
  // ...
}

// ❌ 避ける: 暗黙的any
function process(data) {  // dataの型が不明
  // ...
}
```

### Import順序
```typescript
// 1. React関連
import { useState, useEffect } from 'react';

// 2. 外部ライブラリ
import { toast } from 'sonner';

// 3. 内部モジュール（@/パスエイリアス）
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { User, Session } from '@/lib/db-utils';

// 4. コンポーネント
import { Button } from '@/components/ui/button';

// 5. スタイル（必要時のみ）
import './App.css';
```

## React規約

### コンポーネント構造
```typescript
// 1. Import
import { useState } from 'react';
import type { User } from '@/lib/db-utils';

// 2. 型定義
interface InputTabProps {
  mainUser: User | null;
  users: User[];
  onSaveSuccess?: () => void;
}

// 3. コンポーネント定義
export function InputTab({ mainUser, users, onSaveSuccess }: InputTabProps) {
  // 4. State
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  
  // 5. Effects
  useEffect(() => {
    // ...
  }, [dependency]);
  
  // 6. Handlers
  const handleSave = async () => {
    // ...
  };
  
  // 7. Early return（条件分岐）
  if (!mainUser) {
    return <div>Loading...</div>;
  }
  
  // 8. JSX
  return (
    <div>
      {/* ... */}
    </div>
  );
}
```

### Hooks使用
```typescript
// ✅ 推奨: カスタムフック分離
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadUsers();
  }, []);
  
  return { users, loading, addNewUser, editUser };
}

// ✅ 推奨: 依存配列明示
useEffect(() => {
  if (mainUser) {
    loadData();
  }
}, [mainUser]);  // mainUserのみ依存

// ❌ 避ける: 空依存配列で外部変数参照
useEffect(() => {
  console.log(mainUser);  // mainUserが依存配列にない
}, []);
```

### Propsの型定義
```typescript
// ✅ 推奨: interfaceで明示
interface TabProps {
  mainUser: User | null;
  users: User[];
  addNewUser: (name: string) => Promise<User>;
  onSaveSuccess?: () => void;  // オプショナル
}

// ✅ 推奨: 分割代入
export function MyTab({ mainUser, users, addNewUser }: TabProps) {
  // ...
}
```

## データベース操作規約

### エラーハンドリング必須
```typescript
export async function addUser(name: string): Promise<User> {
  // 1. バリデーション
  if (!name.trim()) {
    const error = new ValidationError('ユーザー名が空です', 'name');
    logger.error(error.message, { context: 'db/users.addUser', error });
    throw error;
  }
  
  try {
    // 2. DB操作前ログ
    logger.debug('ユーザー追加開始', { 
      context: 'db/users.addUser', 
      data: { userName: name } 
    });
    
    // 3. DB操作
    const user: User = {
      id: crypto.randomUUID(),
      name,
      isMainUser: false,
      isArchived: false,
      createdAt: new Date()
    };
    await db.users.add(user);
    
    // 4. 成功ログ
    logger.info('ユーザー追加成功', {
      context: 'db/users.addUser',
      data: { userId: user.id }
    });
    
    return user;
  } catch (err) {
    // 5. エラー変換とログ
    const error = new DatabaseError('ユーザーの追加に失敗しました', {
      userName: name,
      originalError: err
    });
    logger.error(error.message, { context: 'db/users.addUser', error });
    throw error;
  }
}
```

### トランザクション（複数テーブル操作）
```typescript
try {
  // 順次実行（トランザクション的）
  const session = await db.sessions.add(sessionData);
  
  for (const hanchanData of hanchansData) {
    const hanchan = await db.hanchans.add({
      ...hanchanData,
      sessionId: session.id
    });
    
    for (const playerData of hanchanData.players) {
      await db.playerResults.add({
        ...playerData,
        hanchanId: hanchan.id
      });
    }
  }
} catch (err) {
  // エラー時は手動ロールバック必要
  logger.error('保存失敗、ロールバック検討', { context, error: err });
  throw new DatabaseError('セッション保存に失敗しました');
}
```

## ロギング規約

### ログレベル使い分け
```typescript
// DEBUG: 開発環境のみ、詳細な実行情報
logger.debug('関数開始', { context: 'module.function', data: { param1, param2 } });

// INFO: 重要な処理の成功
logger.info('ユーザー追加成功', { context: 'db/users.addUser', data: { userId } });

// WARN: 警告（動作は継続）
logger.warn('メインユーザーが見つかりません', { 
  context: 'session-utils.calculateSessionSummary',
  data: { hanchanNumber, mainUserId }
});

// ERROR: エラー（動作に影響）
logger.error('ユーザー追加失敗', { 
  context: 'db/users.addUser', 
  error: error as Error 
});
```

### context命名規則
- 形式: `module.function` または `file/function`
- 例: `db/users.addUser`, `session-utils.calculateSessionSummary`

## コメント規約

### JSDocコメント
```typescript
/**
 * セッションサマリーを計算
 * 
 * 各半荘でメインユーザーの着順と収支を計算し、
 * セッション全体の統計をまとめる
 * 
 * @param sessionId セッションID
 * @param mainUserId メインユーザーID
 * @returns セッションサマリー
 * @throws {NotFoundError} セッションが見つからない場合
 */
export async function calculateSessionSummary(
  sessionId: string,
  mainUserId: string
): Promise<SessionSummary> {
  // ...
}
```

### インラインコメント
```typescript
// ✅ 推奨: WHYを説明
// React 19 Strict Modeの二重実行対策のため固定ID使用
const MAIN_USER_ID = 'main-user-fixed-id';

// ✅ 推奨: 複雑なロジックの説明
// 点数降順でソートし、同点の場合は同着として扱う
const sortedPlayers = players.sort((a, b) => b.score - a.score);

// ❌ 避ける: WHATを説明（コードから明らか）
// userIdが存在する場合
if (userId) {
  // ...
}
```

## ファイル構成規約

### モジュール分割基準
- **単一ファイル上限**: 500行（推奨）
- **分割タイミング**: 
  - 複数の責務が混在
  - 再利用可能な関数群
  - テストしやすい単位

### 例: db-utils.ts分割（2025-10-09）
- 1,380行 → 5モジュール（users, sessions, hanchans, validation, analysis）
- 各モジュール200-400行
- index.tsでre-export（後方互換性）

## エラーメッセージ規約

### ユーザー向けメッセージ（日本語）
```typescript
// ✅ 推奨: 具体的で分かりやすい
throw new ValidationError('ユーザー名は1文字以上必要です', 'name');

// ❌ 避ける: 技術的すぎる
throw new Error('name field validation failed');
```

### 開発者向けログ（英語OK、日本語推奨）
```typescript
// ✅ 推奨: 構造化ログ
logger.error('ユーザー追加失敗', {
  context: 'db/users.addUser',
  data: { userName: name },
  error: err as Error
});
```

## パフォーマンス規約

### DB読み取り最小化
```typescript
// ✅ 推奨: サマリー事前計算活用
const { summary } = session;
if (summary) {
  return summary;  // 事前計算済みを使用
}

// ❌ 避ける: 毎回計算
const summary = await calculateSessionSummary(sessionId);
```

### 不要な再レンダリング回避
```typescript
// ✅ 推奨: 依存配列を正確に
useEffect(() => {
  loadData();
}, [userId]);  // userIdのみ

// ❌ 避ける: 依存配列なし（毎回実行）
useEffect(() => {
  loadData();
});
```

## Git規約

### コミットメッセージ
```
# ✅ 推奨: 日本語、具体的
Phase 6完了: iOS対応・safe-area調整

# ✅ 推奨: バグ修正
バグ修正: ユーザー参加フィルタリング（3層フィルター実装）

# ✅ 推奨: UI改善
UI改善: 収支推移グラフy=0参照線追加

# ❌ 避ける: 曖昧
update code
fix bug
```

### コミット粒度
- 1機能1コミット
- 動作する状態でコミット
- 大規模変更は複数コミットに分割

## 禁止事項

### 絶対禁止
1. `any` 型使用（型安全性破壊）
2. `console.log` 直接使用（logger使用必須）
3. Boolean値をIndexedDBインデックスに使用
4. 物理削除（論理削除を使用）
5. エラーハンドリングなしのDB操作

### 推奨しない
1. 500行超の単一ファイル
2. 複雑すぎる1関数（50行超）
3. グローバル変数
4. 暗黙的型推論（戻り値型は明示）
