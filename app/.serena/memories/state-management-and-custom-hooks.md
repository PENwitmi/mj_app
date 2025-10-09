# 麻雀アプリ - 状態管理とカスタムフック

**最終更新**: 2025-10-10 00:40
**作成日**: 2025-10-03

---

## 🧠 状態管理の全体設計

### 設計哲学

**階層的状態管理**:
```
App-level State (最上位)
  ↓ useUsers() - ユーザー管理
  ↓ Props経由で全タブに配布
  ↓
Tab-level State (タブ固有)
  ↓ useSessions() - セッションデータ（HistoryTab, AnalysisTab）
  ↓ ローカルState - フォーム入力（InputTab）
  ↓
Component-level State (コンポーネント固有)
  ↓ ダイアログopen/close
  ↓ フィルター選択
  ↓ 編集中データ
```

**状態の責任分離**:
- **グローバル状態**: ユーザー一覧（全タブで共有）
- **タブ状態**: セッションデータ、フィルター、フォーム入力
- **コンポーネント状態**: UI制御（ダイアログ、選択状態）

**データフロー原則**:
1. **単方向データフロー**: 親→子への Props伝播
2. **イベントハンドラーで上昇**: 子→親への変更通知
3. **楽観的UI更新**: DB操作後に即座にローカルState更新
4. **リアルタイム同期**: Dexie useLiveQueryでDB変更を自動反映

---

## 🎣 カスタムフック詳細

### useUsers() - ユーザー管理フック

**ファイル**: `src/hooks/useUsers.ts` (118行)

**責務**: メインユーザー、登録ユーザー、アーカイブ済みユーザーのCRUD操作

#### State構造

```typescript
{
  mainUser: User | null          // メインユーザー（固定ID）
  activeUsers: User[]            // アクティブな登録ユーザー
  archivedUsers: User[]          // アーカイブ済みユーザー
  loading: boolean               // 初期ロード中フラグ
}
```

#### 初期化処理

```typescript
useEffect(() => {
  const loadUsers = async () => {
    try {
      const main = await getMainUser()                // メインユーザー取得
      const active = await getRegisteredUsers()       // アクティブのみ
      const archived = await getArchivedUsers()       // アーカイブ済みのみ

      setMainUser(main ?? null)
      setActiveUsers(active)
      setArchivedUsers(archived)
    } catch (error) {
      logger.error('ユーザー一覧の取得に失敗しました', { context: 'useUsers.loadUsers', error })
    } finally {
      setLoading(false)
    }
  }

  loadUsers()
}, []) // マウント時に1回のみ実行
```

**重要**: React 19 Strict Modeで2回実行されるが、`getMainUser()`は固定ID (`main-user-fixed-id`) で重複作成を防止

#### 提供関数

**1. addNewUser(name: string) → Promise<User>**
```typescript
const addNewUser = async (name: string): Promise<User> => {
  const newUser = await addUser(name)                // DB追加
  setActiveUsers(prev => [...prev, newUser])         // ローカルState更新（楽観的UI）
  return newUser
}
```
- **楽観的UI更新**: DB追加成功後、即座にローカルStateに反映
- **使用場所**: PlayerSelect（プレイヤー登録時）、SettingsTab（ユーザー管理）

**2. editUser(userId: string, name: string) → Promise<User>**
```typescript
const editUser = async (userId: string, name: string): Promise<User> => {
  const updatedUser = await updateUser(userId, name)

  if (updatedUser.isMainUser) {
    setMainUser(updatedUser)                         // メインユーザー更新
  } else {
    setActiveUsers(prev => prev.map(u => u.id === userId ? updatedUser : u))
    setArchivedUsers(prev => prev.map(u => u.id === userId ? updatedUser : u))
  }

  return updatedUser
}
```
- **分岐処理**: メインユーザー vs 登録ユーザーで更新先が異なる
- **両方更新**: アクティブとアーカイブ両方をチェック（どちらにいるか不明なため）

