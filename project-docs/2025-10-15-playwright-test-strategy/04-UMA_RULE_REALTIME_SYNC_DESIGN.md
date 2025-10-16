# ウマルール設定システム 包括的設計ドキュメント

**作成日**: 2025-10-16
**作成者**: Claude Code
**目的**: 麻雀アプリのウマルール設定システムの包括的な設計分析と、リアルタイム反映機能の詳細設計

---

## 目次
1. [現状分析](#1-現状分析)
2. [設計提案](#2-設計提案)
3. [実装ガイド](#3-実装ガイド)
4. [非機能要件](#4-非機能要件)
5. [まとめ](#5-まとめ)

---

## 1. 現状分析

### 1.1 システム概要

麻雀アプリは、ウマルール（着順ボーナス計算方式）を設定可能にし、点数計算に反映させるシステムを持っています。現在2種類のウマルールが存在します：

1. **標準ルール** (`'standard'`)
2. **2位マイナス判定** (`'second-minus'`)

**型定義** (`src/lib/db.ts:8`):
```typescript
export type UmaRule = 'standard' | 'second-minus';
```

### 1.2 データフロー（現状）

```
┌─────────────────────────────────────────────────────────────┐
│                    アプリ起動時                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  App.tsx (アプリケーションルート)                            │
│  - タブ管理 (useState: activeTab)                           │
│  - useUsers() フック使用                                     │
└─────────────────────────────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
┌────────────────────────┐  ┌────────────────────────┐
│   SettingsTab          │  │   InputTab             │
│   (設定変更UI)         │  │   (新規入力UI)         │
└────────────────────────┘  └────────────────────────┘
        │                            │
        │ handleUmaRuleChange        │ useEffect (mount時)
        ▼                            ▼
┌────────────────────────┐  ┌────────────────────────┐
│ setDefaultUmaRule()    │  │ getDefaultUmaRule()    │
│ (utils.ts:33)          │  │ (utils.ts:21)          │
└────────────────────────┘  └────────────────────────┘
        │                            │
        │ localStorage.setItem       │ localStorage.getItem
        ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│      localStorage['mj_app_default_uma_rule']                │
│      値: 'standard' | 'second-minus'                        │
└─────────────────────────────────────────────────────────────┘
                                     │
                                     ▼ (読み込まれた値)
┌─────────────────────────────────────────────────────────────┐
│  InputTab.tsx                                               │
│  - settings.umaRule (useState)                              │
│  - 初期値: getDefaultUmaRule() (Line 36-41)                │
└─────────────────────────────────────────────────────────────┘
                                     │
                                     ▼ (props経由)
┌─────────────────────────────────────────────────────────────┐
│  ScoreInputTable.tsx                                        │
│  - settings.umaRule を受け取り                              │
│  - handleScoreBlur → assignUmaMarks(players, mode, umaRule) │
│    (Line 80)                                                │
└─────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────┐
│  uma-utils.ts: assignUmaMarks()                             │
│  - umaRule による分岐ロジック                               │
│    - 'standard': 標準ウママーク割り当て                     │
│    - 'second-minus': 2位マイナス判定 + 特殊ウマ           │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 2種類のウマルールの詳細仕様

#### 1.3.1 標準ルール (`'standard'`)

**概要**: 1位・2位がプラス、3位・4位がマイナスのウママークを受け取る一般的なルール。

**ウママーク割り当て** (`uma-utils.ts:74-100`):

| モード | 1位 | 2位 | 3位 | 4位 |
|--------|-----|-----|-----|-----|
| 4人打ち | ○○ (+2) | ○ (+1) | ✗ (-1) | ✗✗ (-2) |
| 3人打ち | ○○ (+2) | ○ (+1) | ✗✗✗ (-3) | - |

**計算例** (4人打ち、ウマ=10):
- 1位: +20
- 2位: +10
- 3位: -10
- 4位: -20
- **合計: 0** (ゼロサム)

**コード実装** (`uma-utils.ts:82-86`):
```typescript
if (playersWithIndex.length >= 1) umaMarks[playersWithIndex[0].index] = '○○'
if (playersWithIndex.length >= 2) umaMarks[playersWithIndex[1].index] = '○'
if (playersWithIndex.length >= 3) umaMarks[playersWithIndex[2].index] = '✗'
if (playersWithIndex.length >= 4) umaMarks[playersWithIndex[3].index] = '✗✗'
```

#### 1.3.2 2位マイナス判定 (`'second-minus'`)

**概要**: 2位の点数が負の場合、1位のウママークが増加する特殊ルール。

**判定条件** (`uma-utils.ts:71-72`):
```typescript
const secondPlaceScore = playersWithIndex.length >= 2 ? (playersWithIndex[1].player.score ?? 0) : 0
const isSecondMinus = umaRule === 'second-minus' && secondPlaceScore < 0
```

**ウママーク割り当て** (`uma-utils.ts:75-80, 89-93`):

| モード | 条件 | 1位 | 2位 | 3位 | 4位 |
|--------|------|-----|-----|-----|-----|
| 4人打ち | 2位 < 0 | ○○○ (+3) | 無印 (0) | ✗ (-1) | ✗✗ (-2) |
| 3人打ち | 2位 < 0 | ○○○ (+3) | ✗ (-1) | ✗✗ (-2) | - |

**計算例** (4人打ち、2位が-5、ウマ=10):
- 1位: +30
- 2位: 0
- 3位: -10
- 4位: -20
- **合計: 0** (ゼロサム)

**コード実装** (`uma-utils.ts:77-80`):
```typescript
if (playersWithIndex.length >= 1) umaMarks[playersWithIndex[0].index] = '○○○'
if (playersWithIndex.length >= 2) umaMarks[playersWithIndex[1].index] = ''
if (playersWithIndex.length >= 3) umaMarks[playersWithIndex[2].index] = '✗'
if (playersWithIndex.length >= 4) umaMarks[playersWithIndex[3].index] = '✗✗'
```

### 1.4 問題点の詳細

#### 問題1: タイミングラグ

**症状**:
- SettingsTabでウマルールを変更
- localStorageには即座に反映される
- しかし、**すでにマウント済みのInputTabには反映されない**

**原因** (`InputTab.tsx:36-41`):
```typescript
useEffect(() => {
  setSettings((prev) => ({
    ...prev,
    umaRule: getDefaultUmaRule(),
  }))
}, []) // 依存配列が空 → マウント時のみ実行
```

この`useEffect`は**マウント時に1回のみ**実行されるため、SettingsTabでの変更を検知できません。

#### 問題2: タブ切り替え時の動作

**現在の動作**:
1. ユーザーがInputTabをアクティブにする（初回）
   - `useEffect`が実行され、localStorageから初期値を取得
   - `settings.umaRule = 'standard'` (例)
2. ユーザーがSettingsTabでルールを変更
   - `setDefaultUmaRule('second-minus')`
   - localStorageに保存
3. ユーザーがInputTabに戻る
   - タブは既にマウント済み（`forceMount`使用）
   - `useEffect`は再実行されない
   - **古い値のまま** (`'standard'`)

**期待動作**:
- SettingsTabでの変更が、InputTabに**即座に**反映される

#### 問題3: データフローの分断

```
SettingsTab  →  localStorage  →  InputTab
    (書き込み)       (永続化)        (読み込み: マウント時のみ)

→ 両者の間に「リアルタイム通信」がない
```

### 1.5 現在の変更フロー

**ユーザー操作ステップ**:
1. SettingsTabを開く
2. デフォルトウマルールのセレクトボックスをクリック
3. 新しいルールを選択（例: 標準ルール → 2位マイナス判定）
4. （自動的に保存される）
5. InputTabに切り替える
6. **期待**: 新しいルールが適用されたウママークが表示される
7. **現実**: 古いルールのままウママークが表示される

**内部処理ステップ**:
1. `SettingsTab.handleUmaRuleChange()` 実行 (Line 54-58)
2. `setDefaultUmaRuleState(newRule)` - ローカルState更新
3. `setDefaultUmaRule(newRule)` - localStorage書き込み
4. （InputTabは変更を検知できない）

**状態遷移図**:
```
[初期状態]
  localStorage: 'standard'
  SettingsTab.state: 'standard'
  InputTab.state: 'standard'

↓ SettingsTabで変更

[変更直後]
  localStorage: 'second-minus' ✓
  SettingsTab.state: 'second-minus' ✓
  InputTab.state: 'standard' ✗ (古い値のまま)

↓ InputTabアンマウント → 再マウント

[再マウント後]
  localStorage: 'second-minus' ✓
  SettingsTab.state: 'second-minus' ✓
  InputTab.state: 'second-minus' ✓ (useEffectで再読み込み)
```

---

## 2. 設計提案

### 2.1 アーキテクチャ設計

リアルタイム反映を実現するための3つのパターンを比較検討します。

#### パターン1: Window Storageイベント（❌ 不採用）

**仕組み**:
- `window.addEventListener('storage', handler)`
- localStorageの変更を自動検知

**実装例**:
```typescript
// InputTab.tsx
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'mj_app_default_uma_rule') {
      setSettings(prev => ({ ...prev, umaRule: getDefaultUmaRule() }))
    }
  }

  window.addEventListener('storage', handleStorageChange)
  return () => window.removeEventListener('storage', handleStorageChange)
}, [])
```

**メリット**:
- ブラウザネイティブAPI
- 追加ライブラリ不要

**デメリット**:
- **同一タブ内の変更は検知されない**（別タブ・別ウィンドウのみ）
- 本アプリはシングルタブアプリなので**使用不可**

**評価**: ❌ 不採用（要件を満たさない）

---

#### パターン2: カスタムイベント（⭐ 推奨）

**仕組み**:
- localStorage変更時にカスタムイベントを発火
- 他のコンポーネントがイベントをリッスン

**シーケンス図**:
```
[SettingsTab]               [EventBus]            [InputTab]
      │                          │                     │
      │ handleUmaRuleChange      │                     │
      ├──────────────────────────┤                     │
      │ setDefaultUmaRule()      │                     │
      ├──────────────────────────┤                     │
      │ dispatchEvent            │                     │
      │ ('umaRuleChanged')       │                     │
      ├─────────────────────────►│                     │
      │                          │ addEventListener    │
      │                          ├────────────────────►│
      │                          │ handleEvent         │
      │                          │ setSettings()       │
      │                          │◄────────────────────┤
      │                          │                     │
```

**実装例**:

**1. カスタムイベント発行** (`utils.ts`):
```typescript
export function setDefaultUmaRule(rule: UmaRule): void {
  localStorage.setItem(STORAGE_KEYS.DEFAULT_UMA_RULE, rule)

  // カスタムイベント発火
  window.dispatchEvent(new CustomEvent('umaRuleChanged', {
    detail: { umaRule: rule }
  }))
}
```

**2. イベントリスナー** (`InputTab.tsx`):
```typescript
useEffect(() => {
  const handleUmaRuleChange = (e: Event) => {
    const customEvent = e as CustomEvent<{ umaRule: UmaRule }>
    setSettings(prev => ({
      ...prev,
      umaRule: customEvent.detail.umaRule
    }))
  }

  window.addEventListener('umaRuleChanged', handleUmaRuleChange)
  return () => window.removeEventListener('umaRuleChanged', handleUmaRuleChange)
}, [])
```

**メリット**:
- ✅ シンプル・軽量（ライブラリ不要）
- ✅ 同一タブ内で動作
- ✅ 疎結合（SettingsTabとInputTabが直接依存しない）
- ✅ 拡張性（他のコンポーネントも簡単にリッスン可能）
- ✅ パフォーマンス影響なし

**デメリット**:
- グローバルイベント（命名衝突に注意）

**評価**: ⭐ **推奨** - 要件を満たし、シンプルで保守性が高い

---

#### パターン3: React Context（△ 過剰設計）

**仕組み**:
- ウマルール設定をContext化
- Provider/Consumerパターン

**実装例**:
```typescript
// UmaRuleContext.tsx
const UmaRuleContext = createContext<{
  umaRule: UmaRule
  setUmaRule: (rule: UmaRule) => void
}>({ umaRule: 'standard', setUmaRule: () => {} })

export const UmaRuleProvider = ({ children }) => {
  const [umaRule, setUmaRule] = useState<UmaRule>(getDefaultUmaRule())

  const setUmaRuleAndPersist = (rule: UmaRule) => {
    setUmaRule(rule)
    setDefaultUmaRule(rule)
  }

  return (
    <UmaRuleContext.Provider value={{ umaRule, setUmaRule: setUmaRuleAndPersist }}>
      {children}
    </UmaRuleContext.Provider>
  )
}

// App.tsx
<UmaRuleProvider>
  <Tabs>...</Tabs>
</UmaRuleProvider>

// InputTab.tsx
const { umaRule } = useContext(UmaRuleContext)
```

**メリット**:
- React標準パターン
- 型安全

**デメリット**:
- ❌ 複雑（Providerのネスト管理）
- ❌ 既存設計の大幅変更（SessionSettingsインターフェース変更必須）
- ❌ localStorageとContextの2重管理

**評価**: △ 過剰設計（シンプルな要件に対して複雑すぎる）

---

### 2.2 推奨パターン詳細設計（パターン2）

#### 2.2.1 インターフェース設計

##### A. カスタムイベント仕様

**イベント名**: `umaRuleChanged`

**ペイロード構造**:
```typescript
interface UmaRuleChangedEventDetail {
  umaRule: UmaRule
}

// TypeScript型定義
declare global {
  interface WindowEventMap {
    'umaRuleChanged': CustomEvent<UmaRuleChangedEventDetail>
  }
}
```

**Dispatch側** (`utils.ts`):
```typescript
export function setDefaultUmaRule(rule: UmaRule): void {
  localStorage.setItem(STORAGE_KEYS.DEFAULT_UMA_RULE, rule)

  window.dispatchEvent(new CustomEvent('umaRuleChanged', {
    detail: { umaRule: rule }
  }))
}
```

**Listener側** (`InputTab.tsx`):
```typescript
useEffect(() => {
  const handleUmaRuleChange = (e: CustomEvent<UmaRuleChangedEventDetail>) => {
    setSettings(prev => ({
      ...prev,
      umaRule: e.detail.umaRule
    }))
  }

  window.addEventListener('umaRuleChanged', handleUmaRuleChange as EventListener)
  return () => window.removeEventListener('umaRuleChanged', handleUmaRuleChange as EventListener)
}, [])
```

##### B. カスタムフック `useDefaultUmaRule()` の仕様

**目的**: ウマルールのリアルタイム同期を簡単に利用可能にする

**型定義**:
```typescript
/**
 * デフォルトウマルールをリアルタイム同期するカスタムフック
 * @returns 現在のウマルール（localStorageの変更を自動反映）
 */
export function useDefaultUmaRule(): UmaRule
```

**APIインターフェース**:
```typescript
// 使用例
const umaRule = useDefaultUmaRule()
```

**内部ロジック**:
```typescript
export function useDefaultUmaRule(): UmaRule {
  const [umaRule, setUmaRule] = useState<UmaRule>(getDefaultUmaRule())

  useEffect(() => {
    const handleUmaRuleChange = (e: Event) => {
      const customEvent = e as CustomEvent<UmaRuleChangedEventDetail>
      setUmaRule(customEvent.detail.umaRule)
    }

    window.addEventListener('umaRuleChanged', handleUmaRuleChange)
    return () => window.removeEventListener('umaRuleChanged', handleUmaRuleChange)
  }, [])

  return umaRule
}
```

**エラーハンドリング**:
```typescript
export function useDefaultUmaRule(): UmaRule {
  const [umaRule, setUmaRule] = useState<UmaRule>(() => {
    try {
      return getDefaultUmaRule()
    } catch (err) {
      console.error('Failed to load default uma rule:', err)
      return 'standard' // フォールバック値
    }
  })

  useEffect(() => {
    const handleUmaRuleChange = (e: Event) => {
      try {
        const customEvent = e as CustomEvent<UmaRuleChangedEventDetail>
        const newRule = customEvent.detail.umaRule

        // バリデーション
        if (newRule !== 'standard' && newRule !== 'second-minus') {
          console.error('Invalid uma rule:', newRule)
          return
        }

        setUmaRule(newRule)
      } catch (err) {
        console.error('Failed to handle uma rule change:', err)
      }
    }

    window.addEventListener('umaRuleChanged', handleUmaRuleChange)
    return () => window.removeEventListener('umaRuleChanged', handleUmaRuleChange)
  }, [])

  return umaRule
}
```

#### 2.2.2 状態管理設計

##### 状態の所有者

| コンポーネント | 状態 | 役割 |
|--------------|------|------|
| **localStorage** | `mj_app_default_uma_rule` | 永続化層（SSOT: Single Source of Truth） |
| **SettingsTab** | `defaultUmaRuleState` | ローカルUI状態（セレクトボックス表示用） |
| **InputTab** | `settings.umaRule` | セッション設定の一部（点数計算に使用） |

##### 状態の伝播方法

```
[ユーザー操作]
      │
      ▼
┌──────────────────┐
│  SettingsTab     │
│  handleUmaRule   │
│  Change()        │
└──────────────────┘
      │
      ▼ setDefaultUmaRule()
┌──────────────────┐
│  localStorage    │
│  (SSOT)          │
└──────────────────┘
      │
      │ dispatchEvent('umaRuleChanged')
      ▼
┌──────────────────────────────────────┐
│  window (EventBus)                   │
└──────────────────────────────────────┘
      │
      │ addEventListener
      ▼
┌──────────────────┐
│  InputTab        │
│  handleUmaRule   │
│  Change()        │
│  → setSettings() │
└──────────────────┘
```

##### 状態の永続化戦略

| ストレージ | 用途 | 理由 |
|-----------|------|------|
| **localStorage** | デフォルトウマルール | ✅ ブラウザ再起動後も保持 |
| **SessionStorage** | （不使用） | ❌ タブ閉じると消える（要件に不適） |
| **IndexedDB (Dexie)** | セッションデータのウマルール | ✅ 保存済みセッション用（既存実装） |

### 2.3 データフロー図（提案後）

```
┌─────────────────────────────────────────────────────────────┐
│                    アプリ起動時                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  App.tsx (アプリケーションルート)                            │
│  - タブ管理 (useState: activeTab)                           │
│  - useUsers() フック使用                                     │
└─────────────────────────────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
┌────────────────────────┐  ┌────────────────────────┐
│   SettingsTab          │  │   InputTab             │
│   (設定変更UI)         │  │   (新規入力UI)         │
└────────────────────────┘  └────────────────────────┘
        │                            │
        │ handleUmaRuleChange        │ useDefaultUmaRule()
        ▼                            │ (カスタムフック)
┌────────────────────────┐           │
│ setDefaultUmaRule()    │           │
│ (utils.ts)             │           │
└────────────────────────┘           │
        │                            │
        │ 1. localStorage.setItem    │
        │ 2. dispatchEvent           │
        ▼                            │
┌──────────────────────────────────┐ │
│ localStorage + EventBus          │ │
│ - 'mj_app_default_uma_rule'      │ │
│ - CustomEvent('umaRuleChanged')  │ │
└──────────────────────────────────┘ │
                │                    │
                └────────────────────┘
                         │
                         ▼ addEventListener
┌─────────────────────────────────────────────────────────────┐
│  InputTab.tsx                                               │
│  - settings.umaRule (useState)                              │
│  - useEffect: リアルタイム更新                              │
└─────────────────────────────────────────────────────────────┘
                                     │
                                     ▼ (props経由)
┌─────────────────────────────────────────────────────────────┐
│  ScoreInputTable.tsx                                        │
│  - settings.umaRule を受け取り                              │
│  - handleScoreBlur → assignUmaMarks(players, mode, umaRule) │
└─────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────┐
│  uma-utils.ts: assignUmaMarks()                             │
│  - umaRule による分岐ロジック                               │
└─────────────────────────────────────────────────────────────┘
```

**変更点**:
- ✅ SettingsTab → InputTabへの**リアルタイム通信**が確立
- ✅ localStorageとEventBusの組み合わせで、永続化と通信を両立
- ✅ useDefaultUmaRule() カスタムフックで、他のコンポーネントも簡単に参加可能

---

## 3. 実装ガイド

### 3.1 変更箇所の詳細

#### 変更ファイル一覧

| ファイル | 変更内容 | 変更規模 |
|---------|---------|---------|
| `src/lib/utils.ts` | カスタムイベント発行、型定義追加 | 小（+10行） |
| `src/components/tabs/InputTab.tsx` | useEffect修正（イベントリスナー追加） | 小（+10行） |
| `src/components/tabs/SettingsTab.tsx` | （変更なし） | なし |

#### ファイル1: `src/lib/utils.ts`

**変更前**:
```typescript
// Line 29-35
export function setDefaultUmaRule(rule: UmaRule): void {
  localStorage.setItem(STORAGE_KEYS.DEFAULT_UMA_RULE, rule)
}
```

**変更後**:
```typescript
// 型定義追加（ファイル冒頭）
export interface UmaRuleChangedEventDetail {
  umaRule: UmaRule
}

// グローバル型定義拡張
declare global {
  interface WindowEventMap {
    'umaRuleChanged': CustomEvent<UmaRuleChangedEventDetail>
  }
}

// Line 29-37 (変更後)
export function setDefaultUmaRule(rule: UmaRule): void {
  localStorage.setItem(STORAGE_KEYS.DEFAULT_UMA_RULE, rule)

  // カスタムイベント発火
  window.dispatchEvent(new CustomEvent('umaRuleChanged', {
    detail: { umaRule: rule }
  }))
}
```

**変更理由**:
- localStorage更新と同時にイベント発火することで、リスナー側が即座に検知可能になる
- 型定義追加により、TypeScriptの型安全性を確保

**影響範囲**:
- SettingsTabから呼ばれるため、SettingsTabでのウマルール変更時に自動的にイベントが発火される
- 他のコンポーネントへの影響なし（後方互換性あり）

---

#### ファイル2: `src/components/tabs/InputTab.tsx`

**変更前** (Line 35-41):
```typescript
// コンポーネントマウント時にlocalStorageから最新のウマルールを取得
useEffect(() => {
  setSettings((prev) => ({
    ...prev,
    umaRule: getDefaultUmaRule(),
  }))
}, []) // 依存配列が空 → マウント時のみ実行
```

**変更後**:
```typescript
// コンポーネントマウント時にlocalStorageから最新のウマルールを取得
useEffect(() => {
  setSettings((prev) => ({
    ...prev,
    umaRule: getDefaultUmaRule(),
  }))
}, [])

// ウマルール変更のリアルタイム反映
useEffect(() => {
  const handleUmaRuleChange = (e: CustomEvent<UmaRuleChangedEventDetail>) => {
    setSettings((prev) => ({
      ...prev,
      umaRule: e.detail.umaRule,
    }))
  }

  window.addEventListener('umaRuleChanged', handleUmaRuleChange as EventListener)
  return () => window.removeEventListener('umaRuleChanged', handleUmaRuleChange as EventListener)
}, [])
```

**変更理由**:
- マウント時の初期化（既存）に加えて、リアルタイム更新機能を追加
- SettingsTabでのウマルール変更を即座にキャッチして、settings.umaRuleを更新

**影響範囲**:
- InputTab内の点数計算ロジック（ScoreInputTable等）は、settings.umaRuleを参照しているため、自動的に新しいルールが適用される
- 既存の動作を壊さない（additive change）

**型安全性**:
```typescript
// utils.tsで定義された型を利用
import type { UmaRuleChangedEventDetail } from '@/lib/utils'

const handleUmaRuleChange = (e: CustomEvent<UmaRuleChangedEventDetail>) => {
  // e.detail.umaRule は UmaRule型で型チェックされる
}
```

---

### 3.2 テスト戦略

#### 3.2.1 ユニットテスト

**テスト対象**: `src/lib/utils.ts` - `setDefaultUmaRule()`

**テストケース**:
```typescript
describe('setDefaultUmaRule', () => {
  beforeEach(() => {
    localStorage.clear()
    // イベントリスナーのモック
    window.dispatchEvent = jest.fn()
  })

  test('localStorageに正しく保存される', () => {
    setDefaultUmaRule('second-minus')
    expect(localStorage.getItem('mj_app_default_uma_rule')).toBe('second-minus')
  })

  test('カスタムイベントが発火される', () => {
    setDefaultUmaRule('standard')
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'umaRuleChanged',
        detail: { umaRule: 'standard' }
      })
    )
  })
})
```

**テスト対象**: `src/components/tabs/InputTab.tsx` - リアルタイム更新

**テストケース**:
```typescript
import { render } from '@testing-library/react'
import { InputTab } from './InputTab'

