# Migration Enhancement for Analysis Tab - Design Proposal

**作成日**: 2025-10-31
**プロジェクト**: 麻雀点数記録アプリ
**目的**: Analysis Tab (分析タブ) のデータ不整合問題の解決
**関連**: [2025-10-28-chips-parlorfee-bug-fix](../2025-10-28-chips-parlorfee-bug-fix/)

---

## 1. Problem Statement (問題の明確化)

### 1.1 Current Situation

**背景**:
- 2025-10-28に chips/parlorFee が半荘数分カウントされるバグを修正
- `calculateSessionSummary` ロジックを修正し、chips/parlorFee をセッション全体で1回のみカウントするよう変更
- マイグレーション機能を実装し、既存セッションの `Session.summary` フィールドを再計算

**観察された現象**:
- **History Tab (履歴タブ)**: マイグレーション後、正しいデータを表示
- **Analysis Tab (分析タブ)**: マイグレーション後も古い/誤ったデータを表示

### 1.2 Why Analysis Tab Shows Incorrect Data

**根本原因の分析結果**:

Analysis Tab は `Session.summary` フィールドを **全く使用していない**。

#### Evidence from Code Analysis

**AnalysisTab.tsx (Line 94-135)**: 収支統計の計算
```typescript
const revenueStats = useMemo(() => {
  // ...省略...

  // 各セッションの各半荘からselectedUserIdの収支を計算
  filteredSessions.forEach(({ session, hanchans }) => {
    if (hanchans) {
      hanchans.forEach(hanchan => {
        const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
        if (userResult) {
          // ⚠️ 半荘ごとに chips/parlorFee を計算している！
          const umaPoints = umaMarkToValue(userResult.umaMark)
          const subtotal = userResult.score + umaPoints * session.umaValue
          const payoutBeforeParlorFee = subtotal * session.rate + userResult.chips * session.chipRate

          const parlorFee = userResult.parlorFee || 0
          totalParlorFee += parlorFee

          // プラス/マイナスに振り分け
          if (payoutBeforeParlorFee > 0) {
            totalIncome += payoutBeforeParlorFee
          } else {
            totalExpense += payoutBeforeParlorFee
          }
        }
      })
    }
  })

  // ⚠️ chips/parlorFee が半荘数分カウントされる！
}, [filteredSessions, selectedUserId])
```

**AnalysisTab.tsx (Line 137-169)**: ポイント統計の計算
```typescript
const pointStats = useMemo(() => {
  // ...省略...

  // 各セッションの各半荘からselectedUserIdのポイント（小計）を計算
  filteredSessions.forEach(({ session, hanchans }) => {
    if (hanchans) {
      hanchans.forEach(hanchan => {
        // ⚠️ 半荘ごとに計算 - chips は含まない（正しい）
        const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
        if (userResult && !userResult.isSpectator && userResult.score !== null && userResult.score !== 0) {
          const umaPoints = umaMarkToValue(userResult.umaMark)
          const subtotal = userResult.score + umaPoints * session.umaValue

          if (subtotal > 0) {
            plusPoints += subtotal
          } else {
            minusPoints += subtotal
          }
        }
      })
    }
  })
}, [filteredSessions, selectedUserId])
```

**AnalysisTab.tsx (Line 171-186)**: チップ統計の計算
```typescript
const chipStats = useMemo(() => {
  // ...省略...

  // selectedUserIdのplayerResultsを収集
  const playerResults: PlayerResult[] = []
  filteredSessions.forEach(({ hanchans }) => {
    if (hanchans) {
      hanchans.forEach(hanchan => {
        // ⚠️ 半荘ごとに収集している
        const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
        if (userResult) playerResults.push(userResult)
      })
    }
  })

  return calculateChipStatistics(playerResults)
}, [filteredSessions, selectedUserId])
```

**結論**:
1. Analysis Tab は生の `Hanchan` と `PlayerResult` データから直接計算している
2. `Session.summary` を一切参照していない
3. **chips/parlorFee を半荘ごとにカウントしている** (Line 110, 114)
4. マイグレーションで `Session.summary` を修正しても、Analysis Tab には影響がない

### 1.3 Impact Assessment

**影響を受けるデータ**:

| 統計項目 | 影響 | 理由 |
|---------|------|------|
| **収支統計** | ❌ 不正確 | chips/parlorFee が半荘数分カウント |
| **ポイント統計** | ✅ 正確 | chips を含まず、score + uma のみ計算 |
| **チップ統計** | ❌ 不正確 | 半荘ごとにカウント |
| **着順統計** | ✅ 正確 | chips/parlorFee に依存しない |