**3. archiveUser(userId: string) → Promise<void>**
```typescript
const archiveUserAction = async (userId: string): Promise<void> => {
  await archiveUser(userId)

  const user = activeUsers.find(u => u.id === userId)
  if (user) {
    setActiveUsers(prev => prev.filter(u => u.id !== userId))
    setArchivedUsers(prev => [...prev, { ...user, isArchived: true, archivedAt: new Date() }])
  }
}
```
- **アクティブ→アーカイブへ移動**: ローカルStateでリスト間移動
- **論理削除**: 物理削除せず、`isArchived=true`, `archivedAt=Date`を設定

**4. restoreUser(userId: string) → Promise<void>**
```typescript
const restoreUserAction = async (userId: string): Promise<void> => {
  await restoreUser(userId)

  const user = archivedUsers.find(u => u.id === userId)
  if (user) {
    setArchivedUsers(prev => prev.filter(u => u.id !== userId))
    setActiveUsers(prev => [...prev, { ...user, isArchived: false, archivedAt: undefined }])
  }
}
```
- **アーカイブ→アクティブへ移動**: 復元処理
- **フラグクリア**: `isArchived=false`, `archivedAt=undefined`

#### 使用パターン

**App.tsx（グローバル）**:
```typescript
const { mainUser, activeUsers, archivedUsers, addNewUser, editUser, archiveUser, restoreUser } = useUsers()

// 全タブにProps伝播
<InputTab mainUser={mainUser} users={activeUsers} addNewUser={addNewUser} />
<HistoryTab mainUser={mainUser} users={activeUsers} addNewUser={addNewUser} />
<AnalysisTab mainUser={mainUser} users={activeUsers} addNewUser={addNewUser} />
<SettingsTab 
  mainUser={mainUser} 
  activeUsers={activeUsers} 
  archivedUsers={archivedUsers}
  addNewUser={addNewUser}
  editUser={editUser}
  archiveUser={archiveUser}
  restoreUser={restoreUser}
/>
```

---

### useSessions() - セッション管理フック

**ファイル**: `src/hooks/useSessions.ts` (124行)

**責務**: セッション一覧のリアルタイム監視、サマリー計算、並び替え

#### State構造

```typescript
{
  sessions: SessionWithSummary[]  // セッション + サマリー + オプショナルHanchans
  loading: boolean                // 読み込み中フラグ
  error: Error | null             // エラー情報
}

interface SessionWithSummary {
  session: Session                                      // セッション本体
  summary: SessionSummary                               // サマリー（事前計算 or 動的計算）
  hanchans?: Array<Hanchan & { players: PlayerResult[] }>  // オプショナル（分析タブのみ）
}
```

#### 引数

```typescript
useSessions(mainUserId: string, options?: { includeHanchans?: boolean })
```

**パラメータ**:
- `mainUserId`: 対象ユーザーID（サマリー計算用）
- `options.includeHanchans`: 
  - `false`（デフォルト）: サマリーのみ（履歴タブ）
  - `true`: 半荘データも取得（分析タブ）

#### リアルタイム監視（Dexie useLiveQuery）

```typescript
// Dexie useLiveQueryで全セッションを監視
const allSessions = useLiveQuery(() => db.sessions.toArray(), [])
```

**動作**:
- `db.sessions.toArray()` を監視
- DB変更時（追加/更新/削除）に自動的に再実行
- `allSessions` の値が変わると、useEffectがトリガー

**メリット**:
- **リアルタイム同期**: DB変更が即座にUIに反映
- **自動再レンダリング**: 手動でリフレッシュ不要
- **複数タブ対応**: 別タブでの変更も自動反映

#### サマリー取得ロジック（パフォーマンス最適化）