describe('InputTab - Real-time Uma Rule Sync', () => {
  test('カスタムイベント受信でsettings.umaRuleが更新される', async () => {
    const { rerender } = render(<InputTab {...mockProps} />)

    // 初期値確認
    // (settingsの初期値は'standard'と仮定)

    // カスタムイベント発火
    window.dispatchEvent(new CustomEvent('umaRuleChanged', {
      detail: { umaRule: 'second-minus' }
    }))

    rerender(<InputTab {...mockProps} />)

    // settings.umaRuleが'second-minus'に更新されたことを確認
    // (実際のテストではmockPropsやState検証が必要)
  })
})
```

#### 3.2.2 統合テスト

**シナリオ1**: SettingsTab → InputTab リアルタイム反映

```typescript
describe('Settings → Input Real-time Sync', () => {
  test('SettingsでのUmaRule変更がInputTabに即座に反映される', async () => {
    const { getByRole, getByText } = render(<App />)

    // 1. InputTabでセッション開始（4人打ち選択）
    // ...

    // 2. SettingsTabに移動
    const settingsTab = getByRole('tab', { name: '設定' })
    fireEvent.click(settingsTab)

    // 3. ウマルールを変更
    const umaRuleSelect = getByRole('combobox')
    fireEvent.change(umaRuleSelect, { target: { value: 'second-minus' } })

    // 4. InputTabに戻る
    const inputTab = getByRole('tab', { name: '新規入力' })
    fireEvent.click(inputTab)

    // 5. 点数入力してウママーク確認
    // （2位がマイナス点の場合、1位に○○○が付くことを検証）
    // ...
  })
})
```

**シナリオ2**: ゼロサム検証

```typescript
describe('Uma Calculation with Real-time Rule', () => {
  test('2位マイナス判定でウママーク合計が0になる', () => {
    // 4人打ち、2位が-5の場合
    const players = [
      { score: 15 }, // 1位
      { score: -5 }, // 2位（マイナス）
      { score: -3 }, // 3位
      { score: -7 }, // 4位
    ]

    const umaMarks = assignUmaMarks(players, '4-player', 'second-minus')

    // ウママーク: ['○○○', '', '✗', '✗✗']
    const umaSum = umaMarks.reduce((sum, mark) => sum + umaMarkToValue(mark), 0)
    expect(umaSum).toBe(0) // 3 + 0 + (-1) + (-2) = 0
  })
})
```

#### 3.2.3 E2Eテスト（Playwright）

**シナリオ**: ユーザーの実際の操作フロー

```typescript
// tests/uma-rule-sync.spec.ts
import { test, expect } from '@playwright/test'

