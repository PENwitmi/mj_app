# 要件分析 - 分析タブ統計機能

## 1. 背景と問題発見

### 1.1 発見された問題

**日時**: 2025-11-05

**問題内容**:
分析タブにおいて、`session.summary`依存により以下の重大な問題が発生している：

1. **機能的バグ**: ユーザー切り替えで収支・チップ統計が変わらない
   - `revenueStats`と`chipStats`が`session.summary`に依存
   - `session.summary`はmainUserの統計のみ保持（パフォーマンス最適化のため）
   - selectedUserIdが変わっても統計が更新されない

2. **アーキテクチャの不整合**:
   - ✅ `pointStats`: 動的計算（selectedUserId対応）
   - ✅ `rankStats`: 動的計算（selectedUserId対応）
   - ❌ `revenueStats`: session.summary依存（mainUserのみ）
   - ❌ `chipStats`: session.summary依存（mainUserのみ）

### 1.2 現在の実装の整合性

**正しく動作している部分**（参考実装）:

```typescript
// pointStats: 正しく動的計算
const pointStats = useMemo(() => {
  filteredSessions.forEach(({ session, hanchans }) => {
    hanchans.forEach(hanchan => {
      const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
      if (userResult && !userResult.isSpectator && userResult.score !== null && userResult.score !== 0) {
        const umaPoints = umaMarkToValue(userResult.umaMark)
        const subtotal = userResult.score + umaPoints * session.umaValue
        // ...
      }
    })
  })
}, [filteredSessions, selectedUserId])  // ✅ 正しい依存配列
```

**問題のある部分**:

```typescript
// revenueStats: session.summary依存（mainUserのみ）
const revenueStats = useMemo(() => {
  filteredSessions.forEach(({ session }) => {
    if (session.summary) {
      const totalPayout = session.summary.totalPayout  // ❌ mainUserの統計のみ
      totalParlorFee += session.summary.totalParlorFee
      // ...
    }
  })
}, [filteredSessions])  // ❌ selectedUserIdが依存配列にない
```

## 2. ユーザーストーリー

### 2.1 主要ユーザーストーリー

**US-1: 任意ユーザーの統計表示**
```
誰が: 麻雀アプリのメインユーザー
何のために: 対戦相手の成績を分析して戦略を立てるため
何をしたい: 任意のプレイヤーの収支・チップ・スコア・着順統計をフィルター表示したい

受け入れ基準:
- ユーザー選択で全統計項目が連動して更新される
- 収支統計が選択ユーザーの実際の収支を反映する
- チップ統計が選択ユーザーの実際のチップを反映する
- スコア統計と着順統計と同様のリアクティブ性
```

**US-2: 複数条件でのフィルタリング**
```
誰が: メインユーザー
何のために: 特定条件下での成績を分析するため
何をしたい: ユーザー・期間・モード（3人打ち/4人打ち）を組み合わせて統計を表示したい

受け入れ基準:
- フィルター変更時に全統計が即座に更新される
- 複数フィルター（ユーザー × 期間 × モード）が正しく適用される
- フィルター適用後のデータが0件の場合、適切なメッセージを表示
```

**US-3: パフォーマンス**
```
誰が: メインユーザー
何のために: ストレスなく分析を行うため
何をしたい: 大量のセッションデータ（100セッション以上）でもスムーズに動作してほしい

受け入れ基準:
- フィルター切り替え時の応答時間が200ms以内
- 不要な再計算が発生しない（useMemoの最適化）
- スクロール・タブ切り替えが滑らか
```

### 2.2 セカンダリユーザーストーリー

**US-4: セッション単位のchips/parlorFee正確性**
```
受け入れ基準:
- chips/parlorFeeがセッションごとに1回のみカウントされる
- 半荘数に関わらず正確な合計値が表示される
- session-utils.tsの計算ロジックとの整合性
```

**US-5: エッジケース対応**
```
受け入れ基準:
- 見学者のデータが統計から除外される
- 点数未入力（null/0）の半荘がスキップされる
- 選択ユーザーが参加していないセッションが除外される
```

## 3. 機能要件

### 3.1 統計項目

| 統計項目 | 計算レベル | 説明 | selectedUserId依存 |
|---------|----------|-----|------------------|
| 収支統計（revenueStats） | セッション単位 | 総収支・収入・支出・場代 | ✅ 必須 |
| チップ統計（chipStats） | セッション単位 | チップ収支・プラス・マイナス | ✅ 必須 |
| スコア統計（pointStats） | 半荘単位 | スコア収支・プラス・マイナス | ✅ 実装済み |
| 着順統計（rankStats） | 半荘単位 | 平均着順・各順位の回数/割合 | ✅ 実装済み |

### 3.2 データフロー要件

**FR-1: リアクティブな統計更新**
- selectedUserId変更時、全統計が自動更新される
- 期間・モードフィルター変更時も同様

**FR-2: セッション単位の集計ロジック**
- chips/parlorFeeはセッションごとに1回カウント
- 複数半荘の場合でも重複カウントしない

**FR-3: 半荘単位の集計ロジック**
- score + umaPointsは各半荘で計算
- 選択ユーザーのPlayerResultのみを集計

