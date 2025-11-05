# 実装仕様 - 分析タブ統計機能

## 1. 実装概要

### 1.1 修正対象

**修正が必要な統計**:
1. `revenueStats` (収支統計) - selectedUserId対応
2. `chipStats` (チップ統計) - selectedUserId対応

**参考にする統計** (正しく実装済み):
1. `pointStats` (スコア統計) - 半荘レベル動的計算
2. `rankStats` (着順統計) - 半荘レベル動的計算

### 1.2 実装方針

**原則**:
- session-utils.tsのcalculateSessionSummaryを参照実装とする
- 既存のpointStatsと同じパターンを使用
- chips/parlorFeeはセッション単位で1回のみカウント

## 2. revenueStats実装仕様

### 2.1 現在の実装（問題あり）

```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let totalIncome = 0
  let totalExpense = 0
  let totalParlorFee = 0

  // ❌ session.summary依存（mainUserのみ）
  filteredSessions.forEach(({ session }) => {
    if (session.summary) {
      const totalPayout = session.summary.totalPayout  // ❌ mainUserの統計
      totalParlorFee += session.summary.totalParlorFee

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
    totalParlorFee,
    totalBalance: totalIncome + totalExpense
  }
}, [filteredSessions])  // ❌ selectedUserIdが依存配列にない
```

### 2.2 修正後の実装

```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let totalIncome = 0
  let totalExpense = 0
  let totalParlorFee = 0

  // ✅ セッション単位で selectedUserId の収支を計算
  filteredSessions.forEach(({ session, hanchans }) => {
    if (!hanchans) return

    let sessionPayout = 0
    let sessionChips = 0
    let sessionParlorFee = 0
    let chipsInitialized = false

    // 各半荘で score + uma の収支を計算
    hanchans.forEach(hanchan => {
      const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)

      // 見学者を除外、点数未入力もスキップ
      if (!userResult || userResult.isSpectator || userResult.score === null || userResult.score === 0) {
        return
      }

      // 最初の有効な半荘から chips/parlorFee を取得（1回のみ）
      if (!chipsInitialized) {
        sessionChips = userResult.chips || 0
        sessionParlorFee = userResult.parlorFee || 0
        chipsInitialized = true
      }

      // score + umaPoints の収支を計算
      const umaPoints = umaMarkToValue(userResult.umaMark)
      const subtotal = userResult.score + umaPoints * session.umaValue
      const scorePayout = subtotal * session.rate

      sessionPayout += scorePayout
    })

    // セッション全体で1回のみ chips/parlorFee を加算
    sessionPayout += sessionChips * session.chipRate - sessionParlorFee
    totalParlorFee += sessionParlorFee

    // プラス/マイナスに振り分け
    if (sessionPayout >= 0) {
      totalIncome += sessionPayout
    } else {
      totalExpense += sessionPayout
    }
  })

  return {
    totalIncome,
    totalExpense,
    totalParlorFee,
    totalBalance: totalIncome + totalExpense
  }
}, [filteredSessions, selectedUserId])  // ✅ selectedUserIdを依存配列に追加
```

### 2.3 実装のポイント

**1. セッション単位のループ**
```typescript
filteredSessions.forEach(({ session, hanchans }) => {
  let sessionPayout = 0  // セッション全体の収支
  let sessionChips = 0
  let sessionParlorFee = 0
  let chipsInitialized = false

  // 各半荘で計算...
})
```

**2. chips/parlorFeeの1回のみ取得**
```typescript
if (!chipsInitialized) {
  sessionChips = userResult.chips || 0
  sessionParlorFee = userResult.parlorFee || 0
  chipsInitialized = true
}
```

**3. score + umaの計算**
```typescript
const umaPoints = umaMarkToValue(userResult.umaMark)
const subtotal = userResult.score + umaPoints * session.umaValue
const scorePayout = subtotal * session.rate
sessionPayout += scorePayout
```

**4. セッション終了後にchips/parlorFeeを加算**
```typescript
sessionPayout += sessionChips * session.chipRate - sessionParlorFee
```

### 2.4 session-utils.tsとの整合性確認

