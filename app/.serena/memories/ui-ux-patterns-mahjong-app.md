# 麻雀アプリ - UI/UXパターン

**最終更新**: 2025-10-10 00:40
**作成日**: 2025-10-03

---

## 🎨 デザイン哲学

### モバイルファースト & ネイティブ感

**ターゲット**: iOS向けネイティブアプリ（Capacitor使用予定）

**設計原則**:
1. **モバイルファースト**: スマートフォン縦持ちを第一に考慮
2. **片手操作**: 下部ナビゲーション、大きなタップターゲット
3. **ネイティブ感**: iOSの操作感を意識（タップ、スワイプ、慣性スクロール）
4. **ミニマリズム**: 必要最小限の情報表示、余白を活かす
5. **視認性**: 麻雀台の緑を基調、ハイコントラストの文字

**参考**: 
- iOS Human Interface Guidelines
- Material Design (一部採用)

---

## 🎨 カラーシステム

### プライマリカラー（麻雀台グリーン）

**背景グラデーション**:
```css
background: linear-gradient(135deg, #1a5c3a 0%, #0f3d26 100%);
```
- **#1a5c3a**: 濃い緑（麻雀卓の緑）
- **#0f3d26**: より濃い緑（下部）
- **グラデーション角度**: 135deg（左上→右下）

**下部ナビゲーション**:
```css
bg-[#1a5c3a]
```
- 固定背景と統一感

---

### セマンティックカラー

**収支表示**:
- **プラス収支**: `text-green-600` / `text-blue-600`
- **マイナス収支**: `text-red-600`
- **ゼロ**: デフォルトテキストカラー

**着順表示**:
- **1位**: 金色（今後実装予定）
- **2-3位**: デフォルト
- **4位**: 淡いグレー

**状態表示**:
- **成功**: `text-green-600`
- **エラー**: `text-destructive` (赤)
- **警告**: `text-orange-500`
- **情報**: `text-blue-600`

**ボタン**:
- **Primary**: デフォルト（青系）
- **Destructive**: `bg-destructive` (赤)
- **Archive**: `bg-orange-500` (オレンジ)
- **Outline**: `variant="outline"`
- **Ghost**: `variant="ghost"`

---

### テキストカラー

- **Primary**: デフォルト（白系 on 暗背景）
- **Muted**: `text-muted-foreground`（グレー系）
- **Destructive**: `text-destructive`（赤）

---

## 📐 レイアウトパターン

### 全体構造

```
┌────────────────────────┐
│  Content Area          │ ← 可変高さ（スクロール可能）
│  (Tabs)                │
│                        │
│                        │
│                        │
├────────────────────────┤
│ Fixed Bottom Nav       │ ← 固定（48px高さ）
│ ✏️ 📋 📊 ⚙️ 🧪        │
└────────────────────────┘
```

**実装**:
```tsx
<div className="flex flex-col h-screen">
  {/* メインコンテンツ */}
  <div className="flex-1">
    <Tabs className="h-full">
      <TabsContent className="overflow-hidden px-2 pt-1 pb-12">
        {/* タブコンテンツ */}
      </TabsContent>
    </Tabs>
  </div>

  {/* 下部固定ナビゲーション */}
  <div className="fixed bottom-0 left-0 right-0 border-t bg-[#1a5c3a]">
    <TabsList className="grid w-full grid-cols-5 h-12">
      {/* タブボタン */}
    </TabsList>
  </div>
</div>
```

**重要**:
- `pb-12`: コンテンツ下部に48pxのパディング（固定ナビゲーションとの重複回避）
- `overflow-hidden`: 横スクロール防止
- `flex-1`: コンテンツエリアが残りの高さを全て使用

---

### タブナビゲーション（下部固定）

