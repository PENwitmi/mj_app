# ウマルールのリアルタイム同期機能 - 実装記録

## 実装日
2025-10-16

## 概要
設定タブでウマルールを変更した際、入力タブにリアルタイムで反映される機能を実装。Custom Events APIを使用したコンポーネント間通信により、React Context不要で実装。

## 実装内容

### 1. utils.ts の変更
**ファイル**: `app/src/lib/utils.ts`

#### getDefaultUmaRule() - localStorage破損対応
```typescript
export function getDefaultUmaRule(): UmaRule {
  const stored = localStorage.getItem(STORAGE_KEYS.DEFAULT_UMA_RULE)
  if (stored === 'standard' || stored === 'second-minus') {
    return stored
  }

  // 無効な値の場合は修正
  if (stored !== null) {
    console.warn(`Invalid uma rule in localStorage: ${stored}. Resetting to 'standard'.`)
  }
  setDefaultUmaRule('standard')
  return 'standard'
}
```

#### setDefaultUmaRule() - カスタムイベント発行
```typescript
export function setDefaultUmaRule(rule: UmaRule): void {
  localStorage.setItem(STORAGE_KEYS.DEFAULT_UMA_RULE, rule)

  // カスタムイベントを発火（リアルタイム反映用）
  window.dispatchEvent(
    new CustomEvent('umaRuleChanged', {
      detail: { umaRule: rule },
    })
  )
}
```

#### TypeScript型定義
```typescript
export interface UmaRuleChangedEventDetail {
  umaRule: UmaRule
}

declare global {
  interface WindowEventMap {
    umaRuleChanged: CustomEvent<UmaRuleChangedEventDetail>
  }
}
```

### 2. InputTab.tsx の変更
**ファイル**: `app/src/components/tabs/InputTab.tsx`

#### イベントリスナー実装
```typescript
// ウマルール変更のリアルタイム反映
useEffect(() => {
  // 初回マウント時にlocalStorageから取得
  setSettings((prev) => ({
    ...prev,
    umaRule: getDefaultUmaRule(),
  }))

  // カスタムイベントリスナー（設定タブでの変更を検知）
  const handleUmaRuleChange = (e: CustomEvent<UmaRuleChangedEventDetail>) => {
    const newRule = e.detail.umaRule
    setSettings((prev) => ({
      ...prev,
      umaRule: newRule,
    }))

    // ユーザー通知
    const ruleName = newRule === 'standard' ? '標準ルール' : '2位マイナス判定'
    toast.info(`ウマルールが「${ruleName}」に変更されました。次の半荘から新しいルールが適用されます。`)
  }

  window.addEventListener('umaRuleChanged', handleUmaRuleChange as EventListener)

  return () => {
    window.removeEventListener('umaRuleChanged', handleUmaRuleChange as EventListener)
  }
}, [])
```

## 技術的特徴

### 1. Custom Events API
- React Context/Redux不要
- コンポーネント間の疎結合を維持
- ForceMount戦略と完全互換

### 2. Functional State Update
- `setSettings((prev) => ({ ...prev, umaRule }))` パターン
- 他の設定フィールド（date, rate, umaValue等）を保持
- データロスリスクなし

### 3. TypeScript型安全性
- `WindowEventMap`拡張による型推論
- `UmaRuleChangedEventDetail`インターフェース
- コンパイル時のエラー検出

### 4. User Experience
- トースト通知による即座のフィードバック
- 「次の半荘から」という明確な説明
- 既存データが失われないことの保証

## テスト結果

### テストシナリオ
1. 4人打ち麻雀を開始
2. 第1半荘に点数入力（40, -5, -10, -25）
3. 設定タブで「標準ルール」に変更 → トースト通知確認
4. 入力タブに戻る → データ保持確認
5. 第2半荘に同じ点数入力 → 標準ルール適用確認（2位に○）
6. 設定タブで「2位マイナス判定」に変更 → トースト通知確認
7. 第3半荘に同じ点数入力 → 2位マイナス判定適用確認（2位にマークなし）

### 確認項目
- ✅ トースト通知が表示される
- ✅ タブ切り替え時もデータが保持される
- ✅ 新しい半荘には新しいルールが適用される
- ✅ 既存の半荘はそのまま（再計算されない）

### スクリーンショット
`/Users/nishimototakashi/claude_code/mj_app/.playwright-mcp/test-uma-rule-realtime-sync-complete.png`

## コミット情報
- **コミットID**: ba4b685
- **メッセージ**: feat: ウマルールのリアルタイム同期機能を実装
- **変更行数**: +55行
- **変更ファイル**: 2ファイル

## 設計上の判断

### なぜCustom Eventsか？
1. **Context APIの欠点**:
   - プロバイダーの配置が必要
   - コンポーネントツリーの再設計が必要
   - 既存のForceMount戦略との相性問題

2. **Custom Eventsの利点**:
   - 既存コードへの影響最小
   - グローバルな通信が可能
   - 型安全性を保持可能
   - パフォーマンスオーバーヘッドなし

### なぜ既存データを再計算しないか？
- ユーザーの期待: 過去のデータは確定済み
- データ整合性: 事後変更によるトラブル回避
- 明示的な動作: 「次の半荘から」と通知

## 関連ドキュメント
- 設計ドキュメント: `project-docs/2025-10-15-playwright-test-strategy/04-UMA_RULE_REALTIME_SYNC_DESIGN.md`
- ForceMount影響分析: 同ドキュメント内

## 今後の展開
この実装パターンは他の設定項目（rate, umaValue, chipRate等）にも適用可能。