**参照実装** (session-utils.ts):
```typescript
// session-utils.tsの該当部分
for (const hanchan of hanchans) {
  const mainUserResult = hanchan.players.find((p) => p.userId === mainUserId)

  if (mainUserResult) {
    if (mainUserResult.score === null || mainUserResult.score === 0) {
      continue
    }

    if (!chipsInitialized) {
      sessionChips = mainUserResult.chips || 0
      sessionParlorFee = mainUserResult.parlorFee || 0
      chipsInitialized = true
    }

    const umaPoints = umaMarkToValue(mainUserResult.umaMark)
    const subtotal = mainUserResult.score + umaPoints * session.umaValue
    const scorePayout = subtotal * session.rate
    totalPayout += scorePayout
  }
}

totalPayout += sessionChips * session.chipRate - sessionParlorFee
```

**整合性**: ✅ 計算ロジックが完全に一致

## 3. chipStats実装仕様

### 3.1 現在の実装（問題あり）

```typescript
const chipStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let plusChips = 0
  let minusChips = 0

  // ❌ session.summary依存（mainUserのみ）
  filteredSessions.forEach(({ session }) => {
    if (session.summary) {
      const chips = session.summary.totalChips  // ❌ mainUserの統計

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
}, [filteredSessions])  // ❌ selectedUserIdが依存配列にない
```

### 3.2 修正後の実装

```typescript
const chipStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let plusChips = 0
  let minusChips = 0

  // ✅ セッション単位で selectedUserId のチップを集計
  filteredSessions.forEach(({ hanchans }) => {
    if (!hanchans) return

    let sessionChips = 0
    let chipsInitialized = false

    // 最初の有効な半荘から chips を取得（1回のみ）
    for (const hanchan of hanchans) {
      const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)

      // 見学者を除外、点数未入力もスキップ
      if (!userResult || userResult.isSpectator || userResult.score === null || userResult.score === 0) {
        continue
      }

      if (!chipsInitialized) {
        sessionChips = userResult.chips || 0
        chipsInitialized = true
        break  // 1回取得したらループを抜ける
      }
    }

    // プラス/マイナスに振り分け
    if (sessionChips >= 0) {
      plusChips += sessionChips
    } else {
      minusChips += sessionChips
    }
  })

  return {
    plusChips,
    minusChips,
    chipBalance: plusChips + minusChips
  }
}, [filteredSessions, selectedUserId])  // ✅ selectedUserIdを依存配列に追加
```

### 3.3 実装のポイント

**1. セッション単位のループ**
```typescript
filteredSessions.forEach(({ hanchans }) => {
  let sessionChips = 0
  let chipsInitialized = false

  // 最初の有効な半荘から取得...
})
```

**2. 最初の有効な半荘でchips取得**
```typescript
for (const hanchan of hanchans) {
  const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)

  if (!userResult || userResult.isSpectator || userResult.score === null || userResult.score === 0) {
    continue
  }

  if (!chipsInitialized) {
    sessionChips = userResult.chips || 0
    chipsInitialized = true
    break  // ✅ 1回取得したらループを抜ける
  }
}
```

**3. プラス/マイナスの振り分け**
```typescript
if (sessionChips >= 0) {
  plusChips += sessionChips
} else {
  minusChips += sessionChips
}
```

### 3.4 session-utils.tsとの整合性確認

**参照実装** (session-utils.ts):
```typescript
let sessionChips = 0
let chipsInitialized = false

for (const hanchan of hanchans) {
  const mainUserResult = hanchan.players.find((p) => p.userId === mainUserId)

  if (mainUserResult) {
    if (mainUserResult.score === null || mainUserResult.score === 0) {
      continue
    }

    if (!chipsInitialized) {
      sessionChips = mainUserResult.chips || 0
      chipsInitialized = true
    }
  }
}

totalChips = sessionChips
```

**整合性**: ✅ 計算ロジックが完全に一致

## 4. 依存配列の修正

### 4.1 修正前後の比較

| 統計 | 修正前 | 修正後 | 変更内容 |
|-----|-------|-------|---------|
| revenueStats | `[filteredSessions]` | `[filteredSessions, selectedUserId]` | selectedUserId追加 |
| chipStats | `[filteredSessions]` | `[filteredSessions, selectedUserId]` | selectedUserId追加 |
| pointStats | `[filteredSessions, selectedUserId]` | 変更なし | ✅ 既に正しい |
| rankStats | `[hanchans, selectedUserId, selectedMode]` | 変更なし | ✅ 既に正しい |

### 4.2 依存配列の意味