**具体例** (5半荘セッション、chips=-2, parlorFee=2000):
- **期待値**: 総収支に chips=-200pt, parlorFee=-2000pt が1回のみ反映
- **実際の値**: chips=-1000pt (5倍), parlorFee=-10000pt (5倍)
- **誤差**: 約 -10,800pt (大きな差!)

### 1.4 User Experience Impact

**ユーザーの混乱**:
1. History Tab では正しい収支が表示される
2. Analysis Tab では誤った収支が表示される
3. 同じデータなのに結果が異なる → ユーザーの信頼喪失

**重大度**: **High (高)**
- ユーザーの意思決定に直接影響
- データの信頼性が損なわれる
- アプリの根幹機能である「統計分析」が機能不全

---

## 2. Current State Analysis (現状分析)

### 2.1 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ InputTab: セッション作成                                      │
│   └─> saveSessionWithSummary()                              │
│         ├─> saveSession() - Session/Hanchan/PlayerResult作成 │
│         └─> calculateSessionSummary() - Session.summary計算  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Database (IndexedDB / Dexie)                                │
│   ├─> sessions (Session.summary含む) ✅ 正しい                │
│   ├─> hanchans                                              │
│   └─> playerResults (chips/parlorFee含む) ⚠️ 半荘ごとに保存  │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
┌───────────────────────────┐  ┌───────────────────────────┐
│ HistoryTab                │  │ AnalysisTab               │
│   └─> Session.summary使用  │  │   └─> 生データから直接計算  │
│       ✅ 正しい             │  │       ❌ chips/parlorFee  │
│                           │  │          が半荘数分カウント │
└───────────────────────────┘  └───────────────────────────┘
```

### 2.2 Architecture Analysis

**History Tab** (src/components/tabs/HistoryTab.tsx):
- `useSessions()` フックで `Session.summary` を取得
- 事前計算されたデータを表示するだけ → **Fast & Correct**

**Analysis Tab** (src/components/tabs/AnalysisTab.tsx):
- `useSessions(mainUserId, { includeHanchans: true })` で生データ取得
- 複雑なフィルター処理（期間、モード、ユーザー）
- **毎回 on-the-fly で統計を計算** → **Flexible but Incorrect**

### 2.3 Why Different Approaches?

**History Tab のアプローチ**:
- 目的: セッション単位の収支を表示
- 要件: 高速表示、頻繁なアクセス
- 実装: 事前計算 (`Session.summary`) を活用
- メリット: パフォーマンス最適化
- デメリット: フィルター条件が限定的

**Analysis Tab のアプローチ**:
- 目的: 複雑なフィルター条件での集計分析
- 要件: 柔軟なフィルター（期間、モード、ユーザー、半荘レベル）
- 実装: 生データから動的に計算
- メリット: 柔軟性が高い
- デメリット: 計算ロジックが複雑、バグの温床

### 2.4 Root Cause

**Analysis Tab の設計上の問題**:
1. chips/parlorFee を「セッションレベルのデータ」として扱っていない
2. `PlayerResult` に保存されたデータを半荘ごとに処理している
3. chips/parlorFee が「全半荘で同じ値」という制約を認識していない
4. `calculateSessionSummary` のロジックと **重複した計算処理** を独自実装

**データモデルの制約**:
- chips/parlorFee は `PlayerResult` (半荘レベル) に保存されている
- UI設計上、chips/parlorFee は「セッション全体で1回」入力される
- データモデルとビジネスロジックの乖離が原因

---

## 3. Solution Options (解決策の選択肢)

### Option A: Extend Migration to Recalculate Analysis Data

**アプローチ**:
- 現在のマイグレーションを拡張し、Analysis Tab 用のデータも再計算

**詳細**:
- Analysis Tab は生データから計算しているため、マイグレーションで修正不可能
- データモデル自体を変更しない限り、根本的解決にならない

**評価**:
- ❌ 実現不可能
- 理由: Analysis Tab は `Session.summary` を使用していない

---

### Option B: Make Analysis Tab Use Session.summary (Recommended)

**アプローチ**:
- Analysis Tab の計算ロジックを変更し、`Session.summary` を活用する
- chips/parlorFee を含む統計は `Session.summary` から取得
- chips/parlorFee を除く統計（ポイント、着順）は生データから計算

**詳細実装**:

#### B-1. 収支統計を Session.summary から取得

**Before**:
```typescript
const revenueStats = useMemo(() => {
  // ... 半荘ごとにループして chips/parlorFee を計算 ...
}, [filteredSessions, selectedUserId])
```

**After**:
```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let totalIncome = 0
  let totalExpense = 0
  let totalParlorFee = 0

  // Session.summary から取得（chips/parlorFee込みの最終収支）
  filteredSessions.forEach(({ session }) => {
    if (session.summary) {
      const payout = session.summary.totalPayout
      const parlorFee = 0 // parlorFeeは既にtotalPayoutに含まれている

      // parlorFeeを分離して集計（表示用）
      // TODO: Session.summaryにparlorFee項目を追加する必要がある
      totalParlorFee += parlorFee

      if (payout > 0) {
        totalIncome += payout
      } else {
        totalExpense += payout
      }
    }
  })

  return { totalIncome, totalExpense, totalParlorFee, totalBalance: totalIncome + totalExpense }
}, [filteredSessions])
```

**課題**:
- 現在の `Session.summary` は `totalPayout` (最終収支) のみ保存
- 場代を別途表示するには、`Session.summary` に `totalParlorFee` フィールドを追加する必要がある

#### B-2. チップ統計を Session.summary から取得

**Before**:
```typescript
const chipStats = useMemo(() => {
  // ... 半荘ごとにplayerResultsを収集 ...
  return calculateChipStatistics(playerResults)
}, [filteredSessions, selectedUserId])
```

**After**:
```typescript
const chipStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let totalChips = 0

  // Session.summary から取得
  filteredSessions.forEach(({ session }) => {
    if (session.summary) {
      totalChips += session.summary.totalChips
    }
  })

  // チップは常にプラスまたはマイナスで入力されるため、
  // plusChips/minusChipsへの分解は個別に処理
  return {
    plusChips: totalChips > 0 ? totalChips : 0,
    minusChips: totalChips < 0 ? totalChips : 0,
    chipBalance: totalChips
  }
}, [filteredSessions])
```

**課題**:
- 現在の `Session.summary.totalChips` は合計値のみ
- Analysis Tab の表示形式（プラス/マイナス分離）に合わせるには追加処理が必要

#### B-3. ポイント統計は従来通り (chips/parlorFee 不要)

```typescript
const pointStats = useMemo(() => {
  // 👍 chips/parlorFee を含まないため、現在の実装で正しい
  // ...変更不要...
}, [filteredSessions, selectedUserId])
```

#### B-4. 着順統計は従来通り (chips/parlorFee 不要)

```typescript
const rankStats = useMemo(() => {
  // 👍 chips/parlorFee に依存しないため、現在の実装で正しい
  // ...変更不要...
}, [hanchans, selectedUserId, selectedMode])
```

**評価**:
- ✅ **推奨解決策**
- メリット:
  - History Tab と Analysis Tab で同じデータソースを使用
  - 計算ロジックの重複を削減
  - chips/parlorFee のバグが再発しない（計算ロジックが1箇所に集約）
  - マイグレーション不要（`Session.summary` は既に修正済み）
- デメリット:
  - `Session.summary` に `totalParlorFee` フィールドを追加する必要がある
  - コード変更が必要（Analysis Tab の実装修正）
  - chips のプラス/マイナス分離ロジックが追加で必要

---

### Option C: Add Separate "Recalculate Analysis" Button

**アプローチ**:
- Analysis Tab 専用の再計算ボタンを追加
- ボタンクリック時に、表示中のデータを正しいロジックで再計算

**詳細**:
```typescript
const handleRecalculateClick = async () => {
  // 1. filteredSessions の各セッションについて
  // 2. chips/parlorFee をセッション全体で1回のみカウント
  // 3. 再計算結果を State に保存
  // 4. UI を更新
}
```

**評価**:
- ❌ 非推奨
- デメリット:
  - ユーザー操作が必要（自動修正されない）
  - 根本的解決にならない（計算ロジックの重複は解消されない）
  - UI が複雑になる
  - 「なぜボタンを押す必要があるのか？」ユーザーの混乱を招く

---

### Option D: Fix Analysis Tab Calculation Logic Directly

**アプローチ**:
- Analysis Tab の計算ロジックを修正し、chips/parlorFee をセッション全体で1回のみカウント
- `Session.summary` は使用せず、生データから正しく計算

**詳細実装**:

```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let totalIncome = 0
  let totalExpense = 0
  let totalParlorFee = 0

  // 各セッションごとに chips/parlorFee をセッション全体で1回のみカウント
  filteredSessions.forEach(({ session, hanchans }) => {
    if (hanchans) {
      let sessionIncome = 0
      let sessionExpense = 0
      let sessionChips = 0
      let sessionParlorFee = 0
      let chipsInitialized = false

      hanchans.forEach(hanchan => {
        const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
        if (userResult) {
          // 最初の半荘から chips/parlorFee を取得（1回のみ）
          if (!chipsInitialized) {
            sessionChips = userResult.chips
            sessionParlorFee = userResult.parlorFee
            chipsInitialized = true
          }

          // chips/parlorFee を除いた収支を計算
          const umaPoints = umaMarkToValue(userResult.umaMark)
          const subtotal = userResult.score + umaPoints * session.umaValue
          const payoutWithoutExtras = subtotal * session.rate

          if (payoutWithoutExtras > 0) {
            sessionIncome += payoutWithoutExtras
          } else {
            sessionExpense += payoutWithoutExtras
          }
        }
      })

      // セッション全体で chips/parlorFee を1回のみ加算
      const finalSessionPayout = sessionIncome + sessionExpense + sessionChips * session.chipRate - sessionParlorFee

      if (finalSessionPayout > 0) {
        totalIncome += finalSessionPayout
      } else {
        totalExpense += finalSessionPayout
      }

      totalParlorFee += sessionParlorFee
    }
  })

  return {
    totalIncome,
    totalExpense,
    totalParlorFee,
    totalBalance: totalIncome + totalExpense
  }
}, [filteredSessions, selectedUserId])
```

**評価**:
- ✅ 実現可能
- メリット:
  - `Session.summary` の変更不要
  - Analysis Tab の柔軟性を維持（フィルター条件に依存しない）
  - 既存のマイグレーション機能との互換性
- デメリット:
  - 計算ロジックの重複（`calculateSessionSummary` と類似）
  - バグの再発リスク（2箇所でメンテナンスが必要）
  - コードの複雑性増加

---

## 4. Recommended Solution (推奨解決策)

### 4.1 Hybrid Approach: Option B + Option D

**戦略**: 段階的な実装で、短期的にはOption D、長期的にはOption Bへ移行

#### Phase 1: Immediate Fix (Option D) - 緊急対応

**目的**: Analysis Tab の計算バグを即座に修正

**実装内容**:
1. Analysis Tab の `revenueStats` 計算ロジックを修正
   - chips/parlorFee をセッション全体で1回のみカウント
   - `calculateSessionSummary` と同様のロジックを実装
2. `chipStats` 計算ロジックを修正
   - chips をセッション全体で1回のみカウント
3. マイグレーション不要（データは正しい、計算ロジックのみ修正）

**所要時間**: 2-3時間
**リスク**: Low（既存の `calculateSessionSummary` ロジックを参考にできる）

#### Phase 2: Architectural Improvement (Option B) - 長期的改善

**目的**: 計算ロジックの重複を解消し、保守性を向上

**実装内容**:
1. `Session.summary` インターフェースを拡張
   ```typescript
   export interface SessionSummary {
     // ...既存フィールド...
     totalParlorFee: number  // 新規追加
     chipsBreakdown?: {      // 新規追加（オプショナル）
       plus: number
       minus: number
     }
   }
   ```
2. `calculateSessionSummary` を更新して新フィールドを計算
3. Analysis Tab を更新して `Session.summary` を活用
4. マイグレーションを更新して既存データに新フィールドを追加

**所要時間**: 4-5時間
**リスク**: Medium（データモデル変更を伴う）

### 4.2 Why Hybrid Approach?

**短期的な利点（Phase 1）**:
- ✅ すぐに修正可能
- ✅ マイグレーション不要
- ✅ 既存コードへの影響が最小限
- ✅ iPhone実機でも即座に修正が反映される

**長期的な利点（Phase 2）**:
- ✅ 計算ロジックの一元化
- ✅ バグ再発リスクの低減
- ✅ コードの保守性向上
- ✅ パフォーマンス最適化（事前計算の活用）

**リスク管理**:
- Phase 1で即座に問題解決
- Phase 2は余裕を持って実装（テストを十分に実施）
- ロールバックが容易（Phase 1が独立して機能）

---

## 5. Technical Design (技術設計)

### 5.1 Phase 1: Immediate Fix - Detailed Design

#### 5.1.1 Target Files

```
src/components/tabs/AnalysisTab.tsx
  └─> 修正対象: revenueStats, chipStats の useMemo