**構造**:
```tsx
<TabsList className="grid w-full grid-cols-5 h-12 rounded-none">
  <TabsTrigger value="input" className="flex flex-col gap-0 py-1">
    <span className="text-base leading-none">✏️</span>
    <span className="text-xs leading-none">新規入力</span>
  </TabsTrigger>
  {/* ... 他のタブ */}
</TabsList>
```

**デザイン**:
- **レイアウト**: 5列グリッド（均等幅）
- **高さ**: 48px (`h-12`)
- **角丸**: なし (`rounded-none`)
- **アイコン + ラベル**: 縦並び（`flex-col`）
- **タップターゲット**: 大きい（48px × 全幅/5）

**アイコン選択**:
- ✏️ 新規入力
- 📋 履歴
- 📊 分析
- ⚙️ 設定
- 🧪 TEST（実験用）

---

### カードレイアウト

**基本構造**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>タイトル</CardTitle>
    <CardDescription>説明</CardDescription>
  </CardHeader>
  <CardContent>
    {/* コンテンツ */}
  </CardContent>
</Card>
```

**使用例**:

**1. 設定カード（クリック可能）**:
```tsx
<div className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors">
  <h3 className="font-semibold mb-1">👤 ユーザー管理</h3>
  <p className="text-sm text-muted-foreground">登録ユーザーの追加・編集・削除</p>
</div>
```

**2. セッションカード（履歴）**:
```tsx
<Card className="cursor-pointer hover:shadow-lg transition-shadow relative gap-2 py-3">
  <CardHeader className="px-3">
    {/* 日付、モード、半荘数 */}
  </CardHeader>
  <CardContent className="px-3">
    {/* 収支、チップ、着順 */}
  </CardContent>
</Card>
```

**3. 統計カード（分析）**:
```tsx
<Card>
  <CardContent className="p-3">
    <div className="grid grid-cols-2 gap-3">
      {/* 2列レイアウト */}
    </div>
  </CardContent>
</Card>
```

---

## 🎯 コンポーネントパターン

### ボタン

**サイズ**:
- `size="sm"`: 小（高さ32px）
- デフォルト: 中（高さ40px）
- `className="h-20"`: 大（例: モード選択ボタン）

**バリアント**:
```tsx
<Button>Primary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
```

**フルウィドス**:
```tsx
<Button className="w-full">全幅ボタン</Button>
```

**アイコンボタン**:
```tsx
<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
  ✕
</Button>
```

---

### 入力フィールド

**テキスト入力**:
```tsx
<Input 
  type="text" 
  placeholder="プレースホルダー"
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

**数値入力（スピナーなし）**:
```tsx
<Input 
  type="number" 
  className="text-center"
  inputMode="numeric"  // モバイルで数値キーボード
/>
```

**CSS（スピナー削除）**:
```css
/* index.css */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}
```

---

### セレクト（ドロップダウン）

**基本**:
```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger className="w-full">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">オプション1</SelectItem>
    <SelectItem value="option2">オプション2</SelectItem>
  </SelectContent>
</Select>
```

**プレイヤー選択（カスタム）**:
```tsx
<Select value={userId || playerName}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="選択してください" />
  </SelectTrigger>
  <SelectContent>
    {/* メインユーザー */}
    <SelectItem value={mainUser.id}>👤 {mainUser.name}</SelectItem>
    
    {/* 登録ユーザー */}
    {users.map(user => (
      <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
    ))}
    
    {/* 未登録プレイヤー */}
    {unregisteredPlayers.map(name => (
      <SelectItem key={name} value={name}>{name}</SelectItem>
    ))}
    
    {/* 新規登録 */}
    <SelectItem value="__new__">＋ 新しいプレイヤーを登録</SelectItem>
  </SelectContent>
</Select>
```

---

### ダイアログ

**基本構造**:
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="sm:max-w-[500px]">
    <DialogHeader>
      <DialogTitle>タイトル</DialogTitle>
      <DialogDescription>説明</DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      {/* コンテンツ */}
    </div>
    
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        キャンセル
      </Button>
      <Button onClick={handleSave}>保存</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**確認ダイアログ（AlertDialog）**:
