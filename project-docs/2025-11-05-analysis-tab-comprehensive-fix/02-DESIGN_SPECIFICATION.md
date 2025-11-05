# 分析タブ完全版設計仕様

**Date**: 2025-11-05 18:40
**Document Type**: Design Specification
**Priority**: Critical
**Related Documents**:
- `01-BUG_ANALYSIS.md` (問題分析)
- `03-IMPLEMENTATION_PLAN.md` (実装計画)
- `06-EDGE_CASE_ANALYSIS.md` (エッジケース調査)

---

## 📋 目次

1. [設計原則](#設計原則)
2. [エッジケースの正式定義](#エッジケースの正式定義)
3. [統計計算の完全仕様](#統計計算の完全仕様)
4. [データフローとアーキテクチャ](#データフローとアーキテクチャ)
5. [実装パターン](#実装パターン)
6. [パフォーマンス考慮事項](#パフォーマンス考慮事項)

---

## 設計原則

### 1. データ正確性の最優先

**原則**: ドメイン知識に基づく正確なデータ処理

**適用**:
- 麻雀で0点は正常なプレイ結果 → 集計対象
- `null`のみが真の未入力 → 除外対象
- 見学者は型定義上存在するが、現状のUIでは発生しない

### 2. ユーザー切り替えの完全対応

**原則**: `selectedUserId`による動的な統計計算

**適用**:
- すべての統計が`selectedUserId`に対応
- 依存配列に`selectedUserId`を含める
- 半荘単位での集計（session.summary非依存）

### 3. 一貫性のある実装

**原則**: 同種の統計は同じパターンで実装

**適用**:
- `pointStats`と同じパターンで`revenueStats`/`chipStats`を実装
- エッジケース判定を統一
- コメントの記述スタイルを統一

### 4. 将来の拡張性

**原則**: 現在使われていない機能でも、型定義が存在すれば判定を残す

**適用**:
- `isSpectator`判定は残す（将来の拡張に備えて）
- パフォーマンスへの影響は無視できる程度

---

## エッジケースの正式定義

### 1. 未入力（Null Score）

**定義**: `score === null`

**意味**: プレイヤーが点数を入力していない状態

**発生タイミング**:
- 半荘を追加したが、まだ点数を入力していない
- 入力途中でセッションを保存した場合

**処理**:
```typescript
// ✅ 正しい判定
if (playerResult.score === null) {
  continue  // 未入力として除外
}
```

**UIでの表示**: 半荘は表示されるが、統計からは除外

### 2. 0点（Zero Score）

**定義**: `score === 0`

**意味**: プレイヤーの収支が±0点（正常なプレイ結果）

**発生ケース**:
1. **30000点ちょうどで終了**
   ```
   開始: 30000点
   終了: 30000点
   収支: ±0点
   ```

2. **スコアとウマが相殺**
   ```
   スコア: +5000点
   ウマ: -5000点（✗マーク）
   合計: ±0点
   ```

3. **複数半荘で累積±0**
   ```
   半荘1: +10000点
   半荘2: -10000点
   合計: ±0点
   ```

**処理**:
```typescript
// ✅ 正しい判定（0点は通常処理）
if (playerResult.score === null) {
  continue  // 未入力のみ除外
}
// score === 0 はこの時点で処理対象
```

**統計への影響**:
- 半荘数にカウント: ✅ Yes
- 着順統計に含む: ✅ Yes
- 収支統計に含む: ✅ Yes（±0として）

### 3. 見学者（Spectator）

**定義**: `isSpectator === true`

**意味**: プレイに参加していない観戦者

**現状**: UIで設定する方法がない（常に`false`）

**型定義**:
```typescript
export interface PlayerResult {
  // ... 他のフィールド
  isSpectator: boolean;  // ✅ 型定義上は存在
}
```

**UI実装**:
```typescript
// ScoreInputTable.tsx: Line 100
{
  // ...
  isSpectator: false,  // ❌ 常にfalse、UIで変更不可
}
```

**処理**:
```typescript
// ✅ 判定は残す（将来の拡張に備えて）
if (playerResult.isSpectator) {
  continue  // 見学者として除外
}
```

**理由**:
- 型定義が存在する → 将来的に機能追加の可能性
- 判定コストは無視できる（if文1つ）
- コードの明示性が向上

### 4. 組み合わせ条件

**除外対象の完全な定義**:
```typescript
// ✅ 正しい除外条件（エッジケース全体）
if (playerResult.isSpectator || playerResult.score === null) {
  continue  // 見学者 OR 未入力のみ除外
}
// score === 0 は含まれない（正常データ）
```

**フローチャート**:
```
PlayerResult
  ↓
isSpectator === true?
  Yes → 除外（見学者）
  No ↓
score === null?
  Yes → 除外（未入力）
  No ↓
score === 0?
  → 処理対象（正常データ）
score !== 0?
  → 処理対象（正常データ）
```

### エッジケース判定マトリックス

| 条件 | isSpectator | score | 扱い | 理由 |
|------|-------------|-------|------|------|
| **見学者** | `true` | `null` or `number` | ❌ 除外 | プレイに参加していない |
| **未入力** | `false` | `null` | ❌ 除外 | 点数が入力されていない |
| **±0点** | `false` | `0` | ✅ 含む | 正常なプレイ結果 |
| **プラス** | `false` | `> 0` | ✅ 含む | 正常なプレイ結果 |
| **マイナス** | `false` | `< 0` | ✅ 含む | 正常なプレイ結果 |

---

## 統計計算の完全仕様

### 1. revenueStats（収支統計）

#### 目的
選択されたユーザー（`selectedUserId`）の収支統計を計算

#### データソース
- **半荘単位**: `filteredSessions` → `hanchans` → `players`
- **セッション設定**: `session.rate`, `session.umaValue`, `session.chipRate`

#### 計算ロジック

**Phase 1: 各半荘のスコア収支を計算**
```typescript
// 各半荘で以下を計算:
// 1. score + umaPoints * umaValue = 小計
// 2. 小計 * rate = scorePayout
// 3. scorePayoutをプラス/マイナスに振り分け

filteredSessions.forEach(({ session, hanchans }) => {
  if (hanchans) {
    hanchans.forEach(hanchan => {
      const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)

      // エッジケース除外（見学者・未入力）
      if (!userResult || userResult.isSpectator || userResult.score === null) {
        return  // ✅ 0点は含まれる
      }

      // 小計計算（score + umaPoints * umaValue）
      const umaPoints = umaMarkToValue(userResult.umaMark)
      const subtotal = userResult.score + umaPoints * session.umaValue

      // レート適用
      const scorePayout = subtotal * session.rate

      // プラス/マイナス振り分け
      if (scorePayout >= 0) {
        totalIncome += scorePayout
      } else {
        totalExpense += scorePayout
      }
    })
  }
})
```

**Phase 2: チップと場代を加算（セッション単位で1回のみ）**
```typescript
// 各セッションでchips/parlorFeeを1回のみカウント

let sessionChips = 0
let sessionParlorFee = 0
let chipsInitialized = false

filteredSessions.forEach(({ session, hanchans }) => {
  chipsInitialized = false  // セッション開始時にリセット

  if (hanchans) {
    // 最初の有効半荘からchips/parlorFeeを取得
    for (const hanchan of hanchans) {
      const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)

      if (userResult && !userResult.isSpectator && userResult.score !== null) {
        if (!chipsInitialized) {
          sessionChips = userResult.chips || 0
          sessionParlorFee = userResult.parlorFee || 0
          chipsInitialized = true
          break  // 1回のみ
        }
      }
    }
  }

  // セッション終了時にchips/parlorFeeを加算
  if (chipsInitialized) {
    const chipsPayout = sessionChips * session.chipRate - sessionParlorFee

    if (chipsPayout >= 0) {
      totalIncome += chipsPayout
    } else {
      totalExpense += chipsPayout
    }
  }
})
```

#### 出力
```typescript
interface RevenueStats {
  totalIncome: number      // プラスの収支合計
  totalExpense: number     // マイナスの収支合計
  totalParlorFee: number   // 場代合計（表示用）
  totalBalance: number     // 総収支（totalIncome + totalExpense）
}
```

#### 依存配列
```typescript
useMemo(..., [filteredSessions, selectedUserId])
```

### 2. chipStats（チップ統計）

#### 目的
選択されたユーザー（`selectedUserId`）のチップ統計を計算

#### データソース
- **半荘単位**: `filteredSessions` → `hanchans` → `players`
- **チップ値**: `playerResult.chips`

#### 計算ロジック

**セッション単位でチップを集計（1回のみカウント）**
```typescript
let plusChips = 0
let minusChips = 0

filteredSessions.forEach(({ hanchans }) => {
  if (hanchans && hanchans.length > 0) {
    let sessionChips = 0
    let chipsFound = false

    // 最初の有効半荘からチップを取得（1回のみ）
    for (const hanchan of hanchans) {
      const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)

      // エッジケース除外
      if (userResult && !userResult.isSpectator && userResult.score !== null) {
        sessionChips = userResult.chips || 0
        chipsFound = true
        break  // 1回のみ
      }
    }

    // セッション単位で振り分け
    if (chipsFound) {
      if (sessionChips >= 0) {
        plusChips += sessionChips
      } else {
        minusChips += sessionChips
      }
    }
  }
})
```

#### 出力
```typescript
interface ChipStats {
  plusChips: number     // プラスチップ合計
  minusChips: number    // マイナスチップ合計
  chipBalance: number   // チップ収支（plusChips + minusChips）
}
```

#### 依存配列
```typescript
useMemo(..., [filteredSessions, selectedUserId])
```

### 3. pointStats（スコア統計）

#### 現状
✅ 既にselectedUserId対応済み

#### 修正必要箇所
```typescript
// ❌ 現在（Line 135）
if (userResult && !userResult.isSpectator && userResult.score !== null && userResult.score !== 0) {

// ✅ 修正後
if (userResult && !userResult.isSpectator && userResult.score !== null) {
```

#### その他
変更なし（既に正しい実装）

### 4. rankStats（着順統計）

#### 現状
✅ 既にselectedUserId対応済み（`calculateRankStatistics`内部で処理）

#### 確認事項
`calculateRankStatistics`内部でエッジケース判定が正しいか確認

**db-utils.ts: calculateRankStatistics**
```typescript
// ✅ 確認済み: 正しい実装（既存コード）
export function calculateRankStatistics(
  hanchans: Array<{ players: PlayerResult[] }>,
  userId: string,
  mode: GameMode
): RankStatistics {
  // ... 実装
}
```

---

## データフローとアーキテクチャ

### 全体フロー

```
User Interaction
  ↓
フィルター変更（selectedUserId, selectedPeriod, selectedMode）
  ↓
useSessions(mainUser.id, { includeHanchans: true })
  ↓
sessions（全セッションデータ）
  ↓
filteredSessions = useMemo(() => {
  期間フィルター → モードフィルター → ユーザー参加フィルター
}, [sessions, selectedPeriod, selectedMode, selectedUserId])
  ↓
各統計計算（useMemo）
  ├─ revenueStats(filteredSessions, selectedUserId)
  ├─ chipStats(filteredSessions, selectedUserId)
  ├─ pointStats(filteredSessions, selectedUserId)
  └─ rankStats(hanchans, selectedUserId, selectedMode)
  ↓
UI表示
```

### データ依存関係

#### Level 1: データ取得
```typescript
const { sessions, loading, error } = useSessions(mainUser?.id || '', { includeHanchans: true })
```

**データ構造**:
```typescript
sessions: Array<{
  session: Session & { summary?: SessionSummary }
  hanchans?: Array<{
    hanchanNumber: number
    players: PlayerResult[]
  }>
}>
```

#### Level 2: フィルタリング
```typescript
const filteredSessions = useMemo(() => {
  let filtered = sessions
  filtered = filterSessionsByPeriod(filtered, selectedPeriod)
  filtered = filterSessionsByMode(filtered, selectedMode)

  // ユーザー参加フィルター
  filtered = filtered.filter(({ hanchans }) => {
    if (!hanchans) return false
    return hanchans.some(hanchan =>
      hanchan.players.some(p =>
        p.userId === selectedUserId && !p.isSpectator
      )
    )
  })

  return filtered
}, [sessions, selectedPeriod, selectedMode, selectedUserId])
```

**依存**:
- `sessions`: Level 1のデータ
- `selectedPeriod`, `selectedMode`, `selectedUserId`: フィルターState

#### Level 3: 統計計算
```typescript
const revenueStats = useMemo(() => {
  // 半荘単位でselectedUserIdの収支を計算
}, [filteredSessions, selectedUserId])

const chipStats = useMemo(() => {
  // セッション単位でselectedUserIdのチップを集計
}, [filteredSessions, selectedUserId])

const pointStats = useMemo(() => {
  // 半荘単位でselectedUserIdのスコアを計算
}, [filteredSessions, selectedUserId])

const rankStats = useMemo(() => {
  // 半荘単位でselectedUserIdの着順を計算
}, [hanchans, selectedUserId, selectedMode])
```

**依存**:
- `filteredSessions`: Level 2のフィルター済みデータ
- `selectedUserId`: 統計対象ユーザー

#### Level 4: UI表示
```tsx
<Card>
  {revenueStats && <RevenueDisplay stats={revenueStats} />}
  {chipStats && <ChipDisplay stats={chipStats} />}
  {pointStats && <PointDisplay stats={pointStats} />}
  {rankStats && <RankDisplay stats={rankStats} />}
</Card>
```

### session.summaryとの関係

#### session.summaryの役割

**保存時に事前計算**:
```typescript
// session-utils.ts: saveSessionWithSummary
const summary = await calculateSessionSummary(sessionId, mainUserId)
await db.sessions.update(sessionId, { summary })
```

**特徴**:
- mainUser専用（mainUserIdで計算）
- パフォーマンス最適化（保存時に1回のみ計算）
- 履歴タブで使用（セッション一覧表示）

#### 分析タブでの使用方針

**使用しない理由**:
1. mainUser専用（selectedUserId切り替えに対応できない）
2. 再計算が必要（半荘単位での集計）

**代替手段**:
- 半荘単位での動的計算
- useMemoでキャッシュ
- パフォーマンスへの影響は軽微（通常100半荘以下）

---

## 実装パターン

### パターン1: エッジケース判定（標準）

**用途**: 集計対象の判定

**実装**:
```typescript
// ✅ 標準パターン
if (playerResult.isSpectator || playerResult.score === null) {
  continue  // 見学者 OR 未入力を除外
}
// score === 0 は通常処理
```

**使用箇所**:
- session-utils.ts: Line 142, 203
- InputTab.tsx: Line 260
- AnalysisTab.tsx: Line 135, revenueStats, chipStats

### パターン2: セッション単位の1回のみカウント

**用途**: chips/parlorFeeの集計

**実装**:
```typescript
// ✅ chips/parlorFeeパターン
filteredSessions.forEach(({ session, hanchans }) => {
  let sessionChips = 0
  let sessionParlorFee = 0
  let chipsInitialized = false

  if (hanchans) {
    // 最初の有効半荘からchips/parlorFeeを取得
    for (const hanchan of hanchans) {
      const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)

      if (userResult && !userResult.isSpectator && userResult.score !== null) {
        if (!chipsInitialized) {
          sessionChips = userResult.chips || 0
          sessionParlorFee = userResult.parlorFee || 0
          chipsInitialized = true
          break  // ✅ 1回のみ
        }
      }
    }
  }

  // セッション終了時に処理
  if (chipsInitialized) {
    // chips/parlorFeeを使用した計算
  }
})
```

**使用箇所**:
- session-utils.ts: calculateSessionSummary
- AnalysisTab.tsx: revenueStats, chipStats

### パターン3: 半荘単位の集計

**用途**: score/umaMarksの集計

**実装**:
```typescript
// ✅ 半荘単位パターン
filteredSessions.forEach(({ session, hanchans }) => {
  if (hanchans) {
    hanchans.forEach(hanchan => {
      const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)

      // エッジケース除外
      if (!userResult || userResult.isSpectator || userResult.score === null) {
        return
      }

      // 半荘単位での計算
      const umaPoints = umaMarkToValue(userResult.umaMark)
      const subtotal = userResult.score + umaPoints * session.umaValue
      // ... 集計処理
    })
  }
})
```

**使用箇所**:
- AnalysisTab.tsx: revenueStats, pointStats

### パターン4: プラス/マイナス振り分け

**用途**: 収支・チップの統計

**実装**:
```typescript
// ✅ プラス/マイナスパターン
let plusValue = 0
let minusValue = 0

// ... 各値を計算

if (value >= 0) {
  plusValue += value
} else {
  minusValue += value  // 負の値として加算
}

return {
  plusValue,
  minusValue,
  balance: plusValue + minusValue
}
```

**使用箇所**:
- AnalysisTab.tsx: revenueStats, pointStats, chipStats

---

## パフォーマンス考慮事項

### 計算量分析

#### 現在の実装（session.summary使用）

**時間計算量**: O(N)
- N: フィルター済みセッション数
- 各セッションでsession.summaryを参照（O(1)）

**例**:
```
100セッション × O(1) = 100回のアクセス
```

#### 新実装（半荘単位集計）

**時間計算量**: O(N × H × P)
- N: フィルター済みセッション数
- H: 平均半荘数（通常3-6）
- P: プレイヤー数（3 or 4）

**例**:
```
100セッション × 5半荘 × 4プレイヤー = 2000回のループ
```

### パフォーマンスへの影響

#### 実測値想定

**前提**:
- セッション数: 100
- 平均半荘数: 5
- プレイヤー数: 4

**計算回数**:
- 旧: 100回
- 新: 2000回（20倍）

**実行時間想定**:
- 旧: ~1ms
- 新: ~20ms（useMemoでキャッシュ）

**結論**: 体感できるレベルの遅延ではない（50ms以下は人間には認識不可能）

### useMemoによる最適化

#### キャッシュ戦略

**依存配列**:
```typescript
useMemo(() => {
  // 計算処理
}, [filteredSessions, selectedUserId])
```

**再計算タイミング**:
- `filteredSessions`が変わった時（フィルター変更）
- `selectedUserId`が変わった時（ユーザー切り替え）

**キャッシュヒット率**:
- フィルター変更なし + ユーザー切り替えなし → 100%
- フィルター変更 or ユーザー切り替え → 再計算（意図通り）

### 将来の最適化可能性

#### オプション1: Worker Thread
**時期**: セッション数が1000を超えた場合
**方法**: Web Workerで統計計算をバックグラウンド実行

#### オプション2: Incremental Calculation
**時期**: リアルタイム更新が必要になった場合
**方法**: 差分計算（新しいセッションのみ追加計算）

#### オプション3: Server-Side Calculation
**時期**: バックエンドAPI導入時
**方法**: サーバー側で統計計算、APIで取得

**現時点**: 不要（パフォーマンスは十分）

---

## まとめ

### 設計の要点

1. **エッジケース定義の明確化**
   - `null` = 未入力（除外）
   - `0` = 正常データ（含む）
   - `isSpectator` = 将来用（判定は残す）

2. **selectedUserId完全対応**
   - すべての統計が動的計算
   - 依存配列に`selectedUserId`を含める
   - 一貫性のある実装パターン

3. **パフォーマンスとのバランス**
   - useMemoでキャッシュ
   - 実行時間は体感できないレベル
   - 将来の最適化余地も確保

### 実装の整合性

| 統計 | selectedUserId対応 | エッジケース判定 | chips/parlorFee |
|------|-------------------|-----------------|----------------|
| **revenueStats** | ✅ Phase 2で対応 | ✅ Phase 1で修正 | ✅ セッション1回 |
| **chipStats** | ✅ Phase 2で対応 | ✅ Phase 1で修正 | ✅ セッション1回 |
| **pointStats** | ✅ 既に対応済み | ✅ Phase 1で修正 | N/A |
| **rankStats** | ✅ 既に対応済み | ✅ 確認済み（正しい） | N/A |

### 次のステップ

1. **03-IMPLEMENTATION_PLAN.md**: 修正箇所の完全なリストと実装コード
2. **04-TEST_STRATEGY.md**: テスト計画とテストケース
3. **05-MIGRATION_GUIDE.md**: デプロイ計画とリスク評価

---

**Document Version**: 1.0
**Last Updated**: 2025-11-05 18:40
**Status**: Ready for Implementation Planning
