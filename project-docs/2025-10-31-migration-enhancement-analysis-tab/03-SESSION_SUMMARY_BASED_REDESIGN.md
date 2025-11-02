# Analysis Tab - Session.summary Based Redesign

**作成日**: 2025-11-02
**目的**: Session.summaryを使用した収支統計の完全再設計

---

## 1. Executive Summary

### 1.1 Problem Statement

**発見された問題**（ユーザー指摘）:
> 「全ての半荘のスコアから各々の収支を計算しているようだが、それはおかしい。なぜなら1回の集計によって得られた合計収支が+ならば、一度も支出は発生していないはずだからだ。分析タブにおける収支の計算は、各集計の最終結果をもとに行われるべきである。」

**問題の核心**:
- 現在: 半荘単位で収支を+/-に振り分け（設計ミス）
- 正しい: セッション単位で最終収支を+/-に振り分け

**具体例**:
```
セッション1（5半荘、最終収支+40pt）:
  半荘1: +30pt
  半荘2: -10pt ← これを「支出」としてカウント（誤）
  半荘3: +20pt
  半荘4: +15pt
  半荘5: -5pt  ← これも「支出」としてカウント（誤）

現在の表示:
  収入: +65pt, 支出: -15pt → 概念的に間違い

正しい表示:
  収入: +40pt, 支出: 0pt → セッション全体で黒字なので支出なし
```

### 1.2 Root Cause

**原因**: `Session.summary`の存在を無視した実装

- ✅ マイグレーション機能で`Session.summary`は正しく計算済み
- ❌ Analysis Tabが`Session.summary`を全く使っていない
- ❌ 半荘単位で収支を再計算（chips/parlorFeeバグも含む）

**Session.summaryの構造** (`src/lib/db.ts` Line 24-40):
```typescript
export interface SessionSummary {
  sessionId: string;
  date: string;
  mode: GameMode;
  hanchanCount: number;      // 半荘数
  totalPayout: number;       // 最終収支合計
  totalChips: number;        // チップ合計
  totalParlorFee: number;    // 場代合計（追加予定）
  averageRank: number;       // 平均着順
  rankCounts: {
    first: number;
    second: number;
    third: number;
    fourth?: number;
  };
  overallRank: number;       // セッション内総合順位
}
```

**現状の問題**:
- ❌ `totalParlorFee`フィールドが存在しない
- ✅ `totalChips`は存在する → **totalParlorFeeも追加すべき**

### 1.3 Solution

**解決策の2段階アプローチ**:

#### Step 1: Session.summaryを拡張
```typescript
export interface SessionSummary {
  totalPayout: number;
  totalChips: number;
  totalParlorFee: number;  // ← 追加
  // ...
}
```

#### Step 2: Analysis TabでSession.summaryを使用
```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let totalIncome = 0
  let totalExpense = 0
  let totalParlorFee = 0

  filteredSessions.forEach(({ session }) => {
    if (session.summary) {
      // ✅ すべてsummaryから取得
      const payout = session.summary.totalPayout
      totalParlorFee += session.summary.totalParlorFee

      if (payout >= 0) {
        totalIncome += payout
      } else {
        totalExpense += payout
      }
    }
  })

  return {
    totalIncome,
    totalExpense,
    totalParlorFee,  // ✅ UIに表示（削除しない）
    totalBalance: totalIncome + totalExpense
  }
}, [filteredSessions])
```

**解決される問題**:
1. ✅ Session.summaryにtotalParlorFee追加（データ構造の一貫性）
2. ✅ セッション単位で収支を振り分け（設計上正しい）
3. ✅ chips/parlorFeeバグ解消（summaryは正しく計算済み）
4. ✅ データソース統一（すべてsummaryから）
5. ✅ デフォルトフィルター問題も同時に修正可能
6. ✅ パフォーマンス向上（再計算不要）

---

## 2. Current Implementation Analysis

