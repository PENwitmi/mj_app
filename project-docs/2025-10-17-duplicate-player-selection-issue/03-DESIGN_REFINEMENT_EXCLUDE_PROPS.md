# excludeMainUserとexcludeUserIdsの統合検討

## 📋 メタ情報

- **作成日時**: 2025-10-17 18:35
- **目的**: 除外メカニズムの統合可能性を検討
- **論点**: 単一責務原則 vs インターフェースのシンプルさ

---

## 🤔 問題提起

現在の設計では2つの除外メカニズムが存在します：

```typescript
interface PlayerSelectProps {
  // 既存
  excludeMainUser?: boolean      // メインユーザー除外フラグ

  // 新規
  excludeUserIds?: string[]      // 除外するユーザーIDリスト
}
```

**質問**: この2つを統合し、`excludeUserIds`のみにすべきか？

---

## 📊 比較分析

### 案A: 分離（現在の設計）

```typescript
interface PlayerSelectProps {
  excludeMainUser?: boolean
  excludeUserIds?: string[]
}

// 使用例
<PlayerSelect
  excludeMainUser={true}
  excludeUserIds={getExcludeUserIds(idx)}
/>
```

**メリット**:
- ✅ **単一責務**: 各propsが明確な役割を持つ
  - `excludeMainUser`: 「メインユーザーを除外するか」という意図
  - `excludeUserIds`: 「他の列で選択中のユーザーを除外」という意図
- ✅ **意図の明確性**: コードを読んだときに何をしているか一目瞭然
- ✅ **既存コードへの影響最小**: excludeMainUserをそのまま使える
- ✅ **柔軟性**: メインユーザーだけ除外したいケースに対応可能
- ✅ **テストの明確性**: 各機能を独立してテストできる

**デメリット**:
- ⚠️ propsが増える（2つの除外メカニズム）
- ⚠️ PlayerSelect内部で2箇所の除外ロジック
- ⚠️ 概念的な重複（どちらも「除外」）

**実装コスト**: 低（現在の設計のまま）

---

### 案B: 統合（excludeUserIdsのみ）

```typescript
interface PlayerSelectProps {
  excludeUserIds?: string[]  // メインユーザーも含めて統一的に除外
}

// 使用例
<PlayerSelect
  excludeUserIds={[
    ...(mainUser ? [mainUser.id] : []),  // メインユーザーも含める
    ...getExcludeUserIds(idx)
  ]}
/>
```

**メリット**:
- ✅ **インターフェースのシンプルさ**: propsが1つだけ
- ✅ **統一的な除外メカニズム**: すべてのユーザー除外を同じ方法で処理
- ✅ **PlayerSelect内部がシンプル**: 1箇所のフィルタリングロジックのみ
- ✅ **拡張性**: 将来的に任意のユーザーを除外可能

**デメリット**:
- ❌ **意図の不明確性**: なぜメインユーザーIDが含まれているか分かりにくい
- ❌ **呼び出し側の複雑化**: 毎回メインユーザーIDを配列に追加する必要
- ❌ **既存コードへの影響**: excludeMainUserを使用している箇所をすべて変更
- ❌ **エラーの可能性**: メインユーザーIDを含め忘れるリスク
- ❌ **条件分岐の増加**: mainUser存在チェック、スプレッド構文の多用

**実装コスト**: 中（既存の使用箇所をすべて変更）

---

### 案C: ハイブリッド（後方互換性維持）

```typescript
interface PlayerSelectProps {
  excludeMainUser?: boolean      // 後方互換性のため残す
  excludeUserIds?: string[]      // 新規追加
}

// PlayerSelect内部で統合
export function PlayerSelect({
  excludeMainUser = false,
  excludeUserIds = [],
  mainUser,
  // ...
}: PlayerSelectProps) {
  // 内部で統合
  const allExcludeIds = useMemo(() => {
    const ids = [...excludeUserIds]
    if (excludeMainUser && mainUser) {
      ids.push(mainUser.id)
    }
    return ids
  }, [excludeUserIds, excludeMainUser, mainUser])

  // allExcludeIdsを使ってフィルタリング
  const selectableUsers = useMemo(
    () => users.filter(user => !allExcludeIds.includes(user.id)),
    [users, allExcludeIds]
  )

  // メインユーザーの表示判定も統一
  const showMainUser = mainUser && !allExcludeIds.includes(mainUser.id)

  return (
    <Select>
      <SelectContent>
        {showMainUser && (
          <SelectItem value={mainUser.id}>自分</SelectItem>
        )}
        {selectableUsers.map(user => (
          <SelectItem key={user.id} value={user.id}>
            {user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

**メリット**:
- ✅ **後方互換性**: 既存のexcludeMainUser使用箇所をそのまま維持
- ✅ **柔軟性**: どちらの方法でも除外可能
- ✅ **段階的移行**: 将来的にexcludeMainUserを非推奨にできる
- ✅ **内部ロジックの統一**: PlayerSelect内部は1つの除外メカニズム

**デメリット**:
- ⚠️ propsが2つ残る（一時的）
- ⚠️ 内部実装がやや複雑

**実装コスト**: 中（PlayerSelect内部の変更のみ）

---

## 🎯 推奨: 案C（ハイブリッド）→ 将来的に案B

### 理由

#### 1. 段階的な移行が可能

**現在（Phase 1）**: 両方のpropsを受け入れる
```typescript
<PlayerSelect
  excludeMainUser={true}           // 既存のまま
  excludeUserIds={getExcludeUserIds(idx)}  // 新規追加
