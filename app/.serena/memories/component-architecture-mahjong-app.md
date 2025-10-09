# 麻雀アプリ - コンポーネントアーキテクチャ

**最終更新**: 2025-10-10 00:35
**作成日**: 2025-10-03

---

## 📐 アーキテクチャ概要

**設計原則**:
- **タブベース構造**: 4つのメインタブで機能を分離（新規入力、履歴、分析、設定）
- **状態の一元管理**: Appレベルでユーザー管理（useUsers）を行い、全タブで共有
- **カスタムフック**: 再利用可能なロジックを分離（useUsers, useSessions）
- **コンポーネント分割**: 大きなタブコンポーネントは目的別にサブコンポーネント化

**技術スタック**:
- React 19 (最新機能使用)
- TypeScript (厳格な型管理)
- shadcn/ui (UIコンポーネント)
- Dexie.js (IndexedDB wrapper + useLiveQuery)
- Tailwind CSS v4 (Vite plugin使用)

---

## 🌳 コンポーネントツリー

```
App.tsx (ルートコンポーネント)
├── ErrorBoundary (エラー境界)
├── Toaster (通知UI - sonner)
└── Tabs (shadcn/ui)
    ├── TabsContent: input
    │   └── InputTab (新規入力タブ)
    │       ├── SessionSettingsCard (設定カード)
    │       ├── ScoreInputTable (点数入力表)
    │       │   ├── PlayerSelect (プレイヤー選択)
    │       │   └── NewPlayerDialog (新規プレイヤー登録)
    │       └── TotalsPanel (集計パネル)
    │
    ├── TabsContent: history
    │   └── HistoryTab (履歴タブ)
    │       ├── SessionDetailDialog (セッション詳細)
    │       └── AlertDialog (削除確認)
    │
    ├── TabsContent: analysis
    │   └── AnalysisTab (分析タブ)
    │       ├── AnalysisFilters (フィルター)
    │       ├── RankStatisticsChart (着順統計グラフ)
    │       └── RevenueTimelineChart (収支推移グラフ)
    │
    ├── TabsContent: settings
    │   └── SettingsTab (設定タブ)
    │       ├── NewPlayerDialog (新規ユーザー登録)
    │       ├── Dialog (ユーザー管理)
    │       │   └── Accordion (アーカイブ済みユーザー)
    │       └── Dialog (ユーザー名編集)
    │
    └── TabsList (下部固定ナビゲーション)
        ├── TabsTrigger: input (✏️ 新規入力)
        ├── TabsTrigger: history (📋 履歴)
        ├── TabsTrigger: analysis (📊 分析)
        ├── TabsTrigger: settings (⚙️ 設定)
        └── TabsTrigger: test (🧪 TEST - 実験用)
```

---

## 📂 ファイル構成

### メインタブコンポーネント

**App.tsx** (168行)
- **役割**: ルートコンポーネント、タブレイアウト管理
- **State管理**:
  - `activeTab`: 現在のタブ
  - `mountedTabs`: 一度マウントされたタブ記録（Rechartsエラー対策）
  - `useUsers()`: ユーザー一覧を全タブで共有
- **重要な実装**:
  - `forceMount`パターン: 全タブをマウント状態に保持（状態保持のため）
  - 条件付きレンダリング: AnalysisTab/SettingsTabはアクティブ時のみレンダリング（Rechartsエラー回避）
  - InputTab/HistoryTabは常時レンダリング（フォーム状態保持）
  - 100ms遅延マウント: ResponsiveContainerの初期化待機
- **Props伝播**:
  - `mainUser`, `users` (activeUsers), `addNewUser` を全タブに渡す
  - SettingsTabには追加で `archivedUsers`, `editUser`, `archiveUser`, `restoreUser`

**src/components/tabs/InputTab.tsx** (272行)
- **役割**: 新規セッション入力（点数、チップ、場代）
- **State管理**:
  - `selectedMode`: ゲームモード（4人打ち/3人打ち）
  - `settings`: SessionSettings（日付、レート、ウマ値、チップレート等）
  - `hanchans`: 半荘データ配列（最大表示数は制限なし）