```

#### 5.1.2 Implementation Details

**Step 1: Fix revenueStats calculation**

```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let totalIncome = 0
  let totalExpense = 0
  let totalParlorFee = 0

  // 各セッションごとに chips/parlorFee をセッション全体で1回のみカウント
  filteredSessions.forEach(({ session, hanchans }) => {
    if (!hanchans || hanchans.length === 0) return

    // セッション単位の集計変数
    let sessionPayoutBeforeChipsAndFee = 0
    let sessionChips = 0
    let sessionParlorFee = 0
    let chipsInitialized = false

    hanchans.forEach(hanchan => {
      const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
      if (!userResult || userResult.isSpectator) return

      // 最初の有効な半荘から chips/parlorFee を取得（1回のみ）
      if (!chipsInitialized && userResult.score !== null && userResult.score !== 0) {
        sessionChips = userResult.chips
        sessionParlorFee = userResult.parlorFee || 0
        chipsInitialized = true
      }

      // chips/parlorFee を除いた収支を計算
      const umaPoints = umaMarkToValue(userResult.umaMark)
      const subtotal = userResult.score + umaPoints * session.umaValue
      const payoutWithoutExtras = subtotal * session.rate

      sessionPayoutBeforeChipsAndFee += payoutWithoutExtras
    })

    // セッション全体で chips/parlorFee を1回のみ加算
    const finalSessionPayout = sessionPayoutBeforeChipsAndFee + sessionChips * session.chipRate - sessionParlorFee

    // プラス/マイナスに振り分け
    if (finalSessionPayout > 0) {
      totalIncome += finalSessionPayout
    } else {
      totalExpense += finalSessionPayout  // 負の値
    }

    totalParlorFee += sessionParlorFee
  })

  return {
    totalIncome,
    totalExpense,
    totalParlorFee,
    totalBalance: totalIncome + totalExpense
  }
}, [filteredSessions, selectedUserId])
```

**Key Changes**:
1. ✅ セッションごとに chips/parlorFee を1回のみ取得 (`chipsInitialized` フラグ)
2. ✅ `payoutWithoutExtras` を計算（chips/parlorFee を除く）
3. ✅ セッション全体で chips/parlorFee を加算
4. ✅ `calculateSessionSummary` と同様のロジック

**Step 2: Fix chipStats calculation**

```typescript
const chipStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let totalChips = 0

  // 各セッションから chips を1回のみ取得
  filteredSessions.forEach(({ session, hanchans }) => {
    if (!hanchans || hanchans.length === 0) return

    let sessionChips = 0
    let chipsInitialized = false

    hanchans.forEach(hanchan => {
      const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
      if (!userResult || userResult.isSpectator) return

      // 最初の有効な半荘から chips を取得（1回のみ）
      if (!chipsInitialized && userResult.score !== null && userResult.score !== 0) {
        sessionChips = userResult.chips
        chipsInitialized = true
      }
    })

    totalChips += sessionChips
  })

  return {
    plusChips: totalChips > 0 ? totalChips : 0,
    minusChips: totalChips < 0 ? totalChips : 0,
    chipBalance: totalChips
  }
}, [filteredSessions, selectedUserId])
```

**Key Changes**:
1. ✅ セッションごとに chips を1回のみ取得
2. ✅ 半荘数分のカウントを防止

**Step 3: Keep pointStats unchanged (already correct)**

```typescript
const pointStats = useMemo(() => {
  // 👍 chips/parlorFee を含まないため、現在の実装で正しい
  // ...変更不要...
}, [filteredSessions, selectedUserId])
```

**Step 4: Keep rankStats unchanged (already correct)**

```typescript
const rankStats = useMemo(() => {
  // 👍 chips/parlorFee に依存しないため、現在の実装で正しい
  // ...変更不要...
}, [hanchans, selectedUserId, selectedMode])
```

#### 5.1.3 Edge Cases

| Edge Case | Expected Behavior | Implementation |
|-----------|-------------------|----------------|
| 全半荘が未入力（score=0 or null） | chips/parlorFee=0 | `chipsInitialized` が false のまま |
| 見学者のみ参加 | chips/parlorFee=0 | isSpectator チェックでスキップ |
| セッションが0件 | null を返す | 先頭で early return |
| chips=0 の場合 | 正常に処理 | 0も有効な値として扱う |
| parlorFee が undefined | 0として扱う | `userResult.parlorFee || 0` |

### 5.2 Phase 2: Architectural Improvement - Detailed Design

#### 5.2.1 Target Files

```
src/lib/db.ts
  └─> SessionSummary インターフェースを拡張

