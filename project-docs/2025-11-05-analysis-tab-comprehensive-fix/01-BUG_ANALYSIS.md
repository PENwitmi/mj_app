# バグ分析レポート

**Date**: 2025-11-05 18:40
**Document Type**: Bug Analysis
**Priority**: Critical
**Related Documents**:
- `06-EDGE_CASE_ANALYSIS.md` (前段階の調査)
- `02-DESIGN_SPECIFICATION.md` (設計仕様)
- `03-IMPLEMENTATION_PLAN.md` (実装計画)

---

## 📋 目次

1. [エグゼクティブサマリー](#エグゼクティブサマリー)
2. [問題1: エッジケース判定の誤り](#問題1-エッジケース判定の誤り)
3. [問題2: selectedUserId非対応](#問題2-selecteduserid非対応)
4. [影響範囲マトリックス](#影響範囲マトリックス)
5. [優先度評価](#優先度評価)
6. [根本原因分析](#根本原因分析)

---

## エグゼクティブサマリー

### 発見された問題

**問題1: エッジケース判定の誤り（Critical）**
- **0点（score === 0）を未入力として扱っている**
- 麻雀で±0点は正常なプレイ結果
- 集計から除外されるため、統計が不正確

**問題2: selectedUserId非対応（Critical）**
- **revenueStats/chipStatsがsession.summary依存**
- mainUserのデータしか表示されない
- ユーザー切り替えで統計が更新されない

### ビジネスインパクト

| 項目 | 影響 | 重大度 |
|------|------|--------|
| **データ正確性** | 0点半荘が統計から漏れる | 🔴 Critical |
| **ユーザー体験** | ユーザー切り替えが機能しない | 🔴 Critical |
| **信頼性** | 表示される統計が実データと不一致 | 🔴 Critical |
| **アプリ価値** | 分析機能が事実上使えない | 🔴 Critical |

### 修正方針

**Phase 1: エッジケース修正（優先度: Critical）**
- session-utils.ts、InputTab.tsx、AnalysisTab.tsx の4箇所
- 0点除外ロジックを削除
- 影響範囲: 狭い、リスク: 低い

**Phase 2: selectedUserId対応（優先度: Critical）**
- AnalysisTab.tsx の2つの統計計算を完全書き換え
- 影響範囲: 中程度、リスク: 中程度

---

## 問題1: エッジケース判定の誤り

### 問題の詳細

#### 誤った前提

**コード内のコメント（session-utils.ts:141-142）**:
```typescript
// 点数が入力されていない半荘はスキップ（未入力の半荘は集計対象外）
// 防御的プログラミング: null or 0 の両方をスキップ
if (mainUserResult.score === null || mainUserResult.score === 0) {
  continue
}
```

**誤り**:
- `score === 0`を「未入力」として扱っている
- 「防御的プログラミング」という名目で0点を除外

#### 正しい認識

**麻雀における0点の意味**:

| ケース | 説明 | score値 | 扱い |
|--------|------|---------|------|
| **±0点** | 30000点ちょうどで終了 | `0` | ✅ 正常データ |
| **相殺** | スコア+5000、ウマ-5000 | `0` | ✅ 正常データ |
| **累積±0** | 複数半荘でプラスマイナスが相殺 | `0` | ✅ 正常データ |
| **未入力** | プレイヤーが点数を入力していない | `null` | ❌ 除外 |

**正しい判定**:
```typescript
// ✅ 正しい実装
if (mainUserResult.score === null) {  // nullのみチェック
  continue
}
// score === 0 は通常の処理フローで集計対象
```

### 影響を受けるコード

#### 1. session-utils.ts: Line 142
**場所**: `calculateSessionSummary` - メインユーザーの半荘スキップ判定

**現在のコード**:
```typescript
if (mainUserResult.score === null || mainUserResult.score === 0) {
  continue
}
```

**影響**:
- 0点の半荘が`hanchanCount`から除外される
- 着順カウント（rankCounts）が不正確
- 平均着順計算の分母が誤る
- セッションサマリーの`totalPayout`計算が不正確

**実例シナリオ**:
```
セッション: 3半荘
- 半荘1: +5000点
- 半荘2: ±0点 ← これが除外される
- 半荘3: -5000点

現在の表示:
  半荘数: 2半荘（誤り、実際は3半荘）
  平均着順: 誤った値
```

#### 2. session-utils.ts: Line 203
**場所**: `calculateSessionSummary` - 全プレイヤーの総収支計算

**現在のコード**:
```typescript
if (player.isSpectator || player.score === null || player.score === 0) {
  continue
}
```

**影響**:
- 総合順位計算で0点プレイヤーが除外される
- `overallRank`が不正確

**実例シナリオ**:
```
プレイヤー構成:
- プレイヤーA: +10000点
- プレイヤーB: ±0点 ← 除外される
- プレイヤーC: -10000点

現在の順位計算:
  1位: プレイヤーA
  2位: プレイヤーC（誤り、実際はプレイヤーBが2位）
```

#### 3. InputTab.tsx: Line 260
**場所**: 空ハンチャン判定（保存前フィルタリング）

**現在のコード**:
```typescript
const isEmptyHanchan = (h: Hanchan): boolean => {
  return h.players.every(p =>
    p.isSpectator || p.score === null || p.score === 0
  )
}
```

**影響**:
- 全プレイヤーが0点の半荘が「空」として除外される
- 保存されるべきデータが保存されない

**実例シナリオ**:
```
半荘構成（全員±0点の特殊ケース）:
- プレイヤー1: ±0点
- プレイヤー2: ±0点
- プレイヤー3: ±0点
- プレイヤー4: ±0点

現在の動作:
  → 「空ハンチャン」として保存されない（誤り）

正しい動作:
  → 正常な半荘として保存されるべき
```

#### 4. AnalysisTab.tsx: Line 135
**場所**: `pointStats` - スコア統計計算

**現在のコード**:
```typescript
if (userResult && !userResult.isSpectator && userResult.score !== null && userResult.score !== 0) {
  // スコア集計
}
```

**影響**:
- 0点の半荘がpointStatsから除外される
- plusPoints/minusPoints/pointBalanceが不正確

### 見学者（isSpectator）について

#### 現状の実装

**型定義**: ✅ 存在（`PlayerResult.isSpectator: boolean`）

**UI実装**: ❌ 設定方法なし
- `ScoreInputTable.tsx:100`: 常に`false`で初期化
- プレイヤー選択画面にも見学者設定機能なし

**結論**: 将来の拡張用フィールド。現状のUIでは`true`になることはない。

#### 判定ロジックの扱い

```typescript
// ✅ 現在のロジックは残すべき（将来の拡張に備えて）
if (playerResult.isSpectator || playerResult.score === null) {
  continue
}
```

**理由**:
- 型定義が存在する
- 将来的に見学者機能を追加する可能性
- 判定コスト（if文1つ）は無視できる程度

---

## 問題2: selectedUserId非対応

### 問題の詳細

#### 現在の実装

**AnalysisTab.tsx: revenueStats (Line 93-122)**
```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let totalIncome = 0
  let totalExpense = 0
  let totalParlorFee = 0

  // ✅ セッション単位で収支を集計（session.summary使用）
  filteredSessions.forEach(({ session }) => {
    if (session.summary) {
      // ❌ 問題: session.summaryはmainUserのデータのみ
      const totalPayout = session.summary.totalPayout
      totalParlorFee += session.summary.totalParlorFee

      if (totalPayout >= 0) {
        totalIncome += totalPayout
      } else {
        totalExpense += totalPayout
      }
    }
  })

  return { totalIncome, totalExpense, totalParlorFee, totalBalance: ... }
}, [filteredSessions])  // ❌ selectedUserIdが依存配列にない
```

**問題点**:
1. `session.summary`はmainUser専用（保存時にmainUserIdで計算）
2. `selectedUserId`が変わっても統計が再計算されない
3. 依存配列に`selectedUserId`がない

**AnalysisTab.tsx: chipStats (Line 158-182)**
```typescript
const chipStats = useMemo(() => {
  // ... 同様にsession.summaryに依存
  filteredSessions.forEach(({ session }) => {
    if (session.summary) {
      const chips = session.summary.totalChips  // ❌ mainUserのチップのみ
      // ...
    }
  })
}, [filteredSessions])  // ❌ selectedUserIdが依存配列にない
```

#### 正しい実装

**revenueStats: selectedUserIdベースの半荘単位集計**
```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let totalIncome = 0
  let totalExpense = 0
  let sessionChips = 0
  let sessionParlorFee = 0
  let chipsInitialized = false

  // ✅ 半荘単位でselectedUserIdの収支を計算
  filteredSessions.forEach(({ session, hanchans }) => {
    if (hanchans) {
      hanchans.forEach(hanchan => {
        const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)

        // ✅ 見学者・未入力を除外（0点は含む）
        if (!userResult || userResult.isSpectator || userResult.score === null) {
          return
        }

        // ✅ chips/parlorFeeはセッションで1回のみ
        if (!chipsInitialized) {
          sessionChips = userResult.chips || 0
          sessionParlorFee = userResult.parlorFee || 0
          chipsInitialized = true
        }

        // ✅ 小計（score + umaPoints * umaValue）
        const umaPoints = umaMarkToValue(userResult.umaMark)
        const subtotal = userResult.score + umaPoints * session.umaValue
        const scorePayout = subtotal * session.rate

        if (scorePayout >= 0) {
          totalIncome += scorePayout
        } else {
          totalExpense += scorePayout
        }
      })
    }

    // ✅ セッション終了時にchips/parlorFeeを加算
    if (chipsInitialized) {
      const chipsPayout = sessionChips * session.chipRate - sessionParlorFee
      if (chipsPayout >= 0) {
        totalIncome += chipsPayout
      } else {
        totalExpense += chipsPayout
      }
      chipsInitialized = false  // 次のセッションのためにリセット
    }
  })

  return {
    totalIncome,
    totalExpense,
    totalParlorFee: sessionParlorFee,
    totalBalance: totalIncome + totalExpense
  }
}, [filteredSessions, selectedUserId])  // ✅ selectedUserIdを依存配列に追加
```

**chipStats: selectedUserIdベースの集計**
```typescript
const chipStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let plusChips = 0
  let minusChips = 0

  // ✅ セッション単位でselectedUserIdのチップを集計
  filteredSessions.forEach(({ hanchans }) => {
    if (hanchans && hanchans.length > 0) {
      let sessionChips = 0
      let chipsFound = false

      // ✅ 最初の有効半荘からチップを取得（1回のみ）
      for (const hanchan of hanchans) {
        const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)

        if (userResult && !userResult.isSpectator && userResult.score !== null) {
          sessionChips = userResult.chips || 0
          chipsFound = true
          break
        }
      }

      // ✅ セッション単位で振り分け
      if (chipsFound) {
        if (sessionChips >= 0) {
          plusChips += sessionChips
        } else {
          minusChips += sessionChips
        }
      }
    }
  })

  return {
    plusChips,
    minusChips,
    chipBalance: plusChips + minusChips
  }
}, [filteredSessions, selectedUserId])  // ✅ selectedUserIdを依存配列に追加
```

### 影響範囲

**現在の動作**:
```
1. ユーザーフィルターで「プレイヤーB」を選択
2. revenueStats: mainUserの統計が表示される（誤り）
3. chipStats: mainUserのチップが表示される（誤り）
4. pointStats: ✅ プレイヤーBの統計が表示される（正しい）
```

**修正後の動作**:
```
1. ユーザーフィルターで「プレイヤーB」を選択
2. revenueStats: プレイヤーBの統計が表示される（正しい）
3. chipStats: プレイヤーBのチップが表示される（正しい）
4. pointStats: プレイヤーBの統計が表示される（正しい）
```

---

## 影響範囲マトリックス

### 修正箇所一覧

| ファイル | 行番号 | 箇所 | 問題 | 影響範囲 | リスク |
|---------|--------|------|------|---------|-------|
| **session-utils.ts** | 142 | メインユーザー半荘スキップ | 問題1 | 広い（サマリー全体） | 低 |
| **session-utils.ts** | 203 | 全プレイヤー総収支 | 問題1 | 中（総合順位） | 低 |
| **InputTab.tsx** | 260 | 空ハンチャン判定 | 問題1 | 狭い（保存前） | 低 |
| **AnalysisTab.tsx** | 135 | pointStats条件 | 問題1 | 狭い（統計1個） | 低 |
| **AnalysisTab.tsx** | 93-122 | revenueStats | 問題2 | 中（統計全体） | 中 |
| **AnalysisTab.tsx** | 158-182 | chipStats | 問題2 | 中（統計全体） | 中 |

### 依存関係

```
session-utils.ts (Line 142)
  ↓ 影響
  - SessionSummary.hanchanCount
  - SessionSummary.rankCounts
  - SessionSummary.averageRank
  - SessionSummary.totalPayout
  ↓ 影響
  - 履歴タブの表示
  - 分析タブのrevenueStats（session.summary依存）

session-utils.ts (Line 203)
  ↓ 影響
  - SessionSummary.overallRank
  ↓ 影響
  - 履歴タブの順位表示

InputTab.tsx (Line 260)
  ↓ 影響
  - セッション保存時のフィルタリング
  ↓ 影響
  - 保存されるデータの正確性

AnalysisTab.tsx (Line 93-122, 158-182)
  ↓ 影響
  - 分析タブの統計表示
  ↓ 影響
  - ユーザー体験（ユーザー切り替え機能）
```

---

## 優先度評価

### 問題1: エッジケース修正

**優先度**: 🔴 Critical

**理由**:
- データの正確性に直接影響
- 0点が発生する頻度は低くないが、無視できない
- 修正は単純（条件分岐1つの削除）
- リスクは極めて低い

**実装コスト**: 極小（4箇所、各1行の修正）

**実装時間**: 5-10分

### 問題2: selectedUserId対応

**優先度**: 🔴 Critical

**理由**:
- 分析タブの主要機能が機能していない
- ユーザー切り替えが事実上無意味
- アプリの価値を大きく損なう

**実装コスト**: 中（2つの関数を完全書き換え）

**実装時間**: 30-45分

### 修正順序

**Phase 1: エッジケース修正（優先）**
1. session-utils.ts: Line 142, 203
2. InputTab.tsx: Line 260
3. AnalysisTab.tsx: Line 135

**理由**:
- 独立している（他の問題に依存しない）
- リスクが低い
- 即座に効果が出る

**Phase 2: selectedUserId対応**
1. AnalysisTab.tsx: revenueStats (Line 93-122)
2. AnalysisTab.tsx: chipStats (Line 158-182)

**理由**:
- Phase 1の修正が完了していることが前提
- より複雑な変更
- 独立してテスト可能

---

## 根本原因分析

### なぜこの問題が発生したか

#### 問題1: エッジケース判定の誤り

**原因1: 「防御的プログラミング」の誤用**
```typescript
// 防御的プログラミング: null or 0 の両方をスキップ
if (mainUserResult.score === null || mainUserResult.score === 0) {
  continue
}
```

- 「防御的」という名目で過度に保守的な実装
- ドメイン知識（麻雀で0点は正常）の欠如

**原因2: エッジケースの定義が不明確**
- 「未入力」の定義が曖昧
- `null`と`0`の違いが理解されていない

**原因3: テストケースの不足**
- 0点を含むテストケースがなかった
- エッジケースの検証が不十分

#### 問題2: selectedUserId非対応

**原因1: パフォーマンス最適化の副作用**
- `session.summary`の事前計算（Phase 4で導入）
- mainUser専用の最適化がselectedUserIdと競合

**原因2: 設計の不整合**
- `pointStats`はselectedUserId対応済み
- `revenueStats`/`chipStats`は非対応
- 一貫性のない実装

**原因3: 依存配列の管理ミス**
- useMemo依存配列に`selectedUserId`が欠落
- 静的解析ツール（ESLint）の警告を見逃した可能性

### 再発防止策

#### 短期（今回の修正で実施）

1. **明確なエッジケース定義**
   - `null` = 未入力
   - `0` = 正常データ
   - `isSpectator` = 将来用（現状は常にfalse）

2. **コメントの正確性**
   - 誤解を招くコメントを削除
   - 正しい意図を明記

3. **テストケース追加**
   - 0点を含むテストケース
   - selectedUserId切り替えテスト

#### 中期（今後のプロジェクトで実施）

1. **静的解析の強化**
   - ESLintルール見直し（exhaustive-deps）
   - 依存配列の自動検証

2. **レビュープロセス**
   - useMemo/useCallback使用時の依存配列チェック
   - エッジケースの明示的な定義

3. **ドキュメント整備**
   - データモデルの詳細説明
   - エッジケースのカタログ化

#### 長期（アーキテクチャレベル）

1. **型安全性の向上**
   - `score: number | null` → 明示的な型定義
   - TypeScriptの厳密モード活用

2. **統計計算の抽象化**
   - 統計計算ロジックを独立した関数に分離
   - userId引数を明示的に渡す設計

3. **テスト駆動開発**
   - エッジケースのテストを先に書く
   - カバレッジ100%を目指す

---

## まとめ

### 重大性評価

**両方の問題ともCriticalレベル**:
- データの正確性に直接影響（問題1）
- 主要機能が動作しない（問題2）
- ユーザー信頼を損なう

### 修正の実現可能性

**問題1: 非常に高い**
- 修正箇所が明確
- リスクが極めて低い
- 即座に実施可能

**問題2: 高い**
- 設計方針が明確
- 実装パターンが確立（pointStatsと同様）
- Phase 1完了後に安全に実施可能

### 次のステップ

1. **02-DESIGN_SPECIFICATION.md**: 完全な設計仕様の確定
2. **03-IMPLEMENTATION_PLAN.md**: 実装手順とコード例
3. **04-TEST_STRATEGY.md**: テスト計画の策定
4. **05-MIGRATION_GUIDE.md**: デプロイ計画

---

**Document Version**: 1.0
**Last Updated**: 2025-11-05 18:40
**Status**: Ready for Design Phase