test('ウマルール変更のリアルタイム反映', async ({ page }) => {
  // 1. アプリ起動
  await page.goto('http://localhost:5173')

  // 2. InputTabで4人打ち選択
  await page.click('text=4人打ち麻雀')

  // 3. SettingsTabに移動
  await page.click('[role="tab"]:has-text("設定")')

  // 4. ウマルールを「2位マイナス判定」に変更
  await page.selectOption('select', '2位マイナス判定')

  // 5. InputTabに戻る
  await page.click('[role="tab"]:has-text("新規入力")')

  // 6. 点数入力（2位がマイナスのケース）
  // 1位: +15, 2位: -5, 3位: -3, 4位: -7
  await page.fill('[data-testid="score-1-1"]', '15')
  await page.fill('[data-testid="score-1-2"]', '-5')
  await page.fill('[data-testid="score-1-3"]', '-3')
  // 4位は自動計算されるはず

  // 7. ウママーク確認（1位に○○○が付いているか）
  const umaMark1st = await page.textContent('[data-testid="uma-mark-1-1"]')
  expect(umaMark1st).toBe('○○○')

  // 8. 2位は無印（空文字）
  const umaMark2nd = await page.textContent('[data-testid="uma-mark-1-2"]')
  expect(umaMark2nd).toBe('─') // 無印の表示
})
```

### 3.3 マイグレーション計画

#### 3.3.1 既存データへの影響

**結論**: ✅ **既存データへの影響なし**

**理由**:
- localStorageの`mj_app_default_uma_rule`キーは既に存在（既存実装で使用中）
- 新規追加は「カスタムイベント発火」のみ
- IndexedDBのセッションデータには影響しない（各セッションは独自のumaRuleを保持）

#### 3.3.2 デプロイ手順

**ステップ1**: コード変更のコミット
```bash
git add src/lib/utils.ts src/components/tabs/InputTab.tsx
git commit -m "feat: ウマルール設定のリアルタイム反映機能を実装

