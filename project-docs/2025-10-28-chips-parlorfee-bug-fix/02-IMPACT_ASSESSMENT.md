# Chips/ParlorFee 6倍バグ - 影響範囲評価

## 影響を受ける機能

### 1. 履歴タブ（HistoryTab）- **重大な影響**

**影響度**: 🔴 Critical（クリティカル）

#### 影響箇所
- **セッション一覧カード** (`src/components/tabs/HistoryTab.tsx:106-174`)
  - 「収支」表示が誤った値を表示
  - 「チップ」表示が誤った値を表示

#### 具体的な問題
```typescript
// 現在の表示（誤）
収支: +5400  // 実際は +1080 であるべき（5半荘の場合）
チップ: -10枚 // 実際は -2枚 であるべき

// 計算式（誤）
totalPayout = Σ(各半荘の収支 + chips × chipRate - parlorFee)
            = Σ(各半荘の収支) + (chips × chipRate × n半荘) - (parlorFee × n半荘)

// 計算式（正）
totalPayout = Σ(各半荘の収支) + (chips × chipRate × 1) - (parlorFee × 1)
```

#### ユーザーへの影響
- 過去の記録が全て誤った値で表示される
- ユーザーは自分の収支を正しく把握できない
- **修正後、既存データの表示が変わる** → ユーザー混乱の可能性

### 2. 新規入力タブ（InputTab）- **影響なし（偶然正常）**

**影響度**: 🟢 None（影響なし）

#### 現在の動作
```typescript
// TotalsPanel.tsx: calculatePlayerTotals
hanchans.forEach((hanchan) => {
  const player = hanchan.players[playerIndex]
  chips = player.chips         // 上書きのみ → 最終値
  parlorFee = player.parlorFee // 上書きのみ → 最終値
})
```

#### なぜ正常に動作しているか
1. InputTabでは全半荘に同じchips/parlorFee値をセット
2. ループで上書きしているため、最後の値 = すべての半荘の値
3. 結果的に正しい表示になる

#### 問題点
- **偶然正しく動作しているだけ**で、設計としては不正確
- 将来的に半荘ごとに異なるchips/parlorFeeを設定する場合に破綻する
- コードの意図が不明確

### 3. セッション詳細ダイアログ（SessionDetailDialog）- **影響あり**

**影響度**: 🟡 High（高）

#### 影響箇所
セッション詳細ダイアログは未確認だが、`calculateSessionSummary`を使用している場合は同様の問題がある可能性が高い。

#### 確認が必要なファイル
- `src/components/SessionDetailDialog.tsx`

**TODO**: このファイルを確認し、影響を評価する必要がある

### 4. 分析タブ（AnalysisTab）- **未実装のため保留**

**影響度**: ⚪️ N/A（未実装）

#### 将来の影響
- 分析タブ実装時に同じ問題が発生する可能性が高い
- 修正を先に行うことで、分析タブ実装時の問題を予防できる

## 影響を受けるコードモジュール

### A. コア計算ロジック - **修正必須**

#### `src/lib/session-utils.ts`

**影響関数**:
1. `calculatePayout` (L72-87)
   - 半荘ごとの収支計算
   - chips/parlorFeeを引数として受け取る
   - **修正必要**: 引数の設計を変更、またはフラグで制御

2. `calculateSessionSummary` (L99-245)
   - セッション全体のサマリー計算
   - **修正必要**: chips/parlorFeeのカウントロジック変更

**影響範囲の連鎖**:
```
calculateSessionSummary
  ↓ 呼び出し
calculatePayout (各半荘でループ)
  ↓ 使用
totalPayout (累積加算) ← ❌ ここで重複カウント
totalChips (累積加算)  ← ❌ ここで重複カウント
```

### B. データ保存 - **修正不要（現状維持）**

#### `src/lib/db/sessions.ts`

**影響関数**:
1. `saveSession` (L142-308)
   - Session, Hanchan, PlayerResultを一括作成
   - **修正不要**: データ構造は維持

2. `updateSession` (L375-531)
   - セッション更新（カスケード削除+再作成）
   - **修正不要**: データ構造は維持

**理由**:
- データモデル変更は制約により行わない
- PlayerResult.chips/parlorFeeフィールドは維持
- 計算ロジック側で対応

### C. UI表示 - **修正推奨（任意）**

#### `src/components/input/TotalsPanel.tsx`

**影響関数**:
- `calculatePlayerTotals` (L22-55)
  - **現在**: 上書き代入で偶然正しく動作
  - **推奨**: 明示的に最初の半荘から取得するように修正
  - **優先度**: 低（機能的には問題なし、コード品質向上のため）

## 既存データへの影響

### 保存済みセッションデータ

**影響**: 🔴 Critical（クリティカル）

