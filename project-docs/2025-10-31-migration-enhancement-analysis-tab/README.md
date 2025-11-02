# Migration Enhancement for Analysis Tab - Quick Reference

**作成日**: 2025-10-31
**重要度**: High (高)
**所要時間**: Phase 1: 2.5時間、Phase 2: 3時間（任意）

---

## TL;DR (要約)

**問題**: Analysis Tab (分析タブ) が chips/parlorFee を半荘数分カウントしている

**原因**: Analysis Tab は `Session.summary` を使用せず、生データから直接計算している

**解決策**:
- **Phase 1** (即座に実行): Analysis Tab の計算ロジックを修正
- **Phase 2** (任意): `Session.summary` を拡張し、計算ロジックを一元化

---

## Quick Start

### 実装前の確認事項

1. **読むべきドキュメント**:
   - [01-DESIGN_PROPOSAL.md](./01-DESIGN_PROPOSAL.md) - 詳細設計 (25KB)

2. **関連ドキュメント**:
   - [2025-10-28-chips-parlorfee-bug-fix](../2025-10-28-chips-parlorfee-bug-fix/) - バグの背景

### Phase 1: Immediate Fix (推奨)

**目的**: Analysis Tab の chips/parlorFee カウントバグを即座に修正

**作業内容**:
1. `AnalysisTab.tsx` の `revenueStats` を修正
2. `AnalysisTab.tsx` の `chipStats` を修正
3. 手動テストで確認

**所要時間**: 2.5時間
**リスク**: Low

**実装手順**:
```bash
# バックアップ
cp app/src/components/tabs/AnalysisTab.tsx app/_old_files/backup_$(date "+%Y%m%d_%H%M")/

# ブランチ作成
git checkout -b fix/analysis-tab-chips-parlorfee

# 01-DESIGN_PROPOSAL.md の Section 5.1 を参照して実装
```

### Phase 2: Architectural Improvement (任意)

**目的**: 計算ロジックの重複を解消し、保守性を向上

**作業内容**:
1. `SessionSummary` インターフェースを拡張
2. `calculateSessionSummary` を更新
3. マイグレーション v2 を実装
4. `AnalysisTab.tsx` を `Session.summary` ベースに変更

**所要時間**: 3時間
**リスク**: Medium

---

## Problem Overview

### 現象

| タブ | 状態 | 理由 |
|-----|-----|------|
| History Tab | ✅ 正しい | `Session.summary` を使用（マイグレーション済み） |
| Analysis Tab | ❌ 誤っている | 生データから直接計算（chips/parlorFee が半荘数分カウント） |

### 具体例

**5半荘セッション** (chips=-2, parlorFee=2000):
- **期待値**: chips=-200pt, parlorFee=-2000pt (1回のみ)
- **実際の値**: chips=-1000pt (5倍), parlorFee=-10000pt (5倍)
- **誤差**: 約 -10,800pt

### 影響範囲

| 統計項目 | 影響 | 理由 |
|---------|-----|------|
| 収支統計 | ❌ 不正確 | chips/parlorFee が半荘数分カウント |
| ポイント統計 | ✅ 正確 | chips を含まない |
| チップ統計 | ❌ 不正確 | 半荘ごとにカウント |
| 着順統計 | ✅ 正確 | chips/parlorFee に依存しない |

---

## Solution Comparison

| Option | Description | Pros | Cons | Recommendation |
|--------|-------------|------|------|----------------|
| **A** | マイグレーションでAnalysis Tab データを再計算 | - | ❌ 実現不可能 | ❌ 不採用 |
| **B** | Analysis Tab が Session.summary を使用 | 計算ロジック一元化、パフォーマンス向上 | データモデル変更が必要 | ✅ 長期的推奨 |
| **C** | 「再計算」ボタンを追加 | - | ユーザー操作が必要、根本解決にならない | ❌ 不採用 |
| **D** | Analysis Tab の計算ロジックを直接修正 | 即座に修正可能、マイグレーション不要 | 計算ロジックの重複 | ✅ 短期的推奨 |

**推奨アプローチ**: **Hybrid (D → B)**
- Phase 1: Option D で即座に修正
- Phase 2: Option B で長期的改善

---

## Implementation Checklist

### Phase 1: Immediate Fix

