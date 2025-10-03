# ユーザーアーカイブシステム実装計画

**作成日**: 2025-10-04 07:30
**ステータス**: 設計完了・実装待ち
**フェーズ**: Phase 2.5

---

## 📋 目次

1. [概要・背景](#概要背景)
2. [現状の課題](#現状の課題)
3. [アーカイブ方式の採用理由](#アーカイブ方式の採用理由)
4. [アーキテクチャ設計](#アーキテクチャ設計)
5. [データモデル変更](#データモデル変更)
6. [DB関数実装](#db関数実装)
7. [UI/UX設計](#uiux設計)
8. [マイグレーション戦略](#マイグレーション戦略)
9. [実装手順](#実装手順)
10. [テスト計画](#テスト計画)
11. [リスク管理](#リスク管理)

---

## 🎯 概要・背景

### 目的
ユーザー削除機能を「アーカイブ（論理削除/ソフトデリート）」方式に変更し、データ整合性の確保と誤削除からの復旧を可能にする。

### 対象範囲
- データモデル拡張（User型にフィールド追加）
- DB関数の置き換え（deleteUser → archiveUser/restoreUser）
- UI/UX改善（アーカイブセクション追加、復元機能）
- 既存機能の互換性確保

---

## ❌ 現状の課題

### 問題1: データ整合性リスク
**現在の実装:**
```typescript
// db-utils.ts
export async function deleteUser(userId: string): Promise<void> {
  await db.users.delete(userId);  // ← 物理削除
}
```

**問題:**
- PlayerResultのuserIdが孤立参照になる
- 統計計算時にデータ不整合が発生する可能性
- 削除されたユーザーの過去記録が「不明なユーザー」として表示される

### 問題2: 復旧不可
- 誤削除したユーザーを復元できない
- 長年のデータが一瞬で失われる
- ユーザー体験の悪化

### 問題3: 統計の不正確性
- ユーザー削除後、過去の統計が正しく表示されない
- 削除されたユーザーのデータが集計対象外になる

---

## ✅ アーカイブ方式の採用理由

### 比較表

| 観点 | ハードデリート（現状） | ソフトデリート（アーカイブ） |
|------|----------------------|----------------------------|
| データ整合性 | ❌ PlayerResult更新が必要 | ✅ 完璧に保持 |
| 復元可能性 | ❌ 不可能 | ✅ 簡単に復元 |
| 統計の正確性 | ⚠️ 不正確になる可能性 | ✅ 常に正確 |
| 実装の複雑さ | ❌ 複雑（関連データ更新） | ✅ シンプル（フラグ管理） |
| 監査証跡 | ❌ 履歴なし | ✅ 削除履歴が残る |
| 同名ユーザー | ⚠️ 再登録可能（混乱） | ✅ 復元提案可能 |

### 麻雀アプリの特性との適合性

1. **長期利用**: 5年間のデータ蓄積想定 → 削除ミスが致命的
2. **固定メンバー**: 頻繁に対戦する友人 → 誤削除リスク高
3. **統計の重要性**: 成績分析がコア機能 → データ整合性が必須
4. **ユーザー数少**: せいぜい数十人 → パフォーマンス問題なし

**結論: ソフトデリート方式が最適**

---

## 🏗️ アーキテクチャ設計

### 設計原則

1. **非破壊的**: 既存データを一切削除しない
2. **可逆的**: 全ての操作は元に戻せる
3. **透過的**: アーカイブ済みユーザーは選択肢に表示されない
4. **分離表示**: アクティブとアーカイブを明確に分離

### システム構成図

```
┌─────────────────────────────────────────┐
│          User Management                │
├─────────────────────────────────────────┤
│                                         │
│  📁 Active Users (isArchived: false)    │
│  ├── MainUser (削除不可)                 │
│  ├── RegisteredUser1                    │
│  └── RegisteredUser2                    │
│                                         │
│  🗄️ Archived Users (isArchived: true)   │
│  ├── ArchivedUser1 (復元可能)            │
│  └── ArchivedUser2 (復元可能)            │
│                                         │
└─────────────────────────────────────────┘
         ↓ フィルタリング
┌─────────────────────────────────────────┐
│      PlayerSelect (新規入力タブ)         │
├─────────────────────────────────────────┤
│  ⭐ MainUser                             │
│  RegisteredUser1                        │
│  RegisteredUser2                        │
│  (アーカイブ済みは非表示)                 │
└─────────────────────────────────────────┘
```

---

## 📊 データモデル変更

### User型の拡張

**変更前:**
```typescript
export interface User {
  id: string;
  name: string;
  isMainUser: boolean;
  createdAt: Date;
}
```

**変更後:**
```typescript
export interface User {
  id: string;
  name: string;
  isMainUser: boolean;
  isArchived: boolean;     // 新規: アーカイブフラグ
  archivedAt?: Date;       // 新規: アーカイブ日時（オプショナル）
  createdAt: Date;
}
```

### IndexedDB制約への対応

**制約:**
- Boolean値はIndexedDBのインデックスに使用不可

**対応:**
```typescript
// db.ts - スキーマ定義（変更なし）
this.version(1).stores({
  users: 'id, name, createdAt'  // isArchivedはインデックス化しない
});
```

**クエリ方法:**
```typescript
// ❌ これは動かない（Booleanインデックスなし）
const archived = await db.users.where('isArchived').equals(true).toArray();

// ✅ in-memory filtering（既存パターンと同じ）
const allUsers = await db.users.toArray();
const archived = allUsers.filter(u => u.isArchived);
```

### マイグレーション不要

**理由:**
- 既存のUserレコードは`isArchived`未定義 → JavaScriptではfalsyとして扱われる
- 明示的にfalseを設定する必要なし
- 後方互換性あり

---

## 🔧 DB関数実装

### 1. アーカイブ関数（削除の代替）

```typescript
/**
 * ユーザーをアーカイブ（論理削除）
 * @param userId - アーカイブするユーザーID
 */
export async function archiveUser(userId: string): Promise<void> {
  try {
    logger.debug('ユーザーアーカイブ開始', {
      context: 'db-utils.archiveUser',
      data: { userId }
    });

    // ユーザー情報を取得
    const user = await db.users.get(userId);
    if (!user) {
      const error = new NotFoundError('ユーザーが見つかりません', { userId });
      logger.error(error.message, {
        context: 'db-utils.archiveUser',
        error
      });
      throw error;
    }

    // メインユーザーのアーカイブを防止
    if (user.isMainUser) {
      const error = new ValidationError('メインユーザーはアーカイブできません', 'userId');
      logger.error(error.message, {
        context: 'db-utils.archiveUser',
        error,
        data: { userId }
      });
      throw error;
    }

    // アーカイブフラグを設定
    await db.users.update(userId, {
      isArchived: true,
      archivedAt: new Date()
    });

    logger.info('ユーザーアーカイブ成功', {
      context: 'db-utils.archiveUser',
      data: { userId, userName: user.name }
    });
  } catch (err) {
    if (err instanceof ValidationError || err instanceof NotFoundError) {
      throw err;
    }
    const error = new DatabaseError('ユーザーのアーカイブに失敗しました', { originalError: err });
    logger.error(error.message, {
      context: 'db-utils.archiveUser',
      error
    });
    throw error;
  }
}
```

### 2. 復元関数

```typescript
/**
 * アーカイブ済みユーザーを復元
 * @param userId - 復元するユーザーID
 */
export async function restoreUser(userId: string): Promise<void> {
  try {
    logger.debug('ユーザー復元開始', {
      context: 'db-utils.restoreUser',
      data: { userId }
    });

    const user = await db.users.get(userId);
    if (!user) {
      const error = new NotFoundError('ユーザーが見つかりません', { userId });
      logger.error(error.message, {
        context: 'db-utils.restoreUser',
        error
      });
      throw error;
    }

    if (!user.isArchived) {
      const error = new ValidationError('ユーザーは既にアクティブです', 'userId');
      logger.error(error.message, {
        context: 'db-utils.restoreUser',
        error,
        data: { userId }
      });
      throw error;
    }

    await db.users.update(userId, {
      isArchived: false,
      archivedAt: undefined
    });

    logger.info('ユーザー復元成功', {
      context: 'db-utils.restoreUser',
      data: { userId, userName: user.name }
    });
  } catch (err) {
    if (err instanceof ValidationError || err instanceof NotFoundError) {
      throw err;
    }
    const error = new DatabaseError('ユーザーの復元に失敗しました', { originalError: err });
    logger.error(error.message, {
      context: 'db-utils.restoreUser',
      error
    });
    throw error;
  }
}
```

### 3. フィルタリング関数

```typescript
/**
 * アクティブユーザーのみ取得
 */
export async function getActiveUsers(): Promise<User[]> {
  try {
    const allUsers = await db.users.toArray();
    return allUsers.filter(u => !u.isArchived);
  } catch (err) {
    const error = new DatabaseError('アクティブユーザーの取得に失敗しました', {
      originalError: err
    });
    logger.error(error.message, {
      context: 'db-utils.getActiveUsers',
      error
    });
    throw error;
  }
}

/**
 * アーカイブ済みユーザーのみ取得
 */
export async function getArchivedUsers(): Promise<User[]> {
  try {
    const allUsers = await db.users.toArray();
    return allUsers.filter(u => u.isArchived);
  } catch (err) {
    const error = new DatabaseError('アーカイブ済みユーザーの取得に失敗しました', {
      originalError: err
    });
    logger.error(error.message, {
      context: 'db-utils.getArchivedUsers',
      error
    });
    throw error;
  }
}

/**
 * 登録ユーザーを取得（アクティブのみ、メインユーザー除く）
 */
export async function getRegisteredUsers(): Promise<User[]> {
  try {
    const allUsers = await db.users.toArray();
    return allUsers.filter(u => !u.isMainUser && !u.isArchived);
  } catch (err) {
    const error = new DatabaseError('登録ユーザーの取得に失敗しました', {
      originalError: err
    });
    logger.error(error.message, {
      context: 'db-utils.getRegisteredUsers',
      error
    });
    throw error;
  }
}
```

### 4. deleteUserの廃止

**重要: 既存のdeleteUser関数は削除せず、deprecatedマークを付ける**

```typescript
/**
 * @deprecated archiveUserを使用してください
 * ユーザー削除（非推奨）
 */
export async function deleteUser(userId: string): Promise<void> {
  logger.warn('deleteUserは非推奨です。archiveUserを使用してください', {
    context: 'db-utils.deleteUser',
    data: { userId }
  });

  // 内部的にarchiveUserを呼び出す
  return archiveUser(userId);
}
```

---

## 🎨 UI/UX設計

### 1. SettingsTab（ユーザー管理画面）

#### 変更前
```tsx
{/* 登録ユーザー一覧のみ */}
{users.map(user => (
  <UserCard
    user={user}
    onEdit={handleEdit}
    onDelete={handleDelete}  // 削除ボタン
  />
))}
```

#### 変更後
```tsx
{/* アクティブユーザーセクション */}
<div className="space-y-2">
  <h3 className="text-sm font-medium">登録ユーザー</h3>
  {activeUsers.map(user => (
    <div key={user.id} className="border rounded-lg p-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="font-medium">{user.name}</div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditStart(user)}
          >
            編集
          </Button>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => handleArchive(user.id, user.name)}
          >
            アーカイブ
          </Button>
        </div>
      </div>
    </div>
  ))}
</div>

{/* アーカイブ済みユーザーセクション */}
{archivedUsers.length > 0 && (
  <div className="space-y-2 mt-6 pt-4 border-t">
    <h3 className="text-sm font-medium text-muted-foreground">
      アーカイブ済みユーザー
    </h3>
    {archivedUsers.map(user => (
      <div key={user.id} className="border rounded-lg p-3 bg-gray-100/50 opacity-60">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-600">{user.name}</div>
            <div className="text-xs text-gray-500">
              {user.archivedAt && `アーカイブ: ${new Date(user.archivedAt).toLocaleDateString()}`}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRestore(user.id, user.name)}
          >
            復元
          </Button>
        </div>
      </div>
    ))}
  </div>
)}
```

### 2. useUsers フック

```typescript
export function useUsers() {
  const [mainUser, setMainUser] = useState<User | null>(null)
  const [activeUsers, setActiveUsers] = useState<User[]>([])
  const [archivedUsers, setArchivedUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const main = await getMainUser()
        const active = await getRegisteredUsers()  // アクティブのみ
        const archived = await getArchivedUsers()

        setMainUser(main ?? null)
        setActiveUsers(active)
        setArchivedUsers(archived)
      } catch (error) {
        console.error('Failed to load users:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [])

  const addNewUser = async (name: string): Promise<User> => {
    const newUser = await addUser(name)
    setActiveUsers(prev => [...prev, newUser])
    return newUser
  }

  const editUser = async (userId: string, name: string): Promise<User> => {
    const updatedUser = await updateUser(userId, name)

    if (updatedUser.isMainUser) {
      setMainUser(updatedUser)
    } else {
      setActiveUsers(prev => prev.map(u => u.id === userId ? updatedUser : u))
    }

    return updatedUser
  }

  const archiveUserAction = async (userId: string): Promise<void> => {
    await archiveUser(userId)

    // アクティブから削除、アーカイブに追加
    const user = activeUsers.find(u => u.id === userId)
    if (user) {
      setActiveUsers(prev => prev.filter(u => u.id !== userId))
      setArchivedUsers(prev => [...prev, { ...user, isArchived: true, archivedAt: new Date() }])
    }
  }

  const restoreUserAction = async (userId: string): Promise<void> => {
    await restoreUser(userId)

    // アーカイブから削除、アクティブに追加
    const user = archivedUsers.find(u => u.id === userId)
    if (user) {
      setArchivedUsers(prev => prev.filter(u => u.id !== userId))
      setActiveUsers(prev => [...prev, { ...user, isArchived: false, archivedAt: undefined }])
    }
  }

  return {
    mainUser,
    activeUsers,
    archivedUsers,
    loading,
    addNewUser,
    editUser,
    archiveUser: archiveUserAction,
    restoreUser: restoreUserAction,
  }
}
```

### 3. PlayerSelect（プレイヤー選択）

**変更点: アーカイブ済みユーザーを選択肢から除外**

```typescript
// PlayerSelect.tsx
export function PlayerSelect({
  value,
  playerName,
  onChange,
  position,
  mainUser,
  users,  // ← これは既にactiveUsersのみ
  onAddUser,
  excludeMainUser = false,
}: PlayerSelectProps) {
  // users配列は既にアクティブユーザーのみなので、追加フィルタリング不要
  // ...
}
```

### 4. 確認ダイアログ

```tsx
// アーカイブ確認ダイアログ
const handleArchive = async (userId: string, userName: string) => {
  if (!confirm(
    `「${userName}」をアーカイブしますか？\n` +
    `アーカイブ後も過去の記録は保持され、いつでも復元できます。`
  )) {
    return
  }

  try {
    await archiveUserAction(userId)
    // toast.success(`${userName}をアーカイブしました`)
  } catch (error) {
    alert(error instanceof Error ? error.message : 'アーカイブに失敗しました')
  }
}

// 復元確認（リスクなしなので確認不要でも可）
const handleRestore = async (userId: string, userName: string) => {
  try {
    await restoreUserAction(userId)
    // toast.success(`${userName}を復元しました`)
  } catch (error) {
    alert(error instanceof Error ? error.message : '復元に失敗しました')
  }
}
```

---

## 🔄 マイグレーション戦略

### 既存データへの影響

**結論: マイグレーション不要**

**理由:**
1. 既存のUserレコードは`isArchived`プロパティを持たない
2. JavaScriptでは未定義プロパティはfalsyとして評価される
3. `if (user.isArchived)`は自動的にfalseとして動作

**検証:**
```typescript
const existingUser = { id: '123', name: 'Test', isMainUser: false, createdAt: new Date() };

console.log(existingUser.isArchived);  // undefined
console.log(!existingUser.isArchived); // true ← アクティブとして扱われる

if (existingUser.isArchived) {
  // 実行されない
}
```

### 新規ユーザー作成時

```typescript
export async function addUser(name: string): Promise<User> {
  const user: User = {
    id: crypto.randomUUID(),
    name,
    isMainUser: false,
    isArchived: false,     // 明示的にfalseを設定
    createdAt: new Date()
  };

  await db.users.add(user);
  return user;
}
```

### メインユーザー初期化

```typescript
export async function initializeApp() {
  const mainUserId = 'main-user-fixed-id';
  const existingUser = await db.users.get(mainUserId);

  if (!existingUser) {
    await db.users.add({
      id: mainUserId,
      name: '自分',
      isMainUser: true,
      isArchived: false,  // 明示的に設定
      createdAt: new Date()
    });
  }
}
```

---

## 🚀 実装手順

### Phase 1: データモデル＆DB層（1-2時間）

**タスク:**
1. `src/lib/db.ts` - User型にフィールド追加
2. `src/lib/db-utils.ts` - 新規関数実装
   - `archiveUser()`
   - `restoreUser()`
   - `getActiveUsers()`
   - `getArchivedUsers()`
   - `getRegisteredUsers()` 更新（アクティブのみ返す）
   - `deleteUser()` をdeprecated化
3. `src/lib/db-utils.ts` - `addUser()`, `initializeApp()` にisArchived設定追加

**検証:**
- ブラウザDevToolsでIndexedDB確認
- archiveUser → isArchived: true確認
- restoreUser → isArchived: false確認

### Phase 2: Hooks層（30分-1時間）

**タスク:**
1. `src/hooks/useUsers.ts` 更新
   - activeUsers/archivedUsers分離
   - archiveUserAction/restoreUserAction追加
   - removeUser → archiveUserに名称変更

**検証:**
- useUsersフックの返り値確認
- 状態管理の動作確認

### Phase 3: UI層（1-2時間）

**タスク:**
1. `src/components/tabs/SettingsTab.tsx` 更新
   - アクティブユーザーセクション
   - アーカイブ済みユーザーセクション
   - アーカイブ/復元ボタン
   - 確認ダイアログ
2. `src/components/PlayerSelect.tsx` 確認
   - 既にactiveUsersのみ渡されているか確認
   - 追加変更不要のはず

**検証:**
- アーカイブボタン → アーカイブ済みセクションに移動
- 復元ボタン → アクティブセクションに戻る
- PlayerSelectにアーカイブ済みユーザーが表示されない

### Phase 4: テスト（1時間）

**テストケース:**
1. ユーザーアーカイブ → アーカイブ済みセクションに表示
2. アーカイブ済みユーザー復元 → アクティブセクションに表示
3. メインユーザーアーカイブ試行 → エラー
4. PlayerSelectでアーカイブ済み非表示確認
5. 既存データとの互換性確認（未定義isArchivedの扱い）
6. 新規ユーザー作成 → isArchived: false確認

### Phase 5: ドキュメント更新（30分）

**タスク:**
1. CLAUDE.md更新
2. MASTER_STATUS_DASHBOARD.md更新
3. 実装ログ作成（このディレクトリ内）

**総所要時間: 4-6時間**

---

## 🧪 テスト計画

### 単体テスト

#### DB関数テスト
```typescript
// archiveUser()
describe('archiveUser', () => {
  it('ユーザーをアーカイブできる', async () => {
    const user = await addUser('TestUser');
    await archiveUser(user.id);

    const archived = await db.users.get(user.id);
    expect(archived?.isArchived).toBe(true);
    expect(archived?.archivedAt).toBeDefined();
  });

  it('メインユーザーはアーカイブできない', async () => {
    const mainUser = await getMainUser();
    await expect(archiveUser(mainUser!.id)).rejects.toThrow(ValidationError);
  });
});

// restoreUser()
describe('restoreUser', () => {
  it('アーカイブ済みユーザーを復元できる', async () => {
    const user = await addUser('TestUser');
    await archiveUser(user.id);
    await restoreUser(user.id);

    const restored = await db.users.get(user.id);
    expect(restored?.isArchived).toBe(false);
    expect(restored?.archivedAt).toBeUndefined();
  });
});

// getActiveUsers()
describe('getActiveUsers', () => {
  it('アクティブユーザーのみ取得', async () => {
    const user1 = await addUser('Active1');
    const user2 = await addUser('Active2');
    const user3 = await addUser('Archived');
    await archiveUser(user3.id);

    const active = await getActiveUsers();
    expect(active).toHaveLength(2);
    expect(active.map(u => u.id)).toContain(user1.id);
    expect(active.map(u => u.id)).not.toContain(user3.id);
  });
});
```

### 統合テスト

#### UI動作テスト
1. **アーカイブフロー**
   - SettingsTab → ユーザー管理 → アーカイブボタン → 確認 → アーカイブ済みセクションに移動

2. **復元フロー**
   - アーカイブ済みセクション → 復元ボタン → アクティブセクションに復元

3. **PlayerSelect連携**
   - InputTab → PlayerSelect → アーカイブ済みユーザーが選択肢にない

4. **名前変更の反映**
   - アーカイブ済みユーザーの名前変更 → 過去のPlayerResultに正しく反映

### E2Eテスト（Playwright）

```typescript
test('ユーザーアーカイブと復元', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // 設定タブへ移動
  await page.click('text=⚙️ 設定');

  // ユーザー管理を開く
  await page.click('text=👤 ユーザー管理');

  // 新規ユーザー作成
  await page.click('text=＋ 新しいユーザーを登録');
  await page.fill('input[placeholder="ユーザー名"]', 'テストユーザー');
  await page.click('button:has-text("保存")');

  // アーカイブ
  await page.click('button:has-text("アーカイブ")');
  await page.click('button:has-text("OK")');

  // アーカイブ済みセクションに表示確認
  await expect(page.locator('text=アーカイブ済みユーザー')).toBeVisible();
  await expect(page.locator('text=テストユーザー').nth(1)).toBeVisible();

  // 復元
  await page.click('button:has-text("復元")');

  // アクティブセクションに戻る
  await expect(page.locator('text=登録ユーザー >> .. >> text=テストユーザー')).toBeVisible();
});
```

---

## ⚠️ リスク管理

### リスク1: 既存データとの互換性

**リスク:**
- 既存のUserレコードに`isArchived`プロパティがない

**対策:**
- JavaScriptの未定義プロパティ = falsyの仕様を活用
- 明示的なマイグレーション不要
- 新規作成時は必ずisArchived: falseを設定

**検証方法:**
```typescript
// 既存データの動作確認
const allUsers = await db.users.toArray();
console.log(allUsers.filter(u => !u.isArchived)); // 全て表示されるはず
```

### リスク2: PlayerResultとの整合性

**リスク:**
- アーカイブ済みユーザーのPlayerResultが孤立

**対策:**
- アーカイブはデータを削除しないので問題なし
- userIdは常に有効な参照を保持
- 統計計算時にユーザー名を正しく表示可能

**検証方法:**
```typescript
// アーカイブ済みユーザーの過去記録確認
const archivedUser = await getArchivedUsers()[0];
const results = await db.playerResults.where('userId').equals(archivedUser.id).toArray();
console.log(results); // 正常に取得できるはず
```

### リスク3: 同名ユーザーの扱い

**リスク:**
- アーカイブ済み「田中」がいる状態で新規「田中」を作成

**対策（2つのオプション）:**

**オプション1（シンプル）:**
- 同名でも別ユーザーとして作成許可
- userIdで識別するので統計は正確

**オプション2（親切）:**
- 新規作成時にアーカイブ済みユーザーを検索
- 同名がいれば警告: 「アーカイブ済みユーザー『田中』を復元しますか？」
- ユーザーが選択: 復元 or 新規作成

**推奨: オプション1（将来的にオプション2へ）**

### リスク4: パフォーマンス

**リスク:**
- アーカイブ済みユーザーが増えてもパフォーマンス低下なし？

**分析:**
- ユーザー数: 最大でも数百人程度
- in-memory filtering: ミリ秒単位で完了
- IndexedDBのストレージ: 数十MB以上の余裕

**結論: リスクなし**

---

## 📝 実装チェックリスト

### データモデル
- [ ] User型にisArchived, archivedAt追加
- [ ] addUserでisArchived: false設定
- [ ] initializeAppでisArchived: false設定

### DB関数
- [ ] archiveUser()実装
- [ ] restoreUser()実装
- [ ] getActiveUsers()実装
- [ ] getArchivedUsers()実装
- [ ] getRegisteredUsers()更新（アクティブのみ）
- [ ] deleteUser()をdeprecated化

### Hooks
- [ ] useUsers: activeUsers/archivedUsers分離
- [ ] useUsers: archiveUserAction追加
- [ ] useUsers: restoreUserAction追加

### UI
- [ ] SettingsTab: アクティブセクション実装
- [ ] SettingsTab: アーカイブ済みセクション実装
- [ ] SettingsTab: アーカイブボタン実装
- [ ] SettingsTab: 復元ボタン実装
- [ ] SettingsTab: 確認ダイアログ実装
- [ ] PlayerSelect: 動作確認（変更不要のはず）

### テスト
- [ ] archiveUserテスト
- [ ] restoreUserテスト
- [ ] getActiveUsersテスト
- [ ] getArchivedUsersテスト
- [ ] UI統合テスト
- [ ] 既存データ互換性テスト

### ドキュメント
- [ ] CLAUDE.md更新
- [ ] MASTER_STATUS_DASHBOARD.md更新
- [ ] 実装ログ作成

---

## 🎯 完了基準

1. ✅ ユーザーをアーカイブできる
2. ✅ アーカイブ済みユーザーを復元できる
3. ✅ メインユーザーのアーカイブが防止される
4. ✅ アーカイブ済みユーザーがPlayerSelectに表示されない
5. ✅ アーカイブ済みユーザーの過去記録が正しく保持される
6. ✅ 既存データとの互換性が確保される
7. ✅ 全テストがパスする
8. ✅ ドキュメントが更新される

---

## 📚 参考資料

- 業界標準: Gmail, Slack, Trelloなど主要アプリで採用
- 設計パターン: Soft Delete Pattern
- データベース設計: Logical vs Physical Delete

---

**次のステップ:**
1. このドキュメントをレビュー
2. 実装開始の承認
3. Phase 1から順次実装

**実装予定日**: 2025-10-04
**担当**: Claude Code
**レビュー**: ユーザー承認待ち
