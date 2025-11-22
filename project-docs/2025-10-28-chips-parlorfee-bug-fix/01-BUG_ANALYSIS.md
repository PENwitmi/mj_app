# Chips/ParlorFee 6倍バグ - 詳細分析

## バグ概要

**発見日**: 2025-10-28
**重大度**: 高（Critical）- 計算結果の正確性に直接影響
**影響範囲**: 入力（InputTab）、履歴（HistoryTab）、分析（未実装）

### 症状

chips（チップ）とparlorFee（場代）がセッション全体で1回のみカウントされるべきところ、半荘数分カウントされる。

**具体例**:
- 入力: `chips=-2`, `parlorFee=2000`
- 期待: セッション全体で `chips=-2`（1回のみ）
- 実際:
  - 5半荘 → `chips=-10`（5倍）
  - 6半荘 → `chips=-12`（6倍）

## 根本原因の特定

### 1. データモデルの設計意図

**PlayerResult型定義** (`src/lib/db.ts:64-76`):
```typescript
export interface PlayerResult {
  id: string;
  hanchanId: string;
  userId: string | null;
  playerName: string;
  score: number;             // ±点数（例: +10, -5）
  umaMark: UmaMark;          // ウママーク
  isSpectator: boolean;
  chips: number;             // チップ枚数（セッション終了後に入力）
  parlorFee: number;         // 場代（プレイヤー個別）
  position: number;
  createdAt: Date;
}
```

**重要な事実**:
- `chips`と`parlorFee`は**PlayerResultレコード**に保存される
- PlayerResultは**半荘ごと**に作成される
- コメント「セッション終了後に入力」は設計意図を示しているが、実装が追いついていない

### 2. 問題のあるコード箇所

#### A. UI層での重複カウント: `TotalsPanel.tsx`

**問題箇所** (`src/components/input/TotalsPanel.tsx:22-55`):
```typescript
function calculatePlayerTotals(
  playerIndex: number,
  hanchans: Hanchan[],
  settings: SessionSettings
): PlayerTotals {
  let scoreTotal = 0
  let umaTotal = 0
  let chips = 0
  let parlorFee = 0

  hanchans.forEach((hanchan) => {
    const player = hanchan.players[playerIndex]
    if (!player.isSpectator && player.score !== null) {
      scoreTotal += player.score
      umaTotal += umaMarkToValue(player.umaMark)
    }
    chips = player.chips         // ❌ 問題箇所1: 上書きのみ（結果的に最終値のみ）
    parlorFee = player.parlorFee // ❌ 問題箇所2: 上書きのみ（結果的に最終値のみ）
  })
  // ...
}
```

**一見すると問題なし**: 上書き代入なので最後の値のみが残る → セッション全体で1回のみ
**実際の問題**: すべての半荘で同じ値が入っているため、この実装は正しく動作している

#### B. バックエンド層での重複カウント: `session-utils.ts`

**問題箇所** (`src/lib/session-utils.ts:115-169`):
```typescript
export async function calculateSessionSummary(
  sessionId: string,
  mainUserId: string
): Promise<SessionSummary> {
  // ...
  let totalPayout = 0
  let totalChips = 0

  // 各半荘で着順と収支を計算
  for (const hanchan of hanchans) {
    // ...
    if (mainUserResult) {
      // ...
      // ❌ 問題箇所3: 各半荘でchips/parlorFeeを加算
      totalPayout += calculatePayout(
        mainUserResult.score,
        mainUserResult.umaMark,
        mainUserResult.chips,        // ← 半荘ごとに加算される
        session.rate,
        session.umaValue,
        session.chipRate,
        session.parlorFee
      )
      totalChips += mainUserResult.chips // ❌ 問題箇所4: 半荘ごとに加算
    }
  }
  // ...
}
```

**calculatePayout関数** (`src/lib/session-utils.ts:72-87`):
```typescript
export function calculatePayout(
  score: number,
  umaMark: import('./db').UmaMark,
  chips: number,        // ← 半荘ごとの値
  rate: number,
  umaValue: number,
  chipRate: number,
  parlorFee: number     // ← 半荘ごとの値
): number {
  const umaPoints = umaMarkToValue(umaMark)
  const subtotal = score + umaPoints * umaValue
  const payout = subtotal * rate + chips * chipRate // ❌ 半荘ごとに計算
  const finalPayout = payout - parlorFee            // ❌ 半荘ごとに計算

  return finalPayout
}
```