/>
```

**将来（Phase 4+）**: excludeUserIdsのみに統一
```typescript
<PlayerSelect
  excludeUserIds={[
    mainUser.id,
    ...getExcludeUserIds(idx)
  ]}
/>
```

#### 2. リスクの最小化

- 既存コードをすぐに変更する必要がない
- 新機能追加のみに集中できる
- バグ混入リスクが低い

#### 3. 将来の拡張性

**例: 編集機能での使用**
```typescript
// HistoryTabの編集ダイアログ
<PlayerSelect
  excludeUserIds={[
    ...otherSelectedPlayers,
    ...archivedUsers,  // アーカイブ済みユーザーも除外
  ]}
/>
```

メインユーザー除外とは別の除外ニーズにも対応可能

---

## 💡 最終的な統合方針

### Short-term（Phase 1-3）

**両方を維持し、PlayerSelect内部で統合**

```typescript
// PlayerSelect.tsx
interface PlayerSelectProps {
  excludeMainUser?: boolean      // 既存（非推奨化予定）
  excludeUserIds?: string[]      // 推奨
  // ... other props
}

export function PlayerSelect({
  excludeMainUser = false,
  excludeUserIds = [],
  mainUser,
  users,
  // ...
}: PlayerSelectProps) {
  // 🔄 内部で統合
  const allExcludeIds = useMemo(() => {
    const ids = [...excludeUserIds]
    if (excludeMainUser && mainUser) {
      ids.push(mainUser.id)
    }
    return ids
  }, [excludeUserIds, excludeMainUser, mainUser])

  // 📋 統一的なフィルタリング
  const selectableUsers = useMemo(
    () => users.filter(user => !allExcludeIds.includes(user.id)),
    [users, allExcludeIds]
  )

  const showMainUser = mainUser && !allExcludeIds.includes(mainUser.id)

  return (
    <>
      <Select value={currentValue} onValueChange={handleValueChange}>
        <SelectTrigger className="w-full [&>svg]:hidden">
          <SelectValue placeholder="プレイヤーを選択" />
        </SelectTrigger>
        <SelectContent>
          {/* 統合された除外ロジックで判定 */}
          {showMainUser && (
            <>
              <SelectItem value={mainUser.id}>自分</SelectItem>
              <SelectSeparator />
            </>
          )}

          {selectableUsers.map(user => (
            <SelectItem key={user.id} value={user.id}>
              {user.name}
            </SelectItem>
          ))}

          <SelectSeparator />
          <SelectItem value={SPECIAL_VALUES.DEFAULT}>
            user{position}
          </SelectItem>

          <SelectSeparator />
          <SelectItem value={SPECIAL_VALUES.NEW_PLAYER}>
            ＋ 新しいプレイヤーを登録
          </SelectItem>
        </SelectContent>
      </Select>

      <NewPlayerDialog ... />
    </>
  )
}
```

**使用例（ScoreInputTable）**:
```typescript
<PlayerSelect
  value={player.userId ?? '__default__'}
  playerName={player.playerName}
  onChange={(userId, playerName) => onPlayerChange(idx, userId, playerName)}
  position={idx + 1}
  mainUser={mainUser}
  users={users}
  onAddUser={onAddNewUser}
  excludeMainUser={true}  // ✅ 既存のまま維持
  excludeUserIds={getExcludeUserIds(idx)}  // ✅ 新規追加
