# Issue #24: React Hook設計改善 - 設計ドキュメント

## 現状分析

### 発見された問題

| # | ファイル | 行 | 問題 | 重大度 |
|---|---------|-----|------|--------|
| 1 | `MigrationTool.tsx` | 34-36 | 関数`checkIfNeeded`を依存配列に含む | 🔴 重大 |
| 2 | `useSessions.ts` | 21 | 定義はboolean、呼び出し側にオブジェクト形式が残存 | 🔴 重大 |
| 3 | `useSessions.ts` | 45 | useEffect内で動的import | 🟡 中程度 |
| 4 | `InputTab.tsx` | 81 | `[mainUser, mainUser?.name, ...]` 冗長な依存 | 🟡 中程度 |
| 5 | `InputTab.tsx` | 102 | `[users, ...]` 配列参照の不安定性 | 🟢 低 |

### 詳細分析

#### 問題1: MigrationTool.tsx:34-36

**現状コード:**
```typescript
useEffect(() => {
  checkIfNeeded()
}, [checkIfNeeded])
```

**根本原因:**
- `useMigration`フックが返す`checkIfNeeded`は毎render新しい関数参照
- React Compilerの自動メモ化が効いていない（または不安定）
- 結果: 設定タブ表示時に22回の実行

**修正方針:**
- 依存配列を`[]`に変更（マウント時1回のみ実行）
- ESLintの警告は`// eslint-disable-next-line`で抑制

---

#### 問題2: useSessions.ts シグネチャ不整合

**現状:**
- **定義（useSessions.ts:21）**: `useSessions(mainUserId: string, includeHanchans: boolean = false)`
- **AnalysisTab.tsx:25**: `useSessions(mainUser?.id || '', true)` ✅ 正しい
- **HistoryTab.tsx:29**: `useSessions(mainUser?.id || '')` ✅ 正しい（デフォルトfalse）
- **TestTab.tsx:27**: `useSessions(mainUser?.id || '', { includeHanchans: true })` ❌ 古い形式

**問題:**
- TestTab.tsxだけ古いオブジェクト形式が残っている
- TypeScriptがエラーを出さないのは、`{ includeHanchans: true }`がtruthyなのでbooleanとして評価されているため

**修正方針:**
- TestTab.tsxの呼び出しを`useSessions(mainUser?.id || '', true)`に修正

---

#### 問題3: useSessions.ts:45 動的import

**現状コード:**
```typescript
if (options?.includeHanchans) {
  const { getSessionWithDetails } = await import('@/lib/db-utils')
  // ...
}
```

**問題:**
- useEffect内で毎回新しいPromiseを作成
- コードスプリッティングのメリットより、安定性のデメリットが大きい

**修正方針:**
- ファイル先頭で静的importに変更
- `import { getSessionWithDetails } from '@/lib/db-utils'`

**注意:**
- 現在の定義は`includeHanchans: boolean`なので、コードは`if (includeHanchans)`に変更が必要

---

#### 問題4: InputTab.tsx:81 冗長な依存

**現状コード:**
```typescript
useEffect(() => {
  if (mainUser && hanchans.length > 0) {
    // mainUser名変更時の処理
  }
}, [mainUser, mainUser?.name, hanchans.length])
```

**問題:**
- `mainUser`と`mainUser?.name`は冗長
- `mainUser`が変わればnameも変わる

**修正方針（外部計画参考）:**
```typescript
}, [mainUser?.id, mainUser?.name, hanchans.length])
```

**理由:**
- `mainUser`オブジェクト参照ではなく、必要なプロパティのみを依存
- IDは変わらないが、名前変更を検知したい場合に適切

---

#### 問題5: InputTab.tsx:102 配列参照

**現状コード:**
```typescript
useEffect(() => {
  if (users.length > 0 && hanchans.length > 0) {
    // users名変更時の処理
  }
}, [users, hanchans.length])
```

**問題:**
- `users`配列の参照が変わると再実行

**影響度:** 低
- React Compilerが最適化する可能性が高い
- Phase 2で対応（必要に応じて）

---

## 実装計画

### Phase 1: 重大な問題修正

| # | ファイル | 修正内容 |
|---|---------|---------|
| 1 | `MigrationTool.tsx:34-36` | 依存配列を`[]`に変更 |
| 2 | `TestTab.tsx:27` | `{ includeHanchans: true }` → `true` |
| 3 | `useSessions.ts:45` | 動的import → 静的import |
| 4 | `useSessions.ts:44` | `options?.includeHanchans` → `includeHanchans` |

### Phase 2: 中程度の問題修正

| # | ファイル | 修正内容 |
|---|---------|---------|
| 5 | `InputTab.tsx:81` | `[mainUser, mainUser?.name, ...]` → `[mainUser?.id, mainUser?.name, ...]` |
| 6 | `InputTab.tsx:102` | 必要に応じて対応（React Compilerで最適化されている可能性） |

---

## 修正後のコード

### 1. MigrationTool.tsx

```typescript
// Before
useEffect(() => {
  checkIfNeeded()
}, [checkIfNeeded])

// After
useEffect(() => {
  checkIfNeeded()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])  // マウント時1回のみ
```

### 2. TestTab.tsx

```typescript
// Before
const { sessions, loading, error } = useSessions(mainUser?.id || '', { includeHanchans: true })

// After
const { sessions, loading, error } = useSessions(mainUser?.id || '', true)
```

### 3. useSessions.ts

```typescript
// Before (import部分)
// 動的import: const { getSessionWithDetails } = await import('@/lib/db-utils')

// After (ファイル先頭に追加)
import { getSessionWithDetails } from '@/lib/db-utils'

// Before (line 44)
if (options?.includeHanchans) {

// After
if (includeHanchans) {
```

### 4. InputTab.tsx

```typescript
// Before (line 81)
}, [mainUser, mainUser?.name, hanchans.length])

// After
}, [mainUser?.id, mainUser?.name, hanchans.length])
```

---

## 検証計画

### 自動テスト

```bash
# 型チェック
npm run build

# Lint
npm run lint

# E2Eテスト
npx playwright test
```

### 手動検証

1. **MigrationTool（設定タブ）**
   - 設定タブを開く
   - コンソールでマイグレーションログを確認
   - 期待値: 1-2回（Strict Modeで2回）

2. **AnalysisTab**
   - 分析タブを開く
   - セッションデータが正しく読み込まれることを確認

3. **InputTab**
   - ユーザー名を変更（設定タブ）
   - 入力タブのプレイヤー名が更新されることを確認

---

## リスク評価

| リスク | 影響 | 軽減策 |
|-------|-----|--------|
| ESLint警告の抑制 | コードレビューで見落としやすい | コメントで理由を明記 |
| 静的import追加によるバンドルサイズ増加 | 軽微（既にdb-utilsは使用中） | 影響なし |
| 依存配列変更による動作変更 | 予期しない動作 | E2Eテストで検証 |

---

## 参考

- **Issue #24**: https://github.com/nishimoto-takashi-and-ai/mj_app/issues/24
- **外部計画**: `/Users/nishimototakashi/.gemini/antigravity/brain/6f396738-de68-485d-86d3-e95c1f8fd41a/implementation_plan.md.resolved`
- **React Compiler**: 自動メモ化が効いている場合でも、依存配列の設計は正しくするべき