### 2.1 修正が必要な実装

**File**: `src/components/tabs/AnalysisTab.tsx`

#### 2.1.1 revenueStats（収支統計） - Lines 94-135

**現在の実装**:
```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let totalIncome = 0
  let totalExpense = 0
  let totalParlorFee = 0

  // ❌ 半荘単位でループ（設計ミス）
  filteredSessions.forEach(({ session, hanchans }) => {
    if (hanchans) {
      hanchans.forEach(hanchan => {
        const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
        if (userResult) {
          // 場代を引く前の収支を計算
          const umaPoints = umaMarkToValue(userResult.umaMark)
          const subtotal = userResult.score + umaPoints * session.umaValue
          const payoutBeforeParlorFee = subtotal * session.rate + userResult.chips * session.chipRate

          // ❌ 場代を半荘ごとに加算（chips/parlorFeeバグ）
          const parlorFee = userResult.parlorFee || 0
          totalParlorFee += parlorFee

          // ❌ 半荘単位で+/-振り分け（設計ミス）
          if (payoutBeforeParlorFee > 0) {
            totalIncome += payoutBeforeParlorFee
          } else {
            totalExpense += payoutBeforeParlorFee
          }
        }
      })
    }
  })

  return {
    totalIncome,
    totalExpense,
    totalParlorFee,
    totalBalance: totalIncome + totalExpense - totalParlorFee
  }
}, [filteredSessions, selectedUserId])
```

**問題点**:
1. ❌ 半荘単位で収支を振り分け → セッション単位であるべき（設計ミス）
2. ❌ chips/parlorFeeを半荘ごとに加算 → 5倍バグ
3. ❌ 複雑な計算ロジック → メンテナンス困難
4. ❌ Session.summaryを無視 → データ重複

#### 2.1.2 chipStats（チップ統計） - Lines 171-186

**現在の実装**:
```typescript
const chipStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  // ❌ PlayerResultsを半荘ごとに収集（chips/parlorFeeバグ）
  const playerResults: PlayerResult[] = []
  filteredSessions.forEach(({ hanchans }) => {
    if (hanchans) {
      hanchans.forEach(hanchan => {
        const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
        if (userResult) playerResults.push(userResult)
      })
    }
  })

  return calculateChipStatistics(playerResults)
}, [filteredSessions, selectedUserId])
```

**問題点**:
1. ❌ 半荘ごとにchipsを収集 → 5倍バグ
2. ❌ Session.summaryのtotalChipsを使用すべき

#### 2.1.3 Default Filter - Line 30

```typescript
const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('this-month')
```

**問題点**:
- ❌ デフォルトが'this-month' → 過去のデータが見えない
- ❌ 10月31日のデータが11月2日に表示されない

### 2.2 変更不要な実装（参考）

#### 2.2.1 pointStats（スコア統計） - Lines 137-169

**現在の実装（変更不要）**:
```typescript
const pointStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let plusPoints = 0
  let minusPoints = 0

  // ✅ スコアは半荘単位で集計が正しい
  filteredSessions.forEach(({ session, hanchans }) => {
    if (hanchans) {
      hanchans.forEach(hanchan => {
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

  return {
    plusPoints,
    minusPoints,
    pointBalance: plusPoints + minusPoints
  }
}, [filteredSessions, selectedUserId])
```

**理由（変更不要）**:
- ✅ スコア（score + uma）は**半荘単位の概念**
- ✅ 全半荘のスコアを集計する必要がある
- ✅ 例: 「半荘1で+30点、半荘2で-10点」は有用な情報
- ✅ Session.summaryには含まれない情報（半荘ごとの詳細）

**注意**: この実装は正しく、修正の必要はありません。

---

## 3. New Design - Session.summary Based

### 3.1 Design Principles

