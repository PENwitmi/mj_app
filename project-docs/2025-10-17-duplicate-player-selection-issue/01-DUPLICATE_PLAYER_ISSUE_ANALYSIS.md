# 同一ユーザー重複選択問題の分析レポート

## 📋 メタ情報

- **作成日時**: 2025-10-17 18:26
- **ステータス**: 問題分析完了
- **影響範囲**: InputTab（新規入力タブ）のプレイヤー選択機能
- **優先度**: 🔴 高（データ整合性に関わる仕様上の問題）

---

## 🔍 問題の概要

### 発見された仕様上のミス

**症状**: InputTabにおいて、同じユーザー（登録済みユーザーまたはメインユーザー）を複数のプレイヤー列で選択できてしまう。

**問題の本質**:
- 麻雀ゲームでは、同一人物が複数のプレイヤーとして参加することは物理的に不可能
- しかし現在の実装では、このような不正な状態を許容してしまっている
- データ整合性の観点から、重大な仕様上の欠陥

---

## 🏗️ 現在の実装状況

### コンポーネント構造

```
InputTab (親コンポーネント)
  ├─ SessionSettingsCard
  ├─ ScoreInputTable
  │   └─ PlayerSelect (複数インスタンス - 各プレイヤー列に1つ)
  └─ TotalsPanel
```

### 各コンポーネントの役割と問題点

#### 1. InputTab (`src/components/tabs/InputTab.tsx`)

**役割**:
- セッション全体の状態管理（hanchans, settings）
- プレイヤー変更のハンドリング（handlePlayerChange）
- DB保存処理

**重要な状態**:
```typescript
const [hanchans, setHanchans] = useState<Hanchan[]>([])
// Hanchan内のplayers配列が各プレイヤーの情報を保持
// players[0] = メインユーザー（固定）
// players[1-3] = 選択可能なプレイヤー
```

**問題点**:
- `handlePlayerChange`は単純に指定された位置のプレイヤー情報を更新するだけ
- 他の列で同じユーザーが選択されているかチェックしていない
- 重複チェックロジックが存在しない

**該当コード** (InputTab.tsx:120-129):
```typescript
const handlePlayerChange = (playerIndex: number, userId: string | null, playerName: string) => {
  setHanchans((prevHanchans) =>
    prevHanchans.map((hanchan) => ({
      ...hanchan,
      players: hanchan.players.map((player, idx) =>
        idx === playerIndex ? { ...player, userId, playerName } : player
      ),
    }))
  )
}
```

#### 2. ScoreInputTable (`src/components/input/ScoreInputTable.tsx`)

**役割**:
- 半荘ごとの点数入力テーブル表示
- ヘッダー行にPlayerSelectを配置

**重要な実装** (ScoreInputTable.tsx:128-147):
```typescript
<thead className="sticky top-0 z-10 bg-green-200">
  <tr className="border-b">
    <th className="p-0.5 text-center w-4 text-muted-foreground text-[10px]">#</th>
    {hanchans[0].players.map((player, idx) => (
      <th key={idx} className="p-1">
        {idx === 0 ? (
          // 1列目: メインユーザー固定表示
          <div className="text-sm font-medium text-center">
            {mainUser?.name || '自分'}
          </div>
        ) : (
          // 2-4列目: PlayerSelectで選択可能
          <PlayerSelect
            value={player.userId ?? '__default__'}
            playerName={player.playerName}
            onChange={(userId, playerName) => onPlayerChange(idx, userId, playerName)}
            position={idx + 1}
            mainUser={mainUser}
            users={users}
            onAddUser={onAddNewUser}
            excludeMainUser={true}  // メインユーザーは1列目固定のため除外
          />
        )}
      </th>
    ))}
  </tr>
</thead>
```

**問題点**:
- 各PlayerSelectは独立して動作
- 他のPlayerSelectの選択状態を認識していない
- `excludeMainUser={true}`は実装されているが、他のプレイヤーの重複は未対応

#### 3. PlayerSelect (`src/components/PlayerSelect.tsx`)

**役割**:
- 単一プレイヤーの選択UI
- メインユーザー、登録済みユーザー、デフォルト名、新規登録の選択肢を提供

**Props**:
```typescript
interface PlayerSelectProps {
  value: string              // 現在選択中のuserId
  playerName: string         // 表示用プレイヤー名
  onChange: (userId: string | null, playerName: string) => void
  position: number           // プレイヤー位置（1,2,3,4）
  mainUser: User | null
  users: User[]
  onAddUser: (name: string) => Promise<User>
  excludeMainUser?: boolean  // メインユーザー除外フラグ
}
```

**現在の除外ロジック** (PlayerSelect.tsx:88-95):
```typescript
{/* メインユーザー */}
{mainUser && !excludeMainUser && (
  <>
    <SelectItem value={mainUser.id}>
      自分
    </SelectItem>
    <SelectSeparator />
  </>
)}
```

