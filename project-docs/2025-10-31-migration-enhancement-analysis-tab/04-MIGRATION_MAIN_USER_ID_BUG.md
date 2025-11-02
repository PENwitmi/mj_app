# Migration Main User ID Bug - Root Cause Analysis

**作成日**: 2025-11-03 00:28
**重要度**: Critical
**ステータス**: 原因特定完了、修正待ち

---

## TL;DR (要約)

**問題**: マイグレーション実行後、すべてのセッションの`summary`が0になる
**原因**: `MigrationTool.tsx`が固定値`'main-user-fixed-id'`を使用しているが、実際のセッションには異なるユーザーIDが記録されている
**影響**: 12セッション全てでメインユーザーが見つからず、summary計算が失敗
**修正**: `MigrationTool.tsx`に実際のログインユーザーIDを渡す必要がある

---

## 1. Problem Statement

### 1.1 発見された問題

**症状**:
- マイグレーション実行後、全てのセッションで`summary`の値が0になる
- 具体的には: `totalPayout: 0`, `totalChips: 0`, `averageRank: 0`, `rankCounts: 全て0`

**影響範囲**:
- 全12セッション（100%）
- History Tabで正しい収支が表示されない
- Analysis Tabも影響を受ける

### 1.2 デバッグログからの発見

**✅ 正常なケース（SessionDetailDialog保存時）**:
```typescript
[DEBUG] calculateSessionSummary開始 {
  sessionId: 'f227000e-3fc8-4d80-aab9-7c67fbb1c86c',
  mainUserId: '493a5260-de18-4534-900c-373d2d8af37e',  // ← 実際のユーザーID
  hanchanCount: 2
}

[DEBUG] メインユーザー結果 {
  playerName: '自分',
  score: -23,  // ← データあり
  umaMark: '○',
  chips: -2
}
```

**❌ マイグレーション実行時（全12セッション）**:
```typescript
[INFO] マイグレーション実行開始 {
  mainUserId: 'main-user-fixed-id'  // ← 誤った固定値！
}

[WARN] 半荘にメインユーザーが見つかりません {
  hanchanNumber: 1,
  mainUserId: 'main-user-fixed-id',  // ← データに存在しない
  players: Array(3)
}

[WARN] 総合順位計算: メインユーザーが見つかりません {
  sessionId: '...',
  mainUserId: 'main-user-fixed-id',
  playerCount: 3
}
```

---

## 2. Root Cause Analysis

### 2.1 問題のコード

**File**: `app/src/components/MigrationTool.tsx`
**Line**: 10, 42

```typescript
// Line 10: 固定値の定義
const MAIN_USER_ID = 'main-user-fixed-id'  // ❌ 誤り！

// Line 42: 固定値を使用
const handleConfirmExecute = async () => {
  setShowConfirmDialog(false)
  await executeMigration(MAIN_USER_ID)  // ❌ 誤った固定値を渡している
}
```

### 2.2 なぜこのバグが発生したか

**設計上の誤解**:
1. `'main-user-fixed-id'`は「メインユーザーを表す固定ID」として定義された
2. これは`db-utils.ts`の`initializeApp()`で使われている
3. **しかし**、実際のセッションデータには別のユーザーID（`'493a5260-de18-4534-900c-373d2d8af37e'`）が記録されている

**データ構造の実態**:
```typescript
// ✅ 実際のセッションデータ
{
  id: 'f227000e-3fc8-4d80-aab9-7c67fbb1c86c',
  hanchans: [
    {
      players: [
        {
          userId: '493a5260-de18-4534-900c-373d2d8af37e',  // ← 実際のID
          playerName: '自分',
          score: -23
        }
      ]
    }
  ]
}
```

**マイグレーション時の問題**:
```typescript
// ❌ マイグレーションツールが使用
mainUserId: 'main-user-fixed-id'

// ✅ 実際に必要なID
mainUserId: '493a5260-de18-4534-900c-373d2d8af37e'
```

### 2.3 影響の連鎖

```
MigrationTool.tsx (Line 42)
  ↓ 誤った固定値を渡す
useMigration.ts (Line 87)
  ↓ migration-utils.tsに渡す
migration-utils.ts (Line 94)
  ↓ calculateSessionSummary()に渡す
session-utils.ts (Line 109)
  ↓ メインユーザー検索
session-utils.ts (Line 143)
  ❌ mainUserResult が見つからない
  ↓ continue でスキップ
  ❌ summary値が全て0のまま
```

