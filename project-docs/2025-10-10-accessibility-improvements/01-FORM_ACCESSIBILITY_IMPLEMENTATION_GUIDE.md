# フォームアクセシビリティ改善ガイド

**作成日**: 2025-10-10
**対象**: Issue 1 (id/name属性) + Issue 3 (label関連付け)
**重要度**: 高（特にIssue 3はネイティブアプリで必須）

---

## 📋 目次

1. [問題の概要](#問題の概要)
2. [ネイティブアプリでの対応必要性](#ネイティブアプリでの対応必要性)
3. [Issue 1: id/name属性の追加](#issue-1-idname属性の追加)
4. [Issue 3: label htmlFor関連付け](#issue-3-label-htmlfor関連付け)
5. [実装方法](#実装方法)
6. [対応箇所](#対応箇所)
7. [テスト方法](#テスト方法)

---

## 問題の概要

### 開発ツールで検出された問題

**Issue 1**: "A form field element should have an id or name attribute"
- 影響: 6箇所のフォーム要素
- 症状: ブラウザのオートフィル機能が正しく動作しない可能性

**Issue 3**: "No label associated with a form field"
- 影響: 6箇所のlabel要素
- 症状: スクリーンリーダーが正しくフォームを読み上げられない

---

## ネイティブアプリでの対応必要性

### Capacitorアーキテクチャ

```
┌─────────────────────────────────────┐
│     ネイティブアプリ (iOS/Android)    │
├─────────────────────────────────────┤
│  WebView (WKWebView/Chromium)       │
│  ├─ HTML/CSS/JavaScript             │
│  ├─ React コンポーネント             │
│  └─ アクセシビリティツリー           │← スクリーンリーダーがここを読む
└─────────────────────────────────────┘
```

**重要**: Capacitorは内部的にWebViewを使用するため、**ブラウザと同じHTML構造とアクセシビリティ対応が必要**

### 各Issueの対応判断

| Issue | ブラウザ | ネイティブアプリ | 対応判断 | 理由 |
|-------|---------|----------------|---------|------|
| **Issue 1** | オートフィル用 | 意味なし | △ 推奨 | 実装のベストプラクティス |
| **Issue 2** | CSP eval警告 | 同じ | ✕ 不要 | セキュリティ機能として正しい |
| **Issue 3** | スクリーンリーダー | **スクリーンリーダー** | **◎ 必須** | VoiceOver/TalkBack対応 |

### Issue 3 が必須の理由

1. **iOS VoiceOver / Android TalkBack 対応**
   - WebView内のHTML要素を読み上げる
   - `<label htmlFor="...">` の関連付けがないと、視覚障害者が操作不可能

2. **App Store / Google Play 審査**
   - アクセシビリティガイドラインの遵守が求められる
   - 特にiOSはVoiceOver対応が重視される

3. **法令対応**
   - ADA (Americans with Disabilities Act)
   - WCAG 2.1 Level AA 基準

---

## Issue 1: id/name属性の追加

### 問題

```tsx
// ❌ 現在（id/name なし）
<select
  value={selectedUserId}
  onChange={(e) => onUserChange(e.target.value)}
  className="w-full h-12 text-sm border rounded px-2"
>
  <option value="...">...</option>
</select>
```

### 解決方法

```tsx
// ✅ 修正後（id と name を追加）
<select
  id="user-select"
  name="user"
  value={selectedUserId}
  onChange={(e) => onUserChange(e.target.value)}
  className="w-full h-12 text-sm border rounded px-2"
>
  <option value="...">...</option>
</select>
```

### ネーミング規則

- **id**: コンポーネント内で一意、kebab-case
- **name**: フォーム送信時のキー名、snake_case or camelCase

**例**:
- ユーザー選択: `id="analysis-user-select"`, `name="userId"`
- 期間選択: `id="analysis-period-select"`, `name="period"`
- モード選択: `id="analysis-mode-tabs"`, `name="mode"`

---

## Issue 3: label htmlFor関連付け

### 問題

```tsx
// ❌ 現在（htmlFor なし）
<label className="text-xs text-muted-foreground">ユーザー</label>
<select value={selectedUserId} ...>
```

**結果**:
- スクリーンリーダーが「選択ボックス、値：自分」とだけ読み上げる
- 何を選択するフィールドか分からない

### 解決方法

```tsx
// ✅ 修正後（htmlFor で関連付け）
<label htmlFor="user-select" className="text-xs text-muted-foreground">
  ユーザー
</label>
<select id="user-select" value={selectedUserId} ...>
```

**結果**:
- スクリーンリーダーが「ユーザー、選択ボックス、値：自分」と読み上げる
- labelをタップすると、selectにフォーカスが移る（モバイルで重要）

---

## 実装方法

### AnalysisFilters.tsx の修正

#### 1. ユーザー選択フィールド

```tsx
{/* ユーザー選択 */}
<div className="space-y-1">
  <label
    htmlFor="analysis-user-select"
    className="text-xs text-muted-foreground"
  >
    ユーザー
  </label>
  <select
    id="analysis-user-select"
    name="userId"
    value={selectedUserId}
    onChange={(e) => onUserChange(e.target.value)}
    className="w-full h-12 text-sm border rounded px-2"
    aria-label="分析対象ユーザーを選択"
  >
    {/* メインユーザー */}
    {mainUser && (
      <option key={mainUser.id} value={mainUser.id}>
        自分
      </option>
    )}
    {/* 登録ユーザー */}
    {users.map((user) => (
      <option key={user.id} value={user.id}>
        {user.name}
      </option>
    ))}
  </select>
</div>
```

#### 2. 期間選択フィールド

```tsx
{/* 期間選択 */}
<div className="space-y-1">
  <label
    htmlFor="analysis-period-select"
    className="text-xs text-muted-foreground"
  >
    期間
  </label>
  <select
    id="analysis-period-select"
    name="period"
    value={selectedPeriod}
    onChange={(e) => onPeriodChange(e.target.value as PeriodType)}
    className="w-full h-12 text-sm border rounded px-2"
    aria-label="分析期間を選択"
  >
    <option value="this-month">今月</option>
    <option value="this-year">今年</option>
    {availableYears.map((year) => (
      <option key={year} value={`year-${year}`}>
        {year}年
      </option>
    ))}
    <option value="all-time">全期間</option>
  </select>
</div>
```

#### 3. モードタブ（既存のTabsコンポーネント）

Tabsコンポーネントは shadcn/ui が内部的にアクセシビリティ対応済みですが、念のため role と aria-label を明示：

```tsx
{/* モードタブ */}
<div>
  <Tabs
    value={selectedMode}
    onValueChange={(value) => onModeChange(value as GameMode | 'all')}
  >
    <TabsList
      className="grid w-full grid-cols-3 h-12"
      aria-label="ゲームモード選択"
    >
      <TabsTrigger value="4-player" className="py-0 text-sm">
        4人打ち
      </TabsTrigger>
      <TabsTrigger value="3-player" className="py-0 text-sm">
        3人打ち
      </TabsTrigger>
      <TabsTrigger value="all" className="py-0 text-sm">
        全体
      </TabsTrigger>
    </TabsList>
  </Tabs>
</div>
```

---

## 対応箇所

### AnalysisFilters.tsx

| 要素 | 現在の行 | 追加する属性 |
|------|---------|------------|
| ユーザー選択 label | 37 | `htmlFor="analysis-user-select"` |
| ユーザー選択 select | 38-56 | `id="analysis-user-select"`, `name="userId"`, `aria-label` |
| 期間選択 label | 61 | `htmlFor="analysis-period-select"` |
| 期間選択 select | 62-76 | `id="analysis-period-select"`, `name="period"`, `aria-label` |
| モード TabsList | 82 | `aria-label="ゲームモード選択"` |

**合計**: 6箇所の修正

---

## テスト方法

### 開発ツールでの確認

1. **Chrome DevTools**
   - Elements タブで該当要素を選択
   - Accessibility ツリーで関連付けを確認
   - Issues タブで警告が消えたか確認

2. **React DevTools**
   - Props で id/name/htmlFor が正しく設定されているか確認

### スクリーンリーダーでの確認

#### iOS (VoiceOver)

1. **設定**
   - 設定 > アクセシビリティ > VoiceOver をON
   - または Siri に「VoiceOverをオン」

2. **操作**
   - 右スワイプで要素を順番に移動
   - ダブルタップで選択
   - 上下スワイプで値を変更

3. **期待される読み上げ**
   ```
   「ユーザー、選択ボックス、自分、調整可能」
   「期間、選択ボックス、今月、調整可能」
   「ゲームモード選択、タブ、1/3、4人打ち、選択済み」
   ```

#### Android (TalkBack)

1. **設定**
   - 設定 > ユーザー補助 > TalkBack をON
   - または 音量キー両方を長押し

2. **操作**
   - 右スワイプで要素を順番に移動
   - ダブルタップで選択
   - 上下スワイプで値を変更

3. **期待される読み上げ**
   ```
   「ユーザー、スピナー、自分」
   「期間、スピナー、今月」
   「4人打ち、タブ、1/3、選択済み」
   ```

### 自動テスト（オプション）

```typescript
// AnalysisFilters.test.tsx
import { render, screen } from '@testing-library/react'
import { AnalysisFilters } from './AnalysisFilters'

describe('AnalysisFilters アクセシビリティ', () => {
  test('ユーザー選択にid属性がある', () => {
    render(<AnalysisFilters {...props} />)
    const select = screen.getByLabelText('ユーザー')
    expect(select).toHaveAttribute('id', 'analysis-user-select')
    expect(select).toHaveAttribute('name', 'userId')
  })

  test('期間選択にid属性がある', () => {
    render(<AnalysisFilters {...props} />)
    const select = screen.getByLabelText('期間')
    expect(select).toHaveAttribute('id', 'analysis-period-select')
    expect(select).toHaveAttribute('name', 'period')
  })

  test('labelがselectと関連付けられている', () => {
    render(<AnalysisFilters {...props} />)
    const label = screen.getByText('ユーザー')
    expect(label).toHaveAttribute('for', 'analysis-user-select')
  })
})
```

---

## 参考リンク

### ガイドライン
- [WCAG 2.1 Level AA](https://www.w3.org/WAI/WCAG21/quickref/)
- [Apple Human Interface Guidelines - Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Android Accessibility Guidelines](https://developer.android.com/guide/topics/ui/accessibility)

### Capacitor ドキュメント
- [Capacitor iOS](https://capacitorjs.com/docs/ios)
- [Capacitor Android](https://capacitorjs.com/docs/android)

### スクリーンリーダー
- [VoiceOver ユーザガイド](https://support.apple.com/ja-jp/guide/iphone/iph3e2e415f/ios)
- [TalkBack ヘルプ](https://support.google.com/accessibility/android/answer/6283677)

---

## 実装チェックリスト

- [ ] AnalysisFilters.tsx 修正
  - [ ] ユーザー選択 label に htmlFor 追加
  - [ ] ユーザー選択 select に id/name 追加
  - [ ] 期間選択 label に htmlFor 追加
  - [ ] 期間選択 select に id/name 追加
  - [ ] モード TabsList に aria-label 追加
- [ ] ビルド成功確認
- [ ] Chrome DevTools で Issues 解消確認
- [ ] VoiceOver でテスト（iOS）
- [ ] TalkBack でテスト（Android）
- [ ] ドキュメント更新（このファイル）

---

**最終更新**: 2025-10-10
**ステータス**: 実装待ち