**問題点**:
- `excludeMainUser`のみ実装されている
- 他のプレイヤー列で選択中のユーザーを除外する機能がない
- 選択肢から除外するための情報（excludeUserIds）を受け取っていない

---

## 🔬 問題の詳細分析

### データフロー

```
1. PlayerSelect (列2) でユーザーAを選択
   ↓
2. onChange → InputTab.handlePlayerChange
   ↓
3. hanchans[*].players[1].userId = 'user-a-id'
   ↓
4. 状態更新完了

（問題: この時点で他のPlayerSelectは状態を認識していない）

5. PlayerSelect (列3) でユーザーAを選択可能
   ↓
6. onChange → InputTab.handlePlayerChange
   ↓
7. hanchans[*].players[2].userId = 'user-a-id'  ← 重複発生！
```

### 重複が発生する具体的なケース

**ケース1: 同じ登録ユーザーを複数列で選択**
```
列1: メインユーザー（固定）
列2: 登録ユーザーA ← 選択
列3: 登録ユーザーA ← 選択可能（問題）
列4: 登録ユーザーB
```

**ケース2: 異なるタイミングで同じユーザーを選択**
```
1. 列2でユーザーAを選択
2. 列3でユーザーBを選択
3. 列3でユーザーAに変更 ← 列2と重複（問題）
```

**ケース3: デフォルト名から登録ユーザーへ変更**
```
初期状態:
列2: user2（デフォルト）
列3: user3（デフォルト）

操作後:
列2: ユーザーA ← 選択
列3: ユーザーA ← 選択可能（問題）
```

---

## 🎯 影響範囲

### 機能への影響

1. **データ整合性**: 同一人物が複数回記録される不正なセッションデータが作成可能
2. **分析精度**: AnalysisTabでの統計分析が不正確になる
3. **ユーザー体験**: 誤った入力を許容してしまい、後で気づいて修正が必要になる

### 影響を受けるコンポーネント

- ✅ **InputTab**: 直接影響（新規入力）
- ❌ **HistoryTab**: 影響なし（編集機能未実装）
- ⚠️ **AnalysisTab**: 間接影響（不正データによる統計の歪み）

---

## 🎨 ユーザビリティの問題

### 現在のUI/UX課題

1. **視覚的フィードバックの欠如**
   - 同じユーザーを選択しても警告が表示されない
   - 選択済みユーザーが選択肢から消えない
   - エラーメッセージが表示されない

2. **保存時の検証がない**
   - `handleSave`で重複チェックを行っていない
   - 不正なデータがそのままDBに保存される

3. **修正方法が不明確**
   - 重複に気づいたとしても、どこを修正すべきか分かりにくい

---

## 📊 技術的制約と考慮事項

### React Stateの特性

**課題**: PlayerSelectは独立したコンポーネントで、親の状態変更を直接監視できない

**現在の実装**:
```typescript
// InputTab.tsx - propsとして渡しているが、重複チェックには使われていない
<PlayerSelect
  value={player.userId ?? '__default__'}
  mainUser={mainUser}
  users={users}
  // ↓ 他のプレイヤーの選択状態が渡されていない
/>
```

### パフォーマンスへの配慮

**懸念**: 重複チェックロジックを追加する場合、各PlayerSelectでフィルタリング処理が発生
- プレイヤー数: 最大4人
- 登録ユーザー数: 制限なし（通常10-50人程度を想定）

**影響**: 軽微（4×N回のフィルタリングは問題ない規模）

---

## 🛠️ 修正方針の検討

### 方針1: PlayerSelectにexcludeUserIds propsを追加（推奨）

**概要**: 選択済みユーザーIDの配列を渡し、選択肢から除外する

**メリット**:
- ✅ 視覚的に重複を防げる（選択肢から消える）
- ✅ コンポーネントの責務が明確
- ✅ 既存の`excludeMainUser`パターンと一貫性あり

**デメリット**:
- ⚠️ InputTabでexcludeUserIdsの計算が必要
- ⚠️ ScoreInputTableでpropsの橋渡しが必要

**実装イメージ**:
```typescript
// InputTab.tsx
const getExcludeUserIds = (currentPlayerIndex: number): string[] => {
  if (hanchans.length === 0) return []
  return hanchans[0].players
    .filter((p, idx) => idx !== currentPlayerIndex && p.userId)
    .map(p => p.userId!)
}

// ScoreInputTable.tsx
<PlayerSelect
  excludeUserIds={getExcludeUserIds(idx)}
  // ... other props
/>
```

### 方針2: 保存時バリデーションで重複を検出

**概要**: `handleSave`で重複チェックを行い、エラーメッセージを表示

**メリット**:
- ✅ 実装が単純
- ✅ 既存のバリデーションロジックに追加可能

**デメリット**:
- ❌ 入力完了後にエラーが出るため、UXが悪い
- ❌ 視覚的なフィードバックがない
- ❌ どこを修正すべきか分かりにくい