**filteredSessions依存**:
- 期間フィルター（selectedPeriod）変更
- モードフィルター（selectedMode）変更
- ユーザー参加フィルター（selectedUserId）変更
- セッションデータ更新（新規保存、削除等）

**selectedUserId依存**:
- ユーザー切り替え時に統計を再計算
- 各ユーザーのPlayerResultを取得するため必須

## 5. エッジケース対応

### 5.1 見学者の除外

**チェック条件**:
```typescript
if (!userResult || userResult.isSpectator) {
  return  // または continue
}
```

### 5.2 点数未入力のスキップ

**チェック条件**:
```typescript
if (userResult.score === null || userResult.score === 0) {
  return  // または continue
}
```

**理由**:
- `score === null`: 未入力
- `score === 0`: ゼロサム制約により、全員が0点の場合は未入力扱い

### 5.3 chips/parlorFeeのデフォルト値

**デフォルト値の設定**:
```typescript
sessionChips = userResult.chips || 0
sessionParlorFee = userResult.parlorFee || 0
```

**理由**:
- `chips`がundefined/nullの場合は0として扱う
- `parlorFee`がundefined/nullの場合は0として扱う

### 5.4 選択ユーザーが参加していないセッション

**filteredSessionsで既に除外済み**:
```typescript
const filteredSessions = useMemo(() => {
  let filtered = sessions

  // ...

  // ✅ 選択ユーザーが参加しているセッションのみに絞る
  filtered = filtered.filter(({ hanchans }) => {
    return hanchans?.some(hanchan =>
      hanchan.players.some(p =>
        p.userId === selectedUserId && !p.isSpectator
      )
    )
  })

  return filtered
}, [sessions, selectedPeriod, selectedMode, selectedUserId])
```

**統計計算での追加チェックは不要**:
- filteredSessionsに含まれる全セッションは、selectedUserIdが参加している
- 各半荘でのuserResult検索で見つからない場合はスキップ（防御的プログラミング）

## 6. デバッグログの追加

### 6.1 revenueStatsのログ

**開発モードでのログ出力**:
```typescript
const revenueStats = useMemo(() => {
  // ... 計算ロジック ...

  const result = {
    totalIncome,
    totalExpense,
    totalParlorFee,
    totalBalance: totalIncome + totalExpense
  }

  logger.debug('収支統計計算完了', {
    context: 'AnalysisTab.revenueStats',
    data: {
      selectedUserId,
      sessionCount: filteredSessions.length,
      ...result
    }
  })

  return result
}, [filteredSessions, selectedUserId])
```

### 6.2 chipStatsのログ

**開発モードでのログ出力**:
```typescript
const chipStats = useMemo(() => {
  // ... 計算ロジック ...

  const result = {
    plusChips,
    minusChips,
    chipBalance: plusChips + minusChips
  }

  logger.debug('チップ統計計算完了', {
    context: 'AnalysisTab.chipStats',
    data: {
      selectedUserId,
      sessionCount: filteredSessions.length,
      ...result
    }
  })

  return result
}, [filteredSessions, selectedUserId])
```

## 7. 型定義

### 7.1 戻り値の型

**revenueStats**:
```typescript
type RevenueStats = {
  totalIncome: number
  totalExpense: number
  totalParlorFee: number
  totalBalance: number
} | null
```

**chipStats**:
```typescript
type ChipStats = {
  plusChips: number
  minusChips: number
  chipBalance: number
} | null
```

**null を返すケース**:
- `filteredSessions.length === 0`（早期リターン）

### 7.2 UI表示での型チェック

**既存のUI表示**:
```typescript
{revenueStats && (
  <div className="pl-2 pr-2">
    <div className="text-base font-semibold mb-2">💰 収支</div>
    <div className="space-y-1 text-lg">
      <div className="flex">
        <span className="w-12">+:</span>
        <span className="flex-1 text-right text-blue-600">+{revenueStats.totalIncome}pt</span>
      </div>
      {/* ... */}
    </div>
  </div>
)}
```

**変更不要**: 既存のUI表示ロジックはそのまま使用可能

## 8. 実装チェックリスト

### 8.1 revenueStats修正

- [ ] session.summary依存の削除
- [ ] セッション単位のループ実装
- [ ] chips/parlorFeeの1回のみ取得ロジック
- [ ] score + umaの計算ロジック
- [ ] セッション終了後のchips/parlorFee加算
- [ ] selectedUserIdを依存配列に追加
- [ ] 見学者の除外チェック
- [ ] 点数未入力のスキップチェック
- [ ] デバッグログの追加
- [ ] session-utils.tsとの計算結果比較

