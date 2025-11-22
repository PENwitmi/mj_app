# Chips/ParlorFee 6倍バグ修正セッション - 2025-10-28

## セッション概要

**目的**: 麻雀アプリのchips/parlorFeeが半荘数分カウントされるバグの修正

**現在のステータス**: 
- ✅ バグ特定完了
- ✅ 修正計画ドキュメント作成完了
- ⏳ 実装開始前（ユーザー承認待ち）

## バグの詳細

### 症状
- **入力**: chips=-2, parlorFee=2000
- **期待**: セッション全体で1回のみカウント
- **実際**: 
  - 5半荘 → chips=-10（5倍）
  - 6半荘 → chips=-12（6倍）

### 根本原因
`src/lib/session-utils.ts` の `calculateSessionSummary` 関数（Line 115-169）:

```typescript
for (const hanchan of hanchans) {  // 各半荘でループ
  totalChips += mainUserResult.chips  // ❌ 半荘ごとに加算
  totalPayout += calculatePayout(
    ...,
    mainUserResult.chips,      // ❌ 各半荘でchipsが計算に含まれる
    ...,
    session.parlorFee          // ❌ 各半荘でparlorFeeが引かれる
  )
}
```

### 確認結果
- **web版でも発生**: capacitor/iOSビルド特有の問題ではない
- **実測データ**: テストで「チップ: -10枚」（5半荘 × -2）を確認

## 修正方針

### 基本戦略
**データモデル変更なし、計算式のみ修正**

1. **各半荘のPlayerResultデータは一切変更しない**
2. **calculateSessionSummary の計算ロジックのみ修正**
3. **chips/parlorFeeをセッション全体で1回のみカウント**

### 実装アプローチ

```typescript
// 修正後のロジック
let sessionChips = 0
let sessionParlorFee = 0
let chipsInitialized = false

for (const hanchan of hanchans) {
  // 最初の半荘からchips/parlorFeeを取得（1回のみ）
  if (!chipsInitialized) {
    sessionChips = mainUserResult.chips
    sessionParlorFee = mainUserResult.parlorFee
    chipsInitialized = true
  }
  
  // chips/parlorFeeを除いた収支を計算
  const scoreSubtotal = mainUserResult.score + umaPoints * umaValue
  const scorePayout = scoreSubtotal * rate
  totalPayout += scorePayout
}

// セッション全体で1回のみ加算
totalPayout += sessionChips * chipRate - sessionParlorFee
totalChips = sessionChips
```

### 既存データの扱い

**Option 1: 自動再計算（推奨）**
- 古い`session.summary`を無視
- 履歴タブ表示時に最新ロジックで再計算
- 再計算フラグ付きで保存

**Option 2: マイグレーション（任意）**
- 全セッションのsummaryを一括再計算
- 初回起動時に実行

## 作成したドキュメント

**場所**: `/project-docs/2025-10-28-chips-parlorfee-bug-fix/`

1. **README.md** - 全体概要とクイックスタート
2. **01-BUG_ANALYSIS.md** - バグの詳細分析
3. **02-IMPACT_ASSESSMENT.md** - 影響範囲評価
4. **03-FIX_STRATEGY.md** - 修正戦略
5. **04-IMPLEMENTATION_PLAN.md** - 実装手順（ステップバイステップ）
6. **05-TEST_PLAN.md** - テスト計画

## 実装手順（所要時間: 3.5時間）

1. **準備作業** (10分) - バックアップ、ブランチ作成
2. **コア計算ロジック修正** (60分) - session-utils.ts
3. **ユニットテスト作成** (45分)
4. **マイグレーション実装** (45分) - 既存データ再計算
5. **統合テスト** (30分)
6. **コード品質向上** (20分・任意)
7. **最終確認** (20分)

## 影響範囲

### 修正対象ファイル
- `src/lib/session-utils.ts` - calculateSessionSummary関数（主要修正）
- `src/hooks/useSessions.ts` - 古いsummary無視ロジック追加（任意）

### 影響を受けるコンポーネント
- `src/components/tabs/InputTab.tsx` - 修正不要（入力ロジックは正しい）
- `src/components/input/TotalsPanel.tsx` - 修正不要（UI計算は正しい）
- `src/components/tabs/HistoryTab.tsx` - 修正不要（表示のみ）

### データ整合性
- **PlayerResultデータ**: 変更なし
- **Session.summary**: 自動再計算で更新
- **新規セッション**: 正しい計算で保存
- **既存セッション**: 表示時に再計算

## 次のステップ

**ユーザー承認待ち**: 実装方針を確認後、`04-IMPLEMENTATION_PLAN.md` に従って実装開始

## 技術的な発見

1. **InputTabの実装は正しい**: chips/parlorFee変更ハンドラーが全半荘に同じ値を設定するのは意図通り
2. **TotalsPanelの実装も正しい**: セッション全体で1回のみ計算している
3. **calculateSessionSummaryのみがバグ**: ループ内でchips/parlorFeeを加算

## リスク評価

- **低リスク**: データモデル変更なし、計算式のみ修正
- **後方互換性**: 既存データも正しく表示
- **テストカバレッジ**: 包括的なテスト計画あり
- **ロールバック**: 各ステップが独立、簡単に戻せる

## 参照ファイル

### コアファイル
- `src/lib/session-utils.ts:37-245` - calculateRanks, calculateSessionSummary
- `src/components/tabs/InputTab.tsx:162-183` - chips/parlorFee変更ハンドラー
- `src/components/input/TotalsPanel.tsx:22-55` - calculatePlayerTotals

### テストファイル
- `tests/e2e/verify-chips-bug.spec.ts` - バグ検証テスト（作成済み）

### ドキュメント
- `/project-docs/2025-10-28-chips-parlorfee-bug-fix/` - 修正計画一式
