# Phase 5-4: 収支推移折れ線グラフ実装計画書

**作成日**: 2025-10-07
**完了日**: 2025-10-09 13:51
**ステータス**: ✅ 実装完了
**担当**: Claude Code
**実装時間**: 約2時間

---

## 📋 目次

1. [目的](#目的)
2. [実装工程の全体像](#実装工程の全体像)
3. [Step 1: データ構造とコンポーネント設計](#step-1-データ構造とコンポーネント設計)
4. [Step 2: RevenueTimelineChart.tsx実装](#step-2-revenuetimelinechart-tsx実装)
5. [Step 3: AnalysisTabへの統合](#step-3-analysistabへの統合)
6. [Step 4: テスト・動作確認・調整](#step-4-テスト動作確認調整)
7. [実装スケジュール](#実装スケジュール)
8. [UI/UX考慮事項](#ui-ux考慮事項)
9. [完了判定基準](#完了判定基準)

---

## 🎯 目的

セッション単位の収支を時系列で可視化し、収支の傾向を直感的に把握できるようにする。

### 背景

**現状**:
- 収支統計カードで総収入・総支出・総収支を表示（合計値のみ）
- 時系列での推移が分からない
- どの時期に収支が良い/悪いかの傾向が見えない

**要件**:
- セッション単位の収支を折れ線グラフで可視化
- 累積収支の推移も表示（オプション）
- 時系列での傾向分析を可能にする

### 技術スタック

- **Recharts LineChart**: 折れ線グラフ描画
- **shadcn/ui ChartContainer**: テーマ・設定管理
- **既存のAnalysisTab**: フィルター機能との統合

---

## 📊 実装工程の全体像

### 全体構成

```
Step 1: データ構造・コンポーネント設計 (15-20分)
  ├─ データ変換ロジック設計
  └─ コンポーネント設計（Props、機能要件）

Step 2: RevenueTimelineChart.tsx実装 (40-50分)
  ├─ データ変換関数実装
  ├─ グラフコンポーネント実装
  └─ エラーハンドリング実装

Step 3: AnalysisTabへの統合 (20-30分)
  ├─ import追加
  ├─ レイアウト調整
  └─ レスポンシブ考慮

Step 4: テスト・動作確認・調整 (20-30分)
  ├─ ビルド確認
  ├─ 機能確認
  └─ パフォーマンス確認
```

---

## 🔧 Step 1: データ構造とコンポーネント設計

**見積時間**: 15-20分

### 1.1 データ変換ロジック設計

#### 入力データ

**型**: `SessionWithSummary[]` (from useSessions)

```typescript
{
  session: {
    id: string
    date: string          // YYYY-MM-DD形式
    rate: number
    umaValue: number
    chipRate: number
    parlorFee: number
  },
  summary: {
    revenue: number       // 総収支（円）
    // ... その他サマリー
  },
  hanchans: Array<{
    players: PlayerResult[]
  }>
}
```

#### 出力データ

**型**: 時系列チャート用配列

```typescript
interface RevenueTimelineData {
  date: string          // YYYY-MM-DD形式（ソート用）
  revenue: number       // セッション収支（円）
  cumulative: number    // 累積収支（円）
  label: string         // 表示用ラベル（MM/DD形式）
}
```

**データ例**:
```typescript
[
  { date: "2025-10-01", revenue: +5000, cumulative: +5000, label: "10/01" },
  { date: "2025-10-08", revenue: -3000, cumulative: +2000, label: "10/08" },
  { date: "2025-10-15", revenue: +8000, cumulative: +10000, label: "10/15" },
]
```

### 1.2 コンポーネント設計

#### ファイル構成

**新規作成**: `app/src/components/analysis/RevenueTimelineChart.tsx`

#### Props定義

```typescript
interface RevenueTimelineChartProps {
  sessions: SessionWithSummary[]  // filteredSessions（時系列ソート済み想定）
  userId: string                  // 対象ユーザーID
  showCumulative?: boolean        // 累積収支線を表示するか（デフォルト: true）
}
```

#### 機能要件

1. ✅ **基本表示**
   - セッション単位の収支を折れ線グラフで表示
   - 累積収支の推移も表示（オプション）
   - y=0の参照線（プラス/マイナスの境界）

2. ✅ **インタラクティブ機能**
   - ツールチップで詳細表示（日付、収支、累積収支）
   - ドット強調（ホバー時）
   - アクセシビリティ対応（accessibilityLayer）

3. ✅ **レスポンシブ対応**
   - 高さ: `h-[280px]`（横棒グラフより高め）
   - モバイル対応（X軸ラベル間引き）

4. ✅ **エラーハンドリング**
   - データなし時のメッセージ表示
   - セッション0件 → "表示できるデータがありません"

---

## 🎨 Step 2: RevenueTimelineChart.tsx実装

**見積時間**: 40-50分

### 2.1 データ変換関数実装

#### prepareTimelineData関数

```typescript
function prepareTimelineData(
  sessions: SessionWithSummary[],
  userId: string
): RevenueTimelineData[] {
  // 1. 日付昇順ソート（時系列順）
  const sorted = [...sessions].sort((a, b) =>
    a.session.date.localeCompare(b.session.date)
  )

  let cumulative = 0

  // 2. 各セッションの収支計算
  return sorted.map(({ session, hanchans }) => {
    // hanchansから対象ユーザーの収支を計算
    let sessionRevenue = 0

    hanchans?.forEach(hanchan => {
      const userResult = hanchan.players.find(p => p.userId === userId)
      if (userResult) {
        // calculatePayoutで正確な収支計算（円）
        const payout = calculatePayout(
          userResult.score,
          userResult.umaMark,
          userResult.chips,
          session.rate,
          session.umaValue,
          session.chipRate,
          session.parlorFee
        )
        sessionRevenue += payout
      }
    })

    // 累積収支更新
    cumulative += sessionRevenue

    return {
      date: session.date,
      revenue: sessionRevenue,
      cumulative,
      label: formatDateLabel(session.date) // "10/05"形式
    }
  })
}
```

#### formatDateLabel関数

```typescript
function formatDateLabel(dateStr: string): string {
  // "2025-10-05" → "10/05"
  const [, month, day] = dateStr.split('-')
  return `${month}/${day}`
}
```

### 2.2 グラフコンポーネント実装

#### Chart Configuration

```typescript
const chartConfig = {
  revenue: {
    label: "収支",
    color: "hsl(var(--chart-1))" // 青色
  },
  cumulative: {
    label: "累積収支",
    color: "hsl(var(--chart-2))" // 緑色
  }
} satisfies ChartConfig
```

#### グラフ実装

**グラフタイプ**: LineChart（折れ線グラフ）

**主要機能**:
- 2本の線: 収支（青・実線）、累積収支（緑・破線）
- カーテシアングリッド（水平線のみ）
- X軸: 日付ラベル（MM/DD）
- Y軸: 金額（円）、+/-プレフィックス付き
- ツールチップ: カスタムフォーマッター
- 参照線: y=0ライン（収支プラス/マイナスの境界）

**実装例**:

```tsx
<ChartContainer config={chartConfig} className="h-[280px] w-full">
  <LineChart
    data={chartData}
    margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
    accessibilityLayer
  >
    {/* グリッド（水平線のみ） */}
    <CartesianGrid strokeDasharray="3 3" vertical={false} />

    {/* X軸（日付） */}
    <XAxis
      dataKey="label"
      tick={{ fontSize: 12 }}
      interval="preserveStartEnd"  // 最初と最後は必ず表示
      tickLine={false}
      axisLine={false}
    />

    {/* Y軸（金額） */}
    <YAxis
      tick={{ fontSize: 12 }}
      tickFormatter={(value) => `${value >= 0 ? '+' : ''}${value}`}
      tickLine={false}
      axisLine={false}
    />

    {/* 参照線（y=0） */}
    <ReferenceLine
      y={0}
      stroke="hsl(var(--border))"
      strokeDasharray="3 3"
    />

    {/* ツールチップ */}
    <ChartTooltip
      content={<ChartTooltipContent
        formatter={(value, name) => {
          const numValue = typeof value === 'number' ? value : Number(value)
          if (name === 'revenue') return [`${numValue >= 0 ? '+' : ''}${numValue}円`, '収支']
          if (name === 'cumulative') return [`${numValue >= 0 ? '+' : ''}${numValue}円`, '累積収支']
          return [value, name]
        }}
      />}
    />

    {/* 収支線（実線） */}
    <Line
      type="monotone"
      dataKey="revenue"
      stroke="var(--color-revenue)"
      strokeWidth={2}
      dot={{ r: 4 }}
      activeDot={{ r: 6 }}
    />

    {/* 累積収支線（破線）- オプション */}
    {showCumulative && (
      <Line
        type="monotone"
        dataKey="cumulative"
        stroke="var(--color-cumulative)"
        strokeWidth={2}
        strokeDasharray="5 5"
        dot={{ r: 3 }}
        activeDot={{ r: 5 }}
      />
    )}
  </LineChart>
</ChartContainer>
```

### 2.3 エラーハンドリング

#### データなし時の表示

```typescript
export function RevenueTimelineChart({
  sessions,
  userId,
  showCumulative = true
}: RevenueTimelineChartProps) {
  // データ変換
  const chartData = useMemo(() =>
    prepareTimelineData(sessions, userId),
    [sessions, userId]
  )

  // エッジケース: データなし
  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          表示できるデータがありません
        </CardContent>
      </Card>
    )
  }

  // グラフレンダリング
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-sm font-semibold mb-2">📈 収支推移</div>
        {/* グラフ */}
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          {/* ... */}
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
```

### 2.4 完全なコンポーネント構造

```typescript
import { useMemo } from 'react'
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ReferenceLine } from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { SessionWithSummary } from '@/hooks/useSessions'
import type { ChartConfig } from "@/components/ui/chart"
import { calculatePayout } from '@/lib/session-utils'

interface RevenueTimelineChartProps {
  sessions: SessionWithSummary[]
  userId: string
  showCumulative?: boolean
}

interface RevenueTimelineData {
  date: string
  revenue: number
  cumulative: number
  label: string
}

function formatDateLabel(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${month}/${day}`
}

function prepareTimelineData(
  sessions: SessionWithSummary[],
  userId: string
): RevenueTimelineData[] {
  // 実装は上記参照
}

export function RevenueTimelineChart({
  sessions,
  userId,
  showCumulative = true
}: RevenueTimelineChartProps) {
  const chartData = useMemo(() =>
    prepareTimelineData(sessions, userId),
    [sessions, userId]
  )

  const chartConfig = {
    revenue: {
      label: "収支",
      color: "hsl(var(--chart-1))"
    },
    cumulative: {
      label: "累積収支",
      color: "hsl(var(--chart-2))"
    }
  } satisfies ChartConfig

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          表示できるデータがありません
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-sm font-semibold mb-2">📈 収支推移</div>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          {/* グラフ実装は上記参照 */}
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
```

---

## 🔗 Step 3: AnalysisTabへの統合

**見積時間**: 20-30分

### 3.1 import追加

**ファイル**: `app/src/components/tabs/AnalysisTab.tsx`

```typescript
import { RevenueTimelineChart } from '@/components/analysis/RevenueTimelineChart'
```

### 3.2 レイアウト調整

#### 配置位置

**着順統計グラフの下、収支統計カードの上**

**理由**:
1. **視覚的グループ化**: グラフ2つを連続配置（着順統計 → 収支推移）
2. **情報の流れ**: 収支推移（詳細）→ 収支統計（合計値）の順が自然
3. **分析エリア形成**: 上部にグラフエリア、下部に統計カードエリア

#### 実装例

**変更箇所**: Line 193-205付近（着順統計グラフとの間）

```tsx
{/* 着順統計グラフ */}
{selectedMode !== 'all' && rankStats && (
  <RankStatisticsChart statistics={rankStats} mode={selectedMode} />
)}
{selectedMode === 'all' && (
  <Card>
    <CardContent className="p-3 text-center text-sm text-muted-foreground">
      ⚠️ 着順統計は表示されません。4人打ちと3人打ちでは着順の意味が異なるため、個別のモードタブをご覧ください。
    </CardContent>
  </Card>
)}

{/* 収支推移グラフ（新規追加） */}
{filteredSessions.length > 0 && (
  <RevenueTimelineChart
    sessions={filteredSessions}
    userId={selectedUserId}
    showCumulative={true}
  />
)}

{/* 収支統計カード（既存・変更なし） */}
{revenueStats && (
  <Card>
    <CardContent className="p-3">
      <div className="text-sm font-semibold mb-2">💰 収支統計</div>
      {/* ... */}
    </CardContent>
  </Card>
)}
```

### 3.3 レスポンシブ考慮

#### グラフ高さ設定

- **デスクトップ**: `h-[280px]`（折れ線グラフは横棒グラフより高めに設定）
- **モバイル**: 同じ高さ維持（Y軸の視認性確保）

#### X軸ラベル間引き

- `interval="preserveStartEnd"`: 最初と最後は必ず表示
- Rechartsが自動的に中間を間引き（モバイル対応）

---

## 🧪 Step 4: テスト・動作確認・調整

**見積時間**: 20-30分

### 4.1 ビルド確認

#### TypeScriptコンパイル確認

```bash
cd app
npx tsc --noEmit
```

**期待結果**: 0 errors

#### Viteビルド確認

```bash
npm run build
```

**期待結果**: ビルド成功

### 4.2 機能確認

#### TC-1: 基本表示確認

**手順**:
1. 分析タブに移動
2. ユーザー選択: メインユーザー
3. 期間: 全期間
4. モード: 4人打ち

**期待結果**:
- ✅ 収支推移グラフが表示される
- ✅ 収支線（青・実線）が表示される
- ✅ 累積収支線（緑・破線）が表示される
- ✅ y=0参照線が表示される
- ✅ X軸に日付ラベル（MM/DD）が表示される
- ✅ Y軸に金額（+/-付き）が表示される

#### TC-2: データ更新確認

**手順**:
1. ユーザー切り替え → グラフ更新確認
2. 期間フィルター変更（今月 → 今年）→ グラフ更新確認
3. モード切り替え（4人打ち → 3人打ち）→ グラフ更新確認

**期待結果**:
- ✅ フィルター変更時にグラフが即座に更新される
- ✅ データが正しく反映される

#### TC-3: インタラクティブ機能確認

**手順**:
1. グラフ上のドットにホバー
2. ツールチップ表示確認
3. キーボード操作（Tab, Arrow keys）

**期待結果**:
- ✅ ツールチップが表示される
- ✅ ツールチップ内容: "収支: +5,000円"、"累積収支: +12,000円"
- ✅ ホバー時にドットが拡大（activeDot）
- ✅ キーボード操作可能（accessibilityLayer）

#### TC-4: エッジケース確認

**テストケース**:

1. **セッション1件のみ**
   - 期待: 1点のみ表示（線が引けない）
   - 実際: グラフが正常表示されるか確認

2. **データなし**
   - フィルター条件を厳しくしてデータ0件にする
   - 期待: "表示できるデータがありません" メッセージ

3. **全収支マイナス**
   - 期待: Y軸が負の範囲に対応、グラフが正常表示

4. **大量セッション（50件以上）**
   - 期待: X軸ラベルが自動間引き、描画速度問題なし

#### TC-5: レスポンシブ確認

**デバイス幅テスト**:

| デバイス | 幅 | 確認項目 |
|---------|-----|---------|
| デスクトップ | 1920px | グラフ全体が見やすい |
| タブレット | 768px | グラフ高さ適切、X軸ラベル読める |
| モバイル | 375px | X軸ラベル間引き、Y軸ラベル読める |

**期待結果**:
- ✅ 全デバイスでグラフが適切に表示される
- ✅ モバイルでX軸ラベルが重ならない（自動間引き）

### 4.3 パフォーマンス確認

#### 描画速度

- 大量セッション（50件以上）での初期描画
- タブ切り替え時の再描画速度

**期待値**: 100ms以内

#### メモリ使用量

- React DevTools Profiler使用
- メモリリークの有無確認

**期待値**: タブ切り替え時にメモリが解放される

---

## 📊 実装スケジュール

| Step | 内容 | 見積時間 | 担当 |
|------|------|---------|------|
| **1** | データ構造・コンポーネント設計 | 15-20分 | Claude Code |
| **2** | RevenueTimelineChart.tsx実装 | 40-50分 | Claude Code |
| **3** | AnalysisTab統合・レイアウト調整 | 20-30分 | Claude Code |
| **4** | テスト・動作確認・調整 | 20-30分 | Claude Code + User |
| **合計** | | **95-130分 (1.5-2時間)** | |

---

## 🎨 UI/UX考慮事項

### カラースキーム

| 要素 | 色 | 理由 |
|------|-----|------|
| **収支線** | 青色（`hsl(var(--chart-1))`） | 単発の収支、目立たせる |
| **累積収支線** | 緑色（`hsl(var(--chart-2))`） | 全体的な傾向、補助的 |
| **参照線（y=0）** | グレー破線（`hsl(var(--border))`） | プラス/マイナスの境界 |

### 視覚的差別化

| 要素 | スタイル |
|------|---------|
| 収支線 | 実線、太さ2、ドット大きめ（r=4） |
| 累積収支線 | 破線（5-5）、太さ2、ドット小さめ（r=3） |
| ホバー時ドット | activeDot（r=6, r=5） |

### ラベリング

#### X軸（日付）
- **形式**: "MM/DD" （例: "10/05"）
- **理由**: 省スペース、視認性良好

#### Y軸（金額）
- **形式**: "+5000" / "-3000"
- **理由**: プラス収支を視覚的に強調

#### ツールチップ
- **形式**: "収支: +5,000円"、"累積収支: +12,000円"
- **理由**: 詳細情報を分かりやすく表示

### アクセシビリティ

- ✅ `accessibilityLayer` 使用（キーボード操作、スクリーンリーダー対応）
- ✅ ARIA属性自動付与（Recharts機能）
- ✅ 色だけに依存しない情報表現（実線/破線で区別）

---

## ✅ 完了判定基準

### 必須項目

1. ✅ `RevenueTimelineChart.tsx` 作成完了
2. ✅ `AnalysisTab.tsx` 統合完了
3. ✅ TypeScriptコンパイルエラー 0件
4. ✅ Viteビルド成功
5. ✅ 折れ線グラフ表示（収支・累積収支）
6. ✅ ツールチップ動作確認
7. ✅ レスポンシブ対応確認
8. ✅ データ更新確認（フィルター連動）

### 詳細確認項目

**機能確認**:
- [ ] 分析タブで収支推移グラフ表示
- [ ] 収支線（青・実線）表示
- [ ] 累積収支線（緑・破線）表示
- [ ] y=0参照線表示
- [ ] ツールチップ表示（ホバー時）
- [ ] ツールチップ内容正確（収支、累積収支）
- [ ] キーボード操作可能

**データ更新確認**:
- [ ] ユーザー切り替え時にグラフ更新
- [ ] 期間フィルター変更時にグラフ更新
- [ ] モード切り替え時にグラフ更新

**エッジケース確認**:
- [ ] セッション0件 → エラーメッセージ表示
- [ ] セッション1件 → 1点のみ表示
- [ ] 全収支マイナス → Y軸が負の範囲に対応

**レスポンシブ確認**:
- [ ] デスクトップ表示（1920px）
- [ ] タブレット表示（768px）
- [ ] モバイル表示（375px）
- [ ] X軸ラベル自動間引き（モバイル）

**品質確認**:
- [ ] TypeScriptコンパイル成功
- [ ] Lintエラーなし
- [ ] ビルド成功
- [ ] 実行時エラーなし
- [ ] Console警告なし

---

## 📚 参考情報

### 関連ドキュメント

- `project-docs/2025-10-05-phase5-analysis-tab/01-IMPLEMENTATION_PLAN.md`: Phase 5実装計画書
- `project-docs/2025-10-05-phase5-analysis-tab/05-GRAPH_IMPLEMENTATION_PLAN.md`: グラフ実装計画書（着順統計）
- shadcn/ui Chart Documentation: https://ui.shadcn.com/docs/components/chart
- Recharts LineChart: https://recharts.org/en-US/api/LineChart

### 関連ファイル

**既存ファイル**:
- `app/src/components/tabs/AnalysisTab.tsx`: 分析タブ本体（修正対象）
- `app/src/components/analysis/RankStatisticsChart.tsx`: 着順統計グラフ（参考実装）
- `app/src/hooks/useSessions.ts`: SessionWithSummary型定義
- `app/src/lib/session-utils.ts`: calculatePayout関数

**新規ファイル**:
- `app/src/components/analysis/RevenueTimelineChart.tsx`: 収支推移グラフコンポーネント

---

## 🎓 学習ポイント

### LineChartの特性

**横棒グラフ（BarChart）との違い**:
- **データ点の連続性**: 折れ線グラフは時系列データに適している
- **トレンド可視化**: 収支の推移・傾向を直感的に把握できる
- **複数線の表示**: 収支と累積収支を同時表示可能

**実装のポイント**:
- `type="monotone"`: 滑らかな曲線（データ点を自然に補間）
- `strokeDasharray`: 実線/破線の区別（視覚的差別化）
- `ReferenceLine`: 基準線（y=0で収支の境界を明示）

### useMemoによる最適化

**データ変換のメモ化**:
```typescript
const chartData = useMemo(() =>
  prepareTimelineData(sessions, userId),
  [sessions, userId]
)
```

**理由**:
- `sessions`や`userId`が変わらない限り再計算しない
- フィルター変更時のみ再計算（パフォーマンス向上）

---

---

## ✅ 実装完了報告（2025-10-09 13:51）

### 実装成果

**完成物**:
- ✅ `RevenueTimelineChart.tsx` 実装完了
- ✅ `AnalysisTab.tsx` 統合完了
- ✅ TypeScriptコンパイル成功
- ✅ Viteビルド成功
- ✅ 収支推移グラフ（実線）と累積収支グラフ（破線）の2本が正常表示

**動作確認済み**:
- ✅ 分析タブで収支推移グラフが表示される
- ✅ 収支線（青・実線）が正常表示
- ✅ 累積収支線（緑・破線）が正常表示
- ✅ データがフィルター条件に連動して更新される

### 実装中に発見した重要な問題と解決策

#### 問題1: CartesianGridの設定ミス

**症状**: LineChartが表示されない（width(0) height(0)エラー）

**原因**: `<CartesianGrid vertical={false} />` を使用していた
- 動いているBarChartでは `<CartesianGrid horizontal={false} />` を使用
- **Rechartsの命名は直感に反する**: `horizontal={false}`は水平線を非表示（垂直線のみ表示）

**解決策**:
```tsx
// ❌ 誤り
<CartesianGrid vertical={false} />

// ✅ 正解
<CartesianGrid horizontal={false} />
```

**教訓**:
- Rechartsの`horizontal`/`vertical`パラメータは「表示する線の方向」ではなく「非表示にする線の方向」を指定
- 過去のインシデント教訓（BarChart layout="vertical"で横棒グラフ）と同じパターン
- 公式ドキュメントより、動作している実装を参考にすべき

#### 問題2: LineコンポーネントでCSS変数が効かない

**症状**: `stroke="var(--color-revenue)"` が効かず、LineChartが表示されない

**原因**: RechartsのLineコンポーネントがCSS変数を正しく解決できない
- Barコンポーネントの`fill="var(--color-count)"`は動作する
- Lineコンポーネントの`stroke`属性では動作しない

**解決策**: 直接色を指定
```tsx
// ❌ 動かない
<Line stroke="var(--color-revenue)" />

// ✅ 動く
<Line stroke="#3b82f6" />  // 青色
<Line stroke="#10b981" />  // 緑色
```

**暫定対応**:
- chartConfigの色定義も直接色に変更
- 将来的にはshadcn/uiまたはRechartsの更新で解決される可能性あり

**未解決**: CSS変数が効かない根本原因の調査は今後の課題

### デバッグプロセス

**段階的アプローチ**:
1. **初期実装**: 計画通りに実装 → 表示されない
2. **仮説検証**: サイズ設定の問題と推測 → 外れ
3. **包括的デバッグ**: ユーザーの指摘により広範囲にログ追加
4. **データ確認**: データフローは正常と確認
5. **TESTタブ作成**: 複数パターンで体系的にテスト
6. **比較分析**: 動作しているBarChartと比較
7. **問題特定**: CartesianGrid設定とCSS変数の2つの問題を発見
8. **解決**: 両方を修正して成功

**重要な教訓**:
- 「一つの原因を見つけて満足しない」（ユーザーの指摘）
- 包括的なデバッグアプローチの重要性
- 動作している実装との比較が有効
- TESTタブによる体系的な検証が有効

### ファイル変更サマリー

**新規作成**:
- `app/src/components/analysis/RevenueTimelineChart.tsx` (213行)

**変更**:
- `app/src/components/tabs/AnalysisTab.tsx`: import追加、グラフ統合（208-212行）
- `app/src/App.tsx`: デフォルトタブを'input'に戻す（15行）

**削除**:
- `app/src/components/test/LineChartTest.tsx`: デバッグ用TESTタブ（不要になったため削除）

### 今後の改善課題

1. **CSS変数問題の調査**: LineコンポーネントでCSS変数が効かない原因を調査
2. **テーマ対応**: ダークモード等のテーマ切り替え時の色調整
3. **パフォーマンス最適化**: 大量セッション（50件以上）での描画速度確認
4. **UI/UX改善**: ユーザーフィードバックに基づく調整

---

**Phase 5-4（収支推移折れ線グラフ）実装完了 ✅**
