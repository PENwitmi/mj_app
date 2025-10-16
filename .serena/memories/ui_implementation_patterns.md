# UI実装パターン

Last updated: 2025-10-12

## shadcn/ui コンポーネント

### 使用方法
```bash
npx shadcn@latest add <component-name>
```

### カスタマイズパターン
- `components/ui/`配下に生成
- Tailwind CSS v4でスタイリング
- Radix UIベース（アクセシビリティ対応済み）

## レイアウトパターン

### 1. タブレイアウト（App.tsx）
```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsContent value="input">
    {/* 常時マウント、状態保持 */}
  </TabsContent>
  <TabsContent value="analysis" forceMount>
    <div className={activeTab !== 'analysis' ? "hidden" : ""}>
      {mountedTabs.has('analysis') && activeTab === 'analysis' && (
        <AnalysisTab />
      )}
    </div>
  </TabsContent>
  {/* 下部固定タブナビゲーション */}
  <TabsList className="fixed bottom-0 ...">
</Tabs>
```

**ポイント**:
- `forceMount`: タブ切り替え時もDOMに保持
- **状態保持が必要なタブ**: 条件なしレンダリング（InputTab, HistoryTab）
- **状態リセットOKなタブ**: 条件付きレンダリング（AnalysisTab, SettingsTab）
- `mountedTabs` + 100ms遅延: Rechartsタブ切り替えエラー対策

### 2. カードレイアウト
```tsx
<Card>
  <CardHeader>
    <CardTitle>タイトル</CardTitle>
  </CardHeader>
  <CardContent>
    {/* コンテンツ */}
  </CardContent>
</Card>
```

### 3. フレックスボックス（TotalsPanel、Phase 6改善）
```tsx
<div className="flex flex-col gap-2">
  {/* 垂直方向の要素配置、gap-2でスペーシング */}
</div>
```

## フォームパターン

### 1. プレイヤー選択（PlayerSelect.tsx）
```tsx
<Select value={selectedValue} onValueChange={handleChange}>
  <SelectTrigger>
    <SelectValue placeholder="選択..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">オプション1</SelectItem>
    {/* ユーザー一覧 */}
    <SelectItem value="temp">仮名入力</SelectItem>
    <SelectItem value="new">新規登録</SelectItem>
  </SelectContent>
</Select>
```

### 2. 数値入力
```tsx
<Input
  type="number"
  value={value}
  onChange={(e) => setValue(Number(e.target.value))}
  className="text-right"
/>
```

### 3. ダイアログ（NewPlayerDialog.tsx）
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>タイトル</DialogTitle>
    </DialogHeader>
    {/* フォーム内容 */}
    <DialogFooter>
      <Button onClick={handleSubmit}>保存</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## 状態管理パターン

### 1. カスタムフック（useUsers.ts, useSessions.ts）
```typescript
export function useUsers() {
  const [mainUser, setMainUser] = useState<User | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  
  const loadUsers = async () => {
    const main = await getMainUser();
    const active = await getRegisteredUsers();
    setMainUser(main ?? null);
    setActiveUsers(active);
  };
  
  useEffect(() => {
    loadUsers();
  }, []);
  
  return {
    mainUser,
    activeUsers,
    addNewUser,
    editUser,
    archiveUser,
    refreshUsers: loadUsers  // 手動リフレッシュ関数
  };
}
```

**ポイント**:
- 状態とロジックを集約
- App.tsxで1回呼び出し、全タブで共有
- `refreshUsers`でアプリ初期化後の手動更新対応

### 2. useLiveQuery（Dexie React Hooks）
```typescript
const allSessions = useLiveQuery(() => db.sessions.toArray(), []);

useEffect(() => {
  if (!allSessions) return;
  // allSessions変更時の処理
}, [allSessions]);
```

**ポイント**:
- DBの変更をリアルタイム監視
- 自動再レンダリング

### 3. ローカルステート（タブ内）
```typescript
const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
const [hanchans, setHanchans] = useState<Hanchan[]>([]);
```

## 通知パターン

### toast通知（sonner）
```typescript
import { toast } from 'sonner';

toast.success('保存しました');
toast.error('エラーが発生しました');
toast.info('情報メッセージ');
```

**設定**（App.tsx）:
```tsx
<Toaster position="top-center" />
```

**理由**: iOS safe-area対応（下部タブと干渉回避）

## グラフ表示パターン（Recharts）

