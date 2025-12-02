# Issue #14 詳細グラフ実装設計書

## 1. 現状分析

### 1.1 既存コンポーネント

| コンポーネント | グラフ種類 | データ単位 | 機能 |
|--------------|----------|----------|------|
| `RankStatisticsChartPiePrototype` | 円グラフ | 集計 | 着順分布表示 |
| `RevenueTimelineChart` | 折れ線 | セッション | 個別/累積切替 |

### 1.2 データ可用性

```
AnalysisTab
  └─ useSessions(mainUserId, { includeHanchans: true })
       └─ sessions: SessionWithSummary[]
            ├─ session: Session (date, rate, etc.)
            ├─ summary: SessionSummary (totalPayout, totalChips, etc.)
            └─ hanchans: Array<Hanchan & { players: PlayerResult[] }>
                          ↑ 半荘単位データ（着順推移に必要）
```

## 2. Issue #14 要件

### 2.1 グラフ仕様（Issue本文より）

| タブ | グラフ種類 | X軸 | Y軸 | 特記 |
|-----|----------|-----|-----|------|
| 着順 | 折れ線 | 半荘（直近20件） | 着順（1〜4） | **Y軸反転**（1位が上） |
| 収支 | 面積+折れ線 | セッション | pt | 累計(面積) + 単発(折れ線) |
| スコア | 面積+折れ線 | セッション | 点 | 累計(面積) + 単発(折れ線) |
| チップ | 面積+折れ線 | セッション | 枚 | 累計(面積) + 単発(折れ線) |

## 3. 設計方針

### 3.1 コンポーネント構成

```
src/components/analysis/
├── DetailStatsTabs.tsx          # 既存（グラフ組み込み先）
├── RevenueTimelineChart.tsx     # 既存 → 拡張 or 廃止検討
├── RankTimelineChart.tsx        # 新規：着順推移（Y軸反転）
└── TimelineAreaChart.tsx        # 新規：汎用面積+折れ線グラフ
```

### 3.2 設計判断

#### A. 着順推移グラフ（RankTimelineChart）
- **専用コンポーネント新規作成**
- 理由：
  - Y軸反転（1位を上に）が必要
  - データ単位が「半荘」（他は「セッション」）
  - 直近20件制限
  - 3人打ち/4人打ちでY軸範囲が変わる

#### B. 収支/スコア/チップグラフ
- **案1**: RevenueTimelineChart拡張（汎用化）
- **案2**: 新規TimelineAreaChart作成
- **推奨: 案2**
  - 理由：
    - 現RevenueTimelineChartは個別/累積「切替」（同時表示でない）
    - Issue #14は「重ね表示」を要求
    - ComposedChart（Area + Line）への変更が大きい
    - 既存を壊さず新規作成が安全

### 3.3 汎用TimelineAreaChart設計

```typescript
interface TimelineAreaChartProps {
  data: Array<{
    label: string      // X軸ラベル（日付）
    value: number      // 単発値
    cumulative: number // 累積値
  }>
  title: string        // グラフタイトル
  unit: string         // 単位（pt, 点, 枚）
  colors?: {
    area?: string      // 面積の色（デフォルト: 緑系）
    line?: string      // 線の色（デフォルト: 青系）
  }
}
```

### 3.4 データ準備ロジック

#### 着順推移データ
```typescript
function prepareRankTimelineData(
  sessions: SessionWithSummary[],
  userId: string,
  limit: number = 20
): RankTimelineData[]

// 出力例
[
  { hanchanIndex: 1, rank: 2, date: "10/05" },
  { hanchanIndex: 2, rank: 1, date: "10/05" },
  ...
]
```

#### スコア推移データ
```typescript
function prepareScoreTimelineData(
  sessions: SessionWithSummary[],
  userId: string
): TimelineData[]

// 計算ロジック
// hanchans.forEach → userResult.score合計（rate変換前の素点）
```

#### チップ推移データ
```typescript
function prepareChipTimelineData(
  sessions: SessionWithSummary[],
  userId: string
): TimelineData[]

// 計算ロジック
// summary.totalChips を使用（既存データ活用）
```

## 4. 実装計画

### Phase 1: 汎用コンポーネント作成
1. `TimelineAreaChart.tsx` 新規作成
   - Recharts ComposedChart + Area + Line
   - 個別/累積切替タブ付き（既存UIを踏襲）
   - 汎用props設計

### Phase 2: 着順推移グラフ
2. `RankTimelineChart.tsx` 新規作成
   - Y軸反転実装
   - 半荘単位データ取得
   - 直近20件制限

### Phase 3: 既存グラフ置換
3. `DetailStatsTabs.tsx` 更新
   - 収支タブ: RevenueTimelineChart → TimelineAreaChart
   - スコアタブ: プレースホルダー → TimelineAreaChart
   - チップタブ: プレースホルダー → TimelineAreaChart
   - 着順タブ: RankTimelineChart追加

### Phase 4: クリーンアップ
4. 既存コンポーネント整理
   - `RevenueTimelineChart` 廃止 or 別用途で残す
   - テスト実行・動作確認

## 5. 技術詳細

### 5.1 Recharts ComposedChart使用例

```tsx
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts'

<ComposedChart data={data}>
  <CartesianGrid />
  <XAxis dataKey="label" />
  <YAxis />
  <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="3 3" />

  {/* 累積（面積） */}
  <Area
    type="monotone"
    dataKey="cumulative"
    fill="#10b981"
    fillOpacity={0.3}
    stroke="#10b981"
  />

  {/* 単発（折れ線） */}
  <Line
    type="monotone"
    dataKey="value"
    stroke="#3b82f6"
    strokeWidth={2}
    dot={{ r: 4 }}
  />
</ComposedChart>
```

### 5.2 Y軸反転（着順用）

```tsx
<YAxis
  domain={[1, mode === '4-player' ? 4 : 3]}
  reversed={true}  // これで1位が上に
  ticks={mode === '4-player' ? [1, 2, 3, 4] : [1, 2, 3]}
/>
```

## 6. 代替案検討

### 6.1 Issue #14要件の再検討

現行`RevenueTimelineChart`の「個別/累積切替」は使いやすい。
Issue #14の「面積+折れ線重ね表示」は情報量が多いが複雑。

**提案**: ユーザーに確認
- A: Issue通り「重ね表示」
- B: 現行通り「切替表示」
- C: 両方対応（切替で選択可能）

### 6.2 円グラフの扱い

Issue #14では「着順円グラフ廃止検討」とあるが、
着順タブには現在：
1. 着順回数グリッド
2. 平均着順
3. 円グラフ

着順推移グラフを追加すると情報過多になる可能性。

**提案**:
- 円グラフは残す（視覚的にわかりやすい）
- 推移グラフは円グラフの下に配置

## 7. ファイル変更サマリー

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `TimelineAreaChart.tsx` | 新規 | 汎用面積+折れ線グラフ |
| `RankTimelineChart.tsx` | 新規 | 着順推移グラフ |
| `DetailStatsTabs.tsx` | 修正 | 新グラフ組み込み |
| `RevenueTimelineChart.tsx` | 廃止候補 | 置換後に検討 |

---

**作成日**: 2025-12-03
**Issue**: #14
**ステータス**: 設計レビュー待ち