**設計方針**:
1. ✅ **Session.summaryを唯一の真実の源（SSOT）とする**
2. ✅ セッション単位で収支を振り分け（設計上正しい）
3. ✅ シンプルで保守しやすいコード
4. ✅ パフォーマンス最適化（再計算不要）
5. ✅ マイグレーション済みデータを活用

### 3.2 New Implementation

#### revenueStats (収支統計) - 完全書き直し

**Before** (36行、複雑):
```typescript
const revenueStats = useMemo(() => {
  // 36行の複雑なロジック...
  // 半荘ごとにループ、chips/parlorFee計算、+/-振り分け
}, [filteredSessions, selectedUserId])
```

**After** (18行、シンプル):
```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let totalIncome = 0
  let totalExpense = 0
  let totalParlorFee = 0

  // ✅ セッション単位でループ（設計上正しい）
  filteredSessions.forEach(({ session }) => {
    if (session.summary) {
      // ✅ すべてsummaryから取得（一貫性）
      const totalPayout = session.summary.totalPayout
      totalParlorFee += session.summary.totalParlorFee

      if (totalPayout >= 0) {
        totalIncome += totalPayout
      } else {
        totalExpense += totalPayout
      }
    }
  })

  return {
    totalIncome,
    totalExpense,
    totalParlorFee,  // ✅ UIに表示（維持）
    totalBalance: totalIncome + totalExpense
  }
}, [filteredSessions])
```

**変更点**:
1. ✅ `session.summary.totalPayout`を使用（chips/parlorFee含む）
2. ✅ `session.summary.totalParlorFee`を使用（**新規追加**）
3. ✅ セッション単位で+/-振り分け
4. ✅ `selectedUserId`依存削除（summaryは既にユーザー固有）
5. ✅ データソース統一（すべてsummary）
6. ✅ コード量50%削減

#### pointStats (スコア統計) - 変更なし

**理由**: スコア（score + uma）は半荘単位の概念なので、現在の実装が正しい

**変更なし**:
```typescript
// Section 2.2.1 参照 - 現在の実装を維持
```

**ポイント**:
- ✅ スコアは半荘単位で集計（全半荘のスコアを集計する必要がある）
- ✅ Session.summaryには含まれない情報（半荘ごとの詳細）
- ✅ 修正不要

#### chipStats (チップ統計) - Session.summary使用

**Before** (16行):
```typescript
const chipStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  // ❌ 半荘ごとにPlayerResultsを収集
  const playerResults: PlayerResult[] = []
  filteredSessions.forEach(({ hanchans }) => {
    if (hanchans) {
      hanchans.forEach(hanchan => {
        const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
        if (userResult) playerResults.push(userResult)
      })
    }
  })

  return calculateChipStatistics(playerResults)
}, [filteredSessions, selectedUserId])
```

**After** (15行):
```typescript
const chipStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let plusChips = 0
  let minusChips = 0

  // ✅ セッション単位でチップ集計
  filteredSessions.forEach(({ session }) => {
    if (session.summary) {
      const chips = session.summary.totalChips

      if (chips >= 0) {
        plusChips += chips
      } else {
        minusChips += chips
      }
    }
  })

  return {
    plusChips,
    minusChips,
    chipBalance: plusChips + minusChips
  }
}, [filteredSessions])
```

**変更点**:
1. ✅ `session.summary.totalChips`を使用
2. ✅ `calculateChipStatistics`不要（シンプルに）
3. ✅ セッション単位で集計（chips/parlorFeeバグ解消）

#### Default Filter Fix

**Before**:
```typescript
const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('this-month')
```

**After**:
```typescript
const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('all')
```

### 3.3 UI Changes

**収支統計カード** (Lines 152-183):

**変更点**: データ引用方法のみ変更、UI構造は維持