### 1. 横棒グラフ（RankStatisticsChart.tsx）
```tsx
<ChartContainer className="h-[200px] w-full">
  <BarChart 
    layout="vertical"  // 重要: 横棒グラフは "vertical"
    data={data}
    margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
  >
    <XAxis type="number" />
    <YAxis 
      type="category" 
      dataKey="category"
      width={35}  // 日本語2文字なら35
    />
    <Bar dataKey="value" fill="#3b82f6" />
  </BarChart>
</ChartContainer>
```

**注意**:
- `layout="vertical"` で横棒グラフ（直感に反する命名）
- YAxis width調整（日本語表示幅確保）
- margin全て0で空間最大活用

### 2. 折れ線グラフ（RevenueTimelineChart.tsx）
```tsx
<ChartContainer className="h-[300px] w-full">
  <LineChart data={data}>
    <CartesianGrid horizontal={false} />  // 垂直線のみ
    <XAxis dataKey="date" />
    <YAxis />
    <Line 
      dataKey="revenue" 
      stroke="#3b82f6"  // CSS変数は効かない、直接色指定
      strokeWidth={2}
    />
    {/* 累積モード時のy=0参照線 */}
    {isCumulative && (
      <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
    )}
  </LineChart>
</ChartContainer>
```

**注意**:
- `CartesianGrid horizontal={false}` で水平線非表示
- Lineの`stroke`はCSS変数（`var(--color-*)`）が効かない
- 参照線でy=0を視覚化（累積モード）

### 3. タブ切り替えエラー対策
```tsx
const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['input']));

useEffect(() => {
  const timer = setTimeout(() => {
    setMountedTabs(prev => new Set([...prev, activeTab]));
  }, 100);
  return () => clearTimeout(timer);
}, [activeTab]);

// 条件付きレンダリング
{mountedTabs.has('analysis') && activeTab === 'analysis' && (
  <AnalysisTab />
)}
```

## レスポンシブデザイン

### モバイルファースト
```tsx
className="
  text-sm          // デフォルト: スモール
  md:text-base     // 768px以上: ベース
  lg:text-lg       // 1024px以上: ラージ
"
```

### iOS safe-area対応
```css
/* index.css */
:root {
  --safe-area-inset-top: env(safe-area-inset-top);
  --safe-area-inset-bottom: env(safe-area-inset-bottom);
}

/* タブコンテンツ */
.pb-tab-safe {
  padding-bottom: calc(3rem + var(--safe-area-inset-bottom));
}

/* タブナビゲーション */
.bottom-tab-nav {
  padding-bottom: var(--safe-area-inset-bottom);
}
```

## スクロール対応

### タブコンテンツ
```tsx
<TabsContent 
  value="history" 
  className="overflow-hidden px-2 pt-1 pb-tab-safe"
>
  <div className="h-full overflow-y-auto">
    {/* スクロール可能コンテンツ */}
  </div>
</TabsContent>
```

**ポイント**:
- 親: `overflow-hidden`
- 子: `overflow-y-auto` + `h-full`
- 下部パディング: `pb-tab-safe`（iOS safe-area考慮）

## アクセシビリティ

### 基本原則
- shadcn/ui（Radix UI）で自動対応
- キーボード操作サポート
- ARIA属性自動付与

### 追加考慮事項
- ボタンテキスト明確化
- フォーカス可視化
- エラーメッセージ明示

## パフォーマンス最適化

### コンポーネント分割
- 大きなコンポーネント（>300行）は分割
- InputTab → ScoreInputTable, SessionSettings, TotalsPanel
- AnalysisTab → AnalysisFilters, RankStatisticsChart, RevenueTimelineChart

### メモ化（必要時のみ）
```typescript
const memoizedValue = useMemo(() => {
  return expensiveCalculation(data);
}, [data]);
```

### 遅延ロード（Phase 7予定）
```typescript
const AnalysisTab = React.lazy(() => import('./tabs/AnalysisTab'));
```

## スタイリング規約

### Tailwind CSS v4クラス命名
- ユーティリティファースト
- カスタムクラス最小限
- `cn()` ヘルパーで条件付きクラス

### カラーパレット
- Primary: `bg-primary`, `text-primary`
- Secondary: `bg-secondary`, `text-secondary`
- Destructive: `bg-destructive`, `text-destructive`
- Muted: `bg-muted`, `text-muted-foreground`

### スペーシング
- `gap-2`: 0.5rem（8px）
- `gap-4`: 1rem（16px）
- `p-2`, `p-4`: パディング

### タイポグラフィ
- `text-sm`: 0.875rem（14px）
- `text-base`: 1rem（16px）
- `text-lg`: 1.125rem（18px）
