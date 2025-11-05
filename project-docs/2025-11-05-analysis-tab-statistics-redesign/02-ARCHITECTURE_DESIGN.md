# アーキテクチャ設計 - 分析タブ統計機能

## 1. 設計原則

### 1.1 コアプリンシパル

**原則1: 動的計算によるリアクティブ性**
- session.summaryに依存せず、filteredSessions + hanchansから毎回計算
- selectedUserId変更で自動的に全統計が更新される

**原則2: 計算ロジックの一貫性**
- session-utils.tsのcalculateSessionSummaryを参照実装とする
- 4つの統計すべてが同じ計算パターンを使用

**原則3: パフォーマンスと正確性のバランス**
- useMemoで不要な再計算を防止
- 依存配列の正確性を重視（selectedUserIdを含む）

### 1.2 アーキテクチャパターン

**パターン1: Derived State（派生状態）**
- filteredSessionsを基本状態とする
- 各統計はfilteredSessionsから派生して計算

**パターン2: Memoization（メモ化）**
- useMemoで計算結果をキャッシュ
- 依存配列の変更時のみ再計算

**パターン3: Filter-Map-Reduce**
- Filter: selectedUserIdが参加しているセッション
- Map: セッション/半荘から必要なデータを抽出
- Reduce: 集計して統計値を計算

## 2. データフロー設計

### 2.1 全体データフロー

```
┌─────────────────────────────────────────────────────────────┐
│ AnalysisTab Component                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [User Input]                                               │
│  selectedUserId ────┐                                       │
│  selectedPeriod     ├─→ filteredSessions (useMemo)         │
│  selectedMode ──────┘                                       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ filteredSessions                                      │ │
│  │ = filterByPeriod()                                    │ │
│  │   → filterByMode()                                    │ │
│  │   → filterByUserParticipation(selectedUserId)         │ │
│  └───────────────────────────────────────────────────────┘ │
│                     │                                       │
│                     ├─→ hanchans (useMemo)                  │
│                     │   = flatten all hanchans             │
│                     │                                       │
│                     ├─→ rankStats (useMemo)                 │
│                     │   [依存: hanchans, selectedUserId]    │
│                     │                                       │
│                     ├─→ revenueStats (useMemo) 🔧修正対象   │
│                     │   [依存: filteredSessions, selectedUserId] │
│                     │                                       │
│                     ├─→ pointStats (useMemo) ✅参考実装      │
│                     │   [依存: filteredSessions, selectedUserId] │
│                     │                                       │
│                     └─→ chipStats (useMemo) 🔧修正対象      │
│                         [依存: filteredSessions, selectedUserId] │
│                                                             │
│  [UI Rendering]                                             │
│  - 統合統計カード（4象限）                                   │
│  - グラフ（着順・収支推移）                                   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 filteredSessionsの計算フロー

```typescript
// Step 1: useSessions (custom hook)
const { sessions, loading, error } = useSessions(mainUser?.id || '', { includeHanchans: true })
// sessions: SessionWithDetails[] = { session, hanchans }[]

