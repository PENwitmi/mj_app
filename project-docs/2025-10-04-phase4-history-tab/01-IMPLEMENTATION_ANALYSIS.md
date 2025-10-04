# Phase 4: 履歴タブ実装 - 多角的分析と実装計画

**作成日**: 2025-10-04 14:47
**ステータス**: 計画中

---

## 📋 目次

1. [既存設計の分析](#既存設計の分析)
2. [現状のコード分析](#現状のコード分析)
3. [実装戦略](#実装戦略)
4. [タスク分解](#タスク分解)
5. [技術的課題と解決策](#技術的課題と解決策)

---

## 📊 既存設計の分析

### 設計ドキュメント（05-UI_DESIGN_HISTORY_TAB.md）より

#### 一覧表示の要件
- **レイアウト**: カードリスト形式、スクロール可能
- **ソート**: 新しい順（最新が上）
- **表示内容**:
  - 日付 + 半荘数
  - 収支（最終収支の合計）
  - チップ（枚数の合計）
  - 平均着順
  - 着順内訳（1位○回、2位○回、3位○回、4位○回）
- **UX**: カード全体がタップ可能、収支でプラス/マイナス色分け

#### 詳細画面の要件
- **表示形式**: 入力画面と同じ表形式を再利用
- **編集機能**:
  - デフォルトは閲覧専用モード
  - 編集ボタンで編集モード切り替え
  - 全フィールド編集可能（日付、レート、点数、ウママーク等）
  - 保存・キャンセル機能

---

## 🔍 現状のコード分析

### 既存のDB関数（db-utils.ts）

**セッション取得関数**:
- ✅ `getAllSessions()`: 全セッション取得
- ✅ `getSessionWithDetails(sessionId)`: セッション+半荘+プレイヤー結果を一括取得
- ✅ `getUserStats(userId)`: ユーザー統計取得

**不足している関数**:
- ❌ セッション更新関数（編集機能用）
- ❌ セッション削除関数（削除機能用）
- ❌ セッションサマリー計算関数（一覧表示用）

### 既存のコンポーネントパターン

**InputTab.tsx** (768行):
- 複雑なstate管理（useState多用）
- 計算ロジックをコンポーネント内に実装
- PlayerSelectコンポーネントとの連携
- toast通知の使用パターン

**useUsers.ts** (115行):
- カスタムフックによるデータ管理
- リアルタイム更新（useLiveQuery）
- CRUD操作のカプセル化

---

## 🎯 実装戦略

### Phase 4を3つのステージに分割

#### **Stage 1: 一覧表示（基礎）**
- セッション一覧の取得・表示
- カードUI実装
- セッションサマリー計算
- 日付降順ソート

#### **Stage 2: 詳細表示（閲覧）**
- 詳細モーダル/画面実装
- InputTabの表形式を再利用
- 閲覧専用モード

#### **Stage 3: 編集・削除機能**
- 編集モード切り替え
- データ更新処理
- 削除機能
- バリデーション

---

## 📝 タスク分解

### Stage 1: 一覧表示（推定: 2-3時間）

1. **DB関数追加** (`db-utils.ts`)
   - [ ] `getSessionSummary(sessionId, mainUserId)`: セッションサマリー計算
     - メインユーザーの総収支、総チップ、平均着順、着順内訳を返す
   - [ ] `getAllSessionsWithSummary(mainUserId)`: 全セッション+サマリー取得

2. **カスタムフック作成** (`hooks/useSessions.ts`)
   - [ ] `useSessions()`: セッション一覧管理
     - sessions（一覧データ）
     - loading, error
     - refreshSessions()

3. **UI実装** (`components/tabs/HistoryTab.tsx`)
   - [ ] セッションカードコンポーネント
   - [ ] 一覧表示ロジック
   - [ ] 空状態の表示
   - [ ] ローディング状態

4. **スタイリング**
   - [ ] カードデザイン（設計通り）
   - [ ] 収支の色分け（プラス/マイナス）

### Stage 2: 詳細表示（推定: 2-3時間）

5. **詳細モーダル作成** (`components/SessionDetailDialog.tsx`)
   - [ ] Dialog UIの実装
   - [ ] `getSessionWithDetails()`でデータ取得
   - [ ] InputTabの表コンポーネント再利用
   - [ ] 閲覧専用モード（入力無効化）

6. **HistoryTabとの統合**
   - [ ] カードクリックで詳細表示
   - [ ] モーダル開閉制御

### Stage 3: 編集・削除（推定: 3-4時間）

7. **DB関数追加**
   - [ ] `updateSession(sessionId, data)`: セッション更新
   - [ ] `deleteSession(sessionId)`: セッション削除（cascade対応）

8. **編集機能実装**
   - [ ] 編集モード切り替えボタン
   - [ ] 編集可能状態の管理
   - [ ] データ検証（ゼロサム、ウママーク合計）
   - [ ] 保存処理
   - [ ] キャンセル処理

9. **削除機能実装**
   - [ ] 削除確認ダイアログ
   - [ ] cascade削除（Hanchan, PlayerResult）
   - [ ] 削除後の一覧更新

10. **エラーハンドリング**
    - [ ] 編集エラー処理
    - [ ] 削除エラー処理
    - [ ] toast通知統合

---

## 🔧 技術的課題と解決策

### 1. セッションサマリーの効率的な計算

**課題**: メインユーザーの着順、収支、チップを毎回計算するのは非効率

**解決策**:
```typescript
// db-utils.ts
export interface SessionSummary {
  sessionId: string
  date: string
  mode: GameMode
  hanchanCount: number
  totalPayout: number      // 最終収支合計
  totalChips: number       // チップ合計
  averageRank: number      // 平均着順
  rankCounts: {            // 着順内訳
    first: number
    second: number
    third: number
    fourth?: number        // 3人打ちの場合はundefined
  }
}

export async function getSessionSummary(
  sessionId: string,
  mainUserId: string
): Promise<SessionSummary> {
  // 1. セッション取得
  // 2. 半荘取得
  // 3. メインユーザーのPlayerResult取得
  // 4. 着順計算（点数から算出）
  // 5. 収支計算（InputTabのロジックを関数化して再利用）
}
```

### 2. InputTabの表ロジック再利用

**課題**: 詳細画面でInputTabと同じ表を表示したいが、コンポーネントが大きすぎる

**解決策**:
- **Option A**: InputTab内の表部分を別コンポーネント化
  - `HanchanTable.tsx`として切り出し
  - InputTabとSessionDetailDialogで共有

- **Option B**: SessionDetailDialogで独自実装
  - 閲覧専用なので簡略化可能
  - 編集時のみInputTabのロジックを部分的に流用

**推奨**: Option A（再利用性が高い）

### 3. カスケード削除の実装

**課題**: Sessionを削除するとき、関連するHanchanとPlayerResultも削除する必要がある

**解決策**:
```typescript
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    // 1. 関連する半荘を取得
    const hanchans = await getHanchansBySession(sessionId);

    // 2. 各半荘のPlayerResultを削除
    for (const hanchan of hanchans) {
      await db.playerResults
        .where('hanchanId')
        .equals(hanchan.id)
        .delete();
    }

    // 3. 半荘を削除
    await db.hanchans
      .where('sessionId')
      .equals(sessionId)
      .delete();

    // 4. セッションを削除
    await db.sessions.delete(sessionId);

    logger.info('セッション削除成功', { sessionId });
  } catch (err) {
    // エラーハンドリング
  }
}
```

### 4. 着順の計算ロジック

**課題**: PlayerResultには着順情報がない

**解決策**: 点数から着順を計算する
```typescript
/**
 * 半荘内のプレイヤーの着順を計算（点数ベース）
 */
function calculateRanks(playerResults: PlayerResult[]): Map<string, number> {
  const rankMap = new Map<string, number>()

  // 見学者を除外して点数でソート
  const activePlayers = playerResults
    .filter(p => !p.isSpectator)
    .sort((a, b) => b.score - a.score)  // 点数降順

  // 着順を割り当て（同点の場合は同着）
  let currentRank = 1
  activePlayers.forEach((player, index) => {
    if (index > 0 && player.score < activePlayers[index - 1].score) {
      currentRank = index + 1
    }
    rankMap.set(player.id, currentRank)
  })

  return rankMap
}
```

**理由**:
- ✅ 自然: 点数が高い順に着順を決めるのが麻雀の基本
- ✅ シンプル: ウママークからの逆算よりロジックが単純
- ✅ 正確: ウママークが手動編集されても矛盾しない

---

## 🚀 実装の優先順位

### 最優先（MVP）
1. Stage 1: 一覧表示
   - ユーザーが保存したセッションを確認できる
   - 基本的な情報が見える

### 高優先
2. Stage 2: 詳細表示
   - セッションの詳細を確認できる
   - データ検証ができる

### 中優先
3. Stage 3: 編集・削除
   - データ修正ができる
   - 不要なデータを削除できる

---

## 📦 必要な新規ファイル

```
app/src/
├── hooks/
│   └── useSessions.ts              # 新規作成
├── components/
│   ├── SessionCard.tsx             # 新規作成（オプション）
│   ├── SessionDetailDialog.tsx     # 新規作成
│   └── HanchanTable.tsx            # 新規作成（InputTabから切り出し）
└── lib/
    └── session-utils.ts            # 新規作成（サマリー計算ロジック）
```

---

## 📈 見積もり

| Stage | 内容 | 推定時間 |
|-------|------|----------|
| Stage 1 | 一覧表示（基礎） | 2-3時間 |
| Stage 2 | 詳細表示（閲覧） | 2-3時間 |
| Stage 3 | 編集・削除機能 | 3-4時間 |
| **合計** | | **7-10時間** |

---

## 🎯 次のステップ

1. **Stage 1から開始**: 一覧表示の実装
2. **段階的なコミット**: 各Stageごとにコミット
3. **動作確認**: Playwrightで各機能をテスト
4. **ドキュメント更新**: MASTER_STATUS_DASHBOARD.mdに進捗記録

---

**更新履歴**:
- 2025-10-04 14:47: 初回作成、Phase 4実装計画策定
