# Chips/ParlorFee 6倍バグ - 修正計画ドキュメント

**作成日**: 2025-10-28
**重大度**: Critical（クリティカル）
**所要時間見積もり**: 3.5時間（必須修正: 3時間）

---

## 概要

麻雀点数記録アプリにおいて、chips（チップ）とparlorFee（場代）が半荘数分カウントされるバグが発見されました。

**症状**:
- 入力: `chips=-2`, `parlorFee=2000`
- 期待: セッション全体で `chips=-2`（1回のみ）
- 実際:
  - 5半荘 → `chips=-10`（5倍）
  - 6半荘 → `chips=-12`（6倍）

**影響範囲**:
- 履歴タブ（HistoryTab）の収支表示が誤っている
- セッションサマリー計算が誤っている
- 総合順位計算が誤っている

**根本原因**:
- `calculateSessionSummary`関数が各半荘でchips/parlorFeeを加算している
- chips/parlorFeeは「セッション全体で1回」カウントすべきだが、「半荘ごと」にカウントされている

---

## ドキュメント構成

本ディレクトリには以下の5つのドキュメントが含まれています。

### 📋 [01-BUG_ANALYSIS.md](./01-BUG_ANALYSIS.md) - バグの詳細分析

**サイズ**: 8.3 KB
**所要時間**: 10分

**内容**:
- バグ症状の詳細
- 根本原因の特定
- データフロー全体図
- 設計上の根本問題
- 修正方針の選択（データモデル変更なし）

**重要ポイント**:
- chips/parlorFeeは現在「半荘レベル」（PlayerResult）に保存されているが、「セッションレベル」として扱いたい
- データモデル変更は制約により行わず、計算ロジックのみを修正する方針を採用
- UI層（TotalsPanel）は偶然正しく動作しているが、設計としては不正確

---

### 🎯 [02-IMPACT_ASSESSMENT.md](./02-IMPACT_ASSESSMENT.md) - 影響範囲の評価

**サイズ**: 9.1 KB
**所要時間**: 15分

**内容**:
- 影響を受ける機能の詳細
- 影響を受けるコードモジュール
- 既存データへの影響
- 修正の優先度
- リスク評価

**重要ポイント**:
- **履歴タブ**: Critical（必須修正）- 収支表示が誤っている
- **既存データ**: Critical（必須修正）- マイグレーションが必要
- **InputTab**: None（影響なし）- 偶然正常に動作
- **TotalsPanel**: 推奨修正（コード品質向上のため）

**推奨アクション**:
1. 即座に修正: `calculateSessionSummary`のロジック変更
2. マイグレーション実装: 既存データの再計算
3. 十分なテスト: 計算結果の検証

---

### 🔧 [03-FIX_STRATEGY.md](./03-FIX_STRATEGY.md) - 修正戦略

**サイズ**: 16 KB
**所要時間**: 30分

**内容**:
- 修正の基本方針
- アーキテクチャ的な決定
- 修正対象と具体的な変更内容
  - Phase 1: コア計算ロジックの修正（必須 - P0）
  - Phase 2: マイグレーション処理の実装（必須 - P0）
  - Phase 3: コード品質向上（推奨 - P1）
- 修正の実施順序
- リスク管理
- 成功基準

**重要ポイント**:
- **新規ヘルパー関数**: `calculatePayoutWithoutExtras`を追加
- **chips/parlorFee取得**: 最初の半荘から1回のみ取得
- **マイグレーション**: 既存セッションのサマリーを自動再計算
- **後方互換性**: 既存の`calculatePayout`関数は維持

**コード例**:
```typescript
// chips/parlorFeeをセッション全体で1回のみカウント
let sessionChips = 0
let sessionParlorFee = 0
let chipsInitialized = false

for (const hanchan of hanchans) {
  if (!chipsInitialized) {
    sessionChips = mainUserResult.chips
    sessionParlorFee = mainUserResult.parlorFee
    chipsInitialized = true
  }

  // chips/parlorFeeを除いた収支を計算
  totalPayout += calculatePayoutWithoutExtras(...)
}

// セッション全体でchips/parlorFeeを1回のみ加算
totalPayout += sessionChips * chipRate - sessionParlorFee
```

