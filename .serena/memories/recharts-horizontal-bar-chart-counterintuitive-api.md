# Recharts横棒グラフ実装の重要知見

**作成日**: 2025-10-07 11:28
**重要度**: 🔴 高（直感に反する仕様）

## 核心的知見

Rechartsの`layout`プロパティは直感に反する命名：

### 正しい実装
```typescript
// 横棒グラフ（棒が水平に伸びる）
<BarChart layout="vertical">  // ✅ "vertical"で横棒グラフ！
  <XAxis type="number" />
  <YAxis type="category" dataKey="category" />
  <Bar dataKey="value" />
</BarChart>

// 縦棒グラフ（棒が垂直に伸びる）
<BarChart layout="horizontal">  // ✅ "horizontal"で縦棒グラフ（デフォルト）
  <XAxis type="category" dataKey="category" />
  <YAxis type="number" />
  <Bar dataKey="value" />
</BarChart>
```

## 理解の鍵

**`layout`は「軸の配置方向」を指定**（棒の向きではない）

- `layout="vertical"` → Y軸がカテゴリ（縦配置） → 棒は横向き
- `layout="horizontal"` → X軸がカテゴリ（横配置） → 棒は縦向き

## デバッグポイント

1. **layout と軸typeの組み合わせ確認**
2. **明示的な高さ指定**（`h-[200px]`等）
3. **dataKeyの存在確認**

## 参考
- 詳細: `/Users/nishimototakashi/claude_code/development-insights/recharts-horizontal-bar-chart-guide.md`
- Stack Overflow: https://stackoverflow.com/questions/78451079/recharts-horizontal-bar-chart
