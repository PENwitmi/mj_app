# プレイヤー選択UI 詳細設計

**作成日**: 2025-10-03
**ステータス**: 設計完了
**実装方針**: 案B（Select + ダイアログ方式）採用

---

## 📋 目次

1. [背景と目的](#背景と目的)
2. [データ構造](#データ構造)
3. [UI設計](#ui設計)
4. [選択時の動作](#選択時の動作)
5. [必要なコンポーネント](#必要なコンポーネント)
6. [保存時のロジック](#保存時のロジック)
7. [実装手順](#実装手順)

---

## 🎯 背景と目的

### 課題
- 現状のInputTabはプレイヤー名を文字列で管理（userId紐付けなし）
- DB保存時に`PlayerResult.userId`が必要
- ユーザー管理と集計機能の基盤として、プレイヤー選択UIが必須

### 目的
- **集計対象と非対象を明確に分離**
- **既存ユーザーの選択を簡単に**
- **新規ユーザーの登録を直感的に**

---

## 📊 データ構造

### InputTab内の型定義（更新）

```typescript
interface PlayerResult {
  playerName: string        // 表示名
  userId: string | null     // 集計用ID（nullは集計対象外）
  score: number | null
  umaMark: UmaMark
  chips: number
  parlorFee: number
  isSpectator: boolean
  umaMarkManual: boolean
}
```

### 特殊な値定義

```typescript
const SPECIAL_VALUES = {
  DEFAULT: '__default__',     // デフォルト名のまま（集計対象外）
  NEW_PLAYER: '__new__'       // 新規プレイヤー登録
} as const
```

**重要な設計方針:**
- `userId = null` → 集計対象外（unknown1, unknown2...として保存）
- `userId = string` → 集計対象（統計・分析に使用）

---

## 🎨 UI設計

### Select選択肢の構成

```
┌─────────────────────────────────┐
│ プレイヤーを選択                 │
├─────────────────────────────────┤
│ ⭐ 自分                          │  ← メインユーザー（固定、userId確定）
│ ──────────────                  │
│ 田中太郎                         │  ← 登録済みユーザー（userId確定）
│ 佐藤花子                         │
│ 山田次郎                         │
│ ──────────────                  │
│ デフォルト名のまま               │  ← userId = null（集計対象外）
│ ──────────────                  │
│ ＋ 新しいプレイヤーを登録         │  ← ダイアログ表示 → ユーザー作成
└─────────────────────────────────┘
```

### UI要素の詳細

**1. メインユーザー（最上部）**
- アイコン: ⭐
- 表示名: "自分"
- 常に選択可能
- 1列目専用（推奨）

**2. 登録済みユーザー（中央）**
- 登録順にソート
- 名前のみ表示
- クリックで選択

**3. デフォルト名（下部）**
- 表示: "デフォルト名のまま"
- 選択すると`userId = null`
- プレイヤー名は"プレイヤー1", "プレイヤー2"のまま

**4. 新規登録（最下部）**
- 表示: "＋ 新しいプレイヤーを登録"
- クリックでダイアログ表示
- 登録後、自動的に選択状態になる

---

## ⚙️ 選択時の動作

### ① メインユーザー選択

```typescript
playerResult.userId = mainUser.id
playerResult.playerName = '自分'
```

- メインユーザーのIDを設定
- 表示名は「自分」

### ② 登録済みユーザー選択

```typescript
playerResult.userId = selectedUser.id
playerResult.playerName = selectedUser.name
```

- 選択したユーザーのIDを設定
- 表示名はユーザー名

### ③ デフォルト名選択

```typescript
playerResult.userId = null
playerResult.playerName = `プレイヤー${position}` // 元のまま
```

- userIdをnullに設定（集計対象外）
- 表示名は"プレイヤー1", "プレイヤー2"等のまま
- DB保存時に"unknown1", "unknown2"に変換

### ④ 新規プレイヤー選択

**フロー:**
1. ダイアログ表示
2. 名前入力（バリデーション: 空文字NG、重複警告）
3. `addUser(name)` でDB登録
4. useUsersフックで自動的に選択肢に追加
5. 新規作成したユーザーを自動選択

```typescript
const newUser = await addUser(playerName)
playerResult.userId = newUser.id
playerResult.playerName = newUser.name
```

---

## 🛠️ 必要なコンポーネント

### 1. `hooks/useUsers.ts`

**役割**: ユーザー一覧の管理

```typescript
export function useUsers() {
  const [mainUser, setMainUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUsers = async () => {
      const main = await getMainUser()
      const registered = await getRegisteredUsers()
      setMainUser(main ?? null)
      setUsers(registered)
      setLoading(false)
    }
    loadUsers()
  }, [])

  const addNewUser = async (name: string) => {
    const newUser = await addUser(name)
    setUsers(prev => [...prev, newUser])
    return newUser
  }

  return { mainUser, users, loading, addNewUser }
}
```

### 2. `components/PlayerSelect.tsx`

**役割**: プレイヤー選択Select

**Props:**
```typescript
interface PlayerSelectProps {
  value: string              // userId or SPECIAL_VALUES
  playerName: string         // 表示用
  onChange: (userId: string | null, playerName: string) => void
  position: number           // プレイヤー位置（1,2,3,4）
}
```

**内部状態:**
- ダイアログの開閉状態
- 新規ユーザー入力値

### 3. `components/NewPlayerDialog.tsx`（または PlayerSelect内に統合）

**役割**: 新規プレイヤー入力ダイアログ

**機能:**
- 名前入力フィールド
- バリデーション（空文字、既存ユーザー重複）
- 保存/キャンセルボタン
- 保存成功時に親コンポーネントへ通知

### 4. shadcn/ui Dialog コンポーネント

**追加コマンド:**
```bash
npx shadcn@latest add dialog
```

---

## 💾 保存時のロジック

### セッション保存関数

```typescript
async function saveSession() {
  // 1. バリデーション
  if (!selectedMode) {
    throw new ValidationError('モードが選択されていません')
  }

  if (hanchans.length === 0) {
    throw new ValidationError('最低1半荘のデータが必要です')
  }

  // 2. Session作成
  const session: Session = {
    id: crypto.randomUUID(),
    date: settings.date,
    mode: selectedMode,
    rate: settings.rate,
    umaValue: settings.umaValue,
    chipRate: settings.chipRate,
    parlorFee: 0,  // 未実装
    umaRule: settings.umaRule,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  await db.sessions.add(session)

  // 3. 各Hanchan + PlayerResultを保存
  for (const hanchan of hanchans) {
    const dbHanchan: Hanchan = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      hanchanNumber: hanchan.hanchanNumber,
      autoCalculated: hanchan.autoCalculated,
      createdAt: new Date()
    }
    await db.hanchans.add(dbHanchan)

    for (const player of hanchan.players) {
      // スコアがnullの場合はスキップ
      if (player.score === null) continue

      const playerResult: PlayerResult = {
        id: crypto.randomUUID(),
        hanchanId: dbHanchan.id,
        userId: player.userId,           // ← 既に確定済み
        playerName: player.playerName,
        score: player.score,
        umaMark: player.umaMark,
        isSpectator: player.isSpectator,
        chips: player.chips,
        createdAt: new Date()
      }
      await db.playerResults.add(playerResult)
    }
  }

  // 4. 成功通知
  // toast.success('記録を保存しました')

  // 5. 入力データクリア
  setHanchans([])
  setSelectedMode(null)
}
```

### デフォルト名の処理

保存時、`userId === null`かつデフォルト名の場合：

```typescript
if (player.userId === null && player.playerName.startsWith('プレイヤー')) {
  // DB保存時にunknown1, unknown2...に変換
  playerResult.playerName = `unknown${player.position}`
}
```

---

## 🚀 実装手順

### Phase 1: 基盤構築
1. ✅ `db-utils.ts` - ユーザー管理関数（完成済み）
2. [ ] `hooks/useUsers.ts` - ユーザー一覧管理hook作成
3. [ ] shadcn/ui Dialog追加

### Phase 2: UI実装
4. [ ] PlayerResult型に`userId`フィールド追加
5. [ ] NewPlayerDialog コンポーネント作成
6. [ ] PlayerSelect コンポーネント作成
7. [ ] InputTabにPlayerSelectを統合

### Phase 3: 保存機能
8. [ ] `saveSession()` 関数実装（db-utils.tsに追加）
9. [ ] 保存ボタンUI追加
10. [ ] バリデーション実装
11. [ ] エラーハンドリング

### Phase 4: テスト
12. [ ] デフォルト名で保存テスト
13. [ ] メインユーザー選択で保存テスト
14. [ ] 登録済みユーザー選択で保存テスト
15. [ ] 新規ユーザー作成 → 保存テスト

---

## 📝 注意事項

### 1. ユーザー重複チェック
- 新規ユーザー作成時、既存ユーザー名との重複を警告
- 強制的には防がない（同姓同名の可能性）

### 2. デフォルト名の扱い
- `userId = null` → 集計対象外
- DB保存時に"unknown1", "unknown2"に変換
- 後から編集して集計対象に変更可能（将来機能）

### 3. メインユーザーの固定
- メインユーザーは削除不可
- 名前変更は可能（設定タブで）

### 4. 選択肢の順序
1. メインユーザー（最上部、固定）
2. 登録済みユーザー（登録順）
3. デフォルト名（区切り後）
4. 新規登録（最下部）

---

## 🔄 更新履歴

- 2025-10-03 20:30: 初回作成、案B（Select + ダイアログ方式）の詳細設計完了