src/lib/session-utils.ts
  └─> calculateSessionSummary() を更新

src/lib/migration-utils.ts
  └─> マイグレーション処理を更新

src/components/tabs/AnalysisTab.tsx
  └─> Session.summary を活用するよう変更
```

#### 5.2.2 Data Model Changes

**Before**:
```typescript
export interface SessionSummary {
  sessionId: string
  date: string
  mode: GameMode
  hanchanCount: number
  totalPayout: number        // 最終収支合計
  totalChips: number         // チップ合計
  averageRank: number
  rankCounts: { ... }
  overallRank: number
}
```

**After**:
```typescript
export interface SessionSummary {
  sessionId: string
  date: string
  mode: GameMode
  hanchanCount: number
  totalPayout: number        // 最終収支合計（chips/parlorFee込み）
  totalChips: number         // チップ合計
  totalParlorFee: number     // 🆕 場代合計（表示用に分離）
  averageRank: number
  rankCounts: { ... }
  overallRank: number

  // 🆕 オプショナル: 収支の内訳
  payoutBreakdown?: {
    scoreAndUma: number      // score + uma の収支合計
    chips: number            // チップ収支（chipRate適用後）
    parlorFee: number        // 場代（マイナス値）
  }
}
```

#### 5.2.3 Migration Strategy

**マイグレーション v2**:
```typescript
export async function migrateSessionSummaryV2(
  mainUserId: string,
  onProgress?: MigrationProgressCallback
): Promise<MigrationResult> {
  // 1. 全セッションを取得
  const sessions = await db.sessions.toArray()

  // 2. 各セッションのサマリーを再計算（新フィールド含む）
  for (const session of sessions) {
    const summary = await calculateSessionSummary(session.id, mainUserId)
    await db.sessions.update(session.id, { summary })
  }

  // 3. マイグレーション完了フラグ
  localStorage.setItem('migration_session_summary_v2', 'completed')
}
```

#### 5.2.4 Analysis Tab Changes

**After (Phase 2)**:
```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let totalIncome = 0
  let totalExpense = 0
  let totalParlorFee = 0

  filteredSessions.forEach(({ session }) => {
    if (session.summary) {
      const payout = session.summary.totalPayout
      const parlorFee = session.summary.totalParlorFee || 0

      // プラス/マイナスに振り分け
      if (payout > 0) {
        totalIncome += payout
      } else {
        totalExpense += payout
      }

      totalParlorFee += parlorFee
    }
  })

  return { totalIncome, totalExpense, totalParlorFee, totalBalance: totalIncome + totalExpense }
}, [filteredSessions])
```

**Benefits**:
- ✅ 計算ロジックが1箇所に集約（`calculateSessionSummary`）
- ✅ Analysis Tab のコードがシンプルになる
- ✅ パフォーマンス向上（事前計算を活用）

---

## 6. Implementation Plan (実装計画)

### 6.1 Phase 1: Immediate Fix (推奨: 即座に実行)

#### Step 1: Preparation (5分)

```bash
# バックアップ作成
cp /Users/nishimototakashi/claude_code/mj_app/app/src/components/tabs/AnalysisTab.tsx \
   /Users/nishimototakashi/claude_code/mj_app/app/_old_files/backup_$(date "+%Y%m%d_%H%M")/AnalysisTab.tsx