- [ ] バックアップ作成
- [ ] ブランチ作成
- [ ] `revenueStats` の修正 (45分)
  - [ ] chips/parlorFee をセッション全体で1回のみカウント
  - [ ] エッジケース対応（見学者、未入力半荘）
- [ ] `chipStats` の修正 (30分)
  - [ ] chips をセッション全体で1回のみカウント
- [ ] コードレビュー (15分)
- [ ] 手動テスト (30分)
  - [ ] TC-M1: 5半荘セッション
  - [ ] TC-M2: 1半荘セッション
  - [ ] TC-M3: 10半荘セッション
  - [ ] TC-M4: 見学者のみ
  - [ ] TC-M5: フィルター変更
- [ ] 回帰テスト (15分)
  - [ ] TC-R1: ポイント統計
  - [ ] TC-R2: 着順統計
  - [ ] TC-R3: History Tab
- [ ] コミット (20分)

**所要時間合計**: 2.5時間

### Phase 2: Architectural Improvement (任意)

- [ ] `SessionSummary` インターフェース拡張 (30分)
- [ ] `calculateSessionSummary` 更新 (30分)
- [ ] マイグレーション v2 実装 (60分)
- [ ] `AnalysisTab.tsx` リファクタリング (45分)
- [ ] テスト (45分)

**所要時間合計**: 3時間

---

## Testing Strategy

### Phase 1 Tests

**手動テスト** (必須):
| ID | Description | Expected |
|----|-------------|----------|
| TC-M1 | 5半荘セッション（chips=-2, parlorFee=2000） | History Tab と一致 |
| TC-M2 | 1半荘セッション（chips=0, parlorFee=0） | 正しく表示 |
| TC-M3 | 10半荘セッション（chips=5, parlorFee=1000） | 10倍にならない |
| TC-M4 | 見学者のみ参加 | chips/parlorFee=0 |
| TC-M5 | フィルター変更 | 正しく再計算 |

**回帰テスト** (必須):
| ID | Description | Expected |
|----|-------------|----------|
| TC-R1 | ポイント統計 | Phase 1前後で変化なし |
| TC-R2 | 着順統計 | Phase 1前後で変化なし |
| TC-R3 | History Tab | Phase 1の影響なし |

---

## Risk Assessment

### Phase 1 Risks

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| 計算ロジックのバグ | High | Low | `calculateSessionSummary` と同じロジックを使用 |
| エッジケースの見落とし | Medium | Medium | 包括的な手動テストを実施 |
| History Tab との不一致 | High | Low | 両タブで同じ計算結果になることを確認 |

### Phase 2 Risks

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| データモデル変更の影響 | High | Medium | マイグレーションで既存データを更新 |
| マイグレーション失敗 | High | Low | 冪等性を確保、ロールバック可能に |

---

## Success Criteria

### Phase 1

- ✅ Analysis Tab の収支統計が正しい
- ✅ chips/parlorFee がセッション全体で1回のみカウントされる
- ✅ History Tab との収支が一致する
- ✅ すべての手動テストが合格
- ✅ 既存機能が破壊されていない

### Phase 2

- ✅ `Session.summary` に新フィールドが追加されている
- ✅ Analysis Tab が `Session.summary` を活用している
- ✅ 計算ロジックの重複が解消されている
- ✅ マイグレーションがすべて成功

---

## Documentation Structure

```
2025-10-31-migration-enhancement-analysis-tab/
├── README.md (このファイル) - クイックリファレンス
└── 01-DESIGN_PROPOSAL.md - 詳細設計ドキュメント
    ├── 1. Problem Statement
    ├── 2. Current State Analysis
    ├── 3. Solution Options
    ├── 4. Recommended Solution
    ├── 5. Technical Design
    ├── 6. Implementation Plan
    ├── 7. Testing Strategy
    ├── 8. User Communication Plan
    ├── 9. Risk Assessment
    ├── 10. Success Criteria
    └── 11. Summary
```

---

## Next Steps

1. **ユーザーレビュー**: 01-DESIGN_PROPOSAL.md を確認
2. **承認**: Phase 1 実装の承認を得る
3. **実装開始**: Phase 1 の実装を開始
4. **Phase 2 判断**: Phase 1 完了後、Phase 2 の実施を判断

---

## Contact

**実装者**: Claude Code
**レビュー**: 必須
**質問・懸念事項**: 01-DESIGN_PROPOSAL.md にコメントを追加

---

**Document Status**: ✅ Design Complete - Awaiting User Approval