**実装イメージ**:
```typescript
// InputTab.tsx
const handleSave = async () => {
  // 重複チェック
  const userIds = hanchans[0].players
    .map(p => p.userId)
    .filter(id => id !== null)

  const uniqueUserIds = new Set(userIds)
  if (userIds.length !== uniqueUserIds.size) {
    toast.error('同じプレイヤーが複数回選択されています')
    return
  }

  // ... 既存の保存処理
}
```

### 方針3: リアルタイム検証（onChange時にチェック）

**概要**: PlayerSelectのonChange時に重複をチェックし、選択をキャンセル

**メリット**:
- ✅ 即座にフィードバック
- ✅ 不正な状態を作らせない

**デメリット**:
- ❌ 複雑なロジック（InputTab.handlePlayerChangeの変更）
- ❌ ユーザーが「なぜ選択できないのか」分かりにくい
- ❌ 視覚的フィードバックがない場合、混乱を招く

---

## 🎯 推奨する修正アプローチ

### 段階的実装（方針1 + 方針2のハイブリッド）

#### Phase 1: PlayerSelectに除外ロジック追加（必須）

**優先度**: 🔴 高

**実装内容**:
1. `PlayerSelect`に`excludeUserIds?: string[]` propsを追加
2. `InputTab`で`getExcludeUserIds`関数を実装
3. `ScoreInputTable`でpropsを橋渡し
4. 選択肢レンダリング時に除外処理

**期待される効果**:
- 重複選択が物理的に不可能になる
- 選択肢から消えるため、視覚的に分かりやすい

#### Phase 2: 保存時バリデーション追加（安全装置）

**優先度**: 🟡 中

**実装内容**:
1. `handleSave`に重複チェックロジック追加
2. エラー時にトーストメッセージ表示
3. 該当列のハイライト（オプション）

**期待される効果**:
- Phase 1の実装ミスがあった場合の最後の防壁
- データ整合性の二重保証

#### Phase 3: 視覚的フィードバック改善（UX向上）

**優先度**: 🟢 低

**実装内容**:
1. 選択済みプレイヤーのヘッダーに視覚的マーカー
2. ホバー時のツールチップ表示
3. 重複エラー時のアニメーション

**期待される効果**:
- より直感的なUI
- ユーザーの入力ミス削減

---

## 📝 実装時の注意点

### 1. メインユーザーの扱い

- メインユーザーは1列目に固定
- 2-4列目では`excludeUserIds`に必ず含める
- 既存の`excludeMainUser`ロジックと併用

### 2. デフォルト名（user2, user3, user4）の扱い

- デフォルト名（userId = null）は重複チェック対象外
- 複数列で「user2」を選択しても問題ない（未登録プレイヤーとして扱う）

### 3. 既存セッションデータの互換性

- この修正は新規入力のみに影響
- 履歴データに重複があっても表示には影響しない
- 編集機能実装時に同様のロジックを適用

### 4. テストケース

**必須テストケース**:
1. ✅ 登録ユーザーAを列2で選択 → 列3の選択肢からAが消える
2. ✅ 列2でA、列3でB選択後、列2をBに変更 → 列3の選択肢にAが復活
3. ✅ メインユーザーは列2-4の選択肢に表示されない
4. ✅ デフォルト名（user2等）は全列で選択可能
5. ✅ 新規プレイヤー登録後、他の列の選択肢から自動除外

---

## 🔄 データモデルへの影響

### 影響なし

この修正は**UI層（コンポーネント）のみ**に影響し、データモデルには影響しません。

**理由**:
- DBスキーマ変更不要
- 既存の`PlayerResult`型定義変更不要
- バリデーションロジックの追加のみ

---

## 📈 期待される成果

### 修正後の状態

**データ整合性**:
- ✅ 同一ユーザーの重複選択が不可能
- ✅ 不正なセッションデータが作成されない
- ✅ 分析データの精度向上

**ユーザー体験**:
- ✅ 選択済みユーザーが選択肢から消える（直感的）
- ✅ 入力ミスを未然に防ぐ
- ✅ 保存時のエラーが発生しない

**保守性**:
- ✅ 既存の`excludeMainUser`パターンと一貫性あり
- ✅ 将来の編集機能実装時に同じロジックを再利用可能
- ✅ テストケースが明確

---

## 📚 関連ドキュメント

- `CLAUDE.md`: プロジェクト全体の設計思想
- `project-docs/2025-10-03-phase2-ui-implementation/`: UI実装の初期設計
- `src/components/tabs/InputTab.tsx`: メイン対象ファイル
- `src/components/PlayerSelect.tsx`: 修正対象コンポーネント
- `src/components/input/ScoreInputTable.tsx`: props橋渡し対象

---

## ✅ 次のアクション

1. **分析レポートのレビュー**: この文書を確認し、修正方針を決定
2. **実装計画の策定**: Phase 1の詳細な実装計画を作成
3. **実装開始**: PlayerSelectへのexcludeUserIds追加から着手
4. **テスト実施**: 上記のテストケースを実行
5. **ドキュメント更新**: CLAUDE.mdとMASTER_STATUS_DASHBOARD.mdを更新

---

**レポート終了**