```typescript
useEffect(() => {
  if (!allSessions) return

  const loadSessionsWithSummaries = async () => {
    console.log(`[DEBUG] 📋 履歴タブ: セッション読み込み開始 (全${allSessions.length}件)`)
    const startTime = performance.now()

    let cachedCount = 0      // キャッシュ利用数
    let calculatedCount = 0  // 計算数

    const sessionsWithSummary = await Promise.all(
      allSessions.map(async (session: Session) => {
        // オプション: hanchansデータ取得
        let hanchans: Array<Hanchan & { players: PlayerResult[] }> | undefined
        if (options?.includeHanchans) {
          const sessionDetails = await getSessionWithDetails(session.id)
          if (sessionDetails) hanchans = sessionDetails.hanchans
        }

        // 保存済みサマリーがあればそれを使用（キャッシュ）
        if (session.summary) {
          cachedCount++
          return { session, summary: session.summary, hanchans }
        }

        // 保存済みサマリーがない場合は動的計算（後方互換性）
        calculatedCount++
        const summary = await calculateSessionSummary(session.id, mainUserId)
        return { session, summary, hanchans }
      })
    )

    // 日付降順ソート（最新が上）
    sessionsWithSummary.sort((a, b) => b.session.date.localeCompare(a.session.date))

    const totalTime = performance.now() - startTime
    console.log(`[DEBUG] ✅ 履歴タブ: 読み込み完了 (${totalTime.toFixed(1)}ms)`, {
      total: allSessions.length,
      cached: cachedCount,
      calculated: calculatedCount,
      performance: cachedCount > 0 ? '🚀 キャッシュ利用' : '⚠️ 全計算'
    })

    setSessions(sessionsWithSummary)
  }

  loadSessionsWithSummaries()
}, [allSessions, mainUserId, options?.includeHanchans])
```

**パフォーマンス最適化**:
1. **サマリー事前計算**: `session.summary`が保存済みならそれを利用
2. **後方互換性**: 保存済みサマリーがない古いデータは動的計算
3. **計測とログ**: キャッシュ利用数、計算数、総時間を記録
4. **効果**: 2,900ms → 9.7ms（300-800倍高速化）

**エラーハンドリング**:
```typescript
catch (err) {
  // サマリー計算失敗時もスキップせず、デフォルト値を返す
  return {
    session,
    summary: {
      sessionId: session.id,
      hanchanCount: 0,
      totalPayout: 0,
      totalChips: 0,
      averageRank: 0,
      rankCounts: { first: 0, second: 0, third: 0, fourth: 0 }
    } as SessionSummary
  }
}
```
- **リカバリ**: エラーが発生しても配列から除外せず、デフォルト値で継続
- **ログ**: `logger.error()` で詳細記録

#### 使用パターン

**HistoryTab（サマリーのみ）**:
```typescript
const { sessions, loading, error } = useSessions(mainUser?.id || '')

// sessions[i].session - セッション本体
// sessions[i].summary - サマリー情報
// sessions[i].hanchans - undefined（includeHanchans=false）
```

**AnalysisTab（半荘データ含む）**:
```typescript
const { sessions, loading, error } = useSessions(mainUser?.id || '', { includeHanchans: true })

// sessions[i].session - セッション本体
// sessions[i].summary - サマリー情報
// sessions[i].hanchans - 半荘データ配列（統計計算用）
```

---

## 🔄 状態更新パターン

### 1. 楽観的UI更新（Optimistic UI Updates）

**パターン**: DB操作成功後、即座にローカルStateを更新

**利点**:
- レスポンシブなUI（待機時間なし）
- DB変更がすぐに反映

**実装例（useUsers.addNewUser）**:
```typescript
const addNewUser = async (name: string): Promise<User> => {
  const newUser = await addUser(name)                // DB追加
  setActiveUsers(prev => [...prev, newUser])         // ローカルState更新
  return newUser
}
```

**注意**: 真の楽観的更新（DB操作前にUI更新）ではなく、DB成功後の即座更新

