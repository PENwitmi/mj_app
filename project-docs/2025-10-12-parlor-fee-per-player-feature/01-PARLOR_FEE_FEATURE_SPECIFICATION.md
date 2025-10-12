# プレイヤー別場代フィールド追加・UI改善 仕様書

**作成日**: 2025-10-12 11:42
**ステータス**: 設計中

---

## 📋 目次

1. [背景・問題点](#背景問題点)
2. [現状の実装](#現状の実装)
3. [修正方針](#修正方針)
4. [実装詳細](#実装詳細)
5. [影響範囲](#影響範囲)
6. [テスト項目](#テスト項目)

---

## 背景・問題点

### 発見された問題

ユーザーが場代を入力して保存した後、以下の問題が発生：

1. **編集画面で場代がリセットされる**
   - 履歴タブでセッション詳細を開く → 場代込みの収支が正しく表示
   - 編集ボタンをクリック → 場代が0にリセットされてしまう
   - 原因: `PlayerResult`型に`parlorFee`フィールドが存在しない

2. **セッション詳細ダイアログに場代表示が不要**
   - 場代はSessionレベルで一律表示されているが、実際は各プレイヤー個別の値
   - UI上で混乱を招く可能性

3. **分析タブの収支統計で場代が埋もれている**
   - 現在: プラス / マイナス / 計（場代込み）の3段表示
   - 問題: 場代がどれだけかかっているか不明瞭
   - 要望: プラス / マイナス / 場代 / 計の4段表示で明示化

---

## 現状の実装

### 1. DBスキーマ（`src/lib/db.ts`）

```typescript
export interface PlayerResult {
  id: string;
  hanchanId: string;
  userId: string | null;
  playerName: string;
  score: number;
  umaMark: UmaMark;
  isSpectator: boolean;
  chips: number;              // ← chipsはある
  position: number;
  createdAt: Date;
  // parlorFee フィールドが存在しない！
}

export interface Session {
  id: string;
  date: string;
  mode: GameMode;
  rate: number;
  umaValue: number;
  chipRate: number;
  parlorFee: number;  // ← セッション全体の場代（各プレイヤー個別ではない）
  umaRule: UmaRule;
  summary?: SessionSummary;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. DB読み込み処理（`src/lib/db/sessions.ts`）

```typescript
export function dbHanchansToUIHanchans(
  dbHanchans: Array<Hanchan & { players: PlayerResult[] }>
): UIHanchan[] {
  return dbHanchans.map(hanchan => ({
    hanchanNumber: hanchan.hanchanNumber,
    autoCalculated: false,
    players: hanchan.players
      .sort((a, b) => a.position - b.position)
      .map(player => ({
        playerName: player.playerName,
        userId: player.userId,
        score: player.score,
        umaMark: player.umaMark,
        chips: player.chips,
        parlorFee: 0,  // ← 常に0にリセット（DBにフィールドがないため）
        isSpectator: player.isSpectator,
        umaMarkManual: false
      }))
  }))
}
```

### 3. 分析タブの収支計算（`src/components/tabs/AnalysisTab.tsx` 95-133行目）

```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let totalIncome = 0
  let totalExpense = 0

  filteredSessions.forEach(({ session, hanchans }) => {
    if (hanchans) {
      hanchans.forEach(hanchan => {
        const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
        if (userResult) {
          // calculatePayoutで正確な収支（円）を計算
          const payout = calculatePayout(
            userResult.score,
            userResult.umaMark,
            userResult.chips,
            session.rate,
            session.umaValue,
            session.chipRate,
            session.parlorFee  // ← ここで場代を引いている
          )

          if (payout > 0) {
            totalIncome += payout
          } else {
            totalExpense += payout  // 負の値
          }
        }
      })
    }
  })

  return {
    totalIncome,      // ← 既に場代を引いた後の値
    totalExpense,     // ← 既に場代を引いた後の値
    totalBalance: totalIncome + totalExpense
  }
}, [filteredSessions, selectedUserId])
```

### 4. calculatePayout関数（`src/lib/session-utils.ts`）

```typescript
export function calculatePayout(
  score: number,
  umaMark: UmaMark,
  chips: number,
  rate: number,
  umaValue: number,
  chipRate: number,
  parlorFee: number
): number {
  const umaPoints = umaMarkToValue(umaMark)
  const subtotal = score + umaPoints * umaValue
  const payout = subtotal * rate + chips * chipRate
  const finalPayout = payout - parlorFee  // ← ここで場代を引いている

  return finalPayout  // ← 場代込みの最終収支を返す
}
```

---

## 修正方針

### 1. DBスキーマ拡張

**PlayerResult型に`parlorFee`フィールドを追加**

```typescript
export interface PlayerResult {
  id: string;
  hanchanId: string;
  userId: string | null;
  playerName: string;
  score: number;
  umaMark: UmaMark;
  isSpectator: boolean;
  chips: number;
  parlorFee: number;  // ← 追加: プレイヤー個別の場代
  position: number;
  createdAt: Date;
}
```

**Dexieマイグレーション（Version 3追加）**
- スキーマ定義は変更不要（Dexieは動的にフィールドを追加可能）
- 既存データには`parlorFee`が存在しないが、undefinedとして扱われ問題なし

### 2. UI層の修正

#### A. セッション詳細ダイアログ（`SessionDetailDialog.tsx`）

**閲覧モード**（215-222行目）:
```typescript
// 削除: 場代表示行
// <div>場代: {session.parlorFee}</div>
```

**編集モード**（280-312行目）:
```typescript
// 削除: 場代表示行
// <div>場代: {session.parlorFee}</div>
```

#### B. DB読み込み処理（`src/lib/db/sessions.ts`）

```typescript
export function dbHanchansToUIHanchans(
  dbHanchans: Array<Hanchan & { players: PlayerResult[] }>
): UIHanchan[] {
  return dbHanchans.map(hanchan => ({
    hanchanNumber: hanchan.hanchanNumber,
    autoCalculated: false,
    players: hanchan.players
      .sort((a, b) => a.position - b.position)
      .map(player => ({
        playerName: player.playerName,
        userId: player.userId,
        score: player.score,
        umaMark: player.umaMark,
        chips: player.chips,
        parlorFee: player.parlorFee || 0,  // ← DBから読み込む（既存データは0）
        isSpectator: player.isSpectator,
        umaMarkManual: false
      }))
  }))
}
```

#### C. 分析タブの収支計算（`AnalysisTab.tsx`）

**修正前（場代込み）**:
```typescript
const payout = calculatePayout(...)  // 場代を引いた後の値
if (payout > 0) {
  totalIncome += payout
} else {
  totalExpense += payout
}
```

**修正後（場代を別途集計）**:
```typescript
// 場代を引く前の収支を計算
const umaPoints = umaMarkToValue(userResult.umaMark)
const subtotal = userResult.score + umaPoints * session.umaValue
const payoutBeforeParlorFee = subtotal * session.rate + userResult.chips * session.chipRate

// 場代を別途集計
const parlorFee = userResult.parlorFee || 0
totalParlorFee += parlorFee

// プラス/マイナスに振り分け
if (payoutBeforeParlorFee > 0) {
  totalIncome += payoutBeforeParlorFee
} else {
  totalExpense += payoutBeforeParlorFee
}
```

**表示（4段構成）**:
```typescript
<div className="text-base font-semibold mb-2">💰 収支</div>
<div className="space-y-1 text-lg">
  <div className="flex">
    <span className="w-12">+:</span>
    <span className="flex-1 text-right text-blue-600">+{totalIncome}円</span>
  </div>
  <div className="flex">
    <span className="w-12">-:</span>
    <span className="flex-1 text-right text-red-600">{totalExpense}円</span>
  </div>
  <div className="flex">
    <span className="w-12">場代:</span>
    <span className="flex-1 text-right text-orange-600">-{totalParlorFee}円</span>
  </div>
  <div className="flex pt-1 border-t font-bold">
    <span className="w-12">計:</span>
    <span className="flex-1 text-right">{totalIncome + totalExpense - totalParlorFee}円</span>
  </div>
</div>
```

---

## 実装詳細

### 変更ファイル一覧

| ファイル | 変更内容 | 優先度 |
|---------|---------|--------|
| `src/lib/db.ts` | PlayerResult型に`parlorFee: number`追加 | 高 |
| `src/lib/db/sessions.ts` | `dbHanchansToUIHanchans`で`player.parlorFee`を読み込む | 高 |
| `src/components/SessionDetailDialog.tsx` | 場代表示行を削除（閲覧・編集両モード） | 中 |
| `src/components/tabs/AnalysisTab.tsx` | 収支計算を修正（場代を別途集計、4段表示） | 高 |

### 実装順序

1. **DBスキーマ拡張** (`src/lib/db.ts`)
   - PlayerResult型定義に`parlorFee: number`を追加

2. **DB読み込み処理修正** (`src/lib/db/sessions.ts`)
   - `dbHanchansToUIHanchans`関数で`player.parlorFee`を読み込む

3. **セッション詳細ダイアログ修正** (`SessionDetailDialog.tsx`)
   - 閲覧モード・編集モードの場代表示行を削除

4. **分析タブ修正** (`AnalysisTab.tsx`)
   - `revenueStats`計算を修正（場代を別途集計）
   - UI表示を4段構成に変更

5. **ビルド・テスト**
   - 新規入力 → 保存 → 編集 → 保存の一連の流れで場代が保持されることを確認
   - 分析タブで4段表示が正しく機能することを確認

---

## 影響範囲

### データベース

- **既存データへの影響**: なし
  - 既存の`PlayerResult`レコードには`parlorFee`が存在しないが、読み込み時に`|| 0`でデフォルト値を設定
  - 新規保存時から`parlorFee`が保存される

- **マイグレーション**: 不要
  - Dexieは動的にフィールドを追加可能
  - スキーマバージョンアップ不要

### UI

- **新規入力画面（InputTab）**: 変更なし
  - 既に場代入力欄があり、正常に機能している

- **履歴タブ（HistoryTab）**: 変更なし
  - 既に場代込みの最終収支を表示している

- **セッション詳細ダイアログ**: 場代表示削除
  - 混乱を招く表示がなくなり、UI/UX向上

- **分析タブ（AnalysisTab）**: 収支統計の表示変更
  - 場代の内訳が明確になり、可視性向上

### 計算ロジック

- **TotalsPanel**: 変更なし
  - 既にプレイヤー別の場代を計算している

- **calculatePayout**: 変更なし
  - 引き続き場代を引いた最終収支を返す

- **分析タブの統計計算**: 変更あり
  - 場代を引く前の収支を計算するロジックを追加

---

## テスト項目

### 1. 新規入力テスト

- [ ] 新規セッションで各プレイヤーに場代を入力
- [ ] 保存成功
- [ ] 履歴タブで最終収支が正しく表示される（場代込み）

### 2. 編集機能テスト

- [ ] 場代を入力したセッションの詳細を開く
- [ ] 編集ボタンをクリック
- [ ] 場代が正しく表示される（0にリセットされない）
- [ ] 場代を変更して保存
- [ ] 変更が反映されている

### 3. 分析タブテスト

- [ ] フィルターを適用（期間、モード、ユーザー）
- [ ] 収支統計が4段表示される（+、-、場代、計）
- [ ] 各項目の金額が正しい
- [ ] 計算式: 計 = + + (-) - 場代

### 4. 既存データ互換性テスト

- [ ] 場代フィールド追加前のデータを読み込む
- [ ] 場代が0として扱われる（エラーなし）
- [ ] 編集画面で場代を入力可能
- [ ] 保存後、場代が正しく保存される

### 5. エッジケーステスト

- [ ] 場代が0の場合
- [ ] 場代が負の値の場合（入力制限を確認）
- [ ] 場代が非常に大きい値の場合

---

## 備考

### なぜSession.parlorFeeを削除しないか

現在`Session`型に`parlorFee`フィールドが存在するが、削除しない理由：

1. **後方互換性**: 既存のコード・データへの影響を最小化
2. **段階的移行**: 今後のリファクタリングで削除を検討
3. **現時点では未使用**: UI上では表示していないため、実害なし

将来的には、`Session.parlorFee`を完全に削除し、各プレイヤーの`PlayerResult.parlorFee`のみを使用する設計に統一することを推奨。

---

**次のステップ**: 実装開始

このドキュメントに基づいて、各ファイルの実装を進める。
