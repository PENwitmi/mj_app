# Phase 5-5: タブ切り替えエラー修正

**作成日**: 2025-10-09
**ステータス**: 実装準備中
**目的**: Recharts使用時のタブ切り替えコンソールエラーを解消

---

## 📋 目次

1. [問題の発見経緯](#問題の発見経緯)
2. [根本原因の特定](#根本原因の特定)
3. [解決策の選定](#解決策の選定)
4. [実装計画](#実装計画)
5. [検証計画](#検証計画)
6. [関連ドキュメント](#関連ドキュメント)

---

## 問題の発見経緯

### 発見のタイムライン

**2025-10-09 11:51 - Phase 5-4 (RevenueTimelineChart実装) 開始**
- LineChart実装中にコンソールエラーを発見
- 初期は「グラフの実装方法の問題」と誤認

**2025-10-09 12:30 - エラー原因の調査**
- `min-height`使用でエラー解消を試みる（効果なし）
- TESTタブ作成して体系的に検証

**2025-10-09 14:30 - 真の原因を特定**
- ユーザーからの重要な指摘: 「タブ切り替え時にエラーが出る」
- グラフの実装ではなく、**App.tsxのタブ切り替え実装**が原因と判明

### エラーメッセージ

```
The width(0) and height(0) of chart should be greater than 0,
please check the style of container, or the props width(100%) and height(100%),
or add a minWidth(0) or minHeight(undefined) or use aspect(undefined)
to control the height and width.
```

**発生タイミング**:
- 分析タブ → 入力タブ → 分析タブ
- TEST タブ → 入力タブ → TEST タブ
- 任意のグラフ含むタブの切り替え時

**表示への影響**: なし（グラフは正常に表示される）

---

## 根本原因の特定

### App.tsxの実装

```tsx
// 現在の実装（問題あり）
<TabsContent value="analysis" ... forceMount>
  <AnalysisTab />
</TabsContent>

<TabsContent value="test" ... forceMount>
  <LineChartTest />
</TabsContent>
```

### 問題のメカニズム

1. **forceMount の役割**
   - 全タブが常にDOMにマウントされたまま
   - タブ切り替えは`data-[state=inactive]:hidden`でCSSのみで制御
   - **目的**: コンポーネントのStateを保持（InputTabの入力内容等）

2. **ResponsiveContainer の問題**
   - Rechartsの`ResponsiveContainer`は親要素のサイズを測定
   - `display: none`の要素はwidth/height = 0として計算される
   - タブ切り替え時、一瞬非アクティブ状態（サイズ0）が検出される

3. **エラー発生の流れ**
   ```
   分析タブ表示中（グラフ表示）
     ↓
   入力タブに切り替え
     ↓
   [React処理]
     1. activeTab state更新: "analysis" → "input"
     2. 分析タブに `data-state=inactive` 適用
     3. 分析タブが `hidden` クラスで非表示 ← width/height=0
     4. ResponsiveContainerがサイズ再測定 → エラー！
     ↓
   入力タブが表示される
   ```

### 検証結果（TESTタブで確認）

**Test 1-13（min-height等の対策）**:
- 全てのパターンでエラー発生
- グラフの実装方法ではないことが確定

**Test 14-18（タブ切り替え対策）**:
- チェックボックスON/OFF（コンポーネント内のState変更）では効果なし
- **App.tsxのタブ切り替え**が原因と確認

**重要な発見**:
- Test 18（IntersectionObserver）: グラフ描写前にタブを切り替えるとエラーが出ない
- → タブがアクティブになってから遅延レンダリングすれば解決できる

---

## 解決策の選定

### 検討した選択肢

#### 案1: forceMount削除
```tsx
<TabsContent value="analysis">  {/* forceMount削除 */}
  <AnalysisTab />
</TabsContent>
```

**メリット**:
- コード変更最小
- エラー完全解消

**デメリット**:
- タブ切り替え時に毎回アンマウント→再マウント
- **全てのStateが初期化される**
- InputTabの入力内容が消失 ❌

#### 案2: グラフコンポーネント内で個別対応
```tsx
// AnalysisTab内部
function AnalysisTab({ isActive }: { isActive: boolean }) {
  const [shouldRenderCharts, setShouldRenderCharts] = useState(false)

  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => setShouldRenderCharts(true), 100)
      return () => clearTimeout(timer)
    }
  }, [isActive])

  return (
    <div>
      <AnalysisFilters ... />
      {shouldRenderCharts && <RankStatisticsChart ... />}
    </div>
  )
}
```

**メリット**:
- forceMount維持
- AnalysisTabのStateは保持可能

**デメリット**:
- AnalysisTab, SettingsTabなど複数のタブを修正必要
- 各タブに`isActive` propsを渡す必要

#### 案3: App.tsxで条件付きレンダリング（採用）
```tsx
function App() {
  const [activeTab, setActiveTab] = useState('input')
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['input']))

  useEffect(() => {
    const timer = setTimeout(() => {
      setMountedTabs(prev => new Set([...prev, activeTab]))
    }, 100)
    return () => clearTimeout(timer)
  }, [activeTab])

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      {/* グループ1: State保持が必須 → 条件なし */}
      <TabsContent value="input" forceMount>
        <InputTab />
      </TabsContent>

      {/* グループ2: State初期化OK → 条件付き */}
      <TabsContent value="analysis" forceMount>
        <div className={activeTab !== 'analysis' ? "hidden" : ""}>
          {mountedTabs.has('analysis') && activeTab === 'analysis' && (
            <AnalysisTab />
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
```

**メリット**:
- App.tsxの修正だけで完結
- 各タブコンポーネントは変更不要
- タブごとに適用の可否を選択できる

**デメリット**:
- 条件付きレンダリングを適用したタブはStateが初期化される

### 選定理由

**案3を採用**する理由:

1. **実装が簡単**: App.tsxのみの修正で済む
2. **柔軟性**: タブごとに適用の可否を判断できる
3. **適切なトレードオフ**: State初期化の影響を受け入れられるタブのみに適用

---

## 実装計画

### フェーズ1: State初期化の影響分析

各タブについてState初期化の影響を評価：

| タブ | 主なState | 初期化の影響 | 判定 | 理由 |
|------|----------|-------------|------|------|
| **InputTab** | フォーム入力中のデータ | ❌ **致命的** | 条件なし | ユーザーの作業（20分の入力）が失われる |
| **HistoryTab** | スクロール位置、選択中のセッション | ⚠️ **不便** | 条件なし | UX低下が大きい |
| **AnalysisTab** | フィルター選択（期間、モード、ユーザー） | ✅ **許容範囲** | **条件付き** | 再選択すれば済む |
| **SettingsTab** | 編集中のユーザー情報 | ✅ **許容範囲** | **条件付き** | 編集中でなければ影響なし |

**判断基準**:
- **ユーザーの作業が失われる** → 条件なし（State保持必須）
- **表示条件がリセットされるだけ** → 条件付き（State初期化OK）

### フェーズ2: App.tsx修正

#### 修正内容

```tsx
import { useState, useEffect } from 'react'

function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('input')

  // 【追加】タブ切り替えエラー対策: 一度アクティブになったタブを記録
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['input']))

  const { mainUser, activeUsers, archivedUsers, addNewUser, editUser, archiveUser, restoreUser } = useUsers()

  // 【追加】タブがアクティブになったら100ms遅延してmountedTabsに追加
  useEffect(() => {
    const timer = setTimeout(() => {
      setMountedTabs(prev => new Set([...prev, activeTab]))
    }, 100)

    return () => clearTimeout(timer)
  }, [activeTab])

  // ... 初期化処理等 ...

  return (
    <div className="flex flex-col h-screen">
      <Toaster />
      <div className="flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full gap-0">
          {/*
            グループ1: State保持が必須
            - InputTab: フォーム入力中のデータ
            - HistoryTab: スクロール位置、選択状態
          */}
          <TabsContent value="input" className="overflow-hidden px-2 pt-1 pb-12 data-[state=inactive]:hidden" forceMount>
            <InputTab
              mainUser={mainUser}
              users={activeUsers}
              addNewUser={addNewUser}
              onSaveSuccess={() => setActiveTab('history')}
            />
          </TabsContent>

          <TabsContent value="history" className="overflow-hidden px-2 pt-1 pb-12 data-[state=inactive]:hidden" forceMount>
            <HistoryTab
              mainUser={mainUser}
              users={activeUsers}
              addNewUser={addNewUser}
            />
          </TabsContent>

          {/*
            グループ2: State初期化OK + グラフあり
            - AnalysisTab: フィルター選択のみ（Rechartsあり）
            - SettingsTab: 編集中でなければ影響なし
          */}
          <TabsContent value="analysis" className="overflow-hidden px-2 pt-1 pb-12 data-[state=inactive]:hidden" forceMount>
            {/* 【追加】条件付きレンダリング */}
            <div className={activeTab !== 'analysis' ? "hidden" : ""}>
              {mountedTabs.has('analysis') && activeTab === 'analysis' && (
                <AnalysisTab
                  mainUser={mainUser}
                  users={activeUsers}
                  addNewUser={addNewUser}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="overflow-hidden px-2 pt-1 pb-12 data-[state=inactive]:hidden" forceMount>
            {/* 【追加】条件付きレンダリング */}
            <div className={activeTab !== 'settings' ? "hidden" : ""}>
              {mountedTabs.has('settings') && activeTab === 'settings' && (
                <SettingsTab
                  mainUser={mainUser}
                  activeUsers={activeUsers}
                  archivedUsers={archivedUsers}
                  addNewUser={addNewUser}
                  editUser={editUser}
                  archiveUser={archiveUser}
                  restoreUser={restoreUser}
                />
              )}
            </div>
          </TabsContent>

          {/* タブナビゲーション */}
          {/* ... */}
        </Tabs>
      </div>
    </div>
  )
}
```

#### 変更箇所まとめ

1. **State追加** (1箇所)
   ```tsx
   const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['input']))
   ```

2. **useEffect追加** (1箇所)
   ```tsx
   useEffect(() => {
     const timer = setTimeout(() => {
       setMountedTabs(prev => new Set([...prev, activeTab]))
     }, 100)
     return () => clearTimeout(timer)
   }, [activeTab])
   ```

3. **AnalysisTab条件付きレンダリング** (1箇所)
   ```tsx
   <div className={activeTab !== 'analysis' ? "hidden" : ""}>
     {mountedTabs.has('analysis') && activeTab === 'analysis' && (
       <AnalysisTab ... />
     )}
   </div>
   ```

4. **SettingsTab条件付きレンダリング** (1箇所)
   ```tsx
   <div className={activeTab !== 'settings' ? "hidden" : ""}>
     {mountedTabs.has('settings') && activeTab === 'settings' && (
       <SettingsTab ... />
     )}
   </div>
   ```

### フェーズ3: TESTタブ削除

実装完了後、TESTタブは不要なので削除：

1. `src/components/test/LineChartTest.tsx` 削除
2. App.tsxから以下を削除:
   - `import { LineChartTest } from '@/components/test/LineChartTest'`
   - TESTタブのTabsContent
   - TESTタブのTabsTrigger
   - `grid-cols-5` → `grid-cols-4`
   - `activeTab`のデフォルト値を `'test'` → `'input'` に戻す

---

## 検証計画

### 検証1: コンソールエラーの確認

**目的**: タブ切り替え時にwidth/heightエラーが出ないことを確認

**手順**:
1. ブラウザのDevToolsを開く（Console タブ）
2. 分析タブを表示（グラフが表示されることを確認）
3. 入力タブに切り替え
4. 再度分析タブに切り替え（グラフが表示されることを確認）
5. 設定タブに切り替え
6. 再度分析タブに切り替え
7. コンソールにエラーが出ないことを確認

**期待される結果**:
- ✅ コンソールにwidth/heightエラーが出ない
- ✅ グラフは正常に表示される
- ✅ タブ切り替えがスムーズ

### 検証2: InputTab State保持の確認

**目的**: InputTabの入力内容が保持されることを確認

**手順**:
1. 入力タブで以下を入力:
   - 日付選択
   - 半荘1のプレイヤー選択
   - 半荘1の点数入力
   - 半荘2のプレイヤー選択開始
2. 分析タブに移動
3. 履歴タブに移動
4. 設定タブに移動
5. 入力タブに戻る
6. 入力内容が全て保持されていることを確認

**期待される結果**:
- ✅ 日付、プレイヤー選択、点数入力が全て保持されている
- ✅ ユーザーの作業が失われていない

### 検証3: AnalysisTab State初期化の確認

**目的**: AnalysisTabのフィルターがリセットされることを確認

**手順**:
1. 分析タブを表示
2. フィルターを変更:
   - 期間: 「今月」→「今年」
   - モード: 「4人打ち」→「3人打ち」
   - ユーザー: メインユーザー → 他のユーザー
3. グラフが更新されることを確認
4. 入力タブに移動
5. 分析タブに戻る
6. フィルターがデフォルト値に戻っていることを確認

**期待される結果**:
- ✅ フィルターがデフォルト値（今月・4人打ち・メインユーザー）にリセットされている
- ✅ グラフはエラーなく表示される
- ✅ データは正しく表示される（DBから再取得）

### 検証4: HistoryTab State保持の確認

**目的**: HistoryTabのState（スクロール位置等）が保持されることを確認

**手順**:
1. 履歴タブを表示
2. セッション一覧をスクロール（下の方まで）
3. 特定のセッション詳細を開く
4. 分析タブに移動
5. 履歴タブに戻る
6. スクロール位置と詳細ダイアログの状態を確認

**期待される結果**:
- ✅ スクロール位置が保持されている
- ✅ 開いていた詳細ダイアログが保持されている（または適切に閉じている）

### 検証5: SettingsTab State初期化の確認

**目的**: SettingsTabのStateがリセットされることを確認

**手順**:
1. 設定タブを表示
2. ユーザー編集ダイアログを開く（開かずに次へ進んでもOK）
3. 入力タブに移動
4. 設定タブに戻る
5. ダイアログが閉じていることを確認

**期待される結果**:
- ✅ 編集ダイアログは閉じている（Stateリセット）
- ✅ ユーザー一覧は正しく表示される（DBから再取得）

### 検証6: パフォーマンスの確認

**目的**: 不要な再レンダリングが発生していないことを確認

**手順**:
1. React DevToolsの Profiler を開く
2. 録画開始
3. タブを複数回切り替え（input → analysis → history → settings → input）
4. 録画停止
5. 各コンポーネントの再レンダリング回数を確認

**期待される結果**:
- ✅ 必要最小限の再レンダリング
- ✅ 不要なコンポーネントが再レンダリングされていない

---

## 実装後のタスク

### 1. ドキュメント更新

- [ ] MASTER_STATUS_DASHBOARD.mdにPhase 5-5を追加
- [ ] CLAUDE.mdの「過去のインシデント教訓」に追加
- [ ] 07-REVENUE_TIMELINE_CHART_IMPLEMENTATION_PLAN.mdに関連記載を追加

### 2. コードクリーンアップ

- [ ] TESTタブ削除
  - `src/components/test/LineChartTest.tsx`
  - App.tsxのimportとTabsContent
- [ ] AnalysisTabのコメントアウト解除
  - `RankStatisticsChart`
  - `RevenueTimelineChart`

### 3. Git コミット

```bash
git add app/src/App.tsx
git commit -m "Fix: タブ切り替え時のRechartsコンソールエラーを解消

- forceMount使用時のResponsiveContainerサイズ検出問題に対応
- AnalysisTab/SettingsTabに条件付きレンダリングを適用
- InputTab/HistoryTabはState保持のため条件なしレンダリング維持
- 100ms遅延レンダリングでエラー完全解消

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## トラブルシューティング

### Q1. 分析タブ初回表示時に100ms遅延が気になる

**原因**: `mountedTabs`の初期値に'analysis'が含まれていない

**解決策**: よく使うタブを初期値に追加
```tsx
const [mountedTabs, setMountedTabs] = useState<Set<string>>(
  new Set(['input', 'analysis'])  // analysisも追加
)
```

### Q2. タブ切り替え時にちらつきが見える

**原因**: 100msの遅延が長い

**解決策**: 遅延時間を調整（50ms以上推奨）
```tsx
const timer = setTimeout(() => {
  setMountedTabs(prev => new Set([...prev, activeTab]))
}, 50)  // 100 → 50
```

### Q3. AnalysisTabのフィルターState保持が必要になった

**原因**: 要件変更

**解決策**: 案2（グラフコンポーネント内で個別対応）に変更
1. AnalysisTabのpropsに`isActive: boolean`を追加
2. App.tsxで`isActive={activeTab === 'analysis'}`を渡す
3. AnalysisTab内部でグラフのみ条件付きレンダリング

---

## 関連ドキュメント

### プロジェクト内
- [Phase 5-4: RevenueTimelineChart実装計画](./07-REVENUE_TIMELINE_CHART_IMPLEMENTATION_PLAN.md)
- [Phase 5-3: RankStatisticsChart実装計画](./05-GRAPH_IMPLEMENTATION_PLAN.md)

### 開発知見
- [Recharts タブ切り替えエラー解決ガイド](/Users/nishimototakashi/claude_code/development-insights/charts/recharts-tab-switching-error-solution.md)
- [Recharts LineChart実装ガイド](/Users/nishimototakashi/claude_code/development-insights/charts/recharts-linechart-implementation-guide.md)
- [Recharts 横棒グラフ実装ガイド](/Users/nishimototakashi/claude_code/development-insights/charts/recharts-horizontal-bar-chart-guide.md)

### 外部リソース
- [shadcn/ui Tabs ドキュメント](https://ui.shadcn.com/docs/components/tabs)
- [Recharts ResponsiveContainer API](https://recharts.org/en-US/api/ResponsiveContainer)

---

## 更新履歴

- 2025-10-09: 初版作成（実装準備中）