# ブランチ作成（Gitリポジトリの場合）
cd /Users/nishimototakashi/claude_code/mj_app
git checkout -b fix/analysis-tab-chips-parlorfee
```

#### Step 2: Implementation (90分)

1. **revenueStats の修正** (45分)
   - chips/parlorFee をセッション全体で1回のみカウント
   - `calculateSessionSummary` のロジックを参考にする
   - エッジケースを考慮（見学者、未入力半荘）

2. **chipStats の修正** (30分)
   - chips をセッション全体で1回のみカウント
   - プラス/マイナス分離ロジックを維持

3. **コードレビュー** (15分)
   - `calculateSessionSummary` との一貫性を確認
   - エッジケースの処理を確認

#### Step 3: Testing (45分)

1. **手動テスト** (30分)
   - 既存セッションの表示確認
   - chips/parlorFee の値が正しいか確認
   - History Tab との一貫性確認

2. **エッジケーステスト** (15分)
   - 1半荘セッション
   - 10半荘セッション
   - chips=0, parlorFee=0
   - 見学者のみ参加

#### Step 4: Documentation & Commit (20分)

```bash
# コミット
git add src/components/tabs/AnalysisTab.tsx
git commit -m "fix(AnalysisTab): chips/parlorFee を半荘数分カウントするバグを修正

