# 履歴タブ総合順位機能 - 仕様書

**作成日**: 2025-10-10 05:51
**対象**: 履歴タブの表示機能強化
**目的**: セッション内での総合順位を表示し、ユーザーの相対的パフォーマンスを可視化

---

## 1. 機能概要

### 1.1 総合順位とは

**定義**: 1つのセッション内における、総収支（円）に基づくプレイヤーの順位

**特徴**:
- **対象範囲**: 各セッション内の全プレイヤー（見学者を除く）
- **計算基準**: 総収支（円）の合計値
- **値の範囲**: 1位、2位、3位...（自然数のみ）
- **計算方法**: 平均ではなく累計収支でランク付け

**具体例**:
```
セッションA（4人打ち、3半荘）
┌──────────────┬──────────┬──────────┐
│ プレイヤー   │ 総収支   │ 総合順位 │
├──────────────┼──────────┼──────────┤
│ プレイヤーA  │ +5,000円 │ 1位      │
│ プレイヤーB  │ +2,000円 │ 2位      │
│ メインユーザー│ -1,000円 │ 3位      │
│ プレイヤーD  │ -6,000円 │ 4位      │
└──────────────┴──────────┴──────────┘

ゼロサム検証: 5000 + 2000 - 1000 - 6000 = 0 ✓
→ 履歴カードには「総合順位: 3位」と表示
```

### 1.2 表示位置

**履歴タブ > セッションカード > 左グリッド（最上部）**

```
┌─────────────────────┬─────────────────┐
│ 総合順位: 3位       │  1位: 2回       │
│ 収支: -1000         │  2位: 1回       │
│ チップ: +5枚        │  3位: 0回       │
│ 平均: 2.33位        │                 │
└─────────────────────┴─────────────────┘
   ↑新規追加             ↑既存の着順統計
```

---

## 2. 実装方針

### 2.1 データモデル変更

**`SessionSummary`型に`overallRank`フィールドを追加**

```typescript
export interface SessionSummary {
  sessionId: string
  date: string
  mode: GameMode
  hanchanCount: number
  totalPayout: number
  totalChips: number
  averageRank: number
  rankCounts: {
    first: number
    second: number
    third: number
    fourth?: number
  }
  overallRank: number  // ← 新規追加
}
```

### 2.2 計算タイミング

**セッション保存時に事前計算（パフォーマンス最適化）**

- `saveSessionWithSummary`関数でサマリー計算時に同時計算
- `calculateSessionSummary`関数でも同じロジックを実装（遡及計算用）

**理由**:
- 履歴タブでの表示パフォーマンス向上
- 既存の事前計算パターンと一貫性を保つ
- 再計算コストの削減

### 2.3 既存データの扱い

**開発中のため、データへの侵襲性は考慮不要**

- 既存セッションは`calculateSessionSummary`で自動的に`overallRank`が計算される
- `useSessions`フックが`summary`のないデータを検出時に遡及計算
- 新規保存データは`saveSessionWithSummary`で事前計算

---

## 3. 計算ロジック

### 3.1 アルゴリズム

```typescript
// ステップ1: セッション内の全プレイヤーの総収支を計算
const playerPayouts = new Map<string, number>()

hanchans.forEach(hanchan => {
  hanchan.players.forEach(player => {
    // 見学者は除外
    if (player.isSpectator) continue

    // 各半荘の収支を計算
    const payout = calculatePayout(
      player.score,
      player.umaMark,
      player.chips,
      session.rate,
      session.umaValue,
      session.chipRate,
      session.parlorFee
    )

    // 累積収支に加算
    const currentTotal = playerPayouts.get(player.userId) || 0
    playerPayouts.set(player.userId, currentTotal + payout)
  }
})

// ステップ2: 収支降順でソート（高い収支が上位）
const sortedPlayers = Array.from(playerPayouts.entries())
  .sort((a, b) => b[1] - a[1])  // [userId, totalPayout]

// ステップ3: メインユーザーの順位を特定
const overallRank = sortedPlayers.findIndex(
  ([userId]) => userId === mainUserId
) + 1

// ステップ4: エラーケース処理
if (overallRank === 0) {
  // メインユーザーが見つからない場合
  throw new ValidationError('Main user not found in session')
}
```

### 3.2 同点処理

**初期実装: 先着優先方式**

収支が同じ場合、配列の順序（プレイヤーID順）で順位が決定される。

**例**:
```
プレイヤーA: +3,000円
プレイヤーB: +3,000円（同点）
プレイヤーC: -6,000円

→ 順位: 1位、2位、3位（厳密な同順位処理はしない）
```

**将来的な改善案**:
- 同順位処理: 1位、1位、3位（2位を飛ばす）
- 平均着順でタイブレーク
- チップ数でタイブレーク

### 3.3 ゼロサム検証

総合順位計算時にゼロサム原則の検証は不要。

**理由**:
- 各半荘は保存時に既に`validateZeroSum`で検証済み
- 総合順位は結果を集計するだけ

---

## 4. 変更が必要なファイル

### 4.1 `src/lib/session-utils.ts`

**変更箇所**:

1. **`SessionSummary`型定義**
   ```typescript
   export interface SessionSummary {
     // ... 既存フィールド
     overallRank: number  // 追加
   }
   ```

2. **`calculateSessionSummary`関数**
   - 総合順位計算ロジックを追加
   - 行数: 約20行追加

3. **`saveSessionWithSummary`関数**
   - 事前計算部分に総合順位計算を追加
   - 行数: 約20行追加

### 4.2 `src/components/tabs/HistoryTab.tsx`

**変更箇所**:

