# 実装計画

**Date**: 2025-11-05 18:40
**Document Type**: Implementation Plan
**Priority**: Critical
**Related Documents**:
- `01-BUG_ANALYSIS.md` (問題分析)
- `02-DESIGN_SPECIFICATION.md` (設計仕様)
- `04-TEST_STRATEGY.md` (テスト計画)

---

## 📋 目次

1. [実装フェーズ概要](#実装フェーズ概要)
2. [Phase 1: エッジケース修正](#phase-1-エッジケース修正)
3. [Phase 2: selectedUserId対応](#phase-2-selecteduserid対応)
4. [実装チェックリスト](#実装チェックリスト)
5. [検証手順](#検証手順)

---

## 実装フェーズ概要

### Phase 1: エッジケース修正

**優先度**: 🔴 Critical（Phase 2より優先）

**目的**: 0点（score === 0）を未入力として扱う誤りを修正

**修正箇所**: 6箇所
1. session-utils.ts: Line 142
2. session-utils.ts: Line 203
3. InputTab.tsx: Line 260
4. AnalysisTab.tsx: Line 135
5. **analysis.ts: Line 130** ⚠️ 外部AIレビューで発見
6. **analysis.ts: Line 142** ⚠️ 外部AIレビューで発見

**実装時間**: 8-15分

**リスク**: 極めて低い（条件分岐1つの削除）

**注意**: analysis.ts: Line 225も同様のバグパターンだが、`calculatePointStatistics`は未使用関数のため低優先度（オプション修正）

### Phase 2: selectedUserId対応

**優先度**: 🔴 Critical（Phase 1完了後）

**目的**: revenueStats/chipStatsをselectedUserIdベースの計算に書き換え

**修正箇所**: 2箇所
1. AnalysisTab.tsx: revenueStats (Line 93-122)
2. AnalysisTab.tsx: chipStats (Line 158-182)

**実装時間**: 30-45分

**リスク**: 中程度（統計計算ロジックの完全書き換え）

---

## Phase 1: エッジケース修正

### 修正1: session-utils.ts: Line 142

#### ファイル
`/Users/nishimototakashi/claude_code/mj_app/app/src/lib/session-utils.ts`

#### 現在のコード（Line 139-144）
```typescript
    if (mainUserResult) {
      // 点数が入力されていない半荘はスキップ（未入力の半荘は集計対象外）
      // 防御的プログラミング: null or 0 の両方をスキップ
      if (mainUserResult.score === null || mainUserResult.score === 0) {
        continue
      }
```

#### 修正後のコード
```typescript
    if (mainUserResult) {
      // 未入力の半荘はスキップ（score === null）
      // 注意: score === 0 は正常なプレイ結果（±0点）として集計対象
      if (mainUserResult.score === null) {
        continue
      }
```

#### 修正内容
1. **Line 140-141**: コメント修正
   - 削除: "防御的プログラミング: null or 0 の両方をスキップ"
   - 追加: "注意: score === 0 は正常なプレイ結果（±0点）として集計対象"

2. **Line 142**: 条件式修正
   - 削除: `|| mainUserResult.score === 0`
   - 結果: `if (mainUserResult.score === null)`

#### 影響範囲
- `SessionSummary.hanchanCount`: 0点半荘もカウントされる
- `SessionSummary.rankCounts`: 0点半荘の着順も含まれる
- `SessionSummary.averageRank`: 計算が正確になる
- `SessionSummary.totalPayout`: 0点半荘の収支も含まれる

---

### 修正2: session-utils.ts: Line 203

#### ファイル
`/Users/nishimototakashi/claude_code/mj_app/app/src/lib/session-utils.ts`

#### 現在のコード（Line 200-205）
```typescript
  // 全プレイヤーの総収支を計算
  for (const hanchan of hanchans) {
    for (const player of hanchan.players) {
      // 見学者を除外、点数未入力もスキップ
      if (player.isSpectator || player.score === null || player.score === 0) {
        continue
      }
```

#### 修正後のコード
```typescript
  // 全プレイヤーの総収支を計算
  for (const hanchan of hanchans) {
    for (const player of hanchan.players) {
      // 見学者・未入力を除外（score === 0 は集計対象）
      if (player.isSpectator || player.score === null) {
        continue
      }
```

#### 修正内容
1. **Line 202**: コメント修正
   - 修正: "見学者・未入力を除外（score === 0 は集計対象）"

2. **Line 203**: 条件式修正
   - 削除: `|| player.score === 0`
   - 結果: `if (player.isSpectator || player.score === null)`

#### 影響範囲
- `SessionSummary.overallRank`: 0点プレイヤーも順位計算に含まれる
- 総合順位の正確性が向上

---

### 修正3: InputTab.tsx: Line 260

#### ファイル
`/Users/nishimototakashi/claude_code/mj_app/app/src/components/tabs/InputTab.tsx`

#### 現在のコード（Line 257-262）
```typescript
      // 空ハンチャン判定関数（ローカルヘルパー）
      const isEmptyHanchan = (h: Hanchan): boolean => {
        return h.players.every(p =>
          p.isSpectator || p.score === null || p.score === 0
        )
      }
```

#### 修正後のコード
```typescript
      // 空ハンチャン判定関数（ローカルヘルパー）
      // 注意: score === 0 は正常データとして扱う（全員±0点は有効な半荘）
      const isEmptyHanchan = (h: Hanchan): boolean => {
        return h.players.every(p =>
          p.isSpectator || p.score === null
        )
      }
```

#### 修正内容
1. **Line 258**: コメント追加
   - 追加: "注意: score === 0 は正常データとして扱う（全員±0点は有効な半荘）"

2. **Line 260**: 条件式修正
   - 削除: `|| p.score === 0`
   - 結果: `p.isSpectator || p.score === null`

#### 影響範囲
- 保存前フィルタリング: 全員0点の半荘も保存される
- データの完全性が向上

---

### 修正4: AnalysisTab.tsx: Line 135

#### ファイル
`/Users/nishimototakashi/claude_code/mj_app/app/src/components/tabs/AnalysisTab.tsx`

#### 現在のコード（Line 131-147）
```typescript
    // 各セッションの各半荘からselectedUserIdのポイント（小計）を計算
    filteredSessions.forEach(({ session, hanchans }) => {
      if (hanchans) {
        hanchans.forEach(hanchan => {
          const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
          if (userResult && !userResult.isSpectator && userResult.score !== null && userResult.score !== 0) {
            // 小計 = score + umaPoints * umaValue
            const umaPoints = umaMarkToValue(userResult.umaMark)
            const subtotal = userResult.score + umaPoints * session.umaValue

            // プラス/マイナスに振り分け
            if (subtotal > 0) {
              plusPoints += subtotal
            } else {
              minusPoints += subtotal  // 負の値
            }
          }
        })
      }
    })
```

#### 修正後のコード
```typescript
    // 各セッションの各半荘からselectedUserIdのポイント（小計）を計算
    filteredSessions.forEach(({ session, hanchans }) => {
      if (hanchans) {
        hanchans.forEach(hanchan => {
          const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
          // 見学者・未入力を除外（score === 0 は集計対象）
          if (userResult && !userResult.isSpectator && userResult.score !== null) {
            // 小計 = score + umaPoints * umaValue
            const umaPoints = umaMarkToValue(userResult.umaMark)
            const subtotal = userResult.score + umaPoints * session.umaValue

            // プラス/マイナスに振り分け
            if (subtotal > 0) {
              plusPoints += subtotal
            } else {
              minusPoints += subtotal  // 負の値
            }
          }
        })
      }
    })
```

#### 修正内容
1. **Line 135-136**: コメント追加と条件式修正
   - 追加: "見学者・未入力を除外（score === 0 は集計対象）"
   - 削除: `&& userResult.score !== 0`
   - 結果: `if (userResult && !userResult.isSpectator && userResult.score !== null)`

#### 影響範囲
- `pointStats`: 0点半荘もスコア統計に含まれる
- plusPoints/minusPoints/pointBalanceの正確性が向上

---

### 修正5: analysis.ts: Line 130

#### ファイル
`/Users/nishimototakashi/claude_code/mj_app/app/src/lib/db/analysis.ts`

#### 現在のコード（Line 126-131）
```typescript
    // 空半荘（全プレイヤーが未入力または見学者）をスキップ
    const hasValidScores = hanchan.players.some(p =>
      !p.isSpectator && p.score !== null && p.score !== 0
    )
    if (!hasValidScores) continue
```

#### 修正後のコード
```typescript
    // 空半荘（全プレイヤーが未入力または見学者）をスキップ
    // 注意: score === 0 は正常なプレイ結果として扱う
    const hasValidScores = hanchan.players.some(p =>
      !p.isSpectator && p.score !== null
    )
    if (!hasValidScores) continue
```

#### 修正内容
1. **Line 127**: コメント追加
   - 追加: "注意: score === 0 は正常なプレイ結果として扱う"

2. **Line 129**: 条件式修正
   - 削除: `&& p.score !== 0`
   - 結果: `!p.isSpectator && p.score !== null`

#### 影響範囲
- `calculateRankStatistics`: AnalysisTab.tsx:90で使用（Production）
- 全員0点の半荘が「空半荘」として除外されない
- 着順統計（rankStats）の半荘数カウントが正確になる

---

### 修正6: analysis.ts: Line 142

#### ファイル
`/Users/nishimototakashi/claude_code/mj_app/app/src/lib/db/analysis.ts`

#### 現在のコード（Line 138-145）
```typescript
    for (const hanchan of hanchans) {
      const targetPlayer = hanchan.players.find(p => p.userId === userId)

      // 対象プレイヤーが存在しない、または見学者、または未入力の場合はスキップ
      if (!targetPlayer || targetPlayer.isSpectator || targetPlayer.score === null || targetPlayer.score === 0) {
        continue
      }
```

#### 修正後のコード
```typescript
    for (const hanchan of hanchans) {
      const targetPlayer = hanchan.players.find(p => p.userId === userId)

      // 対象プレイヤーが存在しない、または見学者、または未入力の場合はスキップ
      // 注意: score === 0 は正常なプレイ結果として扱う
      if (!targetPlayer || targetPlayer.isSpectator || targetPlayer.score === null) {
        continue
      }
```

#### 修正内容
1. **Line 141-142**: コメント修正
   - 追加: "注意: score === 0 は正常なプレイ結果として扱う"

2. **Line 143**: 条件式修正
   - 削除: `|| targetPlayer.score === 0`
   - 結果: `if (!targetPlayer || targetPlayer.isSpectator || targetPlayer.score === null)`

#### 影響範囲
- `calculateRankStatistics`: AnalysisTab.tsx:90で使用（Production）
- selectedUserIdが0点の半荘も着順統計に含まれる
- 平均着順の計算が正確になる

---

### 修正7（オプション）: analysis.ts: Line 225

#### ファイル
`/Users/nishimototakashi/claude_code/mj_app/app/src/lib/db/analysis.ts`

#### 状況
- **関数**: `calculatePointStatistics`
- **使用状況**: どこからも呼ばれていない（未使用関数）
- **バグパターン**: 修正1-6と同一（`&& pr.score !== 0`）

#### 現在のコード（Line 225）
```typescript
    const activeResults = playerResults.filter(pr =>
      !pr.isSpectator && pr.score !== null && pr.score !== 0
    )
```

#### 修正後のコード
```typescript
    const activeResults = playerResults.filter(pr =>
      !pr.isSpectator && pr.score !== null
    )
```

#### 判断
- **Priority**: Low（将来的なバグ予防）
- **推奨**: Phase 1で一緒に修正（追加コスト+2分）
- **影響**: 現時点で影響なし（未使用関数）

---

## Phase 2: selectedUserId対応

### 修正8: AnalysisTab.tsx: revenueStats (Line 93-122)

#### ファイル
`/Users/nishimototakashi/claude_code/mj_app/app/src/components/tabs/AnalysisTab.tsx`

#### 現在のコード（Line 93-122）
```typescript
  const revenueStats = useMemo(() => {
    if (filteredSessions.length === 0) return null

    let totalIncome = 0
    let totalExpense = 0
    let totalParlorFee = 0

    // ✅ セッション単位で収支を集計（session.summary使用）
    filteredSessions.forEach(({ session }) => {
      if (session.summary) {
        // ✅ session.summaryから全て取得（一貫性）
        const totalPayout = session.summary.totalPayout
        totalParlorFee += session.summary.totalParlorFee

        // ✅ セッション単位で収入/支出を振り分け（設計的に正しい）
        if (totalPayout >= 0) {
          totalIncome += totalPayout
        } else {
          totalExpense += totalPayout
        }
      }
    })

    return {
      totalIncome,
      totalExpense,
      totalParlorFee,  // ✅ UI表示用に保持（4行構造維持）
      totalBalance: totalIncome + totalExpense  // totalPayoutには既にparlorFee含まれるため再度引かない
    }
  }, [filteredSessions])
```

#### 修正後のコード（完全版）
```typescript
  const revenueStats = useMemo(() => {
    if (filteredSessions.length === 0) return null

    let totalIncome = 0
    let totalExpense = 0
    let accumulatedParlorFee = 0  // 全セッションの場代合計

    // セッション単位で収支を集計（selectedUserIdベース）
    filteredSessions.forEach(({ session, hanchans }) => {
      let sessionChips = 0
      let sessionParlorFee = 0
      let chipsInitialized = false

      if (hanchans) {
        // Phase 1: 各半荘のスコア収支を計算
        hanchans.forEach(hanchan => {
          const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)

          // 見学者・未入力を除外（score === 0 は集計対象）
          if (!userResult || userResult.isSpectator || userResult.score === null) {
            return
          }

          // chips/parlorFeeはセッションで1回のみ取得
          if (!chipsInitialized) {
            sessionChips = userResult.chips || 0
            sessionParlorFee = userResult.parlorFee || 0
            chipsInitialized = true
            accumulatedParlorFee += sessionParlorFee  // 場代を累積
          }

          // 小計（score + umaPoints * umaValue）
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

        // Phase 2: セッション終了時にchips/parlorFeeを加算
        if (chipsInitialized) {
          const chipsPayout = sessionChips * session.chipRate - sessionParlorFee

          if (chipsPayout >= 0) {
            totalIncome += chipsPayout
          } else {
            totalExpense += chipsPayout
          }
        }
      }
    })

    return {
      totalIncome,
      totalExpense,
      totalParlorFee: accumulatedParlorFee,  // UI表示用
      totalBalance: totalIncome + totalExpense
    }
  }, [filteredSessions, selectedUserId])  // ✅ selectedUserIdを依存配列に追加
```

#### 修正内容

**主要変更**:
1. **session.summary依存を削除**: 半荘単位での動的計算に変更
2. **selectedUserIdベースの集計**: mainUserに限定されない
3. **依存配列追加**: `selectedUserId`を追加

**詳細変更**:
1. **Line 93-94**: 変数初期化
   - 追加: `accumulatedParlorFee`（全セッションの場代合計）

2. **Line 96-133**: セッション単位ループ
   - 追加: chips/parlorFee管理変数（sessionChips, sessionParlorFee, chipsInitialized）
   - 追加: Phase 1（半荘スコア集計）
   - 追加: Phase 2（chips/parlorFee加算）

3. **Line 135-140**: return文
   - 変更: `totalParlorFee: accumulatedParlorFee`

4. **Line 141**: 依存配列
   - 追加: `selectedUserId`

#### 影響範囲
- `revenueStats`: selectedUserIdに応じた統計表示
- ユーザー切り替え時の動的更新

---

### 修正9: AnalysisTab.tsx: chipStats (Line 158-182)

#### ファイル
`/Users/nishimototakashi/claude_code/mj_app/app/src/components/tabs/AnalysisTab.tsx`

#### 現在のコード（Line 158-182）
```typescript
  const chipStats = useMemo(() => {
    if (filteredSessions.length === 0) return null

    let plusChips = 0
    let minusChips = 0

    // ✅ セッション単位でチップを集計（session.summary使用）
    filteredSessions.forEach(({ session }) => {
      if (session.summary) {
        const chips = session.summary.totalChips

        if (chips >= 0) {
          plusChips += chips
        } else {
          minusChips += chips
        }
      }
    })

    return {
      plusChips,
      minusChips,
      chipBalance: plusChips + minusChips
    }
  }, [filteredSessions])
```

#### 修正後のコード（完全版）
```typescript
  const chipStats = useMemo(() => {
    if (filteredSessions.length === 0) return null

    let plusChips = 0
    let minusChips = 0

    // セッション単位でチップを集計（selectedUserIdベース）
    filteredSessions.forEach(({ hanchans }) => {
      if (hanchans && hanchans.length > 0) {
        let sessionChips = 0
        let chipsFound = false

        // 最初の有効半荘からチップを取得（1回のみ）
        for (const hanchan of hanchans) {
          const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)

          // 見学者・未入力を除外（score === 0 は集計対象）
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

    return {
      plusChips,
      minusChips,
      chipBalance: plusChips + minusChips
    }
  }, [filteredSessions, selectedUserId])  // ✅ selectedUserIdを依存配列に追加
```

#### 修正内容

**主要変更**:
1. **session.summary依存を削除**: 半荘単位での動的計算に変更
2. **selectedUserIdベースの集計**: mainUserに限定されない
3. **依存配列追加**: `selectedUserId`を追加

**詳細変更**:
1. **Line 165-191**: セッション単位ループ
   - 変更: `({ session })`→`({ hanchans })`
   - 削除: `session.summary`依存
   - 追加: 最初の有効半荘からチップ取得ロジック
   - 追加: エッジケース判定（見学者・未入力除外）

2. **Line 197**: 依存配列
   - 追加: `selectedUserId`

#### 影響範囲
- `chipStats`: selectedUserIdに応じた統計表示
- ユーザー切り替え時の動的更新

---

## 実装チェックリスト

### Phase 1: エッジケース修正

#### session-utils.ts

- [ ] **Line 140-144**: メインユーザー半荘スキップ判定修正
  - [ ] コメント修正（防御的プログラミング削除）
  - [ ] 条件式から`|| mainUserResult.score === 0`削除
  - [ ] 新しいコメント追加（±0点は正常データ）

- [ ] **Line 200-205**: 全プレイヤー総収支計算修正
  - [ ] コメント修正
  - [ ] 条件式から`|| player.score === 0`削除

#### InputTab.tsx

- [ ] **Line 257-262**: 空ハンチャン判定修正
  - [ ] コメント追加（±0点は有効な半荘）
  - [ ] 条件式から`|| p.score === 0`削除

#### AnalysisTab.tsx

- [ ] **Line 135-136**: pointStats条件修正
  - [ ] コメント追加（見学者・未入力除外）
  - [ ] 条件式から`&& userResult.score !== 0`削除

#### analysis.ts ⚠️ 外部AIレビューで発見

- [ ] **Line 126-131**: 空半荘判定修正
  - [ ] コメント追加（±0点は正常データ）
  - [ ] 条件式から`&& p.score !== 0`削除

- [ ] **Line 138-145**: 対象プレイヤー判定修正
  - [ ] コメント追加（±0点は正常データ）
  - [ ] 条件式から`|| targetPlayer.score === 0`削除

- [ ] **Line 225（オプション）**: pointStatistics判定修正
  - [ ] 条件式から`&& pr.score !== 0`削除
  - [ ] 将来的なバグ予防（未使用関数）

### Phase 2: selectedUserId対応

#### AnalysisTab.tsx

- [ ] **Line 93-122**: revenueStats完全書き換え
  - [ ] session.summary依存を削除
  - [ ] selectedUserIdベースの半荘単位集計に変更
  - [ ] chips/parlorFee 1回のみカウントロジック実装
  - [ ] エッジケース判定追加
  - [ ] 依存配列に`selectedUserId`追加
  - [ ] umaMarkToValueインポート確認（既存）

- [ ] **Line 158-182**: chipStats完全書き換え
  - [ ] session.summary依存を削除
  - [ ] selectedUserIdベースのセッション単位集計に変更
  - [ ] 最初の有効半荘からチップ取得ロジック実装
  - [ ] エッジケース判定追加
  - [ ] 依存配列に`selectedUserId`追加

### テスト

- [ ] **Phase 1完了後のテスト**
  - [ ] 0点半荘が統計に含まれるか確認
  - [ ] 履歴タブの半荘数が正しいか確認
  - [ ] 総合順位が正しいか確認
  - [ ] 平均着順が正しいか確認

- [ ] **Phase 2完了後のテスト**
  - [ ] ユーザー切り替えでrevenueStatsが更新されるか確認
  - [ ] ユーザー切り替えでchipStatsが更新されるか確認
  - [ ] mainUserとregistered userで統計が異なるか確認
  - [ ] 統計値がpointStatsと整合するか確認

### コードレビュー

- [ ] **Phase 1**
  - [ ] エッジケース判定が統一されているか
  - [ ] コメントが正確か
  - [ ] 修正箇所が4箇所すべてか

- [ ] **Phase 2**
  - [ ] revenueStats/chipStatsの実装がpointStatsと一貫しているか
  - [ ] chips/parlorFeeが1回のみカウントされているか
  - [ ] 依存配列が正しいか
  - [ ] エッジケース判定が正しいか

---

## 検証手順

### Phase 1: エッジケース修正の検証

#### テストデータ準備

**セッション作成**:
```
日付: 2025-11-05
モード: 4人打ち
半荘1:
  プレイヤーA: +10000点
  プレイヤーB: ±0点 ← 検証対象
  プレイヤーC: -5000点
  プレイヤーD: -5000点
```

#### 検証ステップ

1. **セッション保存**
   - 上記データを入力して保存
   - エラーが発生しないことを確認

2. **履歴タブ確認**
   - セッション詳細を開く
   - 半荘数: 1半荘（0点半荘も含まれる）
   - プレイヤーBの収支: ±0pt

3. **分析タブ確認（プレイヤーB選択）**
   - revenueStats: totalBalance = 0pt
   - pointStats: pointBalance = 0点
   - chipStats: chipBalance = 0枚
   - rankStats: 半荘数 = 1

4. **総合順位確認**
   - 履歴タブで総合順位を確認
   - プレイヤーBが正しく2位として表示される

#### 期待される結果

- [ ] 0点半荘が保存される
- [ ] 0点半荘が統計に含まれる
- [ ] 総合順位が正しい（プレイヤーB = 2位）
- [ ] 平均着順が正しい

### Phase 2: selectedUserId対応の検証

#### テストデータ準備

**セッション作成**:
```
日付: 2025-11-05
モード: 4人打ち
半荘1:
  メインユーザー: +10000点, チップ+5枚
  プレイヤーB: +5000点, チップ+3枚
  プレイヤーC: -7500点, チップ-4枚
  プレイヤーD: -7500点, チップ-4枚
半荘2:
  メインユーザー: -5000点
  プレイヤーB: +5000点
  プレイヤーC: +2500点
  プレイヤーD: -2500点
```

#### 検証ステップ

1. **メインユーザー選択**
   - 分析タブでメインユーザーを選択
   - revenueStats: totalBalance = (10000-5000) * rate + 5 * chipRate - parlorFee
   - chipStats: chipBalance = +5枚
   - pointStats: 半荘1と半荘2の合計

2. **プレイヤーB選択**
   - 分析タブでプレイヤーBを選択
   - revenueStats: totalBalance = (5000+5000) * rate + 3 * chipRate - parlorFee
   - chipStats: chipBalance = +3枚
   - pointStats: 半荘1と半荘2の合計

3. **統計値の比較**
   - メインユーザーとプレイヤーBで統計が異なることを確認
   - 各統計が正しく計算されていることを確認

4. **切り替えの動作確認**
   - ユーザーフィルターを切り替え
   - 統計がリアルタイムで更新されることを確認

#### 期待される結果

- [ ] selectedUserIdによって統計が変わる
- [ ] メインユーザーとプレイヤーBで統計が異なる
- [ ] chips/parlorFeeがセッションで1回のみカウント
- [ ] ユーザー切り替えで即座に更新

### 統合テスト

#### エッジケース総合確認

**テストケース1: 全員0点の半荘**
```
半荘:
  プレイヤーA: ±0点
  プレイヤーB: ±0点
  プレイヤーC: ±0点
  プレイヤーD: ±0点
```

- [ ] 保存される
- [ ] 半荘数にカウントされる
- [ ] 統計に含まれる

**テストケース2: 一部未入力**
```
半荘1:
  プレイヤーA: +10000点
  プレイヤーB: 未入力（null）
  プレイヤーC: -5000点
  プレイヤーD: -5000点
```

- [ ] 半荘1が保存される
- [ ] プレイヤーBのみ統計から除外
- [ ] プレイヤーA, C, Dは統計に含まれる

**テストケース3: 複数セッション・複数ユーザー**
```
セッション1:
  半荘1: メインユーザー+5000, プレイヤーB+3000
  半荘2: メインユーザー-3000, プレイヤーB-2000

セッション2:
  半荘1: メインユーザー±0, プレイヤーB+1000
  半荘2: メインユーザー+2000, プレイヤーB±0
```

- [ ] メインユーザー選択時: セッション1+2の合計
- [ ] プレイヤーB選択時: セッション1+2の合計
- [ ] 0点半荘が両方とも含まれる
- [ ] chips/parlorFeeが各セッションで1回のみ

---

## まとめ

### 実装の順序

1. **Phase 1: エッジケース修正**（8-15分）
   - session-utils.ts: 2箇所
   - InputTab.tsx: 1箇所
   - AnalysisTab.tsx: 1箇所
   - **analysis.ts: 2-3箇所（外部AIレビューで追加）**
   - 検証: 0点半荘が統計に含まれるか

2. **Phase 2: selectedUserId対応**（30-45分）
   - AnalysisTab.tsx: revenueStats
   - AnalysisTab.tsx: chipStats
   - 検証: ユーザー切り替えで統計が更新されるか

### リスク管理

**Phase 1のリスク**: 極めて低い
- 条件分岐1つの削除のみ
- ロジック変更なし
- 即座にロールバック可能

**Phase 2のリスク**: 中程度
- 統計計算ロジックの完全書き換え
- パフォーマンスへの影響（軽微だが検証必要）
- pointStatsと同じパターンで実装済み → 実績あり

### 次のステップ

1. **04-TEST_STRATEGY.md**: テスト計画とテストケース詳細
2. **05-MIGRATION_GUIDE.md**: デプロイ計画とリスク評価
3. **実装開始**: Phase 1 → Phase 2の順で実施

---

**Document Version**: 1.1
**Last Updated**: 2025-11-06 (外部AIレビュー反映)
**Status**: Ready for Implementation

**変更履歴**:
- v1.1 (2025-11-06): 外部AIレビューによりanalysis.ts の2箇所（Line 130, 142）を追加。修正箇所4→6に変更。
- v1.0 (2025-11-05): 初版作成