- utils.ts: setDefaultUmaRule()にカスタムイベント発火を追加
- InputTab.tsx: umaRuleChangedイベントリスナーを追加
- 型定義: UmaRuleChangedEventDetailを追加
"
```

**ステップ2**: ローカル検証
```bash
npm run dev
# 手動でSettingsTab → InputTabの動作を確認
```

**ステップ3**: テスト実行
```bash
npm run lint
npm run build
# (ユニットテストがあれば) npm test
```

**ステップ4**: デプロイ
```bash
npm run build
# ビルド成果物をデプロイ
```

**ステップ5**: 本番環境での動作確認
- SettingsTabでウマルール変更
- InputTabで新しいルールが即座に反映されることを確認

#### 3.3.3 ロールバック戦略

**リスク評価**: 🟢 **低リスク**
- 既存機能を壊さない（additive change）
- localStorage読み込みロジックは変更なし

**ロールバック手順**:
1. 問題発生時は、変更前のコミットにrevert
   ```bash
   git revert <commit-hash>
   ```
2. 緊急デプロイ
3. 根本原因調査

**ロールバック影響**:
- カスタムイベント発火が停止
- InputTabはマウント時のみlocalStorageから読み込む（既存動作に戻る）
- データ損失なし

---

## 4. 非機能要件

### 4.1 パフォーマンス

#### 4.1.1 リアルタイム反映のレイテンシ

**目標値**: < 50ms（人間が知覚できない範囲）

**測定方法**:
```typescript
// SettingsTab.tsx
const handleUmaRuleChange = (value: string) => {
  const startTime = performance.now()

  const newRule = value as UmaRule
  setDefaultUmaRuleState(newRule)
  setDefaultUmaRule(newRule)

  const endTime = performance.now()
  console.log(`Uma rule change latency: ${endTime - startTime}ms`)
}
```

**実測値（推定）**:
- localStorage.setItem: 1-5ms
- dispatchEvent: < 1ms
- イベントハンドラー実行: 1-3ms
- **合計: < 10ms** ✅ 目標達成

#### 4.1.2 メモリ使用量の影響

**評価**: 🟢 **影響なし**

**理由**:
- カスタムイベントはGC対象（イベント発火後すぐに解放）
- イベントリスナーは1つ（InputTab）のみ
- 追加メモリ: < 1KB

#### 4.1.3 再レンダリングの最適化

**現状**:
- SettingsTabでのウマルール変更 → InputTabの`settings` Stateが更新 → 再レンダリング

**最適化1**: `React.memo`でScoreInputTableを最適化
```typescript
export const ScoreInputTable = React.memo(({ settings, ... }) => {
  // ...
}, (prevProps, nextProps) => {
  // settings.umaRuleが変わった時のみ再レンダリング
  return prevProps.settings.umaRule === nextProps.settings.umaRule
})
```

**最適化2**: `useMemo`でウママーク計算を最適化
```typescript
const assignedUmaMarks = useMemo(() => {
  return assignUmaMarks(players, mode, settings.umaRule)
}, [players, mode, settings.umaRule])
```

**評価**: 現状のパフォーマンスは十分高速のため、**過剰最適化は不要**

### 4.2 セキュリティ

#### 4.2.1 localStorage改ざんリスク

**リスク**: 🟡 **低リスク（ユーザー自身のみ影響）**

**シナリオ**:
- ユーザーがブラウザのDevToolsでlocalStorageを直接編集
- 無効な値（例: `'invalid-rule'`）を設定

**対策1**: バリデーション強化 (`utils.ts`):
```typescript
export function getDefaultUmaRule(): UmaRule {
  const stored = localStorage.getItem(STORAGE_KEYS.DEFAULT_UMA_RULE)

  // 厳密なバリデーション
  if (stored === 'standard' || stored === 'second-minus') {
    return stored
  }

  // 無効な値の場合はデフォルト値を返し、修正する
  console.warn(`Invalid uma rule in localStorage: ${stored}. Resetting to 'standard'.`)
  setDefaultUmaRule('standard')
  return 'standard'
}
```

**対策2**: 型ガード
```typescript
function isValidUmaRule(value: unknown): value is UmaRule {
  return value === 'standard' || value === 'second-minus'
}
```

**評価**: ✅ 十分な対策（他ユーザーへの影響なし）

#### 4.2.2 XSS対策（カスタムイベント）

**リスク**: 🟢 **リスクなし**

**理由**:
- カスタムイベントのペイロードは`UmaRule`型（'standard' | 'second-minus'）
- ユーザー入力（文字列）を直接扱わない
- React標準のエスケープ機能が有効

**評価**: ✅ XSSリスクなし

### 4.3 保守性

#### 4.3.1 コードの可読性

**評価**: ⭐⭐⭐⭐⭐ **高い**

**理由**:
- カスタムイベント名（`umaRuleChanged`）が明確
- 型定義により、イベントペイロードが自己文書化
- コメントで意図を明記

**改善例**:
```typescript
// ✅ 良い例: 意図が明確
useEffect(() => {
  // ウマルール変更のリアルタイム反映
  const handleUmaRuleChange = (e: CustomEvent<UmaRuleChangedEventDetail>) => {
    setSettings(prev => ({ ...prev, umaRule: e.detail.umaRule }))
  }

  window.addEventListener('umaRuleChanged', handleUmaRuleChange as EventListener)
  return () => window.removeEventListener('umaRuleChanged', handleUmaRuleChange as EventListener)
}, [])
```

#### 4.3.2 テスタビリティ

**評価**: ⭐⭐⭐⭐☆ **高い**

**理由**:
- カスタムイベントはモック可能
- 純粋関数（assignUmaMarks等）は変更なし
- 統合テストで実際の動作を検証可能

**テスト容易性**:
```typescript
// イベント発火のモック
window.dispatchEvent = jest.fn()