```tsx
<div className="space-y-1 text-lg">
  <div className="flex">
    <span className="w-12">+:</span>
    <span className="flex-1 text-right text-blue-600">+{revenueStats.totalIncome}pt</span>
  </div>
  <div className="flex">
    <span className="w-12">-:</span>
    <span className="flex-1 text-right text-red-600">{revenueStats.totalExpense}pt</span>
  </div>
  <div className="flex">
    <span className="w-12">場代:</span>
    {/* ✅ session.summary.totalParlorFeeから取得（データソース変更のみ） */}
    <span className={`flex-1 text-right ${revenueStats.totalParlorFee <= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
      {(() => {
        const value = Math.abs(revenueStats.totalParlorFee);
        if (revenueStats.totalParlorFee > 0) return `-${value}pt`;
        if (revenueStats.totalParlorFee < 0) return `+${value}pt`;
        return `${value}pt`;
      })()}
    </span>
  </div>
  <div className="flex pt-1 border-t font-bold">
    <span className="w-12">計:</span>
    <span className={`flex-1 text-right ${revenueStats.totalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
      {revenueStats.totalBalance >= 0 ? '+' : ''}{revenueStats.totalBalance}pt
    </span>
  </div>
</div>
```

**変更内容**:
- ✅ 「場代」行は**維持**（必要な情報）
- ✅ データソースを`session.summary.totalParlorFee`に変更
- ✅ UI構造は変更なし（4行維持）

---

## 4. Implementation Plan

### 4.1 Phase 1: Session.summary拡張 (25分)

**Step 1: SessionSummary型定義拡張** (5分)
- File: `src/lib/db.ts` Lines 24-40
- `totalParlorFee: number`を追加

**Step 2: calculateSessionSummary修正** (15分)
- File: `src/lib/session-utils.ts`
- totalParlorFee計算ロジック追加
- 既存のchips計算と同じパターンで実装

```typescript
let totalParlorFee = 0
let parlorFeeInitialized = false

for (const hanchan of hanchans) {
  if (!parlorFeeInitialized) {
    totalParlorFee = mainUserResult.parlorFee
    parlorFeeInitialized = true
  }
}

return {
  // ...
  totalChips: sessionChips,
  totalParlorFee: totalParlorFee,  // 追加
  // ...
}
```

**Step 3: マイグレーション実行** (5分)
- ユーザーが設定タブのマイグレーションツールで実行
- 既存セッションのsummaryを再計算

### 4.2 Phase 2: Analysis Tab修正 (20分)

**Step 1: revenueStats修正** (10分)
- File: `src/components/tabs/AnalysisTab.tsx` Lines 94-135
- Before: 36行 → After: 18行
- `session.summary.totalParlorFee`使用
- UIは4行維持

**Step 2: chipStats修正** (5分)
- File: `src/components/tabs/AnalysisTab.tsx` Lines 171-186
- Before: 16行 → After: 15行
- `session.summary.totalChips`使用

**Step 3: Default Filter修正** (5分)
- File: `src/components/tabs/AnalysisTab.tsx` Line 30
- `'this-month'` → `'all'`

### 4.3 Phase 3: Testing (30分)

**Test Cases**:

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| **TC-SS1** | 5半荘セッション（全体+40pt） | 収入:+40pt、支出:0pt |
| **TC-SS2** | 5半荘セッション（全体-20pt） | 収入:0pt、支出:-20pt |
| **TC-SS3** | chips=-2, parlorFee=2000 | チップ:-2枚（-10枚ではない） |
| **TC-SS4** | デフォルトフィルター | 「全期間」が選択済み |
| **TC-SS5** | 複数セッション集計 | 各セッションの収支が正しく合算 |

**Test Data**:
```typescript
// Session 1: +2870pt (5半荘、chips=-2、場代=2000)
// Session 2: -1500pt (3半荘)
// 期待値: 収入=+2870pt、支出=-1500pt、合計=+1370pt
```

### 4.4 Phase 4: Documentation & Commit (15分)

**Documentation Updates**:
1. `02-DEFAULT_FILTER_ISSUE.md` にSession.summary使用を追記
2. `CLAUDE.md` の進捗更新

**Commit Message**:
```
fix(AnalysisTab): Session.summary拡張と収支統計の全面改修

Session.summary拡張:
- totalParlorFeeフィールドを追加（データ構造の一貫性）
- calculateSessionSummaryでtotalParlorFee計算

Analysis Tab修正:
- セッション単位での収支振り分けに修正
- chips/parlorFeeを半荘ごとにカウントするバグ修正
- デフォルトフィルターを「全期間」に変更
- データソースをsession.summaryに統一

変更箇所:
- SessionSummary: totalParlorFee追加
- session-utils.ts: totalParlorFee計算追加
- revenueStats: 36行 → 18行（50%削減）
- chipStats: 16行 → 15行
- Default filter: 'this-month' → 'all'
- UI: 4行維持（場代行は削除せず、データソースのみ変更）

関連: project-docs/2025-10-31-migration-enhancement-analysis-tab/03-SESSION_SUMMARY_BASED_REDESIGN.md
```

---

## 5. Benefits

### 5.1 Technical Benefits

| 項目 | Before | After | 改善率 |
|------|--------|-------|--------|
| **コード量（修正対象）** | 52行 | 30行 | **42%削減** |
| **依存関係** | hanchans, playerResults | session.summary | **シンプル** |
| **再計算** | 毎回半荘ループ | なし（summary使用） | **パフォーマンス向上** |
| **chips/parlorFee** | 半荘ごと（5倍バグ） | 1回（正しい） | **バグ修正** |
| **メンテナンス性** | 複雑（36行ロジック） | シンプル（15行） | **保守性向上** |

**注**: pointStats（32行）は変更不要のため、コード量に含めていません。

### 5.2 Conceptual Benefits

**設計上の正確性**:
- ❌ Before: 半荘単位で収支を振り分け（概念的に誤り）
- ✅ After: セッション単位で収支を振り分け（概念的に正しい）

**ユーザーの期待に合致**:
> 「1回の集計によって得られた合計収支が+ならば、一度も支出は発生していないはずだからだ。」

**データの一貫性**:
- History Tab: Session.summaryを表示
- Analysis Tab: Session.summaryを使用（一貫性）

### 5.3 UX Benefits

**明確な情報表示**:
- 収入/支出がセッション単位で明確
- 「場代」行は**維持**（必要な情報を引き続き表示）
- データソースが統一されて計算が正確

**デフォルト表示改善**:
- 「全期間」デフォルト → すべてのデータが見える
- 新規ユーザーも混乱しない

---

## 6. Migration Impact

### 6.1 Data Migration Status

**✅ マイグレーション完了**:
- すべてのセッションに`Session.summary`が事前計算済み
- `migration-utils.ts`でchips/parlorFeeバグ修正済み

**確認方法**:
```typescript
// 設定タブのマイグレーションツールで確認済み
// 全セッションのsummary.totalPayoutが正しい
```

### 6.2 Backward Compatibility

**summaryがない場合の対応**:
```typescript
filteredSessions.forEach(({ session }) => {
  if (session.summary) {
    // ✅ summaryがあれば使用（通常ケース）
    const totalPayout = session.summary.totalPayout
  } else {
    // ⚠️ summaryがなければスキップ
    logger.warn('Session.summary not found', {
      context: 'AnalysisTab.revenueStats',
      data: { sessionId: session.id }
    })
  }
})
```

**影響**:
- マイグレーション実行済みなので、すべてのセッションにsummaryがある
- 新規セッションも`saveSessionWithSummary`で作成される
- 実質的に問題なし

---

## 7. Alternative Approaches (検討不要)

### 7.1 Approach A: Partial Fix（不採用）

**内容**: 現在のロジックを保持し、chips/parlorFeeバグのみ修正

**問題**:
- ❌ 根本的な設計ミス（半荘単位振り分け）が残る
- ❌ 複雑なコードが残る
- ❌ 将来のバグリスクが高い

### 7.2 Approach B: Hybrid（不採用）

**内容**: revenueStatsのみsummary使用、chipStatsは半荘単位

**問題**:
- ❌ 一貫性がない
- ❌ chips/parlorFeeバグが残る

### 7.3 Approach C: Full Session.summary Based（採用）

**内容**: すべてsession.summaryベースに統一

**メリット**:
- ✅ シンプルで一貫性がある
- ✅ すべてのバグが解消
- ✅ メンテナンス性が高い

---

## 8. Risk Assessment

### 8.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| summaryがないセッション | Low | Medium | if (!session.summary) でスキップ |
| 計算結果の不一致 | Low | High | テストケースで徹底検証 |
| UI表示の違和感 | Low | Low | ユーザーフィードバック収集 |

### 8.2 UX Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 収支概念の変更への戸惑い | Low | Medium | リリースノートで説明 |
| マイグレーション必要性の認識 | Medium | Low | 設定タブで明確に案内 |

---

## 9. Testing Strategy

### 9.1 Unit Tests (Optional)

**Test Targets**:
- `revenueStats` calculation
- `chipStats` calculation
- Session.summary fallback logic

### 9.2 Integration Tests

**Test Scenarios**:
1. 複数セッション（+/-混在）の集計
2. chips/parlorFeeが正しいかの検証
3. デフォルトフィルター「全期間」の確認

### 9.3 Manual Tests

**Test Data**:
```
Session 1: +2870pt (5半荘、chips=-2、場代=2000)
Session 2: -1500pt (3半荘)
Session 3: +500pt (2半荘)

期待値:
- 収入: +2870 +500 = +3370pt
- 支出: -1500pt
- 合計: +1870pt
```

---

## 10. Release Notes (User Communication)

### 10.1 変更内容

```markdown
## 分析タブ - 収支統計の改善

### 修正内容
- **収支の集計方法を改善**: セッション単位での収支表示に変更
- **chips/場代の計算バグ修正**: 正しい金額が表示されるようになりました
- **デフォルト表示期間を変更**: 「全期間」がデフォルトになりました

### 具体的な変更
- 収支統計: セッション全体の最終結果をもとに「収入」「支出」を計算
- データソース: より正確な計算のため内部データ構造を改善
- 期間フィルター: 初期表示が「全期間」に変更

### マイグレーションについて
- 既存のセッションデータを再計算する必要があります
- 設定タブの「データ再計算」ボタンから実行してください

### 影響
- より正確な収支分析が可能になります
- 過去のデータもすぐに確認できます
```

---

## 11. Summary

### 11.1 Key Changes

| 項目 | Before | After |
|------|--------|-------|
| **収支振り分け** | 半荘単位（誤） | セッション単位（正） |
| **chips/parlorFee** | 半荘ごとカウント（5倍バグ） | 1回のみ（正しい） |
| **データソース（収支・チップ）** | 半荘ループ再計算 | Session.summary使用 |
| **データソース（スコア）** | 半荘ループ | 変更なし（半荘単位が正しい） |
| **コード量（修正対象）** | 52行 | 30行（42%削減） |
| **デフォルトフィルター** | 'this-month' | 'all' |

### 11.2 Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| **Phase 1: Session.summary拡張** | 25分 | 未着手 |
| **Phase 2: Analysis Tab修正** | 20分 | 未着手 |
| **Phase 3: テスト** | 30分 | 未着手 |
| **Phase 4: ドキュメント** | 15分 | 未着手 |
| **合計** | 90分 | - |

### 11.3 Next Steps

1. ✅ 設計完了（このドキュメント）
2. ⏳ ユーザー承認待ち
3. 🔜 実装開始（承認後）

---

**Document Status**: ✅ Design Complete - Awaiting Approval

**Created**: 2025-11-02
**Last Updated**: 2025-11-02
**Version**: 1.1 (pointStats明確化)
