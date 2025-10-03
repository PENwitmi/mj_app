# InputTab コンポーネント実装解析

**作成日**: 2025-10-03 16:50
**対象ファイル**: `app/src/components/tabs/InputTab.tsx`
**目的**: ウマルール機能追加前の現状把握および安全な機能拡張のための参考資料

---

## 1. コンポーネント構造

### 1.1 主要な State

```typescript
const [selectedMode, setSelectedMode] = useState<GameMode | null>(null)
const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SETTINGS)
const [hanchans, setHanchans] = useState<Hanchan[]>([])
const [playerCount, setPlayerCount] = useState<number>(0)
```

- **selectedMode**: 4人打ち/3人打ち選択状態（null = 未選択）
- **settings**: セッション全体の設定（日付、レート、ウマ値、チップレート）
- **hanchans**: 全半荘データの配列（点数、ウママーク、チップ、場代等）
- **playerCount**: プレイヤー人数（4 or 3）

### 1.2 型定義

#### SessionSettings
```typescript
interface SessionSettings {
  date: string        // YYYY-MM-DD形式
  rate: number        // レート（デフォルト: 30）
  umaValue: number    // ウマ値（デフォルト: 10）
  chipRate: number    // チップレート（デフォルト: 100）
}
```

#### PlayerResult
```typescript
interface PlayerResult {
  playerName: string
  score: number | null          // ±点数
  umaMark: UmaMark              // ウママーク（'○○○' | '○○' | '○' | '' | '✗' | '✗✗' | '✗✗✗'）
  chips: number                 // チップ数
  parlorFee: number             // 場代
  isSpectator: boolean          // 見学者フラグ（未実装）
  umaMarkManual: boolean        // ウママークが手動設定されたか
}
```

#### Hanchan
```typescript
interface Hanchan {
  hanchanNumber: number
  players: PlayerResult[]
  autoCalculated: boolean      // 最後の1人の点数が自動計算されたか
}
```

#### PlayerTotals（集計計算結果）
```typescript
interface PlayerTotals {
  scoreTotal: number       // 点数合計
  umaTotal: number         // ウマポイント合計
  subtotal: number         // 小計（点数+ウマ）
  chips: number            // チップ
  payout: number           // 収支（小計×レート+チップ×チップレート）
  parlorFee: number        // 場代
  finalPayout: number      // 最終収支
}
```

---

## 2. 主要機能

### 2.1 モード選択（4人打ち/3人打ち）

**関数**: `handleModeSelect(mode: GameMode)`

**処理フロー**:
1. モード設定（'4-player' または '3-player'）
2. プレイヤー人数決定（4 or 3）
3. 初期プレイヤー名生成（'自分', 'B', 'C', 'D'...）
4. 初期半荘データ作成（3つの空の半荘）

**コード位置**: 195-210行目

---

### 2.2 点数入力とゼロサム自動計算

**リアルタイム更新（onChange）**: 336-346行目
- 入力中の値を即座にstateに反映（表示のみ）

**自動計算（onBlur）**: 347-392行目

**処理フロー**:
1. **ゼロサム自動計算** (356-381行目)
   - 条件: `autoCalculated === false` かつ「必要人数-1人が入力済み」
   - 動作: 未入力の最後の1人の点数を自動計算（ゼロサム原則）
   - 計算: `calculateAutoScore()` → 合計の逆数を返す
   - フラグ設定: `autoCalculated = true`（再計算を防止）

2. **ウママーク自動割り当て** (383-389行目)
   - 条件: `umaMarkManual === false`（手動変更されていない場合のみ）
   - 動作: `assignUmaMarks()` で点数に基づいてウママークを割り当て

**重要な実装ポイント**:
- `autoCalculated`フラグで初回のみ自動計算（再計算を防ぐ）
- `umaMarkManual`フラグで手動変更を保護

---

### 2.3 ウママーク割り当て

**関数**: `assignUmaMarks(players: PlayerResult[], mode: GameMode): UmaMark[]`（80-104行目）

**現在の実装（標準ルールのみ）**:

#### 4人打ち標準ルール
```typescript
1位 → '○○'
2位 → '○'
3位 → '✗'
4位 → '✗✗'
```

#### 3人打ち標準ルール
```typescript
1位 → '○○'
2位 → '○'
3位 → '✗✗✗'
```

**処理フロー**:
1. 見学者と未入力を除外
2. 点数で降順ソート
3. 順位に応じたウママークを割り当て
4. 見学者には空文字（''）

**重要**: この関数が **ウマルール機能追加の主要な改修対象**

---

### 2.4 ウママーク手動変更

**UI**: Selectコンポーネント（394-423行目）

**処理**:
1. ウママーク変更時に`umaMarkManual = true`を設定
2. 以降の自動計算ではそのプレイヤーのウママークを変更しない

**オプション**: `UMA_MARK_OPTIONS`（49-57行目）
- 7種類のウママークを縦積み表示
- 空文字の場合は「無印」として「─」を表示

---

### 2.5 集計計算

