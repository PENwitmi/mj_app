# Phase 5: 分析タブ実装計画書

**作成日**: 2025-10-05 12:12
**ステータス**: 計画中
**Phase**: 5 - 分析タブ実装

---

## 📋 目次

1. [概要](#概要)
2. [実装フェーズ](#実装フェーズ)
3. [データフロー設計](#データフロー設計)
4. [型定義仕様](#型定義仕様)
5. [統計計算ロジック](#統計計算ロジック)
6. [UI実装仕様](#UI実装仕様)
7. [リスク分析＆対策](#リスク分析対策)
8. [テスト戦略](#テスト戦略)

---

## 概要

### 目的
過去の対局データを統計的に分析し、ユーザーの麻雀成績を可視化する「分析タブ」を実装する。

### スコープ
- **Phase 5-1**: 統計計算ロジック実装（db-utils.ts拡張）
- **Phase 5-2**: フィルター機能実装（ユーザー、期間、モード）
- **Phase 5-3**: 統計表示UI実装（着順、収支、ポイント、チップ）
- **Phase 5-4**: UX最適化（ローディング状態、エラー処理）

### 設計原則
1. **データ分離**: ポイント（半荘単位）と収支（セッション単位）を分離
2. **モード分離**: 4人打ち/3人打ちの着順統計は別々に表示
3. **パフォーマンス**: IndexedDBクエリの最適化、in-memory計算
4. **再利用性**: 既存のuseSessions、useUsersフックを活用

---

## 実装フェーズ

### Phase 5-1: 統計計算ロジック実装（db-utils.ts）

**目的**: 分析タブで必要な統計データを計算する関数群を実装

**実装内容**:
1. **型定義**:
   - `AnalysisFilter`: フィルター条件（userId, period, mode）
   - `RankStatistics`: 着順統計（各着順の回数、割合、平均着順）
   - `RevenueStatistics`: 収支統計（総収入、総支出、総収支）
   - `PointStatistics`: ポイント統計（プラス合計、マイナス合計、収支）
   - `ChipStatistics`: チップ統計（総チップ獲得）
   - `AnalysisStatistics`: 全統計の統合型

2. **フィルター関数**:
   - `filterSessionsByPeriod()`: 期間フィルター（今月、今年、特定年、全期間）
   - `filterSessionsByMode()`: モードフィルター（4人打ち、3人打ち、全体）
   - `filterPlayerResultsByUser()`: ユーザーフィルター

3. **統計計算関数**:
   - `calculateRankStatistics()`: 着順統計計算
   - `calculateRevenueStatistics()`: 収支統計計算
   - `calculatePointStatistics()`: ポイント統計計算
   - `calculateChipStatistics()`: チップ統計計算
   - `calculateAnalysisStatistics()`: 全統計を統合して計算

**成果物**:
- `src/lib/db-utils.ts`（拡張）
- 型定義＋6つの統計関数

---

### Phase 5-2: フィルター機能実装

**目的**: ユーザー、期間、モードのフィルターUIを実装

**実装内容**:
1. **State管理**:
   - `selectedUserId`: 選択中のユーザーID（デフォルト: メインユーザー）
   - `selectedPeriod`: 選択中の期間（デフォルト: '今月'）
   - `selectedMode`: 選択中のモード（デフォルト: '4-player'）

2. **フィルターコンポーネント**:
   - `AnalysisFilters.tsx`: フィルターエリア全体
     - ユーザー選択ドロップダウン
     - 期間選択ドロップダウン
     - モードタブ（4人打ち、3人打ち、全体）

3. **期間選択ロジック**:
   - 動的な年リスト生成（データがある年のみ表示）
   - 「今月」「今年」「YYYY年」「全期間」

**成果物**:
- `src/components/analysis/AnalysisFilters.tsx`（新規）

---

### Phase 5-3: 統計表示UI実装

**目的**: 各統計カードを実装し、分析タブの本体を完成

**実装内容**:
1. **統計カードコンポーネント**:
   - `RankStatisticsCard.tsx`: 着順統計カード
     - バーグラフ表示（視覚化）
     - 各着順の回数と割合
     - 平均着順表示
   - `RevenueStatisticsCard.tsx`: 収支統計カード
   - `PointStatisticsCard.tsx`: ポイント統計カード
   - `ChipStatisticsCard.tsx`: チップ統計カード

2. **AnalysisTab本体**:
   - フィルター適用
   - 統計計算実行
   - 各カードの配置
   - データなし時のメッセージ表示
   - 「全体」タブ時の着順統計非表示＋注意メッセージ

**成果物**:
- `src/components/tabs/AnalysisTab.tsx`（大幅拡張）
- `src/components/analysis/RankStatisticsCard.tsx`（新規）
- `src/components/analysis/RevenueStatisticsCard.tsx`（新規）
- `src/components/analysis/PointStatisticsCard.tsx`（新規）
- `src/components/analysis/ChipStatisticsCard.tsx`（新規）

---

### Phase 5-4: UX最適化

**目的**: ローディング状態、エラー処理、パフォーマンス最適化

**実装内容**:
1. **ローディング状態**:
   - フィルター変更時のローディング表示
   - Suspense/Skeletonの活用

2. **エラー処理**:
   - 統計計算エラーのハンドリング
   - ユーザーフレンドリーなエラーメッセージ

3. **パフォーマンス最適化**:
   - useMemoでの統計計算キャッシュ
   - 大量データ時の計算最適化

**成果物**:
- ローディング/エラー表示の追加
- パフォーマンス改善

---

## データフロー設計

### 全体フロー

```
User Interaction (Filter Change)
  ↓
AnalysisTab (State Update)
  ↓
useSessions Hook (Data Fetch)
  ↓
Filter Functions (Period/Mode Filtering)
  ↓
Statistics Calculation Functions
  ↓
Statistics Display Cards (UI Rendering)
```

### 詳細フロー

1. **データ取得**:
   - `useSessions(mainUser.id)` → 全セッション取得
   - `useUsers()` → 全ユーザー取得

2. **フィルター適用**:
   - 期間フィルター: `filterSessionsByPeriod(sessions, period)`
   - モードフィルター: `filterSessionsByMode(sessions, mode)`
   - ユーザーフィルター: `filterPlayerResultsByUser(hanchans, userId)`

3. **統計計算**:
   - フィルター済みデータを統計関数に渡す
   - 各統計を個別に計算 or `calculateAnalysisStatistics()` で一括計算

4. **UI表示**:
   - 各統計カードに計算結果を渡す
   - データなし時: メッセージ表示
   - 「全体」モード時: 着順統計を非表示

---

## 型定義仕様

### AnalysisFilter

```typescript
export interface AnalysisFilter {
  userId: string           // 分析対象ユーザーID
  period: PeriodType       // 期間フィルター
  mode: GameMode | 'all'   // モードフィルター（'4-player' | '3-player' | 'all'）
}

export type PeriodType =
  | 'this-month'      // 今月
  | 'this-year'       // 今年
  | `year-${number}`  // 特定年（例: 'year-2024'）
  | 'all-time'        // 全期間
```

### RankStatistics

```typescript
export interface RankStatistics {
  totalGames: number         // 総半荘数
  rankCounts: {
    first: number            // 1位回数
    second: number           // 2位回数
    third: number            // 3位回数
    fourth?: number          // 4位回数（4人打ちのみ）
  }
  rankRates: {
    first: number            // 1位率（%）
    second: number           // 2位率（%）
    third: number            // 3位率（%）
    fourth?: number          // 4位率（%）
  }
  averageRank: number        // 平均着順（小数第2位まで）
}
```

### RevenueStatistics

```typescript
export interface RevenueStatistics {
  totalIncome: number        // 総収入（プラスセッションの合計）
  totalExpense: number       // 総支出（マイナスセッションの合計、負の値）
  totalBalance: number       // 総収支（totalIncome + totalExpense）
}
```

### PointStatistics

```typescript
export interface PointStatistics {
  plusPoints: number         // プラスポイント合計（半荘単位）
  minusPoints: number        // マイナスポイント合計（半荘単位、負の値）
  pointBalance: number       // ポイント収支（plusPoints + minusPoints）
}
```

### ChipStatistics

```typescript
export interface ChipStatistics {
  totalChips: number         // 総チップ獲得枚数
}
```

### AnalysisStatistics（統合型）

```typescript
export interface AnalysisStatistics {
  rank?: RankStatistics      // 着順統計（全体モード時はundefined）
  revenue: RevenueStatistics
  point: PointStatistics
  chip: ChipStatistics
}
```

---

## 統計計算ロジック

### 着順統計計算（calculateRankStatistics）

**注意**: PlayerResultにはrankフィールドがないため、各半荘で点数順に着順を計算します。

```typescript
/**
 * 半荘内のプレイヤーの着順を計算（点数ベース）
 * session-utils.ts の calculateRanks と同じロジック
 */
function calculateRanksFromScores(playerResults: PlayerResult[]): Map<string, number> {
  const rankMap = new Map<string, number>()

  // 見学者を除外、かつ点数が入力されているプレイヤーのみを対象
  const activePlayers = playerResults
    .filter((p) => !p.isSpectator && p.score !== null)
    .sort((a, b) => b.score! - a.score!) // 点数降順

  // 着順を割り当て（同点の場合は同着）
  let currentRank = 1
  activePlayers.forEach((player, index) => {
    if (index > 0 && player.score! < activePlayers[index - 1].score!) {
      currentRank = index + 1
    }
    rankMap.set(player.id, currentRank)
  })

  return rankMap
}

/**
 * 着順統計を計算
 * @param hanchans 半荘データ配列（各半荘の全プレイヤーデータを含む）
 * @param targetUserId 対象ユーザーID
 * @param mode ゲームモード
 */
export function calculateRankStatistics(
  hanchans: Array<{ players: PlayerResult[] }>,
  targetUserId: string,
  mode: '4-player' | '3-player'
): RankStatistics {
  const rankCounts = { first: 0, second: 0, third: 0, fourth: 0 }
  let totalGames = 0

  // 各半荘ごとに着順を計算
  for (const hanchan of hanchans) {
    // 半荘内の全プレイヤーの着順を計算（点数順）
    const ranks = calculateRanksFromScores(hanchan.players)

    // 対象ユーザーのPlayerResultを見つける
    const targetPlayer = hanchan.players.find(p => p.userId === targetUserId)
    if (!targetPlayer || targetPlayer.isSpectator || targetPlayer.score === null) {
      continue // 見学者 or 点数未入力はスキップ
    }

    // 対象ユーザーの着順を取得
    const rank = ranks.get(targetPlayer.id)
    if (!rank) continue

    // 着順をカウント
    totalGames++
    switch (rank) {
      case 1: rankCounts.first++; break
      case 2: rankCounts.second++; break
      case 3: rankCounts.third++; break
      case 4: rankCounts.fourth++; break
    }
  }

  if (totalGames === 0) {
    return {
      totalGames: 0,
      rankCounts: { first: 0, second: 0, third: 0, fourth: mode === '4-player' ? 0 : undefined },
      rankRates: { first: 0, second: 0, third: 0, fourth: mode === '4-player' ? 0 : undefined },
      averageRank: 0
    }
  }

  // 着順率計算
  const rankRates = {
    first: (rankCounts.first / totalGames) * 100,
    second: (rankCounts.second / totalGames) * 100,
    third: (rankCounts.third / totalGames) * 100,
    fourth: mode === '4-player' ? (rankCounts.fourth / totalGames) * 100 : undefined
  }

  // 平均着順計算
  const totalRankSum =
    1 * rankCounts.first +
    2 * rankCounts.second +
    3 * rankCounts.third +
    (mode === '4-player' ? 4 * rankCounts.fourth : 0)
  const averageRank = totalRankSum / totalGames

  return {
    totalGames,
    rankCounts: mode === '4-player' ? rankCounts : { ...rankCounts, fourth: undefined },
    rankRates,
    averageRank: Number(averageRank.toFixed(2))
  }
}
```

### 収支統計計算（calculateRevenueStatistics）

```typescript
export function calculateRevenueStatistics(
  sessions: Array<{ totalPayout: number }>
): RevenueStatistics {
  let totalIncome = 0
  let totalExpense = 0

  sessions.forEach(session => {
    if (session.totalPayout > 0) {
      totalIncome += session.totalPayout
    } else {
      totalExpense += session.totalPayout // 負の値
    }
  })

  return {
    totalIncome,
    totalExpense,
    totalBalance: totalIncome + totalExpense
  }
}
```

### ポイント統計計算（calculatePointStatistics）

```typescript
export function calculatePointStatistics(
  playerResults: PlayerResult[]
): PointStatistics {
  // 見学者を除外
  const activeResults = playerResults.filter(pr => !pr.isSpectator)

  let plusPoints = 0
  let minusPoints = 0

  activeResults.forEach(pr => {
    const score = pr.score ?? 0
    if (score > 0) {
      plusPoints += score
    } else {
      minusPoints += score // 負の値
    }
  })

  return {
    plusPoints,
    minusPoints,
    pointBalance: plusPoints + minusPoints
  }
}
```

### チップ統計計算（calculateChipStatistics）

```typescript
export function calculateChipStatistics(
  sessions: Array<{ totalChips: number }>
): ChipStatistics {
  const totalChips = sessions.reduce((sum, session) => sum + session.totalChips, 0)

  return { totalChips }
}
```

### 統合統計計算（calculateAnalysisStatistics）

**注意**: この関数は実装しません。UIレイヤーで直接各統計関数を呼び出します。

理由：
1. `calculateRankStatistics()`は半荘データを引数に取る
2. `calculateRevenueStatistics()`と`calculateChipStatistics()`はセッションサマリーから計算
3. `calculatePointStatistics()`はPlayerResultsから計算

データソースが異なるため、統合関数を作るよりUIレイヤーで個別に呼び出す方がシンプルです。

**実際の使用例（AnalysisTab内）**:

```typescript
// hanchansを収集（着順統計用）
const hanchans = useMemo(() => {
  const allHanchans: Array<{ players: PlayerResult[] }> = []
  filteredSessions.forEach(({ hanchans }) => {
    hanchans.forEach(hanchan => {
      allHanchans.push({ players: hanchan.players })
    })
  })
  return allHanchans
}, [filteredSessions])

// 着順統計（全体モード時は計算しない）
const rankStats = useMemo(() => {
  if (selectedMode === 'all') return undefined
  return calculateRankStatistics(hanchans, selectedUserId, selectedMode)
}, [hanchans, selectedUserId, selectedMode])

// 収支統計（セッションサマリーから計算）
const revenueStats = useMemo(() => {
  return calculateRevenueStatistics(
    filteredSessions.map(s => ({ totalPayout: s.summary.totalPayout }))
  )
}, [filteredSessions])

// ポイント統計（対象ユーザーのPlayerResultsを収集）
const pointStats = useMemo(() => {
  const playerResults: PlayerResult[] = []
  filteredSessions.forEach(({ hanchans }) => {
    hanchans.forEach(hanchan => {
      const userResult = hanchan.players.find(p => p.userId === selectedUserId)
      if (userResult) {
        playerResults.push(userResult)
      }
    })
  })
  return calculatePointStatistics(playerResults)
}, [filteredSessions, selectedUserId])

// チップ統計（セッションサマリーから計算）
const chipStats = useMemo(() => {
  return calculateChipStatistics(
    filteredSessions.map(s => ({ totalChips: s.summary.totalChips }))
  )
}, [filteredSessions])
```

---

## UI実装仕様

### AnalysisTab構造

```tsx
export function AnalysisTab() {
  const { mainUser } = useUsers()
  const { sessions, loading, error } = useSessions(mainUser?.id || '')

  // フィルターState
  const [selectedUserId, setSelectedUserId] = useState<string>(mainUser?.id || '')
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('this-month')
  const [selectedMode, setSelectedMode] = useState<GameMode | 'all'>('4-player')

  // フィルター適用
  const filteredSessions = useMemo(() => {
    let filtered = sessions
    filtered = filterSessionsByPeriod(filtered, selectedPeriod)
    filtered = filterSessionsByMode(filtered, selectedMode)
    return filtered
  }, [sessions, selectedPeriod, selectedMode])

  // hanchans収集（着順統計用）
  const hanchans = useMemo(() => {
    const allHanchans: Array<{ players: PlayerResult[] }> = []
    filteredSessions.forEach(({ hanchans }) => {
      hanchans.forEach(hanchan => {
        allHanchans.push({ players: hanchan.players })
      })
    })
    return allHanchans
  }, [filteredSessions])

  // 各統計を個別に計算
  const rankStats = useMemo(() => {
    if (selectedMode === 'all') return undefined
    return calculateRankStatistics(hanchans, selectedUserId, selectedMode)
  }, [hanchans, selectedUserId, selectedMode])

  const revenueStats = useMemo(() => {
    return calculateRevenueStatistics(
      filteredSessions.map(s => ({ totalPayout: s.summary.totalPayout }))
    )
  }, [filteredSessions])

  const pointStats = useMemo(() => {
    const playerResults: PlayerResult[] = []
    filteredSessions.forEach(({ hanchans }) => {
      hanchans.forEach(hanchan => {
        const userResult = hanchan.players.find(p => p.userId === selectedUserId)
        if (userResult) playerResults.push(userResult)
      })
    })
    return calculatePointStatistics(playerResults)
  }, [filteredSessions, selectedUserId])

  const chipStats = useMemo(() => {
    return calculateChipStatistics(
      filteredSessions.map(s => ({ totalChips: s.summary.totalChips }))
    )
  }, [filteredSessions])

  return (
    <div className="space-y-4">
      {/* フィルターエリア */}
      <AnalysisFilters
        selectedUserId={selectedUserId}
        selectedPeriod={selectedPeriod}
        selectedMode={selectedMode}
        onUserChange={setSelectedUserId}
        onPeriodChange={setSelectedPeriod}
        onModeChange={setSelectedMode}
      />

      {/* 統計表示エリア */}
      {filteredSessions.length === 0 ? (
        <Card><CardContent>データがありません</CardContent></Card>
      ) : (
        <>
          {/* 着順統計（全体モード時は非表示） */}
          {selectedMode !== 'all' && rankStats && (
            <RankStatisticsCard statistics={rankStats} mode={selectedMode} />
          )}
          {selectedMode === 'all' && (
            <Card>
              <CardContent>
                ⚠️ 着順統計は表示されません。4人打ちと3人打ちでは着順の意味が異なるため、個別のモードタブをご覧ください。
              </CardContent>
            </Card>
          )}

          {/* 収支統計 */}
          <RevenueStatisticsCard statistics={revenueStats} />

          {/* ポイント統計 */}
          <PointStatisticsCard statistics={pointStats} />

          {/* チップ統計 */}
          <ChipStatisticsCard statistics={chipStats} />
        </>
      )}
    </div>
  )
}
```

### RankStatisticsCard構造

```tsx
interface RankStatisticsCardProps {
  statistics: RankStatistics
  mode: '4-player' | '3-player'
}

export function RankStatisticsCard({ statistics, mode }: RankStatisticsCardProps) {
  const maxRate = Math.max(
    statistics.rankRates.first,
    statistics.rankRates.second,
    statistics.rankRates.third,
    statistics.rankRates.fourth || 0
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>📊 着順統計（{statistics.totalGames}半荘）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <RankBar rank={1} count={statistics.rankCounts.first} rate={statistics.rankRates.first} maxRate={maxRate} />
        <RankBar rank={2} count={statistics.rankCounts.second} rate={statistics.rankRates.second} maxRate={maxRate} />
        <RankBar rank={3} count={statistics.rankCounts.third} rate={statistics.rankRates.third} maxRate={maxRate} />
        {mode === '4-player' && statistics.rankCounts.fourth !== undefined && (
          <RankBar rank={4} count={statistics.rankCounts.fourth} rate={statistics.rankRates.fourth!} maxRate={maxRate} />
        )}
        <div className="pt-2 border-t">
          平均着順: {statistics.averageRank.toFixed(2)}位
        </div>
      </CardContent>
    </Card>
  )
}

function RankBar({ rank, count, rate, maxRate }: { rank: number, count: number, rate: number, maxRate: number }) {
  const barWidth = (rate / maxRate) * 100
  return (
    <div className="flex items-center gap-2">
      <span className="w-12">{rank}位:</span>
      <span className="w-16">{count}回</span>
      <span className="w-16">({rate.toFixed(1)}%)</span>
      <div className="flex-1 bg-muted rounded overflow-hidden h-6">
        <div className="bg-blue-500 h-full" style={{ width: `${barWidth}%` }} />
      </div>
    </div>
  )
}
```

---

## リスク分析＆対策

### リスク1: パフォーマンス低下（大量データ）

**リスク内容**:
- 100セッション以上のデータで統計計算が遅延
- フィルター変更のたびに全データを再計算

**対策**:
1. **useMemoでの計算キャッシュ**:
   - フィルター条件が変わらない限り再計算しない
   - 依存配列を最小限に保つ

2. **段階的ロード**:
   - 初期表示: 今月のデータのみ
   - 全期間選択時: ローディング表示

3. **IndexedDBクエリ最適化**:
   - 既存のインデックス（sessionId, userId）を活用
   - 不要なデータフェッチを避ける

### リスク2: データ不整合（ゼロサム違反）

**リスク内容**:
- 過去のデータにバリデーション違反が存在
- 統計計算で異常値が発生

**対策**:
1. **エラーハンドリング**:
   - 統計計算中の異常値検出
   - ユーザーにエラーメッセージ表示

2. **データ検証**:
   - 計算前にデータ整合性チェック
   - 不正データをログ出力

### リスク3: UI/UXの複雑化

**リスク内容**:
- フィルター操作が分かりにくい
- 統計表示が多すぎて見にくい

**対策**:
1. **直感的なUI**:
   - フィルターエリアを画面上部に固定
   - タブ切り替えで視覚的にモード変更を明示

2. **情報の優先順位**:
   - 重要な統計（収支、着順）を上部に配置
   - スクロール可能なレイアウト

---

## テスト戦略

### 単体テスト（統計計算関数）

**対象**: db-utils.tsの統計計算関数

**テストケース**:
1. **calculateRankStatistics**:
   - 4人打ち: 正常ケース（各着順均等）
   - 3人打ち: 正常ケース（4位なし）
   - エッジケース: 0半荘、見学者のみ

2. **calculateRevenueStatistics**:
   - プラスのみ、マイナスのみ、混在
   - 0円セッションを含む

3. **calculatePointStatistics**:
   - プラスのみ、マイナスのみ、混在
   - 見学者を含むデータ

4. **calculateChipStatistics**:
   - プラス、マイナス、ゼロ

### 統合テスト（UI + 計算ロジック）

**対象**: AnalysisTab全体

**テストケース**:
1. **フィルター動作**:
   - 期間変更 → 統計再計算確認
   - モード変更 → 着順統計表示/非表示確認
   - ユーザー変更 → 統計更新確認

2. **エッジケース**:
   - データなし時のメッセージ表示
   - 全体モード時の着順統計非表示

3. **パフォーマンス**:
   - 100セッション以上でのレスポンス確認

### 手動テスト

**対象**: 実際のデータでの動作確認

**確認項目**:
1. 各統計の計算結果が正しいか
2. フィルター操作がスムーズか
3. UI/UXが直感的か

---

## 実装スケジュール

| Phase | 内容 | 見積時間 |
|-------|-----|---------|
| 5-1 | 統計計算ロジック実装 | 2-3時間 |
| 5-2 | フィルター機能実装 | 1-2時間 |
| 5-3 | 統計表示UI実装 | 2-3時間 |
| 5-4 | UX最適化 | 1時間 |
| **合計** | | **6-9時間** |

---

## 次のステップ

1. ✅ 実装計画書作成（本ドキュメント）
2. ⏭️ Phase 5-1: 統計計算ロジック実装開始
3. ⏭️ Phase 5-2: フィルター機能実装
4. ⏭️ Phase 5-3: 統計表示UI実装
5. ⏭️ Phase 5-4: UX最適化

---

**更新履歴**:
- 2025-10-05 12:30: 計画書修正（着順判定ロジック修正、統合関数削除、実装例更新）
  - `calculateRankStatistics()`の実装を点数順ソートに修正（ウママーク判定は誤り）
  - 関数シグネチャ変更: `(hanchans, targetUserId, mode)` に修正
  - `calculateAnalysisStatistics()`統合関数は実装せず、UI層で個別呼び出しに変更
- 2025-10-05 12:12: Phase 5実装計画書作成完了