左グリッドに総合順位表示を追加

```tsx
{/* 左側：基本情報（中央揃え） */}
<div className="flex-1 space-y-1 text-center">
  {/* 新規追加 */}
  <div className="text-base font-semibold">
    総合順位: {summary.overallRank}位
  </div>

  {/* 既存 */}
  <div className={cn('text-lg font-bold', ...)}>
    収支: {summary.totalPayout > 0 ? '+' : ''}{summary.totalPayout}
  </div>
  <div className="text-base">
    チップ: {summary.totalChips > 0 ? '+' : ''}{summary.totalChips}枚
  </div>
  <div className="text-base">
    平均: {summary.averageRank.toFixed(2)}位
  </div>
</div>
```

---

## 5. エラーケースと対応

### 5.1 メインユーザーがセッション内に存在しない

**状況**:
- 古いデータで整合性が崩れている
- 削除されたユーザーがメインユーザーとして設定されている

**対応**:
```typescript
if (overallRank === 0) {
  logger.error('Main user not found in session', {
    context: 'calculateSessionSummary',
    data: { sessionId, mainUserId }
  })
  // デフォルト値を返す（エラーで停止しない）
  return {
    ...otherFields,
    overallRank: 0
  }
}
```

**表示**:
```tsx
// overallRank === 0 の場合は表示しない
{summary.overallRank > 0 && (
  <div className="text-base font-semibold">
    総合順位: {summary.overallRank}位
  </div>
)}
```

### 5.2 見学者のみのセッション

**状況**: 全員が`isSpectator: true`

**対応**:
```typescript
if (playerPayouts.size === 0) {
  logger.warn('No active players in session', {
    context: 'calculateSessionSummary',
    data: { sessionId }
  })
  return {
    ...otherFields,
    overallRank: 0
  }
}
```

---

## 6. テストケース

### 6.1 正常系

**ケース1: 4人打ち、メインユーザーが2位**
```
入力:
- プレイヤーA: +5,000円
- メインユーザー: +2,000円
- プレイヤーC: -1,000円
- プレイヤーD: -6,000円

期待結果: overallRank = 2
```

**ケース2: 3人打ち、メインユーザーが1位**
```
入力:
- メインユーザー: +8,000円
- プレイヤーB: -3,000円
- プレイヤーC: -5,000円

期待結果: overallRank = 1
```

**ケース3: 複数半荘での累積**
```
セッション（3半荘）:
- 半荘1: メイン=+1000, A=-1000
- 半荘2: メイン=-500, A=+500
- 半荘3: メイン=+2000, A=-2000

累積: メイン=+2500, A=-2500
期待結果: overallRank = 1
```

### 6.2 異常系

**ケース4: メインユーザーが存在しない**
```
入力:
- プレイヤーA: +3,000円
- プレイヤーB: -3,000円
- メインユーザー: 参加なし

期待結果: overallRank = 0（エラー値）
```

**ケース5: 見学者のみ**
```
入力:
- プレイヤーA: 見学者
- プレイヤーB: 見学者

期待結果: overallRank = 0（エラー値）
```

### 6.3 同点処理

**ケース6: 同点（先着優先）**
```
入力:
- プレイヤーA: +3,000円
- メインユーザー: +3,000円（同点）
- プレイヤーC: -6,000円

期待結果:
- プレイヤーA: 1位
- メインユーザー: 2位（配列順による）
- プレイヤーC: 3位
```

---

## 7. 実装手順

### Phase 1: データモデル変更（session-utils.ts）

1. `SessionSummary`型に`overallRank: number`を追加
2. `calculateSessionSummary`関数に計算ロジック実装
3. `saveSessionWithSummary`関数に計算ロジック実装

### Phase 2: UI変更（HistoryTab.tsx）

1. 左グリッドに総合順位表示を追加
2. エラーケース（`overallRank === 0`）の表示制御
3. スタイリング調整

### Phase 3: 動作確認

1. 新規セッション保存 → 総合順位が正しく計算されるか
2. 既存セッション表示 → 遡及計算が正しく動作するか
3. エッジケース → エラー値の表示制御が機能するか

---

## 8. 将来的な改善案

### 8.1 同順位処理の改善

現在は先着優先方式だが、厳密な同順位処理を実装：

```
改善前: 1位、2位、3位（同点でも連番）
改善後: 1位、1位、3位（2位を飛ばす）
```

### 8.2 タイブレークルール

同点時の優先順位を設定：

1. 平均着順が高い方が上位
2. チップ数が多い方が上位
3. 1位の回数が多い方が上位

### 8.3 順位の視覚的強調

```tsx
<div className={cn(
  'text-base font-semibold',
  summary.overallRank === 1 && 'text-yellow-600',  // 金色
  summary.overallRank === 2 && 'text-gray-400',    // 銀色
  summary.overallRank === 3 && 'text-orange-700'   // 銅色
)}>
  総合順位: {summary.overallRank}位
</div>
```

---

## 9. 参考資料

### 9.1 関連ドキュメント

- `project-docs/2025-10-04-phase4-history-tab/04-SUMMARY_PRE_CALCULATION.md`
  - サマリー事前計算の実装パターン
  - パフォーマンス最適化の考え方

### 9.2 関連ファイル

- `src/lib/session-utils.ts`: セッション計算ロジック
- `src/lib/db-utils.ts`: ゼロサム検証、データ整合性
- `src/components/tabs/HistoryTab.tsx`: 履歴タブUI
- `src/hooks/useSessions.ts`: セッション一覧管理

---

**変更履歴**:
- 2025-10-10 05:51: 初版作成