**関数**: `calculatePlayerTotals(playerIndex, hanchans, settings): PlayerTotals`（153-186行目）

**計算式**:
```typescript
// 1. 全半荘の点数・ウマポイント合計
scoreTotal = Σ score
umaTotal = Σ umaMarkToValue(umaMark)

// 2. 小計
subtotal = scoreTotal + (umaTotal × umaValue)

// 3. 収支
payout = (subtotal × rate) + (chips × chipRate)

// 4. 最終収支
finalPayout = payout - parlorFee
```

**ウママーク→数値変換**: `umaMarkToValue()` (121-140行目)
```typescript
'○○○' → 3
'○○'  → 2
'○'   → 1
''    → 0
'✗'   → -1
'✗✗'  → -2
'✗✗✗' → -3
```

**チップと場代の扱い**:
- 各半荘のPlayerResultに値を保持
- 集計時は「最後の値」を使用（169-170行目）
- 入力UIでは全半荘の同じプレイヤーに一括反映（503-507、541-545行目）

---

## 3. データフロー

### 3.1 初期化フロー

```
モード選択
  ↓
handleModeSelect()
  ↓
初期プレイヤー名生成（getInitialPlayerNames）
  ↓
3つの空半荘作成（createInitialPlayerResult × 3）
  ↓
hanchans state更新
```

### 3.2 点数入力フロー

```
Input onChange（リアルタイム）
  ↓
score更新（表示のみ）
  ↓
Input onBlur
  ↓
自動計算判定（autoCalculated === false && 必要人数-1入力済み）
  ├─ Yes → calculateAutoScore() → 最後の1人に自動入力 → autoCalculated = true
  └─ No  → スキップ
  ↓
ウママーク自動割り当て（umaMarkManual === false のプレイヤーのみ）
  ↓
assignUmaMarks()
  ↓
点数で順位づけ → ウママーク設定
  ↓
hanchans state更新
```

### 3.3 集計計算フロー

```
hanchans state変更
  ↓
集計エリア再レンダリング
  ↓
各プレイヤーに対してcalculatePlayerTotals()
  ↓
全半荘を走査
  ├─ scoreTotal、umaTotal累計
  ├─ chips、parlorFee（最後の値）
  └─ 計算式適用
  ↓
小計・収支・最終収支を表示
```

---

## 4. 計算ロジック詳細

### 4.1 ゼロサム自動計算

**関数**: `calculateAutoScore(players: PlayerResult[]): number | null` (106-118行目)

**アルゴリズム**:
```typescript
// 見学者と未入力を除外
const scores = players
  .filter(p => !p.isSpectator && p.score !== null)
  .map(p => p.score as number)

// 合計の逆数を返す
const sum = scores.reduce((acc, score) => acc + score, 0)
return -sum
```

**前提**: 麻雀の点数は必ずゼロサム（全員の合計が0）

---

### 4.2 ウママーク自動割り当て（標準ルール）

**関数**: `assignUmaMarks(players: PlayerResult[], mode: GameMode): UmaMark[]` (80-104行目)

**アルゴリズム**:
```typescript
// 1. 見学者と未入力を除外し、点数で降順ソート
const playersWithIndex = players
  .map((p, idx) => ({ player: p, index: idx }))
  .filter(({ player }) => !player.isSpectator && player.score !== null)
  .sort((a, b) => (b.player.score ?? 0) - (a.player.score ?? 0))

// 2. ウママーク配列を初期化（全員空文字）
const umaMarks: UmaMark[] = players.map(() => '')

// 3. モード別にウママーク割り当て
if (mode === '4-player') {
  if (playersWithIndex.length >= 1) umaMarks[playersWithIndex[0].index] = '○○'
  if (playersWithIndex.length >= 2) umaMarks[playersWithIndex[1].index] = '○'
  if (playersWithIndex.length >= 3) umaMarks[playersWithIndex[2].index] = '✗'
  if (playersWithIndex.length >= 4) umaMarks[playersWithIndex[3].index] = '✗✗'
} else {
  if (playersWithIndex.length >= 1) umaMarks[playersWithIndex[0].index] = '○○'
  if (playersWithIndex.length >= 2) umaMarks[playersWithIndex[1].index] = '○'
  if (playersWithIndex.length >= 3) umaMarks[playersWithIndex[2].index] = '✗✗✗'
}

return umaMarks
```

**注意点**:
- 同点の場合のソート順はJavaScript標準（安定ソート保証なし）
- 見学者はウママーク空文字（計算に含まれない）

---

### 4.3 小計・収支計算

**関数**: `calculatePlayerTotals()` (153-186行目)

**詳細計算式**:

#### 点数合計・ウマポイント合計
```typescript
hanchans.forEach(hanchan => {
  const player = hanchan.players[playerIndex]
  if (!player.isSpectator && player.score !== null) {
    scoreTotal += player.score
    umaTotal += umaMarkToValue(player.umaMark)
  }
  chips = player.chips          // 最後の値を使用
  parlorFee = player.parlorFee  // 最後の値を使用
})
```

