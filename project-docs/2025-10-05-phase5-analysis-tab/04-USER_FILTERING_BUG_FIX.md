# Phase 5 Fix: AnalysisTab 収支・チップ統計のユーザーフィルタリング不具合修正

**作成日**: 2025-10-07 00:55
**ステータス**: 計画完了 → 実装待ち
**担当**: Claude Code

---

## 📋 目次

1. [問題の発見](#問題の発見)
2. [根本原因分析](#根本原因分析)
3. [修正方針](#修正方針)
4. [実装計画](#実装計画)
5. [テスト項目](#テスト項目)

---

## 🐛 問題の発見

### 発見経緯

Phase 5アーキテクチャ統一実装完了後の動作確認中に発見。

**症状**:
- ユーザー選択ドロップダウンで「自分」→「登録ユーザー」に切り替え
- 着順統計・ポイント統計は正しく更新される ✅
- **収支統計・チップ統計が更新されない** ❌

### 影響範囲

- 収支統計（revenueStats）: ユーザー切り替えで値が変わらない
- チップ統計（chipStats）: ユーザー切り替えで値が変わらない
- 着順統計（rankStats）: 正常動作 ✅
- ポイント統計（pointStats）: 正常動作 ✅

---

## 🔍 根本原因分析

### データフローの調査

#### 1. `useSessions`フックの仕様

**ファイル**: `app/src/hooks/useSessions.ts`

```typescript
export function useSessions(mainUserId: string, options?: { includeHanchans?: boolean }) {
  const allSessions = useLiveQuery(() => db.sessions.toArray(), [])

  // サマリー計算（Line 66）
  const summary = await calculateSessionSummary(session.id, mainUserId)
  //                                                         ^^^^^^^^^^
  //                                                         特定ユーザー専用
}
```

**重要な発見**:
- `useSessions`は`mainUserId`パラメータを受け取る
- `session.summary`の計算に`mainUserId`を使用
- **`session.summary`は特定ユーザー専用のデータ**

#### 2. AnalysisTabの実装

**ファイル**: `app/src/components/tabs/AnalysisTab.tsx`

```typescript
// Line 23: useSessions呼び出し
const { sessions, loading, error } = useSessions(mainUser?.id || '', { includeHanchans: true })
//                                                ^^^^^^^^^^^^^^^^
//                                                常にmainUser.id固定

// Line 68-73: 収支統計の計算
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null
  return calculateRevenueStatistics(
    filteredSessions.map(s => ({ totalPayout: s.summary.totalPayout }))
    //                                         ^^^^^^^^^^^^^^^^^^^^^
    //                                         mainUserのデータ
  )
}, [filteredSessions])  // ← selectedUserIdが依存配列にない
```

**問題点**:
- `useSessions`に常に`mainUser.id`を渡している
- `session.summary.totalPayout`は**mainUserの収支**
- `selectedUserId`が変わっても、`session.summary`は再計算されない

#### 3. SessionSummaryのデータ構造

**ファイル**: `app/src/lib/db.ts`

```typescript
export interface SessionSummary {
  sessionId: string;
  date: string;
  mode: GameMode;
  hanchanCount: number;      // 入力済み半荘数
  totalPayout: number;       // ← ユーザー固有の最終収支合計
  totalChips: number;        // ← ユーザー固有のチップ合計
  averageRank: number;       // ← ユーザー固有の平均着順
  rankCounts: {              // ← ユーザー固有の着順集計
    first: number;
    second: number;
    third: number;
    fourth?: number;
  };
}
```

**結論**: `SessionSummary`は**特定ユーザー専用**のサマリーデータ構造。

### 各統計の実装比較

| 統計種類 | データソース | selectedUserId使用 | 動作 |
|---------|-------------|-------------------|------|
| 着順統計 | `hanchans` → `calculateRankStatistics(hanchans, selectedUserId, mode)` | ✅ あり | ✅ 正常 |
| ポイント統計 | `hanchans` → `playerResults.find(p => p.userId === selectedUserId)` | ✅ あり | ✅ 正常 |
| 収支統計 | `session.summary.totalPayout` | ❌ なし | ❌ 不具合 |
| チップ統計 | `session.summary.totalChips` | ❌ なし | ❌ 不具合 |

### なぜポイント統計は動作するのか？

**ポイント統計の実装**（Line 75-87）:
```typescript
const pointStats = useMemo(() => {
  if (filteredSessions.length === 0) return null
  const playerResults: PlayerResult[] = []
  filteredSessions.forEach(({ hanchans }) => {
    if (hanchans) {
      hanchans.forEach(hanchan => {
        const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
        //                                                                        ^^^^^^^^^^^^^^
        //                                                                        selectedUserIdでフィルタリング
        if (userResult) playerResults.push(userResult)
      })
    }
  })
  return calculatePointStatistics(playerResults)
}, [filteredSessions, selectedUserId])  // ← selectedUserIdが依存配列にある
```

**理由**: `hanchans`→`playerResults`を辿って、**selectedUserIdで動的にフィルタリング**しているため。

---

## 🔧 修正方針

### 選択肢の検討

#### オプション1: 動的に再計算する（推奨・採用） ✅

**方針**:
- ポイント統計と同じパターンを適用
- `filteredSessions` → `hanchans` → `playerResults`を辿る
- `selectedUserId`でフィルタリングして収支・チップを計算

**メリット**:
- 正確にユーザー別の統計が取得できる
- 既存パターン（pointStats）との統一
- パフォーマンス影響は軽微（データは既にメモリにある）

**デメリット**:
- 実装がやや複雑になる

#### オプション2: useSessions呼び出しをselectedUserIdベースに変更

**方針**:
```typescript
const { sessions, loading, error } = useSessions(selectedUserId || '', { includeHanchans: true })
```

**メリット**:
- シンプル

**デメリット**:
- ユーザー切り替えのたびにDB再計算が走る
- パフォーマンス低下（Phase 4で最適化したサマリー事前計算が無駄になる）
- `useSessions`の引数が変わるとリアクティブに再レンダリングが多発

#### オプション3: 仕様変更（収支・チップ統計はメインユーザー固定）

**方針**:
- 収支・チップ統計は「自分」のデータのみ表示
- ユーザー切り替えは着順・ポイント統計のみ有効

**メリット**:
- 修正不要

**デメリット**:
- UX低下（ユーザーごとの収支比較ができない）
- 計画書の要件「ユーザー切り替えで統計が正しく更新される」に反する

### 採用: オプション1（動的再計算）

**理由**:
1. 計画書の要件を満たす
2. 既存パターン（pointStats）との統一
3. パフォーマンス影響は軽微

---

## 📝 実装計画

### Step 1: revenueStats修正（収支統計）

**ファイル**: `app/src/components/tabs/AnalysisTab.tsx`
**変更対象**: Line 68-73

#### Before（現状 - 不具合あり）

```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null
  return calculateRevenueStatistics(
    filteredSessions.map(s => ({ totalPayout: s.summary.totalPayout }))
  )
}, [filteredSessions])
```

#### After（修正後 - 動的フィルタリング）

```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  // selectedUserIdのplayerResultsを収集
  const playerResults: PlayerResult[] = []
  filteredSessions.forEach(({ hanchans }) => {
    if (hanchans) {
      hanchans.forEach(hanchan => {
        const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
        if (userResult) playerResults.push(userResult)
      })
    }
  })

  // playerResultsから収支を計算
  let totalIncome = 0
  let totalExpense = 0

  playerResults.forEach(pr => {
    if (pr.score > 0) {
      totalIncome += pr.score
    } else {
      totalExpense += pr.score  // 負の値
    }
  })

  return {
    totalIncome,
    totalExpense,
    totalBalance: totalIncome + totalExpense
  }
}, [filteredSessions, selectedUserId])  // ← selectedUserId追加
```

**変更点**:
- `session.summary.totalPayout`ではなく、`playerResults`から直接計算
- `selectedUserId`でフィルタリング
- 依存配列に`selectedUserId`を追加

**注意**:
- `calculateRevenueStatistics`関数は使用しない（session.summary専用のため）
- インライン計算に変更

---

### Step 2: chipStats修正（チップ統計）

**ファイル**: `app/src/components/tabs/AnalysisTab.tsx`
**変更対象**: Line 89-93

#### Before（現状 - 不具合あり）

```typescript
const chipStats = useMemo(() => {
  if (filteredSessions.length === 0) return null
  return calculateChipStatistics(
    filteredSessions.map(s => ({ totalChips: s.summary.totalChips }))
  )
}, [filteredSessions])
```

#### After（修正後 - 動的フィルタリング）

```typescript
const chipStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  // selectedUserIdのplayerResultsを収集
  const playerResults: PlayerResult[] = []
  filteredSessions.forEach(({ hanchans }) => {
    if (hanchans) {
      hanchans.forEach(hanchan => {
        const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
        if (userResult) playerResults.push(userResult)
      })
    }
  })

  // playerResultsからチップを計算
  const totalChips = playerResults.reduce((sum, pr) => sum + pr.chips, 0)

  return { totalChips }
}, [filteredSessions, selectedUserId])  // ← selectedUserId追加
```

**変更点**:
- `session.summary.totalChips`ではなく、`playerResults.chips`から直接計算
- `selectedUserId`でフィルタリング
- 依存配列に`selectedUserId`を追加

**注意**:
- `calculateChipStatistics`関数は使用しない（session.summary専用のため）
- インライン計算に変更

---

### Step 3: コードの最適化（オプション）

`playerResults`の収集ロジックが3箇所（pointStats, revenueStats, chipStats）で重複しているため、共通化を検討。

#### オプション3-A: useMemoで共通化

```typescript
// selectedUserIdのplayerResultsを収集（共通化）
const userPlayerResults = useMemo(() => {
  const results: PlayerResult[] = []
  filteredSessions.forEach(({ hanchans }) => {
    if (hanchans) {
      hanchans.forEach(hanchan => {
        const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
        if (userResult) results.push(userResult)
      })
    }
  })
  return results
}, [filteredSessions, selectedUserId])

// 各統計で使用
const pointStats = useMemo(() => {
  if (userPlayerResults.length === 0) return null
  return calculatePointStatistics(userPlayerResults)
}, [userPlayerResults])

const revenueStats = useMemo(() => {
  if (userPlayerResults.length === 0) return null
  let totalIncome = 0
  let totalExpense = 0
  userPlayerResults.forEach(pr => {
    if (pr.score > 0) {
      totalIncome += pr.score
    } else {
      totalExpense += pr.score
    }
  })
  return { totalIncome, totalExpense, totalBalance: totalIncome + totalExpense }
}, [userPlayerResults])

const chipStats = useMemo(() => {
  if (userPlayerResults.length === 0) return null
  const totalChips = userPlayerResults.reduce((sum, pr) => sum + pr.chips, 0)
  return { totalChips }
}, [userPlayerResults])
```

**メリット**:
- コードの重複削減
- 保守性向上

**判断**: 今回は最小限の修正に留め、オプション3-Aは将来のリファクタリングで検討。

---

## 🧪 テスト項目

### 必須確認項目

#### 1. ビルド確認

```bash
npx tsc --noEmit
npm run build
```

**期待結果**: 0 errors

#### 2. 動作確認

**Dev Server起動**:
```bash
npm run dev
```

**テストケース**:

##### TC1: メインユーザー（自分）の統計表示
1. 分析タブを開く
2. ユーザー選択で「自分」を選択
3. 着順統計・ポイント統計・収支統計・チップ統計が表示される
4. **期待結果**: 自分のデータが正しく表示される

##### TC2: 登録ユーザーへの切り替え
1. ユーザー選択で登録ユーザー（例: 田中）を選択
2. すべての統計が更新される
3. **期待結果**:
   - 着順統計: 田中の着順データ
   - ポイント統計: 田中のポイントデータ
   - **収支統計: 田中の収支データ** ← 今回の修正対象
   - **チップ統計: 田中のチップデータ** ← 今回の修正対象

##### TC3: 複数ユーザー間での切り替え
1. 「自分」→「田中」→「佐藤」→「自分」と順番に切り替え
2. 各ユーザーでデータが正しく更新される
3. **期待結果**: すべての統計が各ユーザーのデータに正しく切り替わる

##### TC4: データなしユーザー
1. データが存在しないユーザーを選択
2. **期待結果**: 「データがありません」メッセージが表示される

##### TC5: 期間フィルター＋ユーザー切り替え
1. 期間を「今月」に設定
2. ユーザーを切り替え
3. **期待結果**: 期間フィルター＋ユーザーフィルターが両方適用される

##### TC6: モードフィルター＋ユーザー切り替え
1. モードを「4人打ち」に設定
2. ユーザーを切り替え
3. **期待結果**: モードフィルター＋ユーザーフィルターが両方適用される

### 詳細確認項目

#### 収支統計の計算確認

**手動計算との照合**:
1. 特定ユーザー（例: 田中）のデータを手動集計
2. AnalysisTabの収支統計と比較
3. **期待結果**: 数値が一致する

**確認方法**:
- SessionDetailDialogで個別セッションを開く
- 田中の各半荘の点数を合計
- AnalysisTabの収支統計と比較

#### チップ統計の計算確認

**手動計算との照合**:
1. 特定ユーザー（例: 田中）のチップ数を手動集計
2. AnalysisTabのチップ統計と比較
3. **期待結果**: 数値が一致する

---

## 📊 実装前後の比較

### Before（不具合あり）

```
ユーザー選択: [自分] → [田中] に変更

着順統計:   自分のデータ   →  田中のデータ   ✅ 更新される
ポイント統計: 自分のデータ   →  田中のデータ   ✅ 更新される
収支統計:   自分のデータ   →  自分のデータ   ❌ 更新されない
チップ統計:  自分のデータ   →  自分のデータ   ❌ 更新されない
```

### After（修正後）

```
ユーザー選択: [自分] → [田中] に変更

着順統計:   自分のデータ   →  田中のデータ   ✅ 更新される
ポイント統計: 自分のデータ   →  田中のデータ   ✅ 更新される
収支統計:   自分のデータ   →  田中のデータ   ✅ 更新される
チップ統計:  自分のデータ   →  田中のデータ   ✅ 更新される
```

---

## 🎯 期待される結果

1. ✅ すべての統計がユーザー切り替えで正しく更新される
2. ✅ 計画書の要件「ユーザー切り替えで統計が正しく更新される」を満たす
3. ✅ 既存機能（着順統計、ポイント統計）に影響なし
4. ✅ パフォーマンス影響は軽微（データは既にメモリにある）

---

## 📚 参考情報

### 関連ファイル

- `app/src/components/tabs/AnalysisTab.tsx`: 修正対象
- `app/src/hooks/useSessions.ts`: useSessions実装
- `app/src/lib/db-utils.ts`: calculateRevenueStatistics, calculateChipStatistics
- `app/src/lib/session-utils.ts`: calculateSessionSummary
- `app/src/lib/db.ts`: SessionSummary型定義

### 関連ドキュメント

- `03-ARCHITECTURE_UNIFICATION_PLAN.md`: アーキテクチャ統一計画（今回の実装の前提）
- `project-docs/2025-10-04-phase4-history-tab/04-SUMMARY_PRE_CALCULATION.md`: サマリー事前計算の実装

---

**この計画に基づいて修正実装を開始します。**