---

## 3. Solution Design

### 3.1 修正方針

**Option A: MigrationToolにmainUserをpropsで渡す（推奨）**

**理由**:
- ✅ SettingsTabが既に`mainUser`を持っている
- ✅ 実際のログインユーザーIDを確実に取得できる
- ✅ 変更箇所が少ない

**変更ファイル**:
1. `SettingsTab.tsx` - MigrationToolに`mainUser`を渡す
2. `MigrationTool.tsx` - props経由で`mainUser`を受け取る

### 3.2 修正内容（詳細）

#### File 1: `app/src/components/tabs/SettingsTab.tsx`

**Before**:
```typescript
<MigrationTool />
```

**After**:
```typescript
<MigrationTool mainUser={mainUser} />
```

#### File 2: `app/src/components/MigrationTool.tsx`

**Before (Lines 10-15)**:
```typescript
const MAIN_USER_ID = 'main-user-fixed-id'

export function MigrationTool() {
  const {
    status,
    progress,
    // ...
  } = useMigration()
```

**After**:
```typescript
import { User } from '@/lib/db'

interface MigrationToolProps {
  mainUser: User | null
}

export function MigrationTool({ mainUser }: MigrationToolProps) {
  const {
    status,
    progress,
    // ...
  } = useMigration()
```

**Before (Line 42)**:
```typescript
const handleConfirmExecute = async () => {
  setShowConfirmDialog(false)
  await executeMigration(MAIN_USER_ID)  // ❌
}
```

**After**:
```typescript
const handleConfirmExecute = async () => {
  setShowConfirmDialog(false)

  if (!mainUser) {
    // エラーハンドリング（念のため）
    logger.error('メインユーザーが見つかりません', {
      context: 'MigrationTool.handleConfirmExecute'
    })
    return
  }

  await executeMigration(mainUser.id)  // ✅ 実際のユーザーIDを使用
}
```

#### File 3: `app/src/components/MigrationTool.tsx` (UI変更)

**Before (実行ボタン)**:
```typescript
<Button
  onClick={handleExecuteClick}
  disabled={!isNeeded || status === 'running'}
>
  再計算を実行
</Button>
```

**After (mainUser nullチェック追加)**:
```typescript
<Button
  onClick={handleExecuteClick}
  disabled={!isNeeded || status === 'running' || !mainUser}
>
  再計算を実行
</Button>

{!mainUser && (
  <p className="text-sm text-red-600">
    メインユーザーが見つかりません
  </p>
)}
```

---

## 4. Implementation Checklist

### Phase 1: 修正実装 (15分)

- [ ] `SettingsTab.tsx` - MigrationToolにmainUser props追加
- [ ] `MigrationTool.tsx` - props受け取り、型定義追加
- [ ] `MigrationTool.tsx` - 固定値`MAIN_USER_ID`削除
- [ ] `MigrationTool.tsx` - `mainUser.id`を使用
- [ ] `MigrationTool.tsx` - nullチェック追加
- [ ] TypeScriptビルド確認

### Phase 2: 動作確認 (15分)

- [ ] dev server起動
- [ ] マイグレーション実行
- [ ] デバッグログ確認:
  - `mainUserId: '493a5260-de18-4534-900c-373d2d8af37e'` （実際のID）
  - `🔍 メインユーザー結果` が表示される
  - `[WARN] 半荘にメインユーザーが見つかりません` が出ない
- [ ] History Tab確認:
  - summary値が正しい（0ではない）
  - 収支が正しく表示される
- [ ] Analysis Tab確認:
  - summaryを使うようになった後にテスト

### Phase 3: デバッグログ削除 (5分)

- [ ] `session-utils.ts` - 追加した5箇所のデバッグログ削除:
  1. Line 112-120: セッション基本情報
  2. Line 136-148: 半荘全体の情報
  3. Line 166-178: メインユーザーの詳細情報
  4. Line 186-193: 半荘スキップ理由
  5. Line 320-327: 最終計算結果

### Phase 4: コミット (10分)