#### 小計
```typescript
subtotal = scoreTotal + (umaTotal × settings.umaValue)
```

**例**: scoreTotal = +20, umaTotal = 3, umaValue = 10
→ subtotal = 20 + (3 × 10) = 50

#### 収支
```typescript
payout = (subtotal × settings.rate) + (chips × settings.chipRate)
```

**例**: subtotal = 50, rate = 30, chips = 2, chipRate = 100
→ payout = (50 × 30) + (2 × 100) = 1500 + 200 = 1700

#### 最終収支
```typescript
finalPayout = payout - parlorFee
```

**例**: payout = 1700, parlorFee = 500
→ finalPayout = 1700 - 500 = 1200

---

## 5. 未実装機能

### 5.1 ウマルール選択

**現状**: 標準ルール（'standard'）のみハードコード

**必要な機能**:
1. **UI追加**: セッション設定にウマルール選択（Select）
2. **型定義追加**: `SessionSettings`に`umaRule: UmaRule`プロパティ
3. **ロジック改修**: `assignUmaMarks()`をウマルール対応

**想定されるウマルール**:

#### 4人打ち
- **標準ルール（'standard'）**: 1位○○、2位○、3位✗、4位✗✗
- **2位マイナスルール（'second-minus'）**: 1位○○○、2位✗、3位✗、4位✗✗

#### 3人打ち
- **標準ルール（'standard'）**: 1位○○、2位○、3位✗✗✗
- **2位マイナスルール（'second-minus'）**: 1位○○○、2位✗、3位✗✗✗

**影響範囲**:
- `SessionSettings`型（15-20行目）
- `assignUmaMarks()`関数（80-104行目）
- セッション設定UI（244-305行目）
- DB保存時の設定（未実装）

---

### 5.2 見学者機能

**現状**: `isSpectator`フラグは定義済みだが、UI未実装

**必要な機能**:
1. プレイヤーごとの見学者トグル
2. 見学者の点数・ウママークを計算から除外（既にロジックは対応済み）

---

### 5.3 DB保存

**現状**: すべてのデータはメモリ上（state）のみで管理

**必要な機能**:
1. セッション保存ボタン
2. `db-utils.ts`を使用したDB保存
3. 保存成功時の通知

---

## 6. 安全な機能追加のための推奨事項

### 6.1 ウマルール機能追加の手順

1. **型定義の拡張**（破壊的変更なし）
   ```typescript
   interface SessionSettings {
     date: string
     rate: number
     umaValue: number
     chipRate: number
     umaRule: UmaRule  // 追加（デフォルト: 'standard'）
   }
   ```

2. **UI追加**（既存UIに影響なし）
   - セッション設定カードにSelectコンポーネント追加

3. **ロジック改修**（既存ロジックの拡張）
   ```typescript
   const assignUmaMarks = (
     players: PlayerResult[],
     mode: GameMode,
     umaRule: UmaRule  // 引数追加
   ): UmaMark[] => {
     // 既存のソートロジックは維持
     // if文でumaRule分岐を追加
   }
   ```

4. **呼び出し箇所の修正**
   - `onBlur`内（384行目）でumaRule引数を渡す

### 6.2 テスト観点

- [ ] 4人打ち × 標準ルールで既存動作が変わらないこと
- [ ] 4人打ち × 2位マイナスルールで正しいウママークが割り当てられること
- [ ] 3人打ち × 標準ルールで既存動作が変わらないこと
- [ ] 3人打ち × 2位マイナスルールで正しいウママークが割り当てられること
- [ ] 手動変更したウママークが保護されること
- [ ] ゼロサム計算が正常に動作すること

### 6.3 注意事項

- **autoCalculated フラグを破壊しない**: ゼロサム自動計算の再計算防止に必須
- **umaMarkManual フラグを尊重する**: 手動変更の保護に必須
- **見学者フィルタリングを維持する**: `!player.isSpectator`条件を保持
- **state更新の不変性を保つ**: 必ず新しい配列/オブジェクトを作成（`[...hanchans]`等）

---

## 7. まとめ

### 7.1 現在の実装の優れた点

1. **明確な責任分離**: 計算ロジック、UI、データ管理が分離
2. **堅牢な自動計算**: `autoCalculated`フラグで再計算を防止
3. **手動変更の保護**: `umaMarkManual`フラグで意図的な変更を維持
4. **見学者対応の準備**: フィルタリングロジックが既に実装済み

### 7.2 機能追加の容易性

- **ウマルール追加**: `assignUmaMarks()`のif分岐追加で対応可能（破壊的変更なし）
- **DB保存**: 既存のデータ構造が`PlayerResult`型と一致（追加実装のみ）
- **見学者UI**: フラグが既に存在し、計算ロジックも対応済み（UI追加のみ）

### 7.3 ドキュメントの用途

このドキュメントは以下の用途で使用できます:
- ウマルール機能追加時の設計指針
- DB保存機能追加時の参考資料
- コードレビューのチェックリスト
- 新規開発者のオンボーディング資料

---

**最終更新**: 2025-10-03 16:50
