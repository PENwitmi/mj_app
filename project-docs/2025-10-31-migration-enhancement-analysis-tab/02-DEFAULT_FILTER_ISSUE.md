# Issue 2: Default Period Filter Problem

**作成日**: 2025-11-02
**問題**: Analysis Tabのデフォルト期間フィルターが「今月」になっており、過去のデータが表示されない

---

## 1. Problem Statement

### 1.1 Discovered Issue

**発見日**: 2025-11-02
**発見者**: ユーザー
**発見経緯**: マイグレーション実行後、Analysis Tabにデータが表示されない

### 1.2 Root Cause

**AnalysisTab.tsx Line 30**:
```typescript
const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('this-month')
```

**問題点**:
- デフォルトが「今月」(this-month) に設定されている
- 既存のセッションデータは過去の日付（例: 10月31日）
- 現在の日付が11月2日の場合、10月のデータは「今月」フィルターで除外される

### 1.3 User Impact

**症状**:
1. Analysis Tabを開いても「データがありません」と表示される
2. ユーザーはフィルターを変更しないとデータを見られない
3. History Tabではデータが見えるのに、Analysis Tabで見えない → 混乱

**重大度**: **Medium**
- データ自体は正しい（フィルターの問題）
- ユーザー体験を大きく損なう
- 「バグ」と誤解される可能性が高い

---

## 2. Why "this-month" as Default is Bad

### 2.1 UX Perspective

| フィルター | メリット | デメリット |
|----------|---------|----------|
| **「今月」(現在のデフォルト)** | - 直近データに絞れる | ❌ 過去のデータが見えない<br>❌ 月初は特にデータが少ない<br>❌ 新規ユーザーは何も見えない |
| **「全期間」(推奨)** | ✅ すべてのデータが見える<br>✅ 新規ユーザーもすぐ使える<br>✅ 混乱が少ない | - データ量が多い場合、読み込みが遅い可能性 |

### 2.2 Expected Behavior

**新規ユーザー**:
- Analysis Tabを開く → すべてのデータが表示される → 「OK、データが見える」

**現在の挙動**:
- Analysis Tabを開く → 「データがありません」 → 「え？バグ？」
- フィルターを「全期間」に変更 → データが表示される → 「なんだ、あったのか...」

### 2.3 Comparison with Other Apps

**一般的な分析画面のデフォルト**:
- Google Analytics: 「過去30日間」
- Notion: 「全期間」
- 麻雀アプリ（天鳳、雀魂等）: 「全期間」または「過去30日間」

**「今月」をデフォルトにするアプリは少ない理由**:
- 月初（1日～5日）はデータが少なすぎる
- 月をまたぐと突然データが消える（ユーザー混乱）
- 「今月だけ見たい」ニーズより「全体を見たい」ニーズの方が多い

---

## 3. Recommended Solution

### 3.1 Simple Fix

**変更内容**:
```typescript
// Before
const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('this-month')

// After
const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('all')
```

**所要時間**: 5分
**リスク**: None（デフォルト値の変更のみ）

### 3.2 Alternative: "past-30-days"

**もし「全期間」がパフォーマンス的に問題なら**:
```typescript
const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('past-30-days')
```

**メリット**:
- 直近30日間のデータは常に表示される
- 月をまたいでもデータが消えない
- パフォーマンスも良好

**デメリット**:
- 30日より古いデータは手動でフィルター変更が必要

### 3.3 Best Practice: Remember User's Last Selection

**長期的な改善案**:
```typescript
const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>(() => {
  // localStorage から前回の選択を復元
  const saved = localStorage.getItem('analysis-filter-period')
  return (saved as PeriodType) || 'all'
})

useEffect(() => {
  // 選択を localStorage に保存
  localStorage.setItem('analysis-filter-period', selectedPeriod)
}, [selectedPeriod])
```

**メリット**:
- ユーザーの好みを記憶
- 次回開いたときも同じフィルターで表示
- 最高のUX

**所要時間**: 15分

---

## 4. Implementation Plan

### 4.1 Phase 1: Immediate Fix (推奨)

**Step 1: Change Default Value** (5分)

```bash
# ファイル: src/components/tabs/AnalysisTab.tsx
# Line 30 を変更

# Before:
const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('this-month')

# After:
const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('all')
```

**Step 2: Test** (5分)

1. Analysis Tabを開く
2. デフォルトで「全期間」が選択されていることを確認
3. すべてのセッションデータが表示されることを確認