**問題の連鎖**:
1. `calculatePayout`は半荘ごとの収支を計算する関数（設計通り）
2. `calculateSessionSummary`が各半荘でこの関数を呼ぶ（設計通り）
3. **しかし**: chips/parlorFeeは半荘ごとではなくセッション全体で1回のみカウントすべき
4. **結果**: `n半荘 × chips/parlorFee = n倍の計算`

#### C. 同様の問題: プレイヤー間の総収支計算

**問題箇所** (`src/lib/session-utils.ts:186-209`):
```typescript
// 全プレイヤーの総収支を計算
for (const hanchan of hanchans) {
  for (const player of hanchan.players) {
    // ...
    const payout = calculatePayout(
      player.score,
      player.umaMark,
      player.chips,      // ❌ 半荘ごとに加算される
      session.rate,
      session.umaValue,
      session.chipRate,
      session.parlorFee
    )
    // ...
    playerPayouts.set(playerKey, currentTotal + payout)
  }
}
```

**影響**:
- セッション内総合順位（`overallRank`）も誤った値で計算される
- 全プレイヤーの収支が実際より大きく（または小さく）計算される

### 3. なぜUI層では問題が顕在化しなかったか

**InputTab → TotalsPanel**:
```typescript
// TotalsPanel.tsx:32-40
hanchans.forEach((hanchan) => {
  const player = hanchan.players[playerIndex]
  // ...
  chips = player.chips         // 上書きのみ → 最後の半荘の値
  parlorFee = player.parlorFee // 上書きのみ → 最後の半荘の値
})
```

**理由**:
- InputTabでは全半荘で同じchips/parlorFee値を共有する設計
- ループで上書きしているため、結果的に「最後の半荘の値 = 全半荘で同じ値」が残る
- **偶然正しく動作している**が、設計思想としては不正確

### 4. データフロー全体図

```
[入力] InputTab
  ↓ (全半荘に同じchips/parlorFeeをセット)
  chips=-2, parlorFee=2000
  ↓
[保存] saveSession
  ↓ (各PlayerResultに保存)
  Hanchan1: { chips: -2, parlorFee: 2000 }
  Hanchan2: { chips: -2, parlorFee: 2000 }
  ...
  HanchanN: { chips: -2, parlorFee: 2000 }
  ↓
[計算] calculateSessionSummary
  ↓ (各半荘でループ)
  totalChips = -2 + (-2) + ... + (-2) = -2 × N
  totalPayout = ... + (chips × chipRate) × N + (- parlorFee) × N
  ↓
[表示] HistoryTab
  chips: -10 (5半荘の場合)
  chips: -12 (6半荘の場合)
```

## 設計上の根本問題

### データモデルの不一致

**現在の実装**:
- chips/parlorFeeは**半荘レベル**（PlayerResult）に保存
- UI/計算ロジックは**セッションレベル**として扱いたい

**理想的な設計（2つの選択肢）**:

#### 選択肢A: セッションレベルに移動
```typescript
export interface Session {
  // ...
  sessionChips: Map<string, number>      // プレイヤーごとのチップ
  sessionParlorFee: Map<string, number>  // プレイヤーごとの場代
}
```

**メリット**:
- 設計意図が明確（セッション全体で1回）
- 重複計算のリスクがない

**デメリット**:
- 既存のデータモデル変更が必要
- マイグレーションが複雑

#### 選択肢B: PlayerResultに保持 + 計算ロジックで制御（採用案）
```typescript
export interface PlayerResult {
  chips: number;      // 半荘ごとに保存（全半荘で同じ値）
  parlorFee: number;  // 半荘ごとに保存（全半荘で同じ値）
}
```

**メリット**:
- データモデル変更不要
- 既存データの後方互換性を保持
- 計算ロジックのみの修正で対応可能

**デメリット**:
- データの冗長性（全半荘で同じ値を保存）
- 将来的な設計負債

**採用理由**:
- タスクの制約「データモデル変更なし」に合致
- 修正範囲が限定的
- 既存データとの互換性を保持

## まとめ

### バグの本質
- chips/parlorFeeは**セッション全体で1回**カウントすべき
- 現在は**半荘ごと**にカウントされている
- 原因: `calculateSessionSummary`と`calculatePayout`の設計が半荘ベースであるため

### 修正方針
- **選択肢B**を採用: データモデルは維持、計算ロジックのみ修正
- chips/parlorFeeは最初の半荘（または任意の1半荘）から取得
- ループ内での重複加算を防止
- 既存データとの後方互換性を保持