- **機能**:
  - モード選択画面 → 入力画面の2段階UI
  - 空ハンチャンフィルタリング（保存時に全員0点の半荘を除外）
  - 半荘番号自動振り直し（1から連番）
  - メインユーザー名同期（useEffect監視）
  - 登録ユーザー名同期（useEffect監視）
- **サブコンポーネント**:
  - `SessionSettingsCard` (settings管理)
  - `ScoreInputTable` (点数入力、プレイヤー選択)
  - `TotalsPanel` (集計、チップ・場代入力)
- **保存処理**: `saveSessionWithSummary()` でサマリーも事前計算

**src/components/tabs/HistoryTab.tsx** (189行)
- **役割**: セッション一覧表示、削除、詳細表示
- **State管理**:
  - `useSessions()`: セッション一覧（Dexieリアルタイム監視）
  - `deleteDialogOpen`: 削除確認ダイアログ
  - `detailDialogOpen`: 詳細ダイアログ
  - `selectedSessionId`: 選択中のセッションID
- **表示内容**:
  - セッションカード: 日付、モード、半荘数、収支、チップ、平均着順、着順回数
  - カラーコーディング: 収支プラス（緑）、マイナス（赤）
- **機能**:
  - カードクリック → 詳細ダイアログ表示
  - 削除ボタン → 確認ダイアログ → カスケード削除
- **パフォーマンス**:
  - サマリー事前計算利用（9.7ms読み込み）
  - 日付降順ソート（最新が上）

**src/components/tabs/AnalysisTab.tsx** (296行)
- **役割**: 統計分析、グラフ表示
- **State管理**:
  - `useSessions()`: セッション一覧（hanchansデータ含む）
  - `selectedUserId`: 分析対象ユーザー
  - `selectedPeriod`: 期間フィルター（今月/今年/特定年/全期間）
  - `selectedMode`: モードフィルター（4人打ち/3人打ち/全体）
- **統計計算** (useMemoで最適化):
  - `rankStats`: 着順統計（モード別、全体時はundefined）
  - `revenueStats`: 収支統計（プラス/マイナス/合計）
  - `pointStats`: ポイント統計（半荘単位）
  - `chipStats`: チップ統計
- **グラフコンポーネント**:
  - `RankStatisticsChart`: 着順統計横棒グラフ（Recharts BarChart）
  - `RevenueTimelineChart`: 収支推移折れ線グラフ（Recharts LineChart）
- **UI構成**:
  - フィルターエリア（上部）
  - 着順統計グラフ（モード選択時のみ）
  - 収支推移グラフ（常時表示）
  - 統合統計カード（4象限: 着順/収支/ポイント/チップ）

**src/components/tabs/SettingsTab.tsx** (369行)
- **役割**: ユーザー管理、アプリ設定
- **State管理**:
  - `defaultUmaRule`: デフォルトウマルール（localStorage永続化）
  - `userManagementOpen`: ユーザー管理ダイアログ
  - `editDialogOpen`: ユーザー名編集ダイアログ
  - `editingUser`, `editingName`: 編集中のユーザー情報
- **機能**:
  - **ユーザー管理**:
    - メインユーザー表示（編集のみ、削除不可）
    - アクティブユーザー一覧（編集・アーカイブ可能）
    - アーカイブ済みユーザー一覧（Accordion内、復元可能）
    - 新規ユーザー追加
  - **デフォルトウマルール設定**:
    - 標準ルール（1-2位プラス）
    - 2位マイナス判定（2位負の場合特殊ウマ）
  - **開発者用機能**: 全データ削除（リセット）
- **今後実装予定** (プレースホルダー):
  - 表示設定（テーマ、フォントサイズ）
  - データ管理（バックアップ、エクスポート）
  - アプリ情報（バージョン、利用規約）

---

## 🎣 カスタムフック

