# 着順分布グラフ：横棒グラフ→円グラフ移行計画

**作成日**: 2025-10-10
**対象**: AnalysisTab - RankStatisticsChart コンポーネント
**目的**: 着順分布の可視化方法を横棒グラフから円グラフに変更し、割合の理解を促進する

---

## 📋 目次

1. [概要・背景](#概要背景)
2. [現状分析](#現状分析)
3. [変更方針](#変更方針)
4. [実装計画](#実装計画)
5. [技術的考慮事項](#技術的考慮事項)
6. [実装手順](#実装手順)
7. [テスト計画](#テスト計画)
8. [リスクと対策](#リスクと対策)
9. [参考資料](#参考資料)

---

## 概要・背景

### 現状の問題点
- 着順分布は**割合（パーセンテージ）**を示すデータ
- 現在の横棒グラフは**絶対値（回数）**の比較に適したビジュアライゼーション
- 全体に対する各着順の割合が直感的に理解しにくい

### 変更の目的
- 円グラフにより、全体の中での各着順の割合を一目で把握可能に
- データの性質（構成比率）に適した可視化手法の採用
- ユーザー体験の向上

---

## 現状分析

### 現在の実装（横棒グラフ）

#### ファイル構成
- **コンポーネント**: `app/src/components/analysis/RankStatisticsChart.tsx` (100行)
- **親コンポーネント**: `app/src/components/tabs/AnalysisTab.tsx` (319行)
- **データ型**: `app/src/lib/db/analysis.ts` - `RankStatistics` interface

#### 現在のコンポーネント構造
```tsx
// RankStatisticsChart.tsx (現在)
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

// データ変換
const chartData = [
  { rank: '1位', count: statistics.rankCounts.first, rate: statistics.rankRates.first },
  { rank: '2位', count: statistics.rankCounts.second, rate: statistics.rankRates.second },
  { rank: '3位', count: statistics.rankCounts.third, rate: statistics.rankRates.third },
  // 4人打ちの場合は4位も追加
]

// レンダリング
<BarChart layout="vertical" data={chartData}>
  <CartesianGrid horizontal={false} />
  <XAxis type="number" />
  <YAxis dataKey="rank" type="category" width={35} />
  <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
</BarChart>
```

#### 使用しているデータ構造
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

#### 現在の表示内容
- **タイトル**: "📊 着順分布グラフ（N半荘）"
- **X軸**: 回数（number型）
- **Y軸**: 着順（"1位", "2位", "3位", "4位"）
- **棒**: 青色（`var(--color-count)`）、右側に丸み
- **高さ**:
  - 4人打ち: `h-[200px]`
  - 3人打ち: `h-[160px]`

#### 親コンポーネントでの使用状況
```tsx
// AnalysisTab.tsx (Line 299-301)
{selectedMode !== 'all' && rankStats && (
  <RankStatisticsChart statistics={rankStats} mode={selectedMode} />
)}
```

- `selectedMode === 'all'` の場合は非表示（着順の意味が異なるため）
- `rankStats` が存在する場合のみ表示
- `mode` prop で 4人打ち/3人打ちを判別

---

## 変更方針

### なぜ円グラフが適切か

#### データの性質
- **合計が100%になる構成比データ** → 円グラフの最適なユースケース
- 各着順の割合が全体の中でどの程度を占めるかを可視化
- 割合の大小比較が直感的

#### ユーザー視点のメリット
1. **一目で理解できる**: 円の面積で割合を直感的に把握
2. **視覚的インパクト**: 偏りがある場合（例: 1位率が高い）が明確
3. **モバイルフレンドリー**: コンパクトな表示で情報量が多い

#### 麻雀アプリとしての妥当性
- 雀荘の成績表でも円グラフ表示は一般的
- 「自分は1位をどれくらい取っているか」という割合重視の分析
- 統計カードで既に回数は表示済み（重複を避ける）

---

## 実装計画

### 1. データ変換の設計

#### 入力データ（変更なし）
```typescript
statistics: RankStatistics  // 既存のインターフェース
mode: '4-player' | '3-player'
```

#### 円グラフ用データ変換
```typescript
const chartData = [
  {
    name: '1位',
    value: statistics.rankRates.first,  // パーセンテージを直接使用
    count: statistics.rankCounts.first,  // ツールチップ用に保持
    fill: '#3b82f6'  // 青（1位）
  },
  {
    name: '2位',
    value: statistics.rankRates.second,
    count: statistics.rankCounts.second,
    fill: '#10b981'  // 緑（2位）
  },
  {
    name: '3位',
    value: statistics.rankRates.third,
    count: statistics.rankCounts.third,
    fill: '#f59e0b'  // 黄（3位）
  },
  // 4人打ちのみ
  ...(mode === '4-player' && statistics.rankCounts.fourth !== undefined ? [{
    name: '4位',
    value: statistics.rankRates.fourth || 0,
    count: statistics.rankCounts.fourth,
    fill: '#ef4444'  // 赤（4位）
  }] : [])
]
```

**重要ポイント**:
- `value` には `rankRates`（パーセンテージ）を使用
- `count` は回数表示用に保持（ツールチップで活用）
- `fill` で各着順に色を割り当て

### 2. コンポーネント構造

#### 新しいインポート
```tsx
import { Pie, PieChart, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Card, CardContent } from '@/components/ui/card'
```

#### 基本構造
```tsx
<ChartContainer config={chartConfig} className="h-[240px] w-full">
  <PieChart>
    <Pie
      data={chartData}
      dataKey="value"
      nameKey="name"
      cx="50%"
      cy="50%"
      outerRadius={80}
      label={renderCustomLabel}
    >
      {chartData.map((entry, index) => (
        <Cell key={`cell-${index}`} fill={entry.fill} />
      ))}
    </Pie>
    <ChartTooltip content={<CustomTooltipContent />} />
  </PieChart>
</ChartContainer>
```

**構造のポイント**:
- `ChartContainer`: shadcn/uiの統一的なラッパー
- `Pie`: メインの円グラフコンポーネント
- `Cell`: 各セクションの色指定（個別制御）
- カスタムラベルとツールチップで情報表示

### 3. カスタムラベル実装

#### パーセンテージラベル
```tsx
const RADIAN = Math.PI / 180

const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name
}: any) => {
  // ラベル位置計算
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  // 小さすぎる割合は非表示（5%未満など）
  if (percent < 0.05) return null

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-sm font-bold"
    >
      {`${name}`}
      <tspan x={x} dy="1.2em" className="text-xs">
        {`${(percent * 100).toFixed(1)}%`}
      </tspan>
    </text>
  )
}
```

**ラベルの特徴**:
- 2行表示: 1行目=着順名、2行目=パーセンテージ
- 白文字で視認性確保
- 円の中心からの角度で位置計算
- 5%未満は非表示（スペース確保のため）

### 4. カスタムツールチップ実装

```tsx
const CustomTooltipContent = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload
  return (
    <div className="bg-background border rounded-lg p-2 shadow-lg">
      <div className="text-sm font-semibold">{data.name}</div>
      <div className="text-sm text-muted-foreground">
        {data.count}回 ({data.value.toFixed(1)}%)
      </div>
    </div>
  )
}
```

**ツールチップの内容**:
- 着順名（例: "1位"）
- 回数 + パーセンテージ（例: "15回 (35.7%)"）
- shadcn/uiのスタイリング統一

### 5. 色の設定

#### ChartConfig（shadcn/ui用）
```tsx
const chartConfig = {
  first: { label: '1位', color: '#3b82f6' },   // blue-500
  second: { label: '2位', color: '#10b981' },  // emerald-500
  third: { label: '3位', color: '#f59e0b' },   // amber-500
  fourth: { label: '4位', color: '#ef4444' }   // red-500
} satisfies ChartConfig
```

#### 色の選定理由
- **1位（青）**: 優秀、信頼を連想
- **2位（緑）**: 安定、良好な成績
- **3位（黄）**: 注意、中間的な成績
- **4位（赤）**: 警告、改善が必要

色覚多様性への配慮:
- 青-緑-黄-赤のグラデーションは識別しやすい
- 明度差もある配色

### 6. レスポンシブ対応

```tsx
// モードに応じた高さ設定は統一
const heightClass = 'h-[240px]'  // 3人/4人共通

<ChartContainer config={chartConfig} className={`w-full ${heightClass}`}>
  <PieChart>
    <Pie
      data={chartData}
      cx="50%"
      cy="50%"
      outerRadius={mode === '4-player' ? 90 : 80}  // 4人打ちはやや大きく
      // ...
    />
  </PieChart>
</ChartContainer>
```

**レスポンシブのポイント**:
- `ChartContainer` が親要素の幅に自動追従
- 高さは固定（`h-[240px]`）
- 円のサイズ（`outerRadius`）はモードで微調整
- モバイルでも十分な視認性

---

## 技術的考慮事項

### 1. Recharts PieChart の特性

#### データ要件
- `dataKey`: 数値データのキー（`value` = パーセンテージ）
- `nameKey`: ラベルのキー（`name` = "1位"等）
- データの合計が100になる必要はない（自動で比率計算）

#### 座標系
- `cx`, `cy`: 円の中心位置（パーセンテージ or 絶対値）
- `innerRadius`: 内側の半径（0 = 通常の円グラフ、>0 = ドーナツグラフ）
- `outerRadius`: 外側の半径

### 2. パフォーマンス

#### 現在の横棒グラフとの比較
- **横棒グラフ**: CartesianGrid + XAxis + YAxis + Bar → 複数SVG要素
- **円グラフ**: Pie + 3-4個のCell → よりシンプル
- レンダリングコスト: **円グラフの方が軽量**

#### 再レンダリング制御
```tsx
// RankStatisticsChart.tsx
import { memo } from 'react'

export const RankStatisticsChart = memo(({ statistics, mode }) => {
  // ...
})
```

メモ化の条件:
- `statistics` の参照が変わらない限り再レンダリング不要
- `mode` の変更時のみ再計算

### 3. アクセシビリティ

#### 必須対応
```tsx
<PieChart accessibilityLayer>
  <Pie
    data={chartData}
    // ...
  />
</PieChart>
```

#### 追加対応
- `title` 属性でグラフの説明
- キーボードナビゲーション（Recharts 3.0+で自動対応）
- スクリーンリーダー用のaria-label

### 4. Edge Cases

#### ケース1: 全て0回（データなし）
```tsx
if (statistics.totalGames === 0) {
  return (
    <Card>
      <CardContent className="p-3 text-center text-sm text-muted-foreground">
        📊 着順統計を表示するデータがありません
      </CardContent>
    </Card>
  )
}
```

#### ケース2: 極端な偏り（例: 1位率90%）
- ラベルの配置が重なる可能性
- 小さいセクション（<5%）はラベル非表示で対応

#### ケース3: 3人打ちと4人打ちの切り替え
- データ配列の長さが動的に変化
- `outerRadius` の微調整で視覚的バランス維持

---

## 実装手順

### Phase 1: プロトタイプ作成（1時間）
1. 新しい `RankStatisticsChart.tsx` の骨格作成
2. 基本的な円グラフ表示（ラベルなし）
3. データ変換ロジックの実装
4. 動作確認（dev server）

### Phase 2: ビジュアル実装（1時間）
1. カスタムラベルの実装（パーセンテージ表示）
2. Cellコンポーネントで色付け
3. カスタムツールチップの実装
4. モード別の調整（3人/4人）

### Phase 3: 統合とテスト（30分）
1. AnalysisTabでの動作確認
2. データなしケースのテスト
3. 極端な偏りのテスト
4. モバイル表示の確認

### Phase 4: リファクタリングと最適化（30分）
1. コードの整理
2. TypeScript型の厳密化
3. コメントの追加
4. パフォーマンスの確認

**合計見積もり**: 3時間

---

## テスト計画

### 1. ユニットテスト的な確認

#### データ変換の検証
```typescript
// テストケース1: 4人打ち
const test4Player: RankStatistics = {
  totalGames: 42,
  rankCounts: { first: 15, second: 10, third: 10, fourth: 7 },
  rankRates: { first: 35.7, second: 23.8, third: 23.8, fourth: 16.7 },
  averageRank: 2.21
}
// → chartDataが4要素、合計が100に近い

// テストケース2: 3人打ち
const test3Player: RankStatistics = {
  totalGames: 30,
  rankCounts: { first: 12, second: 10, third: 8 },
  rankRates: { first: 40.0, second: 33.3, third: 26.7 },
  averageRank: 1.87
}
// → chartDataが3要素

// テストケース3: データなし
const testNoData: RankStatistics = {
  totalGames: 0,
  rankCounts: { first: 0, second: 0, third: 0 },
  rankRates: { first: 0, second: 0, third: 0 },
  averageRank: 0
}
// → エラーメッセージ表示
```

### 2. 視覚的な確認

#### チェックリスト
- [ ] 円グラフが中央に配置されている
- [ ] 各セクションの色が正しい（1位=青、2位=緑、3位=黄、4位=赤）
- [ ] ラベルが読みやすい位置に表示
- [ ] パーセンテージが正確（合計100%に近い）
- [ ] ツールチップが正しい情報を表示
- [ ] モバイルビューで崩れない
- [ ] 3人/4人の切り替えがスムーズ

### 3. ユーザーシナリオテスト

#### シナリオ1: 均等分布
- 4人打ちで各25%前後 → 円が4等分に近い

#### シナリオ2: 強い偏り
- 1位率60%、その他各13%程度 → 1位のセクションが支配的

#### シナリオ3: モード切り替え
- 4人打ち → 3人打ち → 全体 → 4人打ち
- データの再計算と表示更新が正常

### 4. パフォーマンステスト

#### 測定項目
- 初回レンダリング時間
- フィルター変更時の再レンダリング時間
- メモリ使用量

#### 期待値
- 初回レンダリング: <100ms
- 再レンダリング: <50ms
- メモリ増加: 横棒グラフと同等以下

---

## リスクと対策

### リスク1: ラベルの重なり
**問題**: 小さいセクションでラベルが重なる

**対策**:
- 5%未満のセクションはラベル非表示
- 必要に応じてLabelListで外側配置
- ツールチップで情報補完

### リスク2: 色覚多様性への非対応
**問題**: 色の識別が困難なユーザーがいる

**対策**:
- 明度差のある配色
- パターン追加の検討（将来的）
- ツールチップでテキスト情報を明示

### リスク3: データの理解が難しい
**問題**: 回数情報が見えなくなる

**対策**:
- ツールチップに回数も表示
- 統計カードで詳細情報は既に表示済み
- タイトルに総半荘数を明記

### リスク4: モバイルでの視認性
**問題**: 小さい画面でラベルが読みにくい

**対策**:
- フォントサイズの最適化
- 円のサイズ調整
- ツールチップで情報補完

### リスク5: Recharts依存の問題
**問題**: ライブラリのバグや制限

**対策**:
- Recharts 3.0は安定版
- 必要に応じてカスタムSVGで実装可能
- 代替ライブラリ（Nivo等）も検討可能

---

## 参考資料

### Recharts公式ドキュメント
- **PieChart API**: https://recharts.org/en-US/api/PieChart
- **Pie Component**: https://recharts.org/en-US/api/Pie
- **Cell Component**: https://recharts.org/en-US/api/Cell
- **Custom Labels**: https://recharts.org/en-US/examples/PieChartWithCustomizedLabel

### コミュニティリソース
- **Stack Overflow - Custom Labels**: https://stackoverflow.com/questions/56104004/rechart-adding-labels-to-charts
- **CodeSandbox - Pie Chart Example**: https://codesandbox.io/s/rechart-pie-chart-w-custom-label-example-hzefi
- **Medium - Pie Chart Hacks**: https://celiaongsl.medium.com/2-secret-pie-chart-hacks-to-up-your-recharts-game-hack-recharts-1-9fa62ff9416a

### プロジェクト内参考
- **CLAUDE.md**: `/Users/nishimototakashi/claude_code/mj_app/CLAUDE.md`
- **Recharts横棒グラフガイド**: `/Users/nishimototakashi/claude code/development-insights/charts/recharts-horizontal-bar-chart-guide.md`
- **RechartsLineChart実装ガイド**: `/Users/nishimototakashi/claude code/development-insights/charts/recharts-linechart-implementation-guide.md`

### デザイン参考
- **Color Palette**: Tailwind CSS color scale
- **Accessibility**: WCAG 2.1 AA基準
- **Chart Design Best Practices**: Edward Tufte "The Visual Display of Quantitative Information"

---

## 付録: コード全体像（プロトタイプ）

### 新しい RankStatisticsChart.tsx
```tsx
import { memo } from 'react'
import { Pie, PieChart, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig
} from '@/components/ui/chart'
import { Card, CardContent } from '@/components/ui/card'
import type { RankStatistics } from '@/lib/db-utils'

interface RankStatisticsChartProps {
  statistics: RankStatistics
  mode: '4-player' | '3-player'
}

const RADIAN = Math.PI / 180

// 色定義
const COLORS = {
  first: '#3b82f6',   // blue-500
  second: '#10b981',  // emerald-500
  third: '#f59e0b',   // amber-500
  fourth: '#ef4444'   // red-500
}

export const RankStatisticsChart = memo(({
  statistics,
  mode
}: RankStatisticsChartProps) => {

  // エラーハンドリング: データなし
  if (statistics.totalGames === 0) {
    return (
      <Card>
        <CardContent className="p-3 text-center text-sm text-muted-foreground">
          📊 着順統計を表示するデータがありません
        </CardContent>
      </Card>
    )
  }

  // チャートデータ変換
  const chartData = [
    {
      name: '1位',
      value: statistics.rankRates.first,
      count: statistics.rankCounts.first,
      fill: COLORS.first
    },
    {
      name: '2位',
      value: statistics.rankRates.second,
      count: statistics.rankCounts.second,
      fill: COLORS.second
    },
    {
      name: '3位',
      value: statistics.rankRates.third,
      count: statistics.rankCounts.third,
      fill: COLORS.third
    }
  ]

  if (mode === '4-player' && statistics.rankCounts.fourth !== undefined) {
    chartData.push({
      name: '4位',
      value: statistics.rankRates.fourth || 0,
      count: statistics.rankCounts.fourth,
      fill: COLORS.fourth
    })
  }

  const chartConfig = {
    first: { label: '1位', color: COLORS.first },
    second: { label: '2位', color: COLORS.second },
    third: { label: '3位', color: COLORS.third },
    fourth: { label: '4位', color: COLORS.fourth }
  } satisfies ChartConfig

  // カスタムラベル
  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    name
  }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    // 5%未満は非表示
    if (percent < 0.05) return null

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-sm font-bold"
      >
        {name}
        <tspan x={x} dy="1.2em" className="text-xs">
          {`${(percent * 100).toFixed(1)}%`}
        </tspan>
      </text>
    )
  }

  // カスタムツールチップ
  const CustomTooltipContent = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null

    const data = payload[0].payload
    return (
      <div className="bg-background border rounded-lg p-2 shadow-lg">
        <div className="text-sm font-semibold">{data.name}</div>
        <div className="text-sm text-muted-foreground">
          {data.count}回 ({data.value.toFixed(1)}%)
        </div>
      </div>
    )
  }

  const outerRadius = mode === '4-player' ? 90 : 80

  return (
    <Card>
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="text-sm font-semibold">
            📊 着順分布（{statistics.totalGames}半荘）
          </div>

          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <PieChart accessibilityLayer>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={outerRadius}
                label={renderCustomLabel}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip content={<CustomTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
})

RankStatisticsChart.displayName = 'RankStatisticsChart'
```

---

## まとめ

### 実装のメリット
✅ **データの性質に適合**: 構成比データ → 円グラフ
✅ **視覚的理解の向上**: 割合が一目で把握可能
✅ **コード量の削減**: 横棒グラフより実装がシンプル
✅ **パフォーマンス向上**: レンダリングコストの低減
✅ **ユーザー体験向上**: 麻雀アプリとして自然な表示

### 実装の注意点
⚠️ **ラベル配置**: 小さいセクションの扱いに注意
⚠️ **色の選択**: 色覚多様性への配慮
⚠️ **データ検証**: 極端なケースのテスト
⚠️ **モバイル対応**: レスポンシブ設計の確認

### 次のステップ
1. このドキュメントの妥当性検証
2. プロトタイプ実装
3. ユーザーフィードバック収集
4. 本実装・デプロイ

---

**ドキュメント完了日**: 2025-10-10
**次回レビュー予定**: 実装前