**FR-4: フィルタリング要件**
- ユーザー参加フィルター: selectedUserIdが少なくとも1つの半荘に参加
- 期間フィルター: all-time, this-year, this-month, custom
- モードフィルター: 4-player, 3-player, all

### 3.3 計算式

**収支統計（revenueStats）**:
```typescript
// セッションごとに計算
sessionPayout = Σ(各半荘の scorePayout) + sessionChips * chipRate - sessionParlorFee

where:
  scorePayout = (score + umaPoints * umaValue) * rate
  sessionChips = セッション全体で1回のみ取得
  sessionParlorFee = セッション全体で1回のみ取得
```

**チップ統計（chipStats）**:
```typescript
// セッションごとに集計
sessionChips = PlayerResult.chips (最初の有効な半荘から取得、1回のみ)
totalChips = Σ(各セッションの sessionChips)
```

**スコア統計（pointStats）**:
```typescript
// 半荘ごとに計算
subtotal = score + umaPoints * umaValue
totalPoints = Σ(各半荘の subtotal)
```

**着順統計（rankStats）**:
```typescript
// 半荘ごとに着順を決定（点数降順）
averageRank = Σ(各半荘の rank) / 総半荘数
```

## 4. 非機能要件

### 4.1 パフォーマンス要件

**NFR-1: 応答時間**
- フィルター切り替え: 200ms以内
- 初期表示: 500ms以内（100セッション想定）

**NFR-2: メモ化戦略**
- useMemoで不要な再計算を防止
- 依存配列の正確性（selectedUserIdを含む）

**NFR-3: スケーラビリティ**
- 500セッションまでスムーズに動作（想定される最大データ量）

### 4.2 保守性要件

**NFR-4: コードの一貫性**
- 4つの統計すべてが同じ計算パターンを使用
- session-utils.tsとの計算ロジックの整合性

**NFR-5: 可読性**
- 計算ロジックにコメント付与
- 変数名の明確性（sessionPayout, scorePayout等）

**NFR-6: テスタビリティ**
- 統計計算ロジックの単体テスト可能性

### 4.3 データ整合性要件

**NFR-7: ゼロサム原則の尊重**
- 各半荘の点数合計は0（見学者除く）
- 統計計算でこの原則を維持

**NFR-8: session.summaryとの関係**
- session.summaryはmainUser専用の最適化キャッシュ
- 分析タブでは動的計算を優先
- 履歴タブではsession.summaryを活用（パフォーマンス最適化）

## 5. 成功基準

### 5.1 機能的成功基準

**✅ ユーザー切り替えテスト**
- selectedUserIdを変更
- revenueStats, chipStatsが正しく更新される

**✅ 複数セッション・複数半荘テスト**
- 6半荘のセッションデータでchips/parlorFeeが1回のみカウントされる
- 各半荘のscoreが正しく累積される

**✅ エッジケーステスト**
- 見学者のデータが除外される
- 点数未入力（null/0）の半荘がスキップされる

### 5.2 非機能的成功基準

**✅ パフォーマンステスト**
- 100セッション × 平均3半荘 = 300半荘で200ms以内

**✅ 整合性テスト**
- session-utils.tsのcalculateSessionSummaryと同じ結果

**✅ 保守性**
- コードレビューで「わかりやすい」と評価される
- 将来の統計項目追加が容易

## 6. スコープ外

以下は本設計の対象外とする：

1. **session.summaryの廃止**: 履歴タブのパフォーマンス最適化として維持
2. **統計項目の追加**: 現在の4項目（収支・チップ・スコア・着順）のみ
3. **グラフ機能**: 既存のRankStatisticsChart, RevenueTimelineChartはそのまま
4. **データベーススキーマ変更**: 既存のDexieスキーマを維持

## 7. 優先順位

### 7.1 Must Have（必須）

1. revenueStatsのselectedUserId対応（最高優先度）
2. chipStatsのselectedUserId対応（最高優先度）
3. 依存配列の修正（selectedUserIdを含む）
4. chips/parlorFeeのセッション単位カウント

### 7.2 Should Have（推奨）

1. パフォーマンス最適化（useMemoの最適化）
2. session-utils.tsとの計算ロジック統一
3. コードコメントの充実

### 7.3 Could Have（あれば良い）

1. エラーハンドリングの強化
2. 統計計算の単体テスト追加

## 8. リスクと制約

### 8.1 技術的リスク

**リスク**: 動的計算によるパフォーマンス低下
- **影響度**: 中
- **対策**: useMemoの適切な使用、依存配列の最適化

**リスク**: session.summaryとの計算ロジック不整合
- **影響度**: 高
- **対策**: session-utils.tsのcalculateSessionSummaryを参照実装とする

### 8.2 制約

**制約1**: 既存のsession.summaryを変更できない
- 理由: 履歴タブのパフォーマンス最適化として使用中

**制約2**: Dexieスキーマ変更は避ける
- 理由: マイグレーション処理の複雑性

## 9. 次のステップ

本要件分析を基に、以下のドキュメントを作成する：

1. **02-ARCHITECTURE_DESIGN.md**: データフローとアーキテクチャ設計
2. **03-IMPLEMENTATION_SPECIFICATION.md**: 実装仕様とコード例
3. **04-PERFORMANCE_STRATEGY.md**: パフォーマンス最適化戦略
4. **05-TEST_PLAN.md**: テスト計画と検証方法