### useUsers.ts (118行)
**役割**: ユーザー状態の一元管理（CRUD操作）

**管理対象**:
- `mainUser`: メインユーザー（固定ID: `main-user-fixed-id`）
- `activeUsers`: アクティブな登録ユーザー一覧
- `archivedUsers`: アーカイブ済みユーザー一覧

**提供関数**:
```typescript
{
  mainUser: User | null
  activeUsers: User[]
  archivedUsers: User[]
  loading: boolean
  addNewUser: (name: string) => Promise<User>
  editUser: (userId: string, name: string) => Promise<User>
  archiveUser: (userId: string) => Promise<void>
  restoreUser: (userId: string) => Promise<void>
}
```

**実装パターン**:
- useEffect初回ロード: `getMainUser()`, `getRegisteredUsers()`, `getArchivedUsers()`
- 各操作後にローカルStateを即座に更新（楽観的UI更新）
- エラーハンドリング: logger.error()でログ記録

**使用場所**: App.tsx（全タブで共有）

---

### useSessions.ts (124行)
**役割**: セッション一覧のリアルタイム監視と統計計算

**管理対象**:
- `sessions`: セッション一覧（Session + SessionSummary + オプショナルHanchans）
- `loading`: 読み込み中フラグ
- `error`: エラー情報

**パラメータ**:
```typescript
useSessions(mainUserId: string, options?: { includeHanchans?: boolean })
```
- `includeHanchans=false`: 履歴タブ（サマリーのみ）
- `includeHanchans=true`: 分析タブ（半荘データも取得）

**重要な実装**:
- **Dexie useLiveQuery**: `db.sessions.toArray()` をリアルタイム監視
- **パフォーマンス最適化**:
  - 保存済みサマリー利用（キャッシュ）
  - 保存済みなし → 動的計算（後方互換性）
  - ログで計測: `cached: N件`, `calculated: N件`, `total: Nms`
- **日付降順ソート**: `session.date.localeCompare()` で最新が上
- **エラーリカバリ**: サマリー計算失敗時もデフォルト値を返す（スキップしない）

**使用場所**:
- HistoryTab: `useSessions(mainUser.id)` - サマリーのみ
- AnalysisTab: `useSessions(mainUser.id, { includeHanchans: true })` - 統計計算用

---

## 🧩 再利用可能コンポーネント

### PlayerSelect.tsx (127行)
**役割**: プレイヤー選択コンボボックス（Select + NewPlayerDialog統合）

**機能**:
- メインユーザー（固定）
- 登録ユーザー一覧
- 未登録プレイヤー（名前直接入力）
- 「新規登録」ボタン → NewPlayerDialog表示

**Props**:
```typescript
{
  selectedUserId: string | null
  selectedPlayerName: string
  users: User[]
  mainUser: User | null
  onPlayerChange: (userId: string | null, playerName: string) => void
  onAddNewUser: (name: string) => Promise<User>
  disabled?: boolean
}
```

**使用場所**: ScoreInputTable（半荘入力時のプレイヤー選択）

---

### NewPlayerDialog.tsx
**役割**: 新規プレイヤー登録ダイアログ

**機能**:
- 名前入力フォーム
- 重複チェック
- Enterキーで登録

**Props**:
```typescript
{
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (name: string) => Promise<User>
  existingUsers: User[]
}
```

**使用場所**:
- PlayerSelect（プレイヤー選択時）
- SettingsTab（ユーザー管理時）

---

### SessionDetailDialog.tsx (370行)
**役割**: セッション詳細表示・編集ダイアログ

**機能**:
- セッション情報表示（日付、モード、レート等）
- 半荘別詳細（Accordion形式）
- 各半荘の点数表示
- サマリー統計表示
- **将来**: 編集機能追加予定（Phase 4 Stage 4-5）

**Props**:
```typescript
{
  sessionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  mainUser: User | null
  users: User[]
  addNewUser: (name: string) => Promise<User>
}
```