// Step 2: filteredSessions (useMemo)
const filteredSessions = useMemo(() => {
  let filtered = sessions

  // Filter by period (all-time, this-year, this-month, custom)
  filtered = filterSessionsByPeriod(filtered, selectedPeriod)

  // Filter by mode (4-player, 3-player, all)
  filtered = filterSessionsByMode(filtered, selectedMode)

  // Filter by user participation
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

### 2.3 hanchansの計算フロー

```typescript
// Step 3: hanchans collection (useMemo)
const hanchans = useMemo(() => {
  const allHanchans: Array<{ players: PlayerResult[] }> = []

  filteredSessions.forEach(({ hanchans }) => {
    if (hanchans) {
      hanchans.forEach(hanchan => {
        allHanchans.push({ players: hanchan.players })
      })
    }
  })

  return allHanchans
}, [filteredSessions])
```

### 2.4 統計計算フロー

#### 2.4.1 着順統計（rankStats）✅ 参考実装

```
hanchans (全半荘)
  ↓
各半荘で selectedUserId のPlayerResultを取得
  ↓
各半荘で着順を計算（点数降順）
  ↓
着順をカウント（1位/2位/3位/4位）
  ↓
rankStats = {
  rankCounts: { first, second, third, fourth? },
  rankRates: { first%, second%, third%, fourth%? },
  averageRank
}
```

#### 2.4.2 スコア統計（pointStats）✅ 参考実装

```
filteredSessions
  ↓
各セッションの各半荘でループ
  ↓
selectedUserId のPlayerResultを取得
  ↓
各半荘で計算:
  subtotal = score + umaPoints * session.umaValue
  ↓
プラス/マイナスに振り分け
  ↓
pointStats = {
  plusPoints: Σ(subtotal > 0),
  minusPoints: Σ(subtotal < 0),
  pointBalance: plusPoints + minusPoints
}
```

#### 2.4.3 収支統計（revenueStats）🔧 修正対象

**現在の問題**:
```typescript
// ❌ session.summary依存（mainUserのみ）
filteredSessions.forEach(({ session }) => {
  if (session.summary) {
    const totalPayout = session.summary.totalPayout  // mainUserの統計
    totalParlorFee += session.summary.totalParlorFee
  }
})
```

**修正後の設計**:
```
filteredSessions
  ↓
各セッションでループ
  ↓
セッション内の全半荘で selectedUserId のPlayerResultを取得
  ↓
セッションごとに計算:
  scorePayout = Σ(各半荘の (score + umaPoints * umaValue) * rate)
  sessionChips = 最初の有効な半荘から取得（1回のみ）
  sessionParlorFee = 最初の有効な半荘から取得（1回のみ）
  sessionPayout = scorePayout + sessionChips * chipRate - sessionParlorFee
  ↓
プラス/マイナスに振り分け
  ↓
revenueStats = {
  totalIncome: Σ(sessionPayout > 0),
  totalExpense: Σ(sessionPayout < 0),
  totalParlorFee: Σ(sessionParlorFee),  // UI表示用
  totalBalance: totalIncome + totalExpense
}
```

#### 2.4.4 チップ統計（chipStats）🔧 修正対象

**現在の問題**:
```typescript
// ❌ session.summary依存（mainUserのみ）
filteredSessions.forEach(({ session }) => {
  if (session.summary) {
    const chips = session.summary.totalChips  // mainUserの統計
  }
})
```

**修正後の設計**:
```
filteredSessions
  ↓
各セッションでループ
  ↓
セッション内の最初の有効な半荘から selectedUserId のchipsを取得
  ↓
chips = PlayerResult.chips（1回のみ）
  ↓
プラス/マイナスに振り分け
  ↓
chipStats = {
  plusChips: Σ(chips > 0),
  minusChips: Σ(chips < 0),
  chipBalance: plusChips + minusChips
}
```

## 3. session.summaryとの使い分け

### 3.1 session.summaryの役割

**定義** (session-utils.ts):
```typescript
export interface SessionSummary {
  sessionId: string
  date: string
  mode: GameMode
  hanchanCount: number
  totalPayout: number      // mainUserの収支
  totalChips: number       // mainUserのチップ
  totalParlorFee: number   // mainUserの場代
  averageRank: number      // mainUserの平均着順
  rankCounts: { ... }      // mainUserの着順カウント
  overallRank: number      // セッション内総合順位
}
```

**特徴**:
- mainUser専用の統計
- 保存時に事前計算（saveSessionWithSummary）
- パフォーマンス最適化のためのキャッシュ

### 3.2 使い分けのガイドライン

| 用途 | 使用するデータ | 理由 |
|-----|-------------|------|
| **履歴タブ（HistoryTab）** | session.summary | パフォーマンス最適化（事前計算済み）<br>mainUserの統計のみ必要 |
| **分析タブ（AnalysisTab）** | 動的計算 | 任意ユーザーの統計が必要<br>selectedUserIdに対応 |
| **セッション詳細（SessionDetailDialog）** | session.summary | mainUserの統計のみ表示<br>事前計算済みで高速 |

### 3.3 設計判断の理由

**なぜ分析タブでsession.summaryを使わないのか**:

1. **機能要件**: 任意ユーザーの統計が必要（US-1）
   - session.summaryはmainUser専用
   - selectedUserId対応には動的計算が必須

2. **パフォーマンス**: 分析タブは頻繁に表示されない
   - 履歴タブ: セッション一覧で多用（N件のsummary表示）
   - 分析タブ: フィルター変更時のみ計算（数回/セッション）

3. **保守性**: 計算ロジックの一貫性
   - 4つの統計すべてが動的計算
   - session-utils.tsとの計算ロジック整合性

**session.summaryを保持する理由**:

1. 履歴タブのパフォーマンス最適化として必須
2. セッション詳細ダイアログで即座に表示
3. 将来的な機能（ランキング、リーダーボード等）で活用可能

## 4. コンポーネント設計

### 4.1 AnalysisTabの責務

**単一責務原則**:
- フィルター管理（selectedUserId, selectedPeriod, selectedMode）
- 統計計算（4つのuseMemo）
- UI表示（統合統計カード、グラフ）

**依存関係**:
```
AnalysisTab
  ├─ useSessions (custom hook)
  ├─ AnalysisFilters (child component)
  ├─ RankStatisticsChartPiePrototype (child component)
  └─ RevenueTimelineChart (child component)
```

### 4.2 統計計算のカプセル化

**現在の設計** (inline useMemo):
```typescript
const revenueStats = useMemo(() => {
  // 計算ロジック
}, [filteredSessions, selectedUserId])
```

**将来の改善案** (custom hook):
```typescript
// hooks/useRevenueStats.ts
export function useRevenueStats(
  filteredSessions: SessionWithDetails[],
  selectedUserId: string
) {
  return useMemo(() => {
    // 計算ロジック
  }, [filteredSessions, selectedUserId])
}

// AnalysisTab.tsx
const revenueStats = useRevenueStats(filteredSessions, selectedUserId)
```

**判断**: 本設計では inline useMemo を維持
- 理由: 計算ロジックがシンプル（50行以内）
- 将来的にロジックが複雑化したら分離を検討

## 5. エラーハンドリング設計

### 5.1 データ異常ケース

**ケース1: 見学者の除外**
```typescript
const userResult = hanchan.players.find(p => p.userId === selectedUserId)
if (userResult && !userResult.isSpectator) {
  // 統計に含める
}
```

**ケース2: 点数未入力のスキップ**
```typescript
if (userResult.score === null || userResult.score === 0) {
  continue  // この半荘はスキップ
}
```

**ケース3: chips/parlorFee未初期化**
```typescript
if (!chipsInitialized) {
  sessionChips = mainUserResult.chips || 0
  sessionParlorFee = mainUserResult.parlorFee || 0
  chipsInitialized = true
}
```

### 5.2 ログ出力

**デバッグログ** (logger.debug):
```typescript
logger.debug('ユーザー参加フィルター適用', {
  context: 'AnalysisTab.filteredSessions',
  data: {
    userId: selectedUserId,
    period: selectedPeriod,
    mode: selectedMode,
    resultCount: filtered.length
  }
})
```

**警告ログ** (logger.warn):
```typescript
if (!mainUserResult) {
  logger.warn('半荘にユーザーが見つかりません', {
    context: 'AnalysisTab.revenueStats',
    data: {
      hanchanNumber: hanchan.hanchanNumber,
      selectedUserId,
      players: hanchan.players.map(p => ({ name: p.playerName, userId: p.userId }))
    }
  })
  continue
}
```

## 6. パフォーマンス設計

### 6.1 useMemoの依存配列戦略

**原則**: 必要最小限の依存配列

| 統計 | 依存配列 | 理由 |
|-----|---------|------|
| filteredSessions | [sessions, selectedPeriod, selectedMode, selectedUserId] | 全フィルター条件 |
| hanchans | [filteredSessions] | filteredSessionsが変わったら再計算 |
| rankStats | [hanchans, selectedUserId, selectedMode] | 着順計算に必要 |
| revenueStats | [filteredSessions, selectedUserId] | selectedUserIdの収支計算 |
| pointStats | [filteredSessions, selectedUserId] | selectedUserIdのスコア計算 |
| chipStats | [filteredSessions, selectedUserId] | selectedUserIdのチップ計算 |

### 6.2 計算の最適化

**最適化1: 早期リターン**
```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null  // 早期リターン

  // メインロジック
}, [filteredSessions, selectedUserId])
```

**最適化2: セッションレベルのループ**
```typescript
// ✅ セッション単位でループ（chips/parlorFeeは1回のみ）
filteredSessions.forEach(({ session, hanchans }) => {
  let sessionChips = 0
  let sessionParlorFee = 0
  let chipsInitialized = false

  hanchans.forEach(hanchan => {
    // 各半荘でscore計算
    // 最初の半荘でchips/parlorFee取得
  })

  // セッション単位で集計
})
```

**最適化3: 不要な中間配列の回避**
```typescript
// ❌ 中間配列を作成
const payouts = filteredSessions.map(s => calculatePayout(s))
const total = payouts.reduce((sum, p) => sum + p, 0)

// ✅ 直接集計
let total = 0
filteredSessions.forEach(({ session, hanchans }) => {
  total += calculatePayout(session, hanchans)
})
```

### 6.3 メモリ使用量の管理

**ガイドライン**:
- 大きな中間配列を避ける
- 不要なオブジェクト生成を避ける
- 計算結果のみを保持

## 7. テスト設計との連携

### 7.1 テスト可能性の確保

**設計判断**:
- 計算ロジックはuseMemo内に記述（テストはコンポーネントレベル）
- 将来的にロジックが複雑化したらヘルパー関数に分離

**テストポイント**:
1. selectedUserId変更時の統計更新
2. chips/parlorFeeのセッション単位カウント
3. 見学者・未入力データの除外
4. session-utils.tsとの計算結果整合性

### 7.2 デバッグ支援

**開発モードでのログ出力**:
```typescript
if (import.meta.env.DEV) {
  logger.debug('revenueStats計算結果', {
    context: 'AnalysisTab.revenueStats',
    data: {
      sessionCount: filteredSessions.length,
      totalIncome,
      totalExpense,
      totalParlorFee,
      totalBalance
    }
  })
}
```

## 8. 次のステップ

本アーキテクチャ設計を基に、以下を作成する：

1. **03-IMPLEMENTATION_SPECIFICATION.md**: 具体的な実装仕様とコード例
2. **04-PERFORMANCE_STRATEGY.md**: パフォーマンス最適化の詳細戦略
3. **05-TEST_PLAN.md**: テスト計画と検証方法