```tsx
<AlertDialog open={open} onOpenChange={setOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>セッションを削除しますか？</AlertDialogTitle>
      <AlertDialogDescription>
        この操作は取り消せません。
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>キャンセル</AlertDialogCancel>
      <AlertDialogAction 
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        削除
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

### アコーディオン

**使用例（アーカイブ済みユーザー）**:
```tsx
<Accordion type="single" collapsible>
  <AccordionItem value="archived-users" className="border-0">
    <AccordionTrigger className="text-sm font-medium text-muted-foreground hover:no-underline py-2">
      <div className="flex items-center gap-2">
        <span>🗄️ アーカイブ済みユーザー</span>
        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
          {archivedUsers.length}
        </span>
      </div>
    </AccordionTrigger>
    <AccordionContent className="space-y-2 pt-2">
      {/* アーカイブ済みユーザー一覧 */}
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

**使用場面**:
- アーカイブ済みユーザー一覧（SettingsTab）
- セッション詳細の半荘別表示（SessionDetailDialog）
- 今後: フィルター詳細設定

---

## 📊 グラフ・チャートパターン

### ChartContainer（Recharts統合）

**基本構造**:
```tsx
<ChartContainer className="h-[200px] w-full" config={chartConfig}>
  <BarChart layout="vertical" data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
    <XAxis type="number" />
    <YAxis type="category" dataKey="category" width={35} />
    <Bar dataKey="value" fill="var(--color-value)" />
  </BarChart>
</ChartContainer>
```

**chartConfig**:
```typescript
const chartConfig = {
  value: {
    label: "値",
    color: "#3b82f6"  // CSS変数は効かない場合あり
  }
} satisfies ChartConfig
```

---

### 横棒グラフ（着順統計）

**重要設定**:
```tsx
<BarChart 
  layout="vertical"  // 横棒グラフ（直感に反する命名）
  margin={{ left: 0, right: 0, top: 0, bottom: 0 }}  // 空間最大活用
>
  <CartesianGrid horizontal={false} />  // 水平線非表示、垂直線のみ
  <XAxis type="number" />
  <YAxis type="category" dataKey="category" width={35} />  // 日本語2文字用
  <Bar dataKey="value" fill="#3b82f6" />
</BarChart>
```

**参考**: `/development-insights/charts/recharts-horizontal-bar-chart-guide.md`

---

### 折れ線グラフ（収支推移）

**重要設定**:
```tsx
<LineChart margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
  <CartesianGrid horizontal={false} />  // 水平線非表示
  <XAxis dataKey="date" />
  <YAxis />
  <Line 
    dataKey="revenue" 
    stroke="#3b82f6"  // CSS変数は効かない、直接色指定
    strokeWidth={2} 
  />
</LineChart>
```

**参考**: `/development-insights/charts/recharts-linechart-implementation-guide.md`

---

## 🖱️ インタラクションパターン

### タップ・クリック

**カードタップ**:
```tsx
<Card 
  className="cursor-pointer hover:shadow-lg transition-shadow"
  onClick={() => handleClick()}
>
  {/* カードコンテンツ */}
</Card>
```

**ボタン内のボタン（イベント伝播防止）**:
```tsx
<Card onClick={() => handleCardClick()}>
  <Button onClick={(e) => {
    e.stopPropagation()  // カードのクリックイベントを防ぐ
    handleButtonClick()
  }}>
    ✕
  </Button>
</Card>
```

---

### ホバー効果

**カード**:
```tsx
<Card className="cursor-pointer hover:shadow-lg transition-shadow">
```

**設定項目**:
```tsx
<div className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors">
```

**ボタン**:
```tsx
<Button variant="ghost" className="hover:text-destructive hover:bg-destructive/10">
```

---

### フォーカス状態

**Input**:
```tsx
<Input className="focus:ring-2 focus:ring-primary" />
```