**使用場所**: HistoryTab（セッションカードクリック時）

---

### ErrorBoundary.tsx
**役割**: Reactエラー境界（コンポーネントツリーのエラーをキャッチ）

**機能**:
- エラーキャッチ
- エラーログ記録（logger.error）
- ユーザーフレンドリーなエラー表示
- リロードボタン

**使用場所**: App全体をラップ（main.tsx）

---

## 🎨 shadcn/ui コンポーネント

**使用中のUIコンポーネント** (9個):
- `Button` - ボタン
- `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardDescription` - カード
- `Dialog` - ダイアログ
- `Select` - ドロップダウン選択
- `Input` - テキスト入力
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` - タブ
- `AlertDialog` - 確認ダイアログ
- `Accordion` - アコーディオン
- `chart.tsx` - Recharts統合（ChartContainer, ChartConfig）
- `sonner` - トースト通知（Toaster, toast）
- `Table` - テーブル表示

**配置**: `src/components/ui/`
**特徴**: Tailwind CSS v4ベース、カスタマイズ可能

---

## 📊 サブコンポーネント

### analysis/ (分析タブ用)

**AnalysisFilters.tsx**
- **役割**: フィルター選択UI（ユーザー、期間、モード）
- **State**: 親コンポーネント（AnalysisTab）で管理
- **Props**: フィルター値 + onChange関数群

**RankStatisticsChart.tsx**
- **役割**: 着順統計横棒グラフ（Recharts BarChart）
- **表示内容**: 1位〜4位の回数と割合（%）
- **重要設定**:
  - `layout="vertical"` （横棒グラフ）
  - `margin={{ left: 0, right: 0, top: 0, bottom: 0 }}` （空間最大活用）
  - YAxis `width={35}` （日本語2文字用）
- **Props**: `statistics: RankStatistics`, `mode: GameMode`

**RevenueTimelineChart.tsx**
- **役割**: 収支推移折れ線グラフ（Recharts LineChart）
- **表示内容**: セッションごとの累積収支
- **重要設定**:
  - `horizontal={false}` （水平線非表示、垂直線のみ）
  - `stroke="#3b82f6"` （CSS変数は効かない、直接色指定）
- **Props**: `sessions: SessionWithSummary[]`, `userId: string`, `showCumulative: boolean`

---

### input/ (新規入力タブ用)

**SessionSettings.tsx**
- **役割**: セッション設定カード（日付、レート、ウマ値等）
- **State**: 親コンポーネント（InputTab）で管理
- **Props**: `settings: SessionSettings`, `onSettingsChange`, `onModeChange`, `onSave`

**ScoreInputTable.tsx**
- **役割**: 点数入力表（半荘別入力）
- **機能**:
  - プレイヤー選択（PlayerSelect使用）
  - 点数入力
  - ウママーク自動計算
  - ゼロサム検証（リアルタイム）
  - 半荘追加・削除
- **Props**: `hanchans`, `selectedMode`, `settings`, `mainUser`, `users`, `onHanchansChange`, `onPlayerChange`, `onAddNewUser`

**TotalsPanel.tsx**
- **役割**: 集計パネル（セッション全体の統計）
- **表示内容**:
  - プレイヤー別: 総ポイント、総チップ、総収支
  - セッション全体: 半荘数、総収支
- **入力**: チップ数、場代（プレイヤー別）
- **Props**: `hanchans`, `settings`, `onChipsChange`, `onParlorFeeChange`

---

## 🔑 重要な技術的決定

### 1. タブ切り替えエラー対策（2025-10-09解決）

**問題**: Rechartsグラフでタブ切り替え時に`width(0) and height(0)` エラー

**解決策**:
```typescript
// App.tsx
const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['input']))

useEffect(() => {
  const timer = setTimeout(() => {
    setMountedTabs(prev => new Set([...prev, activeTab]))
  }, 100)
  return () => clearTimeout(timer)
}, [activeTab])