#### 現状
```typescript
// DB内のデータ（5半荘の例）
Session {
  id: "abc123",
  summary: {
    totalChips: -10,      // ❌ 誤った値（-2 × 5半荘）
    totalPayout: 5400,    // ❌ 誤った値（chips/parlorFee含む）
  }
}
```

#### 修正後の期待動作
```typescript
// 修正後の再計算結果
Session {
  id: "abc123",
  summary: {
    totalChips: -2,       // ✅ 正しい値（セッション全体で1回）
    totalPayout: 1080,    // ✅ 正しい値（chips/parlorFee含む）
  }
}
```

### 後方互換性の確保

#### 問題点
- 既存のセッションは誤ったサマリーが保存されている
- 修正後に履歴タブを開くと、古いサマリーが表示される

#### 解決策（2つの選択肢）

##### 選択肢A: マイグレーション実行（推奨）
```typescript
// すべての既存セッションのサマリーを再計算
async function migrateAllSessions(mainUserId: string) {
  const sessions = await db.sessions.toArray()

  for (const session of sessions) {
    // 修正済みのcalculateSessionSummaryで再計算
    const newSummary = await calculateSessionSummary(session.id, mainUserId)
    await db.sessions.update(session.id, { summary: newSummary })
  }
}
```

**メリット**:
- 既存データも正しい値で表示される
- 一貫性が保たれる

**デメリット**:
- 初回起動時に処理時間がかかる可能性
- マイグレーション処理の実装が必要

##### 選択肢B: 遅延再計算（簡易版）
```typescript
// useSessions.tsxで保存済みサマリーがない場合のみ再計算
if (session.summary) {
  return { session, summary: session.summary }
} else {
  // 保存済みサマリーがない場合は計算
  const summary = await calculateSessionSummary(session.id, mainUserId)
  return { session, summary }
}
```

**現在の実装**: この方式を既に採用（`src/hooks/useSessions.ts:52-59`）

**メリット**:
- 既存コードで対応可能
- マイグレーション不要

**デメリット**:
- 古いセッションは誤った値のまま
- ユーザーが混乱する可能性

#### 推奨アプローチ
**選択肢A（マイグレーション）を強く推奨**

理由:
1. ユーザーは過去の正確な記録を期待する
2. 修正前後で値が変わることで混乱を生む
3. マイグレーションは一度だけ実行すればよい
4. IndexedDBの操作は高速なので、パフォーマンス問題は少ない

## 修正の優先度

### 必須修正（Priority: P0）
1. ✅ `src/lib/session-utils.ts` - calculateSessionSummary
   - chips/parlorFeeの重複カウント防止

2. ✅ マイグレーション処理の実装
   - 既存セッションのサマリー再計算

### 推奨修正（Priority: P1）
3. ⚠️ `src/components/input/TotalsPanel.tsx` - calculatePlayerTotals
   - コード品質向上（偶然の正常動作を明示的に）

### 任意修正（Priority: P2）
4. 📝 データモデル設計の見直し（将来的な改善）
   - chips/parlorFeeをSessionレベルに移動する検討
   - 現時点では実装不要（設計負債として記録のみ）

## リスク評価

### 修正によるリスク

#### リスク1: 既存データの表示変更
**影響度**: 🔴 High
**発生確率**: 🔴 High（100%）
**対策**: マイグレーション実行 + ユーザー通知

#### リスク2: 新しいバグの混入
**影響度**: 🟡 Medium
**発生確率**: 🟢 Low
**対策**: 十分なテストケース作成 + 手動テスト

#### リスク3: パフォーマンス劣化
**影響度**: 🟢 Low
**発生確率**: 🟢 Low
**対策**: マイグレーション処理の最適化、進捗表示

### 修正しない場合のリスク

#### リスク1: ユーザーの収支把握不能
**影響度**: 🔴 Critical
**発生確率**: 🔴 High（100%）
**影響**: アプリの根本的な価値を損なう

#### リスク2: ユーザー信頼の喪失
**影響度**: 🔴 Critical
**発生確率**: 🟡 Medium
**影響**: バグ発見後、アプリ全体への信頼低下

## まとめ

### 影響範囲のサマリー
| 機能/モジュール | 影響度 | 修正必要性 | 優先度 |
|---|---|---|---|
| HistoryTab | 🔴 Critical | 必須 | P0 |
| calculateSessionSummary | 🔴 Critical | 必須 | P0 |
| 既存データマイグレーション | 🔴 Critical | 必須 | P0 |
| TotalsPanel | 🟢 None（機能的） | 推奨 | P1 |
| InputTab | 🟢 None | 不要 | - |

### 推奨アクション
1. **即座に修正**: calculateSessionSummaryのロジック変更
2. **マイグレーション実装**: 既存データの再計算
3. **十分なテスト**: 計算結果の検証
4. **コード品質向上**: TotalsPanelの明示的な実装