// イベントリスナーのテスト
window.dispatchEvent(new CustomEvent('umaRuleChanged', { detail: { umaRule: 'standard' } }))
```

#### 4.3.3 拡張性（将来的な設定項目追加）

**評価**: ⭐⭐⭐⭐⭐ **非常に高い**

**シナリオ1**: 新しいウマルール追加（例: `'uma-3-1'`）

**必要な変更**:
1. 型定義更新 (`db.ts`):
   ```typescript
   export type UmaRule = 'standard' | 'second-minus' | 'uma-3-1'
   ```
2. 計算ロジック更新 (`uma-utils.ts`):
   ```typescript
   if (umaRule === 'uma-3-1') {
     // 新ルールのウママーク割り当て
   }
   ```
3. UI更新 (`SettingsTab.tsx`):
   ```typescript
   <SelectItem value="uma-3-1">ウマ3-1ルール</SelectItem>
   ```

**カスタムイベントシステムへの影響**: ❌ **なし**（既存実装のまま動作）

---

**シナリオ2**: 他の設定項目のリアルタイム反映（例: デフォルトレート）

**実装パターン**:
```typescript
// utils.ts
export function setDefaultRate(rate: number): void {
  localStorage.setItem(STORAGE_KEYS.DEFAULT_RATE, String(rate))
  window.dispatchEvent(new CustomEvent('defaultRateChanged', { detail: { rate } }))
}