---

### 📝 [04-IMPLEMENTATION_PLAN.md](./04-IMPLEMENTATION_PLAN.md) - 実装計画（ステップバイステップ）

**サイズ**: 22 KB
**所要時間**: 120分（実装作業込み）

**内容**:
- 実装の全体フロー
- 7つのステップに分かれた詳細な実装手順
  - Step 1: 準備作業（バックアップ、ブランチ作成）
  - Step 2: コア計算ロジックの修正
  - Step 3: ユニットテストの作成
  - Step 4: マイグレーション処理の実装
  - Step 5: 統合テスト
  - Step 6: コード品質向上（任意）
  - Step 7: 最終確認とデプロイ
- 各ステップでのチェックポイント
- コミットメッセージの例
- トラブルシューティング

**重要ポイント**:
- **ステップバイステップ**: 各ステップが独立しており、段階的に進められる
- **チェックポイント**: 各ステップで確認すべき項目が明確
- **コミット戦略**: 小さな変更ごとにコミットし、ロールバック可能に
- **テスト駆動**: 実装とテストを並行して進める

**所要時間見積もり**:
| ステップ | 作業内容 | 見積もり時間 |
|---|---|---|
| Step 1 | 準備作業 | 10分 |
| Step 2 | コア計算ロジックの修正 | 60分 |
| Step 3 | ユニットテストの作成 | 45分 |
| Step 4 | マイグレーション処理の実装 | 45分 |
| Step 5 | 統合テスト | 30分 |
| Step 6 | コード品質向上（任意） | 20分 |
| Step 7 | 最終確認とデプロイ | 20分 |
| **合計** | | **3.5時間（P0のみ: 3時間）** |

---

### ✅ [05-TEST_PLAN.md](./05-TEST_PLAN.md) - テスト計画

**サイズ**: 14 KB
**所要時間**: 90分（テスト実施込み）

**内容**:
- テスト戦略
- ユニットテスト（15ケース）
  - TC-U1: `calculatePayoutWithoutExtras`の正確性
  - TC-U2: chips/parlorFee単一カウント
  - TC-U3: 全プレイヤーの計算
- 統合テスト（4ケース）
  - TC-I1: 新規セッションの保存と表示
  - TC-I2: 既存セッションのマイグレーション
  - TC-I3: マイグレーションの冪等性
  - TC-I4: セッション詳細ダイアログ
- 手動テスト（5ケース）
  - TC-M1〜M5: エッジケース検証
- 回帰テスト（3ケース）
  - TC-R1〜R3: 既存機能の非破壊検証
- パフォーマンステスト（1ケース）
  - TC-P1: 大量データのマイグレーション

**重要ポイント**:
- **包括的なカバレッジ**: ユニット→統合→手動→回帰→パフォーマンスの順に実施
- **エッジケース**: 1半荘、10半荘、chips=0、見学者、未入力半荘など
- **後方互換性**: 既存機能が破壊されていないことを確認
- **テスト結果の記録**: テンプレートを用意

---

## 推奨される読み方

### 初見の場合（全体把握）
1. **README.md（本ファイル）**: 全体概要を把握
2. **01-BUG_ANALYSIS.md**: バグの本質を理解
3. **02-IMPACT_ASSESSMENT.md**: 影響範囲を確認
4. **03-FIX_STRATEGY.md**: 修正方針を理解
5. **04-IMPLEMENTATION_PLAN.md**: 実装手順を確認
6. **05-TEST_PLAN.md**: テスト計画を把握

### 実装作業前（実装者向け）
1. **03-FIX_STRATEGY.md**: 修正方針の詳細を理解
2. **04-IMPLEMENTATION_PLAN.md**: ステップバイステップで実装
3. **05-TEST_PLAN.md**: テストケースを確認しながら実装

### テスト実施時（QA向け）
1. **05-TEST_PLAN.md**: すべてのテストケースを実施
2. **02-IMPACT_ASSESSMENT.md**: 影響範囲を再確認
3. テスト結果を記録

---

## 修正のクイックスタートガイド