**Commit Message**:
```
fix(MigrationTool): 実際のユーザーIDを使用するよう修正

問題:
- マイグレーション実行時に固定値'main-user-fixed-id'を使用
- 実際のセッションデータには別のユーザーIDが記録されている
- 結果、メインユーザーが見つからずsummary値が全て0になる

修正:
- MigrationToolにmainUser propsを追加
- SettingsTabからmainUserを渡すように変更
- 実際のログインユーザーID (mainUser.id) を使用
- nullチェックを追加してエラーハンドリング強化

影響:
- 12セッション全てで正しいsummary値が計算される
- History Tabで正しい収支が表示される

関連:
- project-docs/2025-10-31-migration-enhancement-analysis-tab/04-MIGRATION_MAIN_USER_ID_BUG.md
```

---

## 5. Test Cases

### TC-M1: マイグレーション実行（正常系）

**前提条件**:
- 実際のユーザーID: `'493a5260-de18-4534-900c-373d2d8af37e'`
- 12セッション存在

**操作**:
1. 設定タブを開く
2. 「データ再計算」ボタンをクリック
3. 確認ダイアログでOK

**期待結果**:
- ✅ デバッグログ: `mainUserId: '493a5260-de18-4534-900c-373d2d8af37e'`
- ✅ 警告なし（`[WARN] 半荘にメインユーザーが見つかりません` が出ない）
- ✅ 全12セッションのsummary更新成功
- ✅ History Tabで正しい収支表示

### TC-M2: mainUser null（異常系）

**前提条件**:
- mainUser === null（通常は発生しない）

**操作**:
1. 設定タブを開く
2. 「データ再計算」ボタンを確認

**期待結果**:
- ✅ ボタンがdisabled
- ✅ エラーメッセージ表示: 「メインユーザーが見つかりません」

---

## 6. Related Files

### 変更が必要なファイル

| File | Changes | LOC |
|------|---------|-----|
| `app/src/components/tabs/SettingsTab.tsx` | props追加 | +1 |
| `app/src/components/MigrationTool.tsx` | props受け取り、固定値削除、nullチェック | +15, -2 |

### 影響を受けるファイル（変更不要）

| File | Why No Change Needed |
|------|---------------------|
| `app/src/hooks/useMigration.ts` | 既に正しくmainUserIdを受け取っている |
| `app/src/lib/migration-utils.ts` | 既に正しくmainUserIdを受け取っている |
| `app/src/lib/session-utils.ts` | 既に正しくmainUserIdで検索している |

---

## 7. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| mainUser nullの場合 | Low | Low | nullチェック追加 |
| 異なるユーザーでのテスト不足 | Low | Medium | 複数ユーザーでテスト |
| 修正後の回帰 | Very Low | High | 既存のテスト継続実行 |

---

## 8. Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| **原因特定** | 45分 | ✅ 完了 |
| **ドキュメント作成** | 30分 | 🔄 進行中 |
| **修正実装** | 15分 | ⏳ 未着手 |
| **動作確認** | 15分 | ⏳ 未着手 |
| **デバッグログ削除** | 5分 | ⏳ 未着手 |
| **コミット** | 10分 | ⏳ 未着手 |
| **合計** | **2時間** | - |

---

## 9. Lessons Learned

### 9.1 設計上の教訓

**問題**:
- 固定値`'main-user-fixed-id'`の意図が曖昧だった
- 「メインユーザーの固定ID」という命名が誤解を招いた

**教訓**:
- 固定値は使用箇所と用途を明確にする
- 「固定ID」と「現在のユーザーID」を明確に区別する

### 9.2 デバッグの教訓

**成功した手法**:
- ✅ デバッグログを5箇所に戦略的に配置
- ✅ mainUserIdの値を各段階で記録
- ✅ 正常ケースと異常ケースを比較

**今後の改善**:
- 初期実装時にこのレベルのログを入れるべきだった
- ユーザーIDのミスマッチは早期に検出できるはず

---

## 10. Summary

**問題の本質**:
- マイグレーションツールが固定値を使用していた
- 実際のデータには別のIDが記録されていた
- IDミスマッチによりメインユーザーが見つからない

**修正の本質**:
- 実際のログインユーザーIDを使用する
- props経由で正しいIDを取得する

**影響**:
- 修正後、全12セッションのsummary計算が成功する
- History/Analysis Tabで正しいデータが表示される

---

**Document Status**: ✅ Complete
**Next Action**: 修正実装
**Created**: 2025-11-03 00:28
**Last Updated**: 2025-11-03 00:28
