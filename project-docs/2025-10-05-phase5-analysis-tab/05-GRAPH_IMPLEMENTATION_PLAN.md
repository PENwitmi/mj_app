# Phase 5 Extension: 分析タブ グラフ表示実装計画書

**作成日**: 2025-10-07 07:45
**ステータス**: 計画完了 → 実装待ち
**担当**: Claude Code

---

## 📋 目次

1. [目的](#目的)
2. [技術選定](#技術選定)
3. [実装フェーズ](#実装フェーズ)
4. [詳細設計](#詳細設計)
5. [実装手順](#実装手順)
6. [テスト項目](#テスト項目)
7. [将来の拡張性](#将来の拡張性)

---

## 🎯 目的

分析タブの統計表示に**視覚的なグラフ**を追加し、データの理解を容易にする。

### 背景

**現状**:
- 着順統計、収支統計、ポイント統計、チップ統計が**テキストのみ**で表示
- 設計書（`06-UI_DESIGN_ANALYSIS_TAB.md`）では**バーグラフ**が想定されている

**要件**:
- 着順統計: 横棒グラフ（各着順の回数・割合を視覚化）
- 将来的: 収支推移グラフ、ポイント分布グラフ（オプション）

---

## 🛠️ 技術選定

### 選定結果: shadcn/ui Chart コンポーネント ✅

**理由**:
1. **既存エコシステムとの統合**: 既にshadcn/uiを使用中
2. **Rechartsベース**: 高機能で信頼性の高いグラフライブラリ
3. **カスタマイズ性**: Tailwind CSSとの完全統合
4. **アクセシビリティ**: `accessibilityLayer`でキーボード・スクリーンリーダー対応
5. **公式サポート**: shadcn/ui v4で正式サポート

### 技術スタック

```
shadcn/ui Chart Component
  ↓ (ラップ)
Recharts Library
  ↓ (レンダリング)
SVG/Canvas
```

**主要コンポーネント**:
- `ChartContainer`: テーマ・設定管理
- `BarChart`: Rechartsのバーグラフ
- `CartesianGrid`: グリッド表示
- `XAxis` / `YAxis`: 軸設定
- `ChartTooltip` / `ChartTooltipContent`: ツールチップ
- `ChartLegend` / `ChartLegendContent`: 凡例

---

## 📊 実装フェーズ

### Phase 5-3A: shadcn/ui Chart導入（10分）

**タスク**:
1. shadcn/ui Chart コンポーネント追加
2. Recharts依存関係インストール
3. ビルド確認

**成果物**:
- `app/src/components/ui/chart.tsx` (自動生成)
- `package.json` (recharts追加)

---

### Phase 5-3B: 着順統計バーグラフ実装（30-40分）

**タスク**:
1. `RankStatisticsChart.tsx` コンポーネント作成
2. データ変換ロジック実装
3. AnalysisTabへの統合
4. スタイリング調整（モバイル対応）

**成果物**:
- `app/src/components/analysis/RankStatisticsChart.tsx` (新規)
- `app/src/components/tabs/AnalysisTab.tsx` (修正)

---

### Phase 5-3C: テスト・調整（20分）

**タスク**:
1. 動作確認（4人打ち・3人打ち・全体モード）
2. レスポンシブ対応確認
3. アクセシビリティ確認
4. パフォーマンス確認

---

### Phase 5-4 (将来・オプション): 拡張グラフ実装

**候補**:
- 収支推移折れ線グラフ（時系列）
- ポイント分布ヒストグラム
- チップ獲得推移グラフ

---

## 🎨 詳細設計

### RankStatisticsChart コンポーネント設計

**ファイル**: `app/src/components/analysis/RankStatisticsChart.tsx`

#### Props定義

```typescript
interface RankStatisticsChartProps {
  statistics: RankStatistics  // db-utils.tsの型
  mode: '4-player' | '3-player'
}
```

#### データ変換

**入力**: `RankStatistics`
```typescript
{
  totalGames: 50,
  rankCounts: { first: 15, second: 12, third: 13, fourth: 10 },
  rankRates: { first: 30.0, second: 24.0, third: 26.0, fourth: 20.0 },
  averageRank: 2.36
}
```

**出力**: Recharts用データ構造
```typescript
const chartData = [
  { rank: "1位", count: 15, rate: 30.0 },
  { rank: "2位", count: 12, rate: 24.0 },
  { rank: "3位", count: 13, rate: 26.0 },
  { rank: "4位", count: 10, rate: 20.0 }  // 4人打ちのみ
]
```

#### Chart Configuration

```typescript
const chartConfig = {
  count: {
    label: "回数",
    color: "hsl(var(--chart-1))"  // Tailwind CSS変数
  },
  rate: {
    label: "割合",
    color: "hsl(var(--chart-2))"
  }
} satisfies ChartConfig
```

#### グラフタイプ: 横棒グラフ

**理由**:
- 着順（カテゴリー）が縦軸、回数（数値）が横軸
- 視覚的に比較しやすい
- モバイルでも見やすい

**実装例**:
```tsx
<ChartContainer config={chartConfig} className="min-h-[200px] w-full">
  <BarChart
    layout="horizontal"
    data={chartData}
    accessibilityLayer
    margin={{ left: 30, right: 20, top: 10, bottom: 10 }}
  >
    <CartesianGrid horizontal={false} />
    <YAxis
      dataKey="rank"
      type="category"
      tickLine={false}
      axisLine={false}
      width={40}
    />
    <XAxis
      type="number"
      tickLine={false}
      axisLine={false}
      domain={[0, 'dataMax']}
    />
    <ChartTooltip
      content={<ChartTooltipContent
        formatter={(value, name) => {
          if (name === 'count') return `${value}回`
          if (name === 'rate') return `${value.toFixed(1)}%`
          return value
        }}
      />}
    />
    <Bar
      dataKey="count"
      fill="var(--color-count)"
      radius={[0, 4, 4, 0]}  // 右側のみ角丸
    />
  </BarChart>
</ChartContainer>
```

---

## 📝 実装手順

### Step 1: shadcn/ui Chart導入

**実行コマンド**:
```bash
cd app
npx shadcn@latest add chart
```

**自動実行内容**:
1. `app/src/components/ui/chart.tsx` 作成
2. `package.json` に `recharts` 追加
3. `npm install` 実行

**確認**:
```bash
# TypeScriptコンパイル確認
npx tsc --noEmit

# ビルド確認
npm run build
```

---

### Step 2: RankStatisticsChart コンポーネント作成

**ファイル**: `app/src/components/analysis/RankStatisticsChart.tsx`

**実装内容**:

```typescript
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { RankStatistics } from "@/lib/db-utils"
import type { ChartConfig } from "@/components/ui/chart"

interface RankStatisticsChartProps {
  statistics: RankStatistics
  mode: '4-player' | '3-player'
}

export function RankStatisticsChart({ statistics, mode }: RankStatisticsChartProps) {
  // データ変換
  const chartData = [
    { rank: "1位", count: statistics.rankCounts.first, rate: statistics.rankRates.first },
    { rank: "2位", count: statistics.rankCounts.second, rate: statistics.rankRates.second },
    { rank: "3位", count: statistics.rankCounts.third, rate: statistics.rankRates.third },
  ]

  // 4人打ちの場合は4位を追加
  if (mode === '4-player' && statistics.rankCounts.fourth !== undefined) {
    chartData.push({
      rank: "4位",
      count: statistics.rankCounts.fourth,
      rate: statistics.rankRates.fourth || 0
    })
  }

  // Chart設定
  const chartConfig = {
    count: {
      label: "回数",
      color: "hsl(var(--chart-1))"
    }
  } satisfies ChartConfig

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">📊 着順統計（{statistics.totalGames}半荘）</div>

      {/* グラフ */}
      <ChartContainer config={chartConfig} className="min-h-[180px] w-full">
        <BarChart
          layout="horizontal"
          data={chartData}
          accessibilityLayer
          margin={{ left: 30, right: 20, top: 10, bottom: 10 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <YAxis
            dataKey="rank"
            type="category"
            tickLine={false}
            axisLine={false}
            width={40}
            className="text-xs"
          />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            domain={[0, 'dataMax']}
            className="text-xs"
          />
          <ChartTooltip
            content={<ChartTooltipContent
              formatter={(value, name) => {
                if (name === 'count') return [`${value}回`, '回数']
                return [value, name]
              }}
            />}
          />
          <Bar
            dataKey="count"
            fill="var(--color-count)"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ChartContainer>

      {/* 平均着順 */}
      <div className="pt-2 border-t text-sm">
        平均着順: <span className="font-bold">{statistics.averageRank.toFixed(2)}位</span>
      </div>

      {/* 詳細テキスト（補足情報） */}
      <div className="text-xs text-muted-foreground space-y-0.5">
        {chartData.map(({ rank, count, rate }) => (
          <div key={rank}>
            {rank}: {count}回 ({rate.toFixed(1)}%)
          </div>
        ))}
      </div>
    </div>
  )
}
```

**ポイント**:
1. **データ変換**: `RankStatistics` → Recharts用配列
2. **横棒グラフ**: `layout="horizontal"`
3. **アクセシビリティ**: `accessibilityLayer`
4. **ツールチップ**: カスタムフォーマッター
5. **モバイル対応**: `min-h-[180px]` で最小高さ確保

---

### Step 3: AnalysisTab統合

**ファイル**: `app/src/components/tabs/AnalysisTab.tsx`

**変更箇所**: Line 194-210（着順統計カード部分）

#### Before（現状 - テキストのみ）

```tsx
{selectedMode !== 'all' && rankStats && (
  <Card>
    <CardContent className="p-3">
      <div className="text-sm font-semibold mb-2">
        📊 着順統計（{rankStats.totalGames}半荘）
      </div>
      <div className="space-y-1 text-sm">
        <div>1位: {rankStats.rankCounts.first}回 ({rankStats.rankRates.first.toFixed(1)}%)</div>
        <div>2位: {rankStats.rankCounts.second}回 ({rankStats.rankRates.second.toFixed(1)}%)</div>
        <div>3位: {rankStats.rankCounts.third}回 ({rankStats.rankRates.third.toFixed(1)}%)</div>
        {selectedMode === '4-player' && rankStats.rankCounts.fourth !== undefined && (
          <div>4位: {rankStats.rankCounts.fourth}回 ({rankStats.rankRates.fourth?.toFixed(1)}%)</div>
        )}
        <div className="pt-1 border-t">平均着順: {rankStats.averageRank.toFixed(2)}位</div>
      </div>
    </CardContent>
  </Card>
)}
```

#### After（修正後 - グラフ表示）

```tsx
{selectedMode !== 'all' && rankStats && (
  <Card>
    <CardContent className="p-3">
      <RankStatisticsChart statistics={rankStats} mode={selectedMode} />
    </CardContent>
  </Card>
)}
```

**追加import**:
```typescript
import { RankStatisticsChart } from '@/components/analysis/RankStatisticsChart'
```

**変更点**:
- テキスト表示を `RankStatisticsChart` コンポーネントに置き換え
- props として `statistics` と `mode` を渡す

---

### Step 4: ビルド確認・動作テスト

#### 4-1. TypeScriptコンパイル確認

```bash
cd app
npx tsc --noEmit
```

**期待結果**: 0 errors

#### 4-2. Viteビルド確認

```bash
npm run build
```

**期待結果**: ビルド成功

#### 4-3. Dev Server起動・動作確認

```bash
npm run dev
```

**確認項目**:
- [ ] 分析タブ表示
- [ ] 着順統計グラフ表示
- [ ] 4人打ちモード: 4つのバー（1位〜4位）
- [ ] 3人打ちモード: 3つのバー（1位〜3位）
- [ ] ツールチップ表示（ホバー時）
- [ ] レスポンシブ対応（モバイル表示）
- [ ] アクセシビリティ（キーボード操作）

---

## 🧪 テスト項目

### 必須確認項目

#### 1. ビルド確認
- [ ] TypeScriptコンパイル成功
- [ ] Viteビルド成功
- [ ] Recharts依存関係正しくインストール

#### 2. グラフ表示確認（4人打ちモード）
- [ ] 4つのバー（1位〜4位）が表示
- [ ] 各バーの長さが回数に比例
- [ ] Y軸ラベル（1位、2位、3位、4位）表示
- [ ] X軸（回数）表示
- [ ] 平均着順テキスト表示

#### 3. グラフ表示確認（3人打ちモード）
- [ ] 3つのバー（1位〜3位）のみ表示
- [ ] 4位が表示されない

#### 4. インタラクティブ機能
- [ ] ツールチップ表示（バーホバー時）
- [ ] ツールチップ内容正確（回数、割合）
- [ ] キーボード操作可能（accessibilityLayer）

#### 5. レスポンシブ対応
- [ ] デスクトップ表示（1024px以上）
- [ ] タブレット表示（768px-1023px）
- [ ] モバイル表示（〜767px）
- [ ] 最小高さ確保（min-h-[180px]）

#### 6. データ更新確認
- [ ] ユーザー切り替え → グラフ更新
- [ ] 期間フィルター変更 → グラフ更新
- [ ] モード切り替え（4人打ち ⇄ 3人打ち） → グラフ更新
- [ ] データなし時 → エラー表示なし

#### 7. パフォーマンス確認
- [ ] 大量データ（100半荘以上）で動作確認
- [ ] レンダリング遅延なし
- [ ] メモリリークなし

#### 8. アクセシビリティ確認
- [ ] スクリーンリーダー対応（accessibilityLayer）
- [ ] キーボードナビゲーション
- [ ] ARIA属性適切
- [ ] コントラスト比適切

---

## 🚀 将来の拡張性

### Phase 5-4候補: 追加グラフ機能

#### 1. 収支推移折れ線グラフ

**目的**: セッション単位の収支推移を時系列で可視化

**グラフタイプ**: Line Chart（折れ線グラフ）

**データ構造**:
```typescript
const revenueChartData = [
  { date: "2025-10-01", revenue: +5000 },
  { date: "2025-10-08", revenue: -3000 },
  { date: "2025-10-15", revenue: +8000 },
  // ...
]
```

**実装コンポーネント**: `RevenueTimelineChart.tsx`

---

#### 2. ポイント分布ヒストグラム

**目的**: ポイント（±点数）の分布を可視化

**グラフタイプ**: Bar Chart（縦棒グラフ）

**データ構造**:
```typescript
const pointDistributionData = [
  { range: "-20〜-10", count: 5 },
  { range: "-10〜0", count: 12 },
  { range: "0〜10", count: 18 },
  { range: "10〜20", count: 10 },
  // ...
]
```

**実装コンポーネント**: `PointDistributionChart.tsx`

---

#### 3. チップ獲得推移

**目的**: セッション単位のチップ獲得推移を可視化

**グラフタイプ**: Area Chart（面グラフ）

**データ構造**:
```typescript
const chipChartData = [
  { date: "2025-10-01", chips: +3 },
  { date: "2025-10-08", chips: -1 },
  { date: "2025-10-15", chips: +5 },
  // ...
]
```

**実装コンポーネント**: `ChipTimelineChart.tsx`

---

### 実装優先順位

| 優先度 | 機能 | 見積時間 | Phase |
|--------|------|---------|-------|
| **高** | 着順統計バーグラフ | 1時間 | Phase 5-3 |
| 中 | 収支推移折れ線グラフ | 1.5時間 | Phase 5-4 |
| 低 | ポイント分布ヒストグラム | 1時間 | Phase 5-4 |
| 低 | チップ獲得推移 | 1時間 | Phase 5-4 |

---

## 📊 実装スケジュール

| Phase | 内容 | 見積時間 | 担当 |
|-------|------|---------|------|
| 5-3A | shadcn/ui Chart導入 | 10分 | Claude Code |
| 5-3B | 着順統計バーグラフ実装 | 30-40分 | Claude Code |
| 5-3C | テスト・調整 | 20分 | Claude Code + User |
| **合計** | | **60-70分** | |

---

## 📚 参考情報

### 関連ドキュメント

- `project-docs/2025-10-03-initial-discussion/06-UI_DESIGN_ANALYSIS_TAB.md`: 分析タブ設計書（バーグラフ要件）
- `project-docs/2025-10-05-phase5-analysis-tab/01-IMPLEMENTATION_PLAN.md`: Phase 5実装計画書
- shadcn/ui Chart Documentation: https://ui.shadcn.com/docs/components/chart
- Recharts Documentation: https://recharts.org/

### 関連ファイル

**既存ファイル**:
- `app/src/components/tabs/AnalysisTab.tsx`: 分析タブ本体（修正対象）
- `app/src/lib/db-utils.ts`: `RankStatistics`型定義

**新規ファイル**:
- `app/src/components/ui/chart.tsx`: shadcn/ui Chart（自動生成）
- `app/src/components/analysis/RankStatisticsChart.tsx`: 着順統計グラフコンポーネント

---

## ✅ 完了判定基準

### 必須項目

1. ✅ shadcn/ui Chart コンポーネント導入完了
2. ✅ Recharts依存関係インストール完了
3. ✅ `RankStatisticsChart.tsx` 作成完了
4. ✅ AnalysisTabへの統合完了
5. ✅ TypeScriptコンパイルエラー 0件
6. ✅ Viteビルド成功
7. ✅ 4人打ち・3人打ちモードで正しくグラフ表示
8. ✅ ツールチップ動作確認
9. ✅ レスポンシブ対応確認
10. ✅ アクセシビリティ確認

### 詳細確認項目

**機能確認**:
- [ ] 分析タブで着順統計グラフ表示
- [ ] 横棒グラフ形式で表示
- [ ] 4人打ち: 4つのバー表示
- [ ] 3人打ち: 3つのバー表示
- [ ] ツールチップ表示（ホバー時）
- [ ] 平均着順テキスト表示
- [ ] 詳細テキスト表示（補足情報）

**データ更新確認**:
- [ ] ユーザー切り替え時にグラフ更新
- [ ] 期間フィルター変更時にグラフ更新
- [ ] モード切り替え時にグラフ更新

**品質確認**:
- [ ] TypeScriptコンパイル成功
- [ ] Lintエラーなし
- [ ] ビルド成功
- [ ] 実行時エラーなし
- [ ] Console警告なし

---

## 🎓 学習ポイント

### shadcn/ui Chart コンポーネント

**コンポジションパターン**:
- shadcn/uiが提供するのは薄いラッパー
- Rechartsコンポーネントを直接使用
- テーマ・設定管理のみshadcn/uiが担当

**メリット**:
- Recharts更新時にロックインされない
- 柔軟なカスタマイズが可能
- 既存のRechartsドキュメント・コミュニティが利用可能

### Recharts基礎

**横棒グラフの実装**:
- `layout="horizontal"` で横棒グラフに変換
- `YAxis`: カテゴリー軸（type="category"）
- `XAxis`: 数値軸（type="number"）

**アクセシビリティ**:
- `accessibilityLayer` プロップでキーボード・スクリーンリーダー対応
- ARIA属性自動付与

---

**この計画に基づいて実装を開始する準備が整いました。**