// State保持必須タブ（InputTab等）→ 条件なし
<TabsContent value="input" forceMount>
  <InputTab />
</TabsContent>

// State初期化OKタブ（AnalysisTab等）→ 条件付き
<TabsContent value="analysis" forceMount>
  <div className={activeTab !== 'analysis' ? "hidden" : ""}>
    {mountedTabs.has('analysis') && activeTab === 'analysis' && (
      <AnalysisTab />
    )}
  </div>
</TabsContent>
```

**参考**: `/development-insights/charts/recharts-tab-switching-error-solution.md`

---

### 2. Recharts実装の注意点

**横棒グラフ**:
- `layout="vertical"` が横棒グラフ（直感に反する命名）
- `horizontal={false}` で水平線非表示（CartesianGrid）
- 参考: `/development-insights/charts/recharts-horizontal-bar-chart-guide.md`

**折れ線グラフ**:
- `<Line stroke="#3b82f6" />` - CSS変数（`var(--color-xxx)`）は効かない
- 参考: `/development-insights/charts/recharts-linechart-implementation-guide.md`

---

### 3. React 19 Strict Mode対策

**問題**: useEffect二重実行でユーザー重複作成

**解決策**: メインユーザー固定ID (`main-user-fixed-id`) で重複防止

```typescript
// lib/db-utils.ts
export async function initializeApp() {
  const fixedId = 'main-user-fixed-id'
  const existing = await db.users.get(fixedId)
  if (!existing) {
    await db.users.add({
      id: fixedId,
      name: 'あなた',
      isMainUser: true,
      // ...
    })
  }
}
```

---

### 4. ユーザーアーカイブシステム（論理削除）

**設計原則**: 物理削除を使わず、データ整合性を確保

**実装**:
- `isArchived: boolean`
- `archivedAt?: Date`
- `getActiveUsers()`: `isArchived === false`
- `getArchivedUsers()`: `isArchived === true`

**UI**:
- アクティブユーザー一覧（通常表示）
- アーカイブ済みユーザー（Accordion内、復元可能）

---

### 5. パフォーマンス最適化（サマリー事前計算）

**問題**: 履歴タブ読み込みが遅い（各セッションで統計計算）

**解決策**: `saveSessionWithSummary()` で保存時にサマリー計算

**効果**:
- Before: 2,900ms（全計算）
- After: 9.7ms（キャッシュ利用）
- **300-800倍の高速化**

**実装**: Phase 4 Stage 2-3（2025-10-08）

**参考**: `project-docs/2025-10-04-phase4-history-tab/04-SUMMARY_PRE_CALCULATION.md`

---

## 📝 コンポーネント命名規則

**ファイル名**: PascalCase (例: `InputTab.tsx`, `SessionDetailDialog.tsx`)
**コンポーネント関数**: PascalCase (例: `export function InputTab()`)
**カスタムフック**: camelCase (例: `useUsers`, `useSessions`)
**Props型**: `ComponentNameProps` (例: `InputTabProps`, `HistoryTabProps`)

---

## 🔄 今後の拡張予定

**Phase 4 Stage 4-5** (編集機能):
- SessionDetailDialogに編集モード追加
- 既存セッションの点数修正・半荘追加削除

**Phase 6** (Capacitor統合):
- iOS/Androidネイティブアプリ化
- モバイル最適化UI調整
- タッチ操作最適化

**設定タブ拡張**:
- 表示設定（テーマ、フォントサイズ）
- データ管理（バックアップ、エクスポート）
- アプリ情報（バージョン、利用規約）

---

## 📚 関連ドキュメント

- **プロジェクト概要**: Serenaメモリ `project-overview-mahjong-app`
- **DB層アーキテクチャ**: Serenaメモリ `project-architecture-database-layer`
- **Phase 2リファクタリング**: `project-docs/2025-10-09-db-utils-refactoring/`
- **Phase 4履歴タブ**: `project-docs/2025-10-04-phase4-history-tab/`
- **Recharts実装ガイド**: `/development-insights/charts/`