**Step 3: Commit** (5分)

```bash
git add src/components/tabs/AnalysisTab.tsx
git commit -m "fix(AnalysisTab): デフォルト期間フィルターを「全期間」に変更

デフォルトが「今月」だと、過去のデータが表示されずユーザーが混乱するため、
「全期間」に変更。

理由:
- 月初はデータが少なく「データがありません」と誤解される
- 新規ユーザーがすぐにデータを確認できる
- 他の麻雀アプリでも「全期間」がデフォルトが一般的

関連: project-docs/2025-10-31-migration-enhancement-analysis-tab/02-DEFAULT_FILTER_ISSUE.md"
```

**所要時間合計**: 15分

### 4.2 Phase 2: Remember User's Selection (任意)

**Step 1: Implement localStorage Integration** (15分)

**Step 2: Test** (10分)

**Step 3: Commit** (5分)

**所要時間合計**: 30分

---

## 5. Integration with Main Issue

### 5.1 Combined Implementation Plan

**chips/parlorFeeバグ + デフォルトフィルター問題を同時に修正**

#### Option A: 1つのPRにまとめる

```
fix/analysis-tab-issues
  ├── Fix 1: chips/parlorFee calculation bug (90分)
  ├── Fix 2: Default period filter (5分)
  └── Testing (45分)

Total: 2.5時間
```

**メリット**:
- 1回のレビュー・マージで完了
- 関連する問題をまとめて解決

**デメリット**:
- PRが大きくなる
- レビューが複雑

#### Option B: 2つの独立したPR

```
PR 1: fix/analysis-tab-chips-parlorfee (90分)
  └── chips/parlorFee calculation bug

PR 2: fix/analysis-tab-default-filter (5分)
  └── Default period filter
```

**メリット**:
- 小さく分割されてレビューしやすい
- 緊急度に応じて順序を変えられる

**デメリット**:
- 2回のレビュー・マージが必要

### 5.2 Recommended Approach

**推奨**: Option A（1つのPRにまとめる）

**理由**:
1. 両方とも Analysis Tab の問題
2. デフォルトフィルター修正は5分で完了（オーバーヘッド小）
3. ユーザーは「Analysis Tabが修正された」と一度に理解できる
4. テストも一度にまとめて実行できる

---

## 6. Testing Strategy

### 6.1 Manual Tests

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| **TC-DF1** | Analysis Tabを開く（データあり） | デフォルトで「全期間」が選択され、全データが表示される |
| **TC-DF2** | フィルターを「今月」に変更 | 今月のデータのみ表示される |
| **TC-DF3** | フィルターを「全期間」に戻す | 全データが再表示される |
| **TC-DF4** | Analysis Tabを開く（データなし） | 「データがありません」と表示される |

### 6.2 Regression Tests

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| **TC-DFR1** | History Tabが正常動作 | 影響なし |
| **TC-DFR2** | 他のフィルター（モード、ユーザー）が正常動作 | 影響なし |

---

## 7. User Communication

### 7.1 No Communication Needed

**理由**:
- デフォルト値の変更のみ
- ユーザーにとっては「改善」
- 既存機能の破壊なし

### 7.2 Release Notes (Optional)

```markdown
## 改善

- **Analysis Tab**: デフォルトの表示期間を「全期間」に変更しました。
  これにより、タブを開いたときに過去のデータがすぐに表示されるようになります。
```

---

## 8. Summary

### 8.1 Key Points

1. **問題**: デフォルトが「今月」のため、過去のデータが表示されない
2. **原因**: ユーザー体験を考慮していないデフォルト値
3. **解決策**: デフォルトを「全期間」に変更（5分で完了）
4. **推奨**: chips/parlorFeeバグと同時に修正（効率的）

### 8.2 Benefits

- ✅ 新規ユーザーがすぐにデータを確認できる
- ✅ 月初でも問題なく使える
- ✅ 「データがない」という誤解を防止
- ✅ 他のアプリとの一貫性

---

**Document Status**: ✅ Design Complete - Ready for Implementation

**Next Steps**:
1. chips/parlorFeeバグ修正と同時に実装（推奨）
2. または独立したPRとして実装

**所要時間**: 5分（chips/parlorFeeバグと合わせて2.5時間）

---

**作成日**: 2025-11-02
**最終更新**: 2025-11-02
**バージョン**: 1.0