/>
```

### Long-term（Phase 4+）

**excludeUserIdsに統一し、excludeMainUserを非推奨化**

#### ステップ1: getExcludeUserIdsにメインユーザー含める

```typescript
// InputTab.tsx
const getExcludeUserIds = useCallback(
  (currentPlayerIndex: number): string[] => {
    if (hanchans.length === 0) return []

    const excludeIds: string[] = []

    // 🆕 列1の場合を除き、メインユーザーIDを含める
    if (currentPlayerIndex !== 0 && mainUser) {
      excludeIds.push(mainUser.id)
    }

    // 他の列で選択中のユーザーを追加
    hanchans[0].players.forEach((player, idx) => {
      if (idx !== currentPlayerIndex && player.userId) {
        excludeIds.push(player.userId)
      }
    })

    return excludeIds
  },
  [hanchans, mainUser]
)
```

#### ステップ2: excludeMainUserを削除

```typescript
<PlayerSelect
  value={player.userId ?? '__default__'}
  playerName={player.playerName}
  onChange={(userId, playerName) => onPlayerChange(idx, userId, playerName)}
  position={idx + 1}
  mainUser={mainUser}
  users={users}
  onAddUser={onAddNewUser}
  // excludeMainUser={true}  ❌ 削除
  excludeUserIds={getExcludeUserIds(idx)}  // ✅ メインユーザーも含まれる
/>
```

#### ステップ3: PlayerSelectからexcludeMainUserを削除

```typescript
interface PlayerSelectProps {
  // excludeMainUser?: boolean  ❌ 削除
  excludeUserIds?: string[]
  // ... other props
}
```

---

## 📐 設計原則の観点から

### 単一責務原則（SRP）について

**質問**: excludeMainUserとexcludeUserIdsは単一責務原則に反するか？

**回答**: **いいえ、短期的には反しない。長期的には統合が望ましい。**

#### 詳細な分析

**短期的観点**:
```
excludeMainUser: 「メインユーザー除外」という特定の責務
excludeUserIds:  「他列選択中ユーザー除外」という特定の責務
```
- 2つの異なる理由で除外が必要
- それぞれ独立した責務として正当化可能
- ❌ ただし、概念的には重複（どちらも「除外」）

**長期的観点**:
```
excludeUserIds: 「特定ユーザーを除外」という統一された責務
```
- メインユーザーも「除外すべきユーザーの1つ」に過ぎない
- 除外理由（メインユーザー/他列選択中）は呼び出し側の関心事
- PlayerSelectは「誰を除外するか」だけを気にすればよい
- ✅ より純粋な責務分離

### インターフェース分離原則（ISP）について

**原則**: クライアントは使用しないメソッド/propsに依存すべきではない

**現在の設計**:
```typescript
// ScoreInputTableでは両方使う
excludeMainUser={true}
excludeUserIds={getExcludeUserIds(idx)}

// 将来の編集機能では excludeUserIds のみ使うかもしれない
excludeUserIds={getAllExcludeIds(idx)}
```

**判断**:
- 短期的には両方必要なので ISP 違反ではない
- 長期的には excludeUserIds のみで十分なので、統合が望ましい

### 開放閉鎖原則（OCP）について

**原則**: 拡張に対して開いており、修正に対して閉じている

**統合後の拡張性**:
```typescript
// ✅ 新しい除外要件に簡単に対応
<PlayerSelect
  excludeUserIds={[
    ...selectedPlayers,      // 既存: 他列選択中
    ...archivedUsers,        // 新規: アーカイブ済み
    ...blockedUsers,         // 新規: ブロック中
  ]}
/>
```

**判断**: 統合した方が OCP に準拠しやすい

---

## 🔄 実装アプローチ（修正版）

### 単一フェーズでの完全実装

**公開前なので、段階的移行は不要。一気に最終形態を実装。**

#### InputTab.tsx - getExcludeUserIds実装

```typescript
const getExcludeUserIds = useCallback(
  (currentPlayerIndex: number): string[] => {
    const excludeIds: string[] = []

    // 🆕 メインユーザーも含める（列1以外）
    if (currentPlayerIndex !== 0 && mainUser) {
      excludeIds.push(mainUser.id)
    }

    // 他列選択中のユーザー
    if (hanchans.length > 0) {
      hanchans[0].players.forEach((player, idx) => {
        if (idx !== currentPlayerIndex && player.userId) {
          excludeIds.push(player.userId)
        }
      })
    }

    return excludeIds
  },
  [hanchans, mainUser]  // 🆕 mainUserを依存配列に追加
)
```

#### ScoreInputTable.tsx - excludeMainUser削除

```typescript
<PlayerSelect
  value={player.userId ?? '__default__'}
  playerName={player.playerName}
  onChange={(userId, playerName) => onPlayerChange(idx, userId, playerName)}
  position={idx + 1}
  mainUser={mainUser}
  users={users}
  onAddUser={onAddNewUser}
  // excludeMainUser={true}  ❌ 完全削除
  excludeUserIds={getExcludeUserIds(idx)}  // ✅ メインユーザーIDも含まれる