---

### 2. リアルタイム同期（Real-time Sync）

**パターン**: Dexie useLiveQueryでDB変更を自動検知

**動作**:
```typescript
const allSessions = useLiveQuery(() => db.sessions.toArray(), [])

useEffect(() => {
  if (!allSessions) return
  // allSessions変更時に自動実行
}, [allSessions])
```

**シナリオ**:
1. InputTabで新規セッション保存 → `db.sessions.add()`
2. Dexie useLiveQueryが変更検知
3. HistoryTabの`allSessions`が自動更新
4. useEffectトリガー → サマリー再計算 → UI再レンダリング

**利点**:
- **手動リフレッシュ不要**: DB変更が自動的にUI反映
- **複数タブ対応**: 別タブでの変更も自動同期
- **一貫性**: DB = UIの一貫性保証

---

### 3. Props伝播パターン

**パターン**: App-levelで管理したStateをProps経由で配布

**App.tsx**:
```typescript
const { mainUser, activeUsers, archivedUsers, addNewUser, editUser, archiveUser, restoreUser } = useUsers()

// 全タブにProps伝播
<InputTab 
  mainUser={mainUser}           // State
  users={activeUsers}           // State
  addNewUser={addNewUser}       // ハンドラー
/>
```

**子コンポーネント（InputTab）**:
```typescript
interface InputTabProps {
  mainUser: User | null
  users: User[]
  addNewUser: (name: string) => Promise<User>
}

export function InputTab({ mainUser, users, addNewUser }: InputTabProps) {
  // mainUser, users は読み取り専用
  // 変更時は addNewUser() を呼ぶ → App-levelで状態更新 → Props再伝播
}
```

**利点**:
- **単方向データフロー**: 予測可能な状態管理
- **責任の明確化**: Appがユーザー管理の責任を持つ
- **再利用性**: 子コンポーネントは疎結合

---

### 4. ローカルState管理（Tab-level）

**パターン**: タブ固有の状態はタブ内で完結

**InputTab（フォーム入力）**:
```typescript
const [selectedMode, setSelectedMode] = useState<GameMode | null>(null)
const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SETTINGS)
const [hanchans, setHanchans] = useState<Hanchan[]>([])
```
- **スコープ**: InputTab内のみ
- **保存時**: `saveSessionWithSummary()` でDB保存 → HistoryTabに自動反映（useLiveQuery）

**AnalysisTab（フィルター）**:
```typescript
const [selectedUserId, setSelectedUserId] = useState<string>(mainUser?.id || '')
const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('this-month')
const [selectedMode, setSelectedMode] = useState<GameMode | 'all'>('4-player')
```
- **スコープ**: AnalysisTab内のみ
- **用途**: フィルター条件（DB保存不要）

---

## 🧪 React 19考慮事項

### Strict Modeの二重実行

**問題**: useEffectが2回実行される → ユーザー重複作成リスク

**解決策1: 固定IDで冪等性確保**
```typescript
// lib/db-utils.ts
export async function initializeApp() {
  const fixedId = 'main-user-fixed-id'        // 固定ID
  const existing = await db.users.get(fixedId)
  
  if (!existing) {
    await db.users.add({
      id: fixedId,
      name: 'あなた',
      isMainUser: true,
      // ...
    })
  }
}
```

**解決策2: クリーンアップ関数（必要に応じて）**
```typescript
useEffect(() => {
  let isMounted = true

  const loadUsers = async () => {
    if (!isMounted) return  // マウント解除済みならスキップ
    // ...
  }

  loadUsers()

  return () => { isMounted = false }  // クリーンアップ
}, [])
```

---

## 📊 状態のライフサイクル

### ユーザー状態