chips/parlorFee をセッション全体で1回のみカウントするよう修正。
calculateSessionSummary のロジックと一貫性を持たせる。

- revenueStats: chips/parlorFee をセッション単位で集計
- chipStats: chips をセッション単位で集計
- エッジケース対応: 見学者、未入力半荘、chips=0

関連: project-docs/2025-10-28-chips-parlorfee-bug-fix/"
```

**所要時間合計**: 2.5時間

### 6.2 Phase 2: Architectural Improvement (任意: 後日実施)

#### Step 1: Data Model Changes (30分)

1. `SessionSummary` インターフェースを拡張
2. `calculateSessionSummary` を更新

#### Step 2: Migration Implementation (60分)

1. `migrateSessionSummaryV2` 関数を実装
2. MigrationTool コンポーネントを更新（v2対応）

#### Step 3: Analysis Tab Refactoring (45分)

1. `revenueStats` を `Session.summary` ベースに変更
2. `chipStats` を `Session.summary` ベースに変更
3. 不要なコードを削除

#### Step 4: Testing & Documentation (45分)

**所要時間合計**: 3時間

---

## 7. Testing Strategy (テスト戦略)

### 7.1 Phase 1 Testing

#### 7.1.1 Unit Tests (不要)

- Analysis Tab は複雑なビジネスロジックを含むため、手動テストで十分

#### 7.1.2 Manual Tests (必須)

| Test Case | Description | Expected Result | Status |
|-----------|-------------|-----------------|--------|
| **TC-M1** | 5半荘セッション（chips=-2, parlorFee=2000）の収支確認 | History Tab と Analysis Tab の収支が一致 | ⏳ |
| **TC-M2** | 1半荘セッション（chips=0, parlorFee=0）の収支確認 | 収支が正しく表示される | ⏳ |
| **TC-M3** | 10半荘セッション（chips=5, parlorFee=1000）の収支確認 | chips/parlorFee が10倍にならない | ⏳ |
| **TC-M4** | 見学者のみ参加セッション | chips/parlorFee=0 で処理される | ⏳ |
| **TC-M5** | フィルター変更時の収支確認 | 期間/モード変更で正しく再計算される | ⏳ |

#### 7.1.3 Regression Tests (必須)

| Test Case | Description | Expected Result | Status |
|-----------|-------------|-----------------|--------|
| **TC-R1** | ポイント統計が正しい | Phase 1前後で変化なし | ⏳ |
| **TC-R2** | 着順統計が正しい | Phase 1前後で変化なし | ⏳ |
| **TC-R3** | History Tab が正しい | Phase 1の影響を受けない | ⏳ |

### 7.2 Phase 2 Testing

#### 7.2.1 Migration Tests

| Test Case | Description | Expected Result | Status |
|-----------|-------------|-----------------|--------|
| **TC-MG1** | マイグレーション実行 | 全セッションが新フィールド付きで更新 | ⏳ |
| **TC-MG2** | マイグレーションの冪等性 | 複数回実行しても結果が同じ | ⏳ |

#### 7.2.2 Integration Tests

| Test Case | Description | Expected Result | Status |
|-----------|-------------|-----------------|--------|
| **TC-I1** | Analysis Tab がSession.summaryを使用 | 収支が正しく表示される | ⏳ |
| **TC-I2** | 新規セッション作成後の表示 | 新フィールドが正しく保存・表示される | ⏳ |

---

## 8. User Communication Plan (ユーザー周知計画)

### 8.1 Phase 1: Immediate Fix

**コミュニケーション不要**:
- バグ修正のため、ユーザーへの通知は不要
- アプリを開くだけで自動的に修正が適用される

**変更内容**:
- Analysis Tab の収支表示が正しくなる
- History Tab との一貫性が確保される

### 8.2 Phase 2: Architectural Improvement

**マイグレーション通知** (MigrationTool コンポーネントで表示):
```
データ再計算 (v2)