// InputTab.tsx
useEffect(() => {
  const handleRateChange = (e: CustomEvent<{ rate: number }>) => {
    setSettings(prev => ({ ...prev, rate: e.detail.rate }))
  }

  window.addEventListener('defaultRateChanged', handleRateChange as EventListener)
  return () => window.removeEventListener('defaultRateChanged', handleRateChange as EventListener)
}, [])
```

**評価**: ✅ 同じパターンで拡張可能

---

## 5. まとめ

### 5.1 推奨実装

#### 実装サマリー

| 項目 | 内容 |
|------|------|
| **パターン** | カスタムイベント（パターン2） |
| **変更ファイル数** | 2ファイル（utils.ts, InputTab.tsx） |
| **変更行数** | 合計 +20行 |
| **リスク** | 🟢 低リスク（additive change） |
| **テスト戦略** | ユニット + 統合 + E2E |
| **パフォーマンス影響** | < 10ms（無視できるレベル） |
| **保守性** | ⭐⭐⭐⭐⭐ 非常に高い |

#### 実装の核心

**1. `utils.ts`でカスタムイベント発火**:
```typescript
export function setDefaultUmaRule(rule: UmaRule): void {
  localStorage.setItem(STORAGE_KEYS.DEFAULT_UMA_RULE, rule)
  window.dispatchEvent(new CustomEvent('umaRuleChanged', { detail: { umaRule: rule } }))
}
```

**2. `InputTab.tsx`でリアルタイム受信**:
```typescript
useEffect(() => {
  const handleUmaRuleChange = (e: CustomEvent<UmaRuleChangedEventDetail>) => {
    setSettings(prev => ({ ...prev, umaRule: e.detail.umaRule }))
  }

  window.addEventListener('umaRuleChanged', handleUmaRuleChange as EventListener)
  return () => window.removeEventListener('umaRuleChanged', handleUmaRuleChange as EventListener)
}, [])
```

#### 実装の利点

1. ✅ **シンプル**: 追加コード < 30行
2. ✅ **リアルタイム**: SettingsTab変更 → InputTab即座反映
3. ✅ **型安全**: TypeScript型定義で保証
4. ✅ **疎結合**: コンポーネント間の直接依存なし
5. ✅ **拡張性**: 他の設定項目にも同じパターン適用可能
6. ✅ **後方互換性**: 既存動作を壊さない
7. ✅ **テスト容易性**: モック・検証が簡単

### 5.2 今後の展望

#### 短期（Phase 1）: 本設計の実装
- [x] 設計完了
- [ ] 実装（utils.ts, InputTab.tsx）
- [ ] テスト（ユニット + 統合）
- [ ] デプロイ

#### 中期（Phase 2）: 他設定項目への展開
- デフォルトレート（rate）のリアルタイム反映
- デフォルトウマ値（umaValue）のリアルタイム反映
- デフォルトチップレート（chipRate）のリアルタイム反映

**実装パターン統一**:
```typescript
// 汎用的なカスタムイベントシステム
type SettingKey = 'umaRule' | 'rate' | 'umaValue' | 'chipRate'