**ダイアログ初期フォーカス**:
```tsx
<Input autoFocus />
```

**Enterキー送信**:
```tsx
<Input 
  onKeyDown={(e) => {
    if (e.key === 'Enter') {
      handleSave()
    }
  }}
/>
```

---

## 🎨 スペーシング・タイポグラフィ

### スペーシング（Tailwind）

**パディング**:
- `p-2`: 8px
- `p-3`: 12px
- `p-4`: 16px
- `px-2`: 左右8px
- `py-1`: 上下4px

**マージン**:
- `gap-2`: 8px
- `gap-3`: 12px
- `gap-4`: 16px
- `space-y-2`: 子要素間の縦マージン8px
- `space-y-4`: 子要素間の縦マージン16px

**コンテンツエリアパディング**:
```tsx
<TabsContent className="overflow-hidden px-2 pt-1 pb-12">
```
- `px-2`: 左右8px
- `pt-1`: 上4px
- `pb-12`: 下48px（固定ナビゲーションとの重複回避）

---

### タイポグラフィ

**見出し**:
- `text-lg`: 18px
- `text-base`: 16px
- `text-sm`: 14px
- `text-xs`: 12px

**フォントウェイト**:
- `font-normal`: 400
- `font-medium`: 500
- `font-semibold`: 600
- `font-bold`: 700

**行送り**:
- `leading-none`: 1
- デフォルト: 1.5

**テキスト揃え**:
- `text-left`: 左揃え
- `text-center`: 中央揃え
- `text-right`: 右揃え

---

## 📱 レスポンシブデザイン

### ブレイクポイント（Tailwind）

- `sm:`: 640px以上
- `md:`: 768px以上
- `lg:`: 1024px以上

**使用例**:
```tsx
<DialogContent className="sm:max-w-[500px]">
  {/* スマホ: 全幅、PC: 最大500px */}
</DialogContent>
```

**現状**: モバイル専用設計、レスポンシブ対応は今後実装予定

---

## ♿ アクセシビリティ

### セマンティックHTML

```tsx
<button>ボタン</button>  // ✅ 良い
<div onClick={...}>ボタン</div>  // ❌ 悪い
```

### aria-label（必要に応じて）

```tsx
<Button aria-label="削除" className="h-8 w-8 p-0">
  ✕
</Button>
```

### キーボード操作

**Enterキー送信**:
```tsx
<Input onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
```

**Tab順序**: ブラウザデフォルトに従う

---

## 💬 フィードバックパターン

### トースト通知（sonner）

**成功**:
```tsx
import { toast } from 'sonner'

toast.success('セッションを保存しました')
```

**エラー**:
```tsx
toast.error('保存に失敗しました')
```

**情報**:
```tsx
toast.info('情報メッセージ')
```

**配置**: 画面上部中央（デフォルト）

---

### ローディング状態

**画面全体**:
```tsx
if (loading) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="text-lg font-medium">読み込み中...</div>
        <div className="text-sm text-muted-foreground mt-2">
          データを取得しています
        </div>
      </div>
    </div>
  )
}
```

**ボタン内**（今後実装予定）:
```tsx
<Button disabled={loading}>
  {loading ? '保存中...' : '保存'}
</Button>
```

---

### エラー表示

**画面全体**:
```tsx
if (error) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="text-lg font-medium text-destructive">
          エラーが発生しました
        </div>
        <div className="text-sm text-muted-foreground mt-2">
          {error.message}
        </div>
      </div>
    </div>
  )
}
```

**空状態**:
```tsx
if (data.length === 0) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <p className="text-lg font-medium text-muted-foreground mb-2">
          データがありません
        </p>
        <p className="text-sm text-muted-foreground">
          「新規入力」タブから記録を追加しましょう
        </p>
      </CardContent>
    </Card>
  )
}
```

---

## 🎭 アニメーション・トランジション

### トランジション