Analysis Tab の統計データを最新の形式に更新します。
この操作は既存データを保持し、計算結果のみを更新します。

実行しますか？
```

**完了メッセージ**:
```
✅ 再計算完了

処理完了: XX / XX セッション
実行時間: X.XX秒

Analysis Tab の統計が最新の形式に更新されました。
```

---

## 9. Risk Assessment & Mitigation (リスク評価と対策)

### 9.1 Phase 1 Risks

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| 計算ロジックのバグ | High | Low | `calculateSessionSummary` と同じロジックを使用 |
| エッジケースの見落とし | Medium | Medium | 包括的な手動テストを実施 |
| パフォーマンス劣化 | Low | Low | useMemo で最適化済み |
| History Tab との不一致 | High | Low | 両タブで同じ計算結果になることを確認 |

### 9.2 Phase 2 Risks

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| データモデル変更の影響 | High | Medium | マイグレーションで既存データを更新 |
| マイグレーション失敗 | High | Low | 冪等性を確保、ロールバック可能に |
| 後方互換性の破壊 | Medium | Low | オプショナルフィールドとして実装 |

---

## 10. Success Criteria (成功基準)

### 10.1 Phase 1

- ✅ Analysis Tab の収支統計が正しい
- ✅ chips/parlorFee がセッション全体で1回のみカウントされる
- ✅ History Tab との収支が一致する
- ✅ すべての手動テストが合格
- ✅ 既存機能が破壊されていない（回帰テスト）

### 10.2 Phase 2

- ✅ `Session.summary` に新フィールドが追加されている
- ✅ Analysis Tab が `Session.summary` を活用している
- ✅ 計算ロジックの重複が解消されている
- ✅ マイグレーションがすべて成功
- ✅ パフォーマンスが維持または向上

---

## 11. Summary & Recommendations (まとめと推奨事項)

### 11.1 Key Findings

1. **根本原因**: Analysis Tab は `Session.summary` を使用せず、生データから直接計算している
2. **バグの本質**: chips/parlorFee を半荘ごとにカウントしている（セッション全体で1回のみカウントすべき）
3. **影響範囲**: 収支統計とチップ統計が誤っている（ポイント統計と着順統計は正しい）
4. **マイグレーションの限界**: `Session.summary` を修正しても Analysis Tab には影響がない

### 11.2 Recommended Actions

**即座に実行 (Phase 1)**:
- ✅ Analysis Tab の計算ロジックを修正
- ✅ chips/parlorFee をセッション全体で1回のみカウント
- ✅ 所要時間: 2.5時間
- ✅ リスク: Low

**将来的に実行 (Phase 2)**:
- ✅ `Session.summary` を拡張（新フィールド追加）
- ✅ Analysis Tab を `Session.summary` ベースに変更
- ✅ 計算ロジックの一元化
- ✅ 所要時間: 3時間
- ✅ リスク: Medium

### 11.3 Long-Term Considerations

**アーキテクチャ的な改善**:
1. データモデルとビジネスロジックの整合性を確保
2. chips/parlorFee を「セッションレベル」のデータとして扱う
3. 計算ロジックを1箇所に集約（DRY原則）
4. 事前計算を活用してパフォーマンス最適化

**教訓**:
- chips/parlorFee のような「セッション全体で共通」のデータは、データモデルでも「セッションレベル」に保存すべき
- UI層とデータ層の設計が乖離すると、バグの温床になる
- 計算ロジックの重複は、バグ再発リスクを増大させる

---

## 12. Appendix (付録)

### 12.1 Related Documentation

- [2025-10-28-chips-parlorfee-bug-fix](../2025-10-28-chips-parlorfee-bug-fix/) - chips/parlorFee バグの詳細
- [CLAUDE.md](/Users/nishimototakashi/claude_code/mj_app/CLAUDE.md) - プロジェクト全体の方針

### 12.2 Code References

- `src/components/tabs/AnalysisTab.tsx` - 修正対象
- `src/lib/session-utils.ts` - `calculateSessionSummary` の正しいロジック
- `src/lib/migration-utils.ts` - マイグレーション処理
- `src/components/MigrationTool.tsx` - マイグレーションUI

### 12.3 Contact

**実装者**: Claude Code
**レビュー**: ユーザー承認後に実装開始
**質問・懸念事項**: このドキュメントにコメントを追加してください

---

**Document Status**: ✅ Design Complete - Awaiting User Approval

**Next Steps**:
1. ユーザーによる設計レビュー
2. 承認後、Phase 1 の実装を開始
3. Phase 1 完了後、Phase 2 の実施判断

---

**作成日**: 2025-10-31
**最終更新**: 2025-10-31
**バージョン**: 1.0