function dispatchSettingChange<T>(key: SettingKey, value: T): void {
  window.dispatchEvent(new CustomEvent(`${key}Changed`, { detail: { value } }))
}
```

#### 長期（Phase 3）: 高度な同期システム
- ブラウザタブ間同期（Storage Event活用）
- Cloud同期（複数デバイス間での設定共有）
- 設定プリセット機能（複数の設定セットを切り替え）

**技術的可能性**:
```typescript
// Cloud同期例（Firebase Realtime Database）
const settingsRef = ref(db, `users/${userId}/settings`)
onValue(settingsRef, (snapshot) => {
  const cloudSettings = snapshot.val()
  // ローカル設定との差分を検知して同期
})
```

---

## 補足資料

### A. 関連ファイルパス一覧

| カテゴリ | ファイルパス |
|---------|-------------|
| **データモデル** | `/Users/nishimototakashi/claude_code/mj_app/app/src/lib/db.ts` |
| **ウマ計算ロジック** | `/Users/nishimototakashi/claude_code/mj_app/app/src/lib/uma-utils.ts` |
| **ユーティリティ** | `/Users/nishimototakashi/claude_code/mj_app/app/src/lib/utils.ts` |
| **設定タブUI** | `/Users/nishimototakashi/claude_code/mj_app/app/src/components/tabs/SettingsTab.tsx` |
| **入力タブUI** | `/Users/nishimototakashi/claude_code/mj_app/app/src/components/tabs/InputTab.tsx` |
| **セッション設定** | `/Users/nishimototakashi/claude_code/mj_app/app/src/components/input/SessionSettings.tsx` |
| **点数入力テーブル** | `/Users/nishimototakashi/claude_code/mj_app/app/src/components/input/ScoreInputTable.tsx` |
| **集計パネル** | `/Users/nishimototakashi/claude_code/mj_app/app/src/components/input/TotalsPanel.tsx` |
| **アプリルート** | `/Users/nishimototakashi/claude_code/mj_app/app/src/App.tsx` |

### B. 重要な既存設計思想

本設計は以下の既存設計思想を尊重しています：

1. **単一責任の原則** (SRP)
   - `utils.ts`: localStorage管理
   - `uma-utils.ts`: ウマ計算ロジック
   - `InputTab.tsx`: 入力UIロジック

2. **開放閉鎖の原則** (OCP)
   - 既存機能を変更せず、新機能を追加（additive change）

3. **依存性逆転の原則** (DIP)
   - カスタムイベントで疎結合を実現

4. **React 19ベストプラクティス**
   - `useEffect`での副作用管理
   - クリーンアップ関数でイベントリスナー解除

5. **パフォーマンスファースト**
   - 不要な再レンダリングを避ける設計

### C. 用語集

| 用語 | 説明 |
|------|------|
| **ウマルール** | 麻雀の着順ボーナス計算方式 |
| **ウママーク** | 着順に応じた記号（○○○、○○、○、無印、✗、✗✗、✗✗✗） |
| **標準ルール** | 1-2位がプラス、3-4位がマイナスの一般的なルール |
| **2位マイナス判定** | 2位が負の場合、1位のウマが増加する特殊ルール |
| **ゼロサム** | ウママークの合計が0になる原則 |
| **カスタムイベント** | `window.dispatchEvent()`で発火するカスタムDOMイベント |
| **SSOT** | Single Source of Truth（単一の真実の情報源） |
| **リアルタイム反映** | 設定変更が即座に他のコンポーネントに反映されること |

---

**ドキュメント終了**

この設計ドキュメントは、ウマルール設定システムのリアルタイム反映機能の実装に必要なすべての情報を網羅しています。実装時は、セクション3「実装ガイド」を参照し、段階的に進めてください。
