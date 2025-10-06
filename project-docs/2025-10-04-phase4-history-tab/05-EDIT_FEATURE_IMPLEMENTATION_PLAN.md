# Phase 4 Stage 4-5: 履歴タブ編集機能 実装計画書

**作成日:** 2025-10-05
**対象:** HistoryTab → SessionDetailDialog 編集機能実装
**関連:** Phase 4 Stage 1-3（一覧・詳細・削除機能）の拡張

---

## 📋 目次
1. [背景・目的](#背景目的)
2. [現状分析サマリー](#現状分析サマリー)
3. [アーキテクチャ設計](#アーキテクチャ設計)
4. [実装計画（Phase 1-5）](#実装計画phase-1-5)
5. [データフロー設計](#データフロー設計)
6. [型定義仕様](#型定義仕様)
7. [リスク＆対策](#リスク対策)
8. [テスト戦略](#テスト戦略)

---

## 🎯 背景・目的

### 背景
Phase 4 Stage 1-3で以下の機能を実装済み：
- ✅ セッション一覧表示（HistoryTab）
- ✅ セッション詳細表示（SessionDetailDialog）
- ✅ セッション削除機能
- ✅ パフォーマンス最適化（サマリー事前計算）

SessionDetailDialogには「編集」ボタンが実装済みだが、機能は未実装（TODOコメント）。

### 目的
既存セッションの編集機能を実装し、以下を実現：
1. **データ修正の柔軟性**: 入力ミスの修正、後からの点数追加・変更
2. **既存コンポーネントの再利用**: InputTabで実装済みのScoreInputTable等を活用
3. **データ整合性の保証**: ゼロサム原則・ウママーク合計検証の維持
4. **UX向上**: シームレスな編集→保存フロー

---

## 📊 現状分析サマリー

### 再利用可能な既存資産

#### 1. UIコンポーネント（InputTab実装済み）
| コンポーネント | 行数 | 機能 | 再利用性 |
|---------------|------|------|----------|
| `ScoreInputTable.tsx` | 217行 | 点数入力・ウママーク選択・自動計算 | ✅ 高 |
| `SessionSettingsCard` | 101行 | セッション設定（日付・レート等） | ✅ 高 |
| `TotalsPanel.tsx` | 183行 | 集計表示・チップ/場代入力 | ✅ 高 |

#### 2. ビジネスロジック（lib/uma-utils.ts）
- `assignUmaMarks()`: ウママーク自動割り当て
- `calculateAutoScore()`: ゼロサム自動計算
- `umaMarkToValue()`: ウママーク→数値変換

#### 3. データアクセス層（lib/db-utils.ts）
- `getSessionWithDetails()`: セッション詳細取得（半荘+プレイヤー結果）
- `saveSession()`: 新規セッション保存
- `deleteSession()`: カスケード削除

### 必要な新規実装

#### 1. データ変換関数（db-utils.ts）
- `sessionToSettings()`: DB Session → UI SessionSettings
- `dbHanchansToUIHanchans()`: DB Hanchan[] → UI Hanchan[]
- `uiDataToSaveData()`: UI編集データ → DB保存用データ
- `updateSession()`: セッション更新（カスケード削除+再作成）

#### 2. SessionDetailDialog改修
- State管理: 編集モード・編集データ・保存状態
- イベントハンドラー: 編集開始・保存・キャンセル
- UI構造: 閲覧モード ↔ 編集モード切り替え

#### 3. EditModeView コンポーネント（新規）
- 既存3コンポーネントの統合
- イベントハンドラー配線

---

## 🏗️ アーキテクチャ設計

### コンポーネント階層

```
HistoryTab
  └─ SessionDetailDialog (改修)
       ├─ [閲覧モード] ReadOnlyView (既存実装)
       │    └─ 半荘テーブル（閲覧専用）
       │
       └─ [編集モード] EditModeView (新規)
            ├─ SessionSettingsCard (再利用)
            ├─ ScoreInputTable (再利用)
            └─ TotalsPanel (再利用)
```

### データフロー層設計

```
UI Layer (React Components)
  ↕ (型変換)
Data Conversion Layer (db-utils.ts - 新規実装)
  ↕
Data Access Layer (db-utils.ts - 既存)
  ↕
Database Layer (Dexie / IndexedDB)
```

### 型システム設計

```typescript
// UI Layer Types (編集用)
interface SessionSettings {
  date: string
  rate: number
  umaValue: number
  chipRate: number
  umaRule: UmaRule
}

interface UIHanchan {
  hanchanNumber: number
  players: UIPlayerResult[]
  autoCalculated: boolean
}

interface UIPlayerResult {
  playerName: string
  userId: string | null
  score: number | null
  umaMark: UmaMark
  chips: number
  parlorFee: number
  isSpectator: boolean
  umaMarkManual: boolean
}

// DB Layer Types (保存用 - 既存)
interface SessionSaveData {
  date: string
  mode: 'four-player' | 'three-player'
  rate: number
  umaValue: number
  chipRate: number
  umaRule: UmaRule
  hanchans: Array<{
    hanchanNumber: number
    players: Array<{
      playerName: string
      userId: string | null
      score: number
      umaMark: UmaMark
      chips: number
      parlorFee: number
      isSpectator: boolean
      position: number
    }>
  }>
}
```

---

## 📅 実装計画（Phase 1-5）

### Phase 1: データ変換層実装 (見積: 1.5h)

**ファイル:** `src/lib/db-utils.ts`

#### Task 1.1: 型変換ユーティリティ関数作成
```typescript
// DB Session → UI SessionSettings
export function sessionToSettings(session: Session): SessionSettings

// DB Hanchan[] → UI Hanchan[]（position順ソート）
export function dbHanchansToUIHanchans(
  dbHanchans: Array<Hanchan & { players: PlayerResult[] }>
): UIHanchan[]

// UI編集データ → DB保存用データ
export function uiDataToSaveData(
  settings: SessionSettings,
  hanchans: UIHanchan[],
  mode: GameMode,
  parlorFee: number
): SessionSaveData
```

**テスト項目:**
- [ ] Session → SessionSettings 変換正常系
- [ ] DB Hanchan → UI Hanchan変換（position順確認）
- [ ] UI → SaveData変換（GameMode文字列変換確認）

#### Task 1.2: セッション更新関数実装
```typescript
export async function updateSession(
  sessionId: string,
  data: SessionSaveData,
  mainUserId: string
): Promise<void>
```

**実装詳細:**
1. トランザクション開始（Dexie）
2. 既存半荘IDを取得
3. カスケード削除（PlayerResults → Hanchans）
4. セッション設定を更新
5. 新しい半荘とプレイヤー結果を作成
6. サマリー再計算（`calculateSessionSummary`）
7. サマリー保存

**テスト項目:**
- [ ] 既存データの完全削除確認（カスケード）
- [ ] 新規データの正常作成
- [ ] サマリー再計算の正確性
- [ ] トランザクションロールバック（エラー時）

---

### Phase 2: SessionDetailDialog編集モード基盤構築 (見積: 2.0h)

**ファイル:** `src/components/SessionDetailDialog.tsx`

#### Task 2.1: State管理追加
```typescript
// 既存
const [sessionData, setSessionData] = useState<SessionWithDetails | null>(null)

// 追加
const [isEditMode, setIsEditMode] = useState(false)
const [editableSettings, setEditableSettings] = useState<SessionSettings | null>(null)
const [editableHanchans, setEditableHanchans] = useState<UIHanchan[]>([])
const [isSaving, setIsSaving] = useState(false)
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
```

#### Task 2.2: イベントハンドラー実装
```typescript
// 編集モード開始
const handleEditClick = () => {
  const settings = sessionToSettings(sessionData.session)
  const hanchans = dbHanchansToUIHanchans(sessionData.hanchans)
  setEditableSettings(settings)
  setEditableHanchans(hanchans)
  setIsEditMode(true)
}

// 保存
const handleSave = async () => {
  // バリデーション
  // UI → DB変換
  // updateSession呼び出し
  // トースト通知
  // 編集モード終了
}

// キャンセル
const handleCancel = () => {
  // 未保存警告
  // 編集モード終了
}
```

#### Task 2.3: UI構造変更（閲覧/編集モード切り替え）
- ヘッダー部分: 編集/保存/キャンセルボタン
- ボディ部分: `{!isEditMode ? <ReadOnlyView /> : <EditModeView />}`
- Dialog閉じる時の未保存警告

---

### Phase 3: EditModeView コンポーネント実装 (見積: 1.5h)

**ファイル:** `src/components/EditModeView.tsx` (新規作成)

#### Task 3.1: コンポーネント作成
```typescript
interface EditModeViewProps {
  settings: SessionSettings
  hanchans: UIHanchan[]
  mode: GameMode
  mainUser: User | null
  users: User[]
  onSettingsChange: (settings: SessionSettings) => void
  onHanchansChange: (hanchans: UIHanchan[]) => void
  onPlayerChange: (playerIndex: number, userId: string | null, playerName: string) => void
  onAddNewUser: (name: string) => Promise<User>
}

export function EditModeView({ ... }: EditModeViewProps) {
  return (
    <div className="space-y-4">
      <SessionSettingsCard {...} />
      <ScoreInputTable {...} />
      <TotalsPanel {...} />
    </div>
  )
}
```

#### Task 3.2: SessionSettingsCard調整
- `hideButtons` prop追加
- モード変更・保存ボタンの条件表示

---

### Phase 4: バリデーション＆エラーハンドリング強化 (見積: 1.0h)

**ファイル:** `src/lib/validation.ts` (新規作成)

#### Task 4.1: 保存前バリデーション実装
```typescript
export function validateSession(
  hanchans: UIHanchan[],
  mode: GameMode
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // 最低1半荘が必要
  // アクティブプレイヤー数チェック
  // 全点数入力チェック
  // ゼロサム検証
  // ウママーク合計検証

  return { valid: errors.length === 0, errors }
}
```

#### Task 4.2: handleSaveに統合
```typescript
const handleSave = async () => {
  const validation = validateSession(editableHanchans, sessionData.session.mode)
  if (!validation.valid) {
    toast.error('入力エラー', {
      description: validation.errors.join('\n')
    })
    return
  }
  // 保存処理...
}
```

---

### Phase 5: 統合テスト＆UX最適化 (見積: 1.5h)

#### Task 5.1: 統合テストシナリオ実行
- [ ] 新規セッション作成 → 編集 → 保存 → 確認
- [ ] 編集中キャンセル → 未保存警告確認
- [ ] ゼロサム違反 → バリデーションエラー確認
- [ ] ウママーク違反 → バリデーションエラー確認
- [ ] サマリー再計算の正確性確認
- [ ] useLiveQueryによる自動更新確認

#### Task 5.2: UX改善
- [ ] ローディング状態の視覚的フィードバック
- [ ] 保存成功時のアニメーション
- [ ] キーボードショートカット（Ctrl+S で保存等）
- [ ] フォーカス管理（編集モード開始時に最初の入力欄へフォーカス）
- [ ] スクロール位置復元

---

## 🔄 データフロー設計

### 編集モード開始フロー
```
ユーザー: [編集]ボタンクリック
  ↓
handleEditClick()
  ↓
sessionToSettings(sessionData.session)
  ↓ DB Session → UI SessionSettings
editableSettings: { date, rate, umaValue, ... }
  ↓
dbHanchansToUIHanchans(sessionData.hanchans)
  ↓ DB Hanchan[] → UI Hanchan[]（position順ソート）
editableHanchans: [{ hanchanNumber, players: [...], autoCalculated }]
  ↓
setIsEditMode(true)
  ↓
<EditModeView> レンダリング
  ├─ SessionSettingsCard
  ├─ ScoreInputTable
  └─ TotalsPanel
```

### 保存フロー
```
ユーザー: [保存]ボタンクリック
  ↓
handleSave()
  ↓
validateSession(editableHanchans, mode)
  ↓ バリデーション
{ valid: true, errors: [] } or { valid: false, errors: [...] }
  ↓ valid === false → toast.error() → return
uiDataToSaveData(editableSettings, editableHanchans, mode, parlorFee)
  ↓ UI → DB変換（GameMode文字列変換等）
saveData: SessionSaveData
  ↓
updateSession(sessionId, saveData, mainUserId)
  ↓ トランザクション開始
  ├─ 既存半荘・プレイヤー結果削除（カスケード）
  ├─ セッション設定更新
  ├─ 新規半荘・プレイヤー結果作成
  └─ サマリー再計算・保存
  ↓
toast.success('セッションを更新しました')
  ↓
setIsEditMode(false)
  ↓
useLiveQueryが自動更新を検知
  ↓
HistoryTabのセッション一覧が自動更新
```

### キャンセルフロー
```
ユーザー: [キャンセル]ボタンクリック
  ↓
handleCancel()
  ↓
hasUnsavedChanges === true?
  ├─ Yes → window.confirm('編集内容が保存されていません。破棄しますか？')
  │   ├─ confirmed === false → return（編集モード継続）
  │   └─ confirmed === true → 続行
  └─ No → 続行
  ↓
setIsEditMode(false)
setEditableSettings(null)
setEditableHanchans([])
setHasUnsavedChanges(false)
  ↓
<ReadOnlyView> レンダリング
```

---

## 📐 型定義仕様

### UIHanchan型（新規定義）
```typescript
// src/lib/db-utils.ts または src/types/ui.ts
export interface UIHanchan {
  hanchanNumber: number
  players: UIPlayerResult[]
  autoCalculated: boolean
}

export interface UIPlayerResult {
  playerName: string
  userId: string | null
  score: number | null
  umaMark: UmaMark
  chips: number
  parlorFee: number
  isSpectator: boolean
  umaMarkManual: boolean  // UI専用フィールド
}
```

### SessionSettings型（既存）
```typescript
// src/components/input/SessionSettings.tsx
export interface SessionSettings {
  date: string
  rate: number
  umaValue: number
  chipRate: number
  umaRule: UmaRule
}
```

### 型の対応表

| DB Entity | UI Type | 変換関数 | 備考 |
|-----------|---------|----------|------|
| `Session` | `SessionSettings` | `sessionToSettings()` | parlorFeeはSessionにあるがSessionSettingsにはない |
| `Hanchan & { players }` | `UIHanchan` | `dbHanchansToUIHanchans()` | position順ソート、umaMarkManual追加 |
| `PlayerResult` | `UIPlayerResult` | （上記に含まれる） | umaMarkManual追加 |

### GameMode文字列の注意点
```typescript
// UI Layer (GameMode型)
type GameMode = '4-player' | '3-player'

// DB Layer (SessionSaveData)
mode: 'four-player' | 'three-player'

// 変換必須
mode === '4-player' ? 'four-player' : 'three-player'
```

---

## ⚠️ リスク＆対策

### 1. データ整合性リスク

**リスク:**
- カスケード削除の失敗
- トランザクション中断時の不整合
- サマリー再計算の不一致

**対策:**
- Dexieトランザクション使用（all-or-nothing）
- 削除前にハンドラーチェック
- サマリー計算ロジックの単体テスト
- エラー時のロールバック保証

### 2. パフォーマンスリスク

**リスク:**
- 大量半荘編集時の遅延
- useLiveQueryによる不要な再レンダリング

**対策:**
- React.memo による最適化検討
- バッチ更新（複数変更を1回のDB操作に集約）
- debounce/throttle適用（過度な再計算防止）

### 3. UXリスク

**リスク:**
- 未保存データの意図しない消失
- 編集中のダイアログ誤閉じ
- バリデーションエラーの分かりにくさ

**対策:**
- 未保存警告ダイアログ（window.confirm）
- hasUnsavedChanges フラグ管理
- onOpenChange でのガード処理
- 詳細なバリデーションエラーメッセージ

### 4. 型安全性リスク

**リスク:**
- DB型とUI型の変換ミス
- GameMode文字列の不一致
- nullable値の扱いミス

**対策:**
- 型変換関数の単体テスト
- TypeScript strict mode使用
- 変換処理の集約（1箇所でのみ変換）

---

## 🧪 テスト戦略

### 単体テスト（Phase 1完了後）

**対象:** データ変換関数（db-utils.ts）

```typescript
describe('sessionToSettings', () => {
  it('should convert Session to SessionSettings correctly', () => {
    const session: Session = { /* ... */ }
    const result = sessionToSettings(session)
    expect(result).toEqual({
      date: session.date,
      rate: session.rate,
      // ...
    })
  })
})

describe('dbHanchansToUIHanchans', () => {
  it('should sort players by position', () => {
    const dbHanchans = [
      {
        hanchanNumber: 1,
        players: [
          { position: 2, /* ... */ },
          { position: 0, /* ... */ },
          { position: 1, /* ... */ }
        ]
      }
    ]
    const result = dbHanchansToUIHanchans(dbHanchans)
    expect(result[0].players[0].position).toBe(0)
    expect(result[0].players[1].position).toBe(1)
    expect(result[0].players[2].position).toBe(2)
  })
})

describe('updateSession', () => {
  it('should cascade delete old hanchans and playerResults', async () => {
    // Setup: 既存セッション作成
    // Act: updateSession実行
    // Assert: 古いデータが削除されていることを確認
  })

  it('should recalculate summary correctly', async () => {
    // Setup: セッション更新
    // Assert: summaryが正しく再計算されている
  })
})
```

### 統合テスト（Phase 5）

**シナリオ1: 正常系（編集→保存）**
```
1. セッション一覧で任意のセッションをクリック
2. 詳細ダイアログで[編集]ボタンクリック
3. 点数を変更（例: 半荘1のプレイヤー1を +10 → +15）
4. [保存]ボタンクリック
5. 確認:
   - トースト通知「セッションを更新しました」表示
   - 詳細ダイアログが閲覧モードに戻る
   - セッション一覧のサマリーが更新される
```

**シナリオ2: 異常系（ゼロサム違反）**
```
1. 編集モードで点数を変更（ゼロサム違反）
2. [保存]ボタンクリック
3. 確認:
   - バリデーションエラートースト表示
   - エラーメッセージに違反内容が明記
   - 編集モードが継続（保存されない）
```

**シナリオ3: キャンセル（未保存警告）**
```
1. 編集モードで点数を変更
2. [キャンセル]ボタンクリック
3. 確認:
   - 警告ダイアログ「編集内容が保存されていません。破棄しますか？」表示
   - [いいえ]選択 → 編集モード継続
   - [はい]選択 → 閲覧モードに戻る（変更破棄）
```

### E2Eテスト（オプショナル）

Playwrightを使用した自動化テスト:
```typescript
test('edit session and save successfully', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.click('[data-testid="history-tab"]')
  await page.click('[data-testid="session-card-0"]')
  await page.click('[data-testid="edit-button"]')
  await page.fill('[data-testid="score-input-h1-p0"]', '15')
  await page.click('[data-testid="save-button"]')
  await expect(page.locator('[data-testid="toast-success"]')).toBeVisible()
})
```

---

## 📊 実装スケジュール＆マイルストーン

| Phase | 内容 | 見積時間 | 依存関係 | 完了基準 |
|-------|------|----------|----------|----------|
| Phase 1 | データ変換層実装 | 1.5h | なし | 単体テスト全パス |
| Phase 2 | SessionDetailDialog改修 | 2.0h | Phase 1 | 編集モード切り替え動作確認 |
| Phase 3 | EditModeView実装 | 1.5h | Phase 2 | 3コンポーネント統合表示確認 |
| Phase 4 | バリデーション強化 | 1.0h | Phase 3 | エラーケース全てハンドリング |
| Phase 5 | テスト＆最適化 | 1.5h | Phase 4 | 統合テストシナリオ全パス |
| **合計** | | **7.5h** | | |

### マイルストーン

**M1: データ層完成（Phase 1完了）**
- 型変換関数実装完了
- updateSession関数実装完了
- 単体テスト全パス

**M2: UI基盤完成（Phase 2完了）**
- 編集モード切り替え動作
- 保存/キャンセルボタン実装
- State管理確立

**M3: 編集UI完成（Phase 3完了）**
- EditModeView統合
- 3コンポーネント正常動作
- イベントハンドラー配線完了

**M4: 品質保証完成（Phase 4-5完了）**
- バリデーション全実装
- 統合テスト全パス
- UX最適化完了

---

## 🎯 成功基準

### 機能要件
- [x] 既存セッションの全項目が編集可能
- [x] ゼロサム原則が維持される
- [x] ウママーク合計=0が維持される
- [x] サマリーが正確に再計算される
- [x] 未保存データ警告が機能する

### 非機能要件
- [x] 編集→保存が3秒以内に完了
- [x] バリデーションエラーが1秒以内に表示
- [x] 既存コンポーネント再利用率80%以上
- [x] TypeScript型エラー0件
- [x] 統合テストカバレッジ80%以上

### UX要件
- [x] 編集開始が1クリックで可能
- [x] 保存成功が視覚的に明確
- [x] エラーメッセージが具体的
- [x] 未保存時の意図しない消失を防止

---

## 📝 次のアクション

**Phase 1実装開始の準備:**
1. [ ] UIHanchan型の正式定義追加（db-utils.ts または types/ui.ts）
2. [ ] 型変換関数のシグネチャ確認
3. [ ] updateSession関数のトランザクション設計レビュー
4. [ ] Phase 1実装開始

**ドキュメント管理:**
- このドキュメント: `project-docs/2025-10-04-phase4-history-tab/05-EDIT_FEATURE_IMPLEMENTATION_PLAN.md`
- 実装進捗: TodoWrite で管理
- 実装完了後: MASTER_STATUS_DASHBOARD.md に記録

---

**最終更新:** 2025-10-05
**ステータス:** 実装計画完成 → Phase 1実装待ち