/>
```

#### PlayerSelect.tsx - excludeMainUser削除

```typescript
interface PlayerSelectProps {
  value: string
  playerName: string
  onChange: (userId: string | null, playerName: string) => void
  position: number
  mainUser: User | null
  users: User[]
  onAddUser: (name: string) => Promise<User>
  // excludeMainUser?: boolean  ❌ 完全削除
  excludeUserIds?: string[]      // ✅ 統一された除外メカニズム
}

// 選択肢フィルタリング
const selectableUsers = useMemo(
  () => users.filter(user => !excludeUserIds.includes(user.id)),
  [users, excludeUserIds]
)

// メインユーザー表示判定
const showMainUser = mainUser && !excludeUserIds.includes(mainUser.id)

return (
  <SelectContent>
    {showMainUser && (
      <SelectItem value={mainUser.id}>自分</SelectItem>
    )}
    {selectableUsers.map(user => (
      <SelectItem key={user.id} value={user.id}>
        {user.name}
      </SelectItem>
    ))}
    {/* ... その他 ... */}
  </SelectContent>
)
```

**実装のポイント**:
- ✅ excludeMainUser完全削除
- ✅ getExcludeUserIdsにメインユーザーロジック統合
- ✅ PlayerSelect内部のロジックをシンプル化

---

## 📊 比較表

| 観点 | 分離（案A） | 統合（案B） | ハイブリッド（案C） |
|------|-----------|-----------|------------------|
| **propsの数** | 2つ | 1つ | 2つ→1つ |
| **意図の明確性** | ✅ 高 | ⚠️ 低 | ✅ 高 |
| **実装の複雑さ** | ⚠️ 中 | ✅ 低 | ⚠️ 中 |
| **既存コード影響** | ✅ 小 | ❌ 大 | ✅ 小 |
| **拡張性** | ⚠️ 中 | ✅ 高 | ✅ 高 |
| **テスト容易性** | ✅ 高 | ⚠️ 中 | ✅ 高 |
| **SRP準拠** | ⚠️ 短期的にはOK | ✅ 長期的に優れる | ✅ 両立 |
| **リスク** | ✅ 低 | ⚠️ 中 | ✅ 低 |

---

## ✅ 最終推奨（修正版）

### 🚨 重要な前提条件の変更

**公開前のプロジェクトであるため、段階的移行のメリットはない。**

- 既存ユーザーへの影響: なし
- 後方互換性の維持: 不要
- リスク: 実装前なので最小

### 採用する設計: 案B（統合）

**excludeUserIdsのみに統合**

```typescript
interface PlayerSelectProps {
  excludeUserIds?: string[]      // 統一された除外メカニズム
  // excludeMainUser?: boolean   // ❌ 削除
}
```

**理由**:
1. ✅ インターフェースのシンプルさ
2. ✅ SRP準拠（統一的な除外メカニズム）
3. ✅ 拡張性（任意のユーザー除外が可能）
4. ✅ 公開前なので一気に理想形態へ移行可能
5. ✅ 不要な段階的移行コストを回避

---

## 🎓 設計の教訓

### 1. 「正しい」設計は1つではない

- 短期的には分離が正解
- 長期的には統合が正解
- 文脈と制約によって最適解は変わる

### 2. 段階的な移行の重要性

- いきなり理想形を目指さない
- リスクを最小化しながら進化させる
- 後方互換性を保ちながら改善

### 3. 原則は絶対ではない

- SRPも文脈次第で解釈が変わる
- 実用性とのバランスが重要
- 教条的にならず、プラグマティックに判断

### 4. インターフェースの進化

```
V1: excludeMainUser のみ
  ↓
V2: excludeMainUser + excludeUserIds（ハイブリッド）
  ↓
V3: excludeUserIds のみ（統合）
```

段階的に進化させることで、安全に最適な設計に到達できる

---

## 📝 まとめ（修正版）

**質問**: excludeMainUserと統合する可能性はある？単一責務を考えると統合は避けるべき？

**回答**:

1. **統合の可能性**: ✅ **ある。公開前なので今すぐ実施すべき。**

2. **単一責務の解釈**:
   - 短期的には2つの責務として正当化可能
   - 長期的には「ユーザー除外」という1つの責務に統合すべき
   - **公開前なので「長期的な理想形」を今すぐ実装できる**

3. **採用アプローチ**:
   - **excludeUserIdsのみに統合**（一気に最終形態へ）
   - excludeMainUserは完全削除
   - getExcludeUserIdsにメインユーザーロジックを統合

4. **設計哲学**:
   - 公開前は理想形を目指すべき
   - 不要な段階的移行コストを回避
   - 将来の拡張性を最大化

**結論**: 統合すべきであり、公開前なので段階的移行は不要。今すぐ一気に実装。

---

**文書作成: 2025-10-17 18:35**