**ホバー・アクティブ**:
```tsx
<Card className="transition-shadow hover:shadow-lg">
<div className="transition-colors hover:bg-accent">
```

**タブ切り替え**:
```tsx
<TabsContent className="data-[state=inactive]:hidden">
```
- デフォルトのフェードアニメーションを使用

### 今後実装予定

- **スライドイン**: ダイアログ表示時
- **フェードイン**: カード表示時
- **スワイプジェスチャー**: タブ切り替え
- **プルリフレッシュ**: 一覧更新

---

## 📋 フォームパターン

### バリデーション

**必須入力**:
```typescript
if (!name.trim()) {
  toast.error('名前を入力してください')
  return
}
```

**重複チェック**:
```typescript
const isDuplicate = existingUsers.some(u => u.name === name.trim())
if (isDuplicate) {
  toast.error('既に登録されています')
  return
}
```

**ゼロサム検証**:
```typescript
const sum = players.reduce((acc, p) => acc + (p.score ?? 0), 0)
if (sum !== 0) {
  toast.error('点数の合計は0になる必要があります')
  return
}
```

---

### プレースホルダー

**日本語**:
```tsx
<Input placeholder="プレイヤー名" />
<Input placeholder="選択してください" />
```

---

### 入力タイプ

**数値入力（モバイル）**:
```tsx
<Input 
  type="number" 
  inputMode="numeric"  // 数値キーボード表示
/>
```

**日付入力**:
```tsx
<Input 
  type="date" 
  value={date}
  onChange={(e) => setDate(e.target.value)}
/>
```

---

## 🎯 ベストプラクティス

### 1. タップターゲットサイズ

**最小サイズ**: 44×44px (Apple HIG推奨)

**実装**:
```tsx
<Button className="h-12 w-full">  // 48px高さ（十分な大きさ）
<Button size="sm" className="h-8 w-8 p-0">  // アイコンボタン（最小限）
```

---

### 2. 色のコントラスト

**WCAG AA準拠**: コントラスト比4.5:1以上

**確認方法**:
- Chrome DevTools Accessibility
- WebAIM Contrast Checker

---

### 3. フィードバック即時性

**原則**: ユーザー操作に対して即座にフィードバック

**実装**:
- ボタンクリック → ホバー効果 → ローディング → トースト
- 入力 → リアルタイムバリデーション
- タップ → ハイライト効果

---

### 4. エラーメッセージ

**良い例**:
```typescript
toast.error('名前を入力してください')  // 具体的
toast.error('点数の合計は0になる必要があります')  // 理由明示
```

**悪い例**:
```typescript
toast.error('エラー')  // 不明瞭
toast.error('Failed')  // 英語
```

---

## 🚀 今後の改善予定

### Phase 6（Capacitor統合）

1. **ネイティブジェスチャー**:
   - スワイプでタブ切り替え
   - プルリフレッシュ
   - ロングプレス

2. **iOS最適化**:
   - セーフエリア対応
   - ステータスバー色調整
   - ハプティックフィードバック

3. **パフォーマンス**:
   - 遅延ロード（Lazy Loading）
   - 画像最適化
   - アニメーション最適化

---

### UI/UX改善

1. **ダークモード**: 夜間使用の視認性向上
2. **カスタムテーマ**: ユーザー好みの色設定
3. **フォントサイズ**: アクセシビリティ向上
4. **アニメーション**: よりスムーズな遷移

---

## 📚 関連ドキュメント

- **コンポーネントアーキテクチャ**: Serenaメモリ `component-architecture-mahjong-app`
- **状態管理**: Serenaメモリ `state-management-and-custom-hooks`
- **shadcn/ui**: https://ui.shadcn.com/
- **Tailwind CSS v4**: https://tailwindcss.com/
- **iOS Human Interface Guidelines**: https://developer.apple.com/design/human-interface-guidelines/
- **Recharts実装ガイド**: `/development-insights/charts/`