```
1. App mount
   ↓
2. useUsers() 初期化
   ↓ getMainUser(), getRegisteredUsers(), getArchivedUsers()
   ↓
3. State設定: mainUser, activeUsers, archivedUsers
   ↓
4. Props伝播 → 全タブ
   ↓
5. ユーザー追加 (addNewUser)
   ↓ DB: db.users.add()
   ↓ State: setActiveUsers([...prev, newUser])
   ↓
6. Props再伝播 → UI再レンダリング
```

---

### セッション状態

```
1. HistoryTab/AnalysisTab mount
   ↓
2. useSessions(mainUserId, options) 初期化
   ↓ useLiveQuery(() => db.sessions.toArray())
   ↓
3. useEffect トリガー
   ↓ サマリー取得（キャッシュ or 計算）
   ↓ 日付降順ソート
   ↓
4. State設定: sessions, loading, error
   ↓
5. UI表示
   ↓
6. DB変更（別タブで保存）
   ↓ useLiveQuery 自動検知
   ↓
7. useEffect 再実行 → State再設定 → UI再レンダリング
```

---

## 🎯 ベストプラクティス

### 1. カスタムフック設計

**原則**:
- **単一責任**: 1つのフックは1つの責任（useUsers=ユーザー管理、useSessions=セッション管理）
- **疎結合**: 他のフックに依存しない
- **再利用性**: 複数コンポーネントで使用可能

**インターフェース**:
```typescript
export function useCustomHook(params) {
  return {
    data: T[],           // データ
    loading: boolean,    // ロード中フラグ
    error: Error | null, // エラー
    actions: {           // アクション関数群
      add: (item) => {},
      update: (id, item) => {},
      remove: (id) => {}
    }
  }
}
```

---

### 2. State更新の原則

**不変性（Immutability）**:
```typescript
// ❌ 悪い例（直接変更）
users.push(newUser)
setUsers(users)

// ✅ 良い例（新しい配列作成）
setUsers([...users, newUser])

// ❌ 悪い例（直接変更）
users[0].name = 'New Name'
setUsers(users)

// ✅ 良い例（新しいオブジェクト作成）
setUsers(users.map(u => u.id === id ? { ...u, name: 'New Name' } : u))
```

**非同期更新の安全性**:
```typescript
// ❌ 悪い例（古い値参照のリスク）
setCount(count + 1)

// ✅ 良い例（関数形式で最新値保証）
setCount(prev => prev + 1)
```

---

### 3. パフォーマンス最適化

**useMemo（計算コストが高い処理）**:
```typescript
// AnalysisTab.tsx
const rankStats = useMemo(() => {
  if (selectedMode === 'all') return undefined
  if (hanchans.length === 0) return undefined
  return calculateRankStatistics(hanchans, selectedUserId, selectedMode)
}, [hanchans, selectedUserId, selectedMode])
```

**依存配列の注意点**:
```typescript
// ❌ 悪い例（オブジェクト比較で毎回再計算）
useMemo(() => {
  // ...
}, [{ userId: mainUser?.id }])

// ✅ 良い例（プリミティブ値で比較）
useMemo(() => {
  // ...
}, [mainUser?.id])
```

---

### 4. エラーハンドリング

**一貫したエラー処理**:
```typescript
try {
  await dbOperation()
  setData(result)         // 成功時
} catch (err) {
  const error = err instanceof Error ? err : new Error('Unknown error')
  setError(error)         // エラーState設定
  logger.error('操作失敗', { context: 'hookName.functionName', error })
  throw error             // 必要に応じて上位に伝播
}
```

---

## 📚 関連ドキュメント

- **コンポーネントアーキテクチャ**: Serenaメモリ `component-architecture-mahjong-app`
- **DB層アーキテクチャ**: Serenaメモリ `project-architecture-database-layer`
- **プロジェクト概要**: Serenaメモリ `project-overview-mahjong-app`
- **Phase 4履歴タブ**: `project-docs/2025-10-04-phase4-history-tab/`
- **React 19考慮事項**: CLAUDE.md "React 19 Strict Mode"セクション