実装作業を開始する場合は、以下の手順で進めてください。

### 1. 事前準備（5分）
```bash
# 作業ディレクトリに移動
cd /Users/nishimototakashi/claude_code/mj_app/app

# バックアップ作成
mkdir -p _old_files/backup_chips_parlorfee_bugfix_$(date "+%Y%m%d_%H%M")
cp src/lib/session-utils.ts _old_files/backup_chips_parlorfee_bugfix_$(date "+%Y%m%d_%H%M")/

# ブランチ作成（Gitリポジトリの場合）
git checkout -b fix/chips-parlorfee-bug
```

### 2. コア修正（60分）
- `04-IMPLEMENTATION_PLAN.md`のStep 2を参照
- `calculatePayoutWithoutExtras`関数を追加
- `calculateSessionSummary`を修正

### 3. テスト作成（45分）
- `04-IMPLEMENTATION_PLAN.md`のStep 3を参照
- `05-TEST_PLAN.md`のTC-U1〜U3を実装

### 4. マイグレーション実装（45分）
- `04-IMPLEMENTATION_PLAN.md`のStep 4を参照
- `src/lib/migrations.ts`を作成
- `src/App.tsx`を修正

### 5. 統合テスト（30分）
- `05-TEST_PLAN.md`のTC-I1〜I4を実施

### 6. デプロイ（20分）
- `04-IMPLEMENTATION_PLAN.md`のStep 7を参照

---

## 完了条件

### 必須条件（P0）
- ✅ `calculateSessionSummary`が修正されている
- ✅ ユニットテストがすべて合格
- ✅ マイグレーション処理が実装されている
- ✅ 既存セッションが正しく再計算される
- ✅ 新規セッションのchips/parlorFeeが正しい

### 推奨条件（P1）
- ✅ `TotalsPanel.tsx`が明示的な実装になっている
- ✅ すべての手動テストシナリオが合格
- ✅ ドキュメントが更新されている

### 品質条件
- ✅ Lintエラーがない
- ✅ ビルドが成功する
- ✅ コンソールにエラーが出ない
- ✅ パフォーマンスが劣化していない

---

## トラブルシューティング

### よくある問題と対処法

#### Q1: マイグレーション中にエラーが発生する
**A1**: `localStorage.removeItem('migration_chips_parlorfee_v1')`を実行してマイグレーションを再実行してください。

#### Q2: テストが失敗する
**A2**: IndexedDBのデータをクリアして再実行してください。ブラウザの開発者ツールから`Application > IndexedDB > MahjongDB`を削除できます。

#### Q3: 既存データの値が修正されない
**A3**: マイグレーションが実行されたか確認してください（`localStorage.getItem('migration_chips_parlorfee_v1')`）。

---

## 関連リソース

### プロジェクト全体
- **CLAUDE.md**: `/Users/nishimototakashi/claude_code/mj_app/CLAUDE.md`
- **プロジェクトルート**: `/Users/nishimototakashi/claude_code/mj_app/app`

### 関連ファイル
- `src/lib/session-utils.ts` - コア計算ロジック
- `src/components/input/TotalsPanel.tsx` - UI層の集計表示
- `src/hooks/useSessions.ts` - セッション取得フック
- `src/components/tabs/HistoryTab.tsx` - 履歴表示

### 開発環境
- **開発サーバー起動**: `npm run dev`
- **テスト実行**: `npm run test`
- **ビルド**: `npm run build`

---

## まとめ

本バグは麻雀点数記録アプリの根幹機能である「収支計算」に影響する重大なバグです。chips/parlorFeeが半荘数分カウントされることで、ユーザーは正確な収支を把握できない状態にあります。

本ドキュメント群は、このバグを体系的に分析し、包括的な修正計画を提供しています。各ドキュメントは独立して読めますが、順番に読むことで全体像を把握できます。

**修正作業の開始前に、必ず03-FIX_STRATEGY.mdと04-IMPLEMENTATION_PLAN.mdを熟読してください。**

---

**作成者**: Claude Code (Quality Engineer)
**レビュー**: 必須
**承認**: 実装開始前に承認を得てください