### 8.2 chipStats修正

- [ ] session.summary依存の削除
- [ ] セッション単位のループ実装
- [ ] 最初の有効な半荘からchips取得ロジック
- [ ] breakによるループ終了
- [ ] selectedUserIdを依存配列に追加
- [ ] 見学者の除外チェック
- [ ] 点数未入力のスキップチェック
- [ ] デバッグログの追加
- [ ] session-utils.tsとの計算結果比較

### 8.3 テスト

- [ ] ユーザー切り替えテスト（UI確認）
- [ ] 複数セッション・複数半荘テスト（6半荘データ）
- [ ] chips/parlorFeeの1回カウント検証
- [ ] 見学者除外テスト
- [ ] 点数未入力スキップテスト
- [ ] パフォーマンステスト（100セッション）

## 9. 実装例の完全版

### 9.1 revenueStats完全実装

```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let totalIncome = 0
  let totalExpense = 0
  let totalParlorFee = 0

  // セッション単位で selectedUserId の収支を計算
  filteredSessions.forEach(({ session, hanchans }) => {
    if (!hanchans) return

    let sessionPayout = 0
    let sessionChips = 0
    let sessionParlorFee = 0
    let chipsInitialized = false

    // 各半荘で score + uma の収支を計算
    hanchans.forEach(hanchan => {
      const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)

      // 見学者を除外、点数未入力もスキップ
      if (!userResult || userResult.isSpectator || userResult.score === null || userResult.score === 0) {
        return
      }

      // 最初の有効な半荘から chips/parlorFee を取得（1回のみ）
      if (!chipsInitialized) {
        sessionChips = userResult.chips || 0
        sessionParlorFee = userResult.parlorFee || 0
        chipsInitialized = true
      }

      // score + umaPoints の収支を計算
      const umaPoints = umaMarkToValue(userResult.umaMark)
      const subtotal = userResult.score + umaPoints * session.umaValue
      const scorePayout = subtotal * session.rate

      sessionPayout += scorePayout
    })

    // セッション全体で1回のみ chips/parlorFee を加算
    sessionPayout += sessionChips * session.chipRate - sessionParlorFee
    totalParlorFee += sessionParlorFee

    // プラス/マイナスに振り分け
    if (sessionPayout >= 0) {
      totalIncome += sessionPayout
    } else {
      totalExpense += sessionPayout
    }
  })

  const result = {
    totalIncome,
    totalExpense,
    totalParlorFee,
    totalBalance: totalIncome + totalExpense
  }

  logger.debug('収支統計計算完了', {
    context: 'AnalysisTab.revenueStats',
    data: {
      selectedUserId,
      sessionCount: filteredSessions.length,
      ...result
    }
  })

  return result
}, [filteredSessions, selectedUserId])
```

### 9.2 chipStats完全実装

```typescript
const chipStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  let plusChips = 0
  let minusChips = 0

  // セッション単位で selectedUserId のチップを集計
  filteredSessions.forEach(({ hanchans }) => {
    if (!hanchans) return

    let sessionChips = 0
    let chipsInitialized = false

    // 最初の有効な半荘から chips を取得（1回のみ）
    for (const hanchan of hanchans) {
      const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)

      // 見学者を除外、点数未入力もスキップ
      if (!userResult || userResult.isSpectator || userResult.score === null || userResult.score === 0) {
        continue
      }

      if (!chipsInitialized) {
        sessionChips = userResult.chips || 0
        chipsInitialized = true
        break  // 1回取得したらループを抜ける
      }
    }

    // プラス/マイナスに振り分け
    if (sessionChips >= 0) {
      plusChips += sessionChips
    } else {
      minusChips += sessionChips
    }
  })

  const result = {
    plusChips,
    minusChips,
    chipBalance: plusChips + minusChips
  }

  logger.debug('チップ統計計算完了', {
    context: 'AnalysisTab.chipStats',
    data: {
      selectedUserId,
      sessionCount: filteredSessions.length,
      ...result
    }
  })

  return result
}, [filteredSessions, selectedUserId])
```

## 10. 次のステップ

1. **04-PERFORMANCE_STRATEGY.md**: パフォーマンス最適化の詳細戦略
2. **05-TEST_PLAN.md**: テスト計画と検証方法
