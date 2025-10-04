# Phase 4: 実装推奨アプローチ

**作成日**: 2025-10-04 14:47
**ステータス**: 推奨事項

---

## 🎯 実装アプローチの選択

### Stage 1優先の理由

1. **ユーザー価値の早期提供**
   - 保存したデータを確認できることが最優先
   - InputTabで保存→HistoryTabで確認というフローの完成

2. **段階的な複雑性の追加**
   - 一覧表示（シンプル）→ 詳細表示 → 編集（複雑）
   - 各ステージで動作確認しながら進める

3. **リスク分散**
   - 早い段階で技術的課題を発見
   - 設計の妥当性を検証

---

## 🔧 技術的推奨事項

### 1. コンポーネント分割戦略

#### InputTabの表ロジック再利用

**現状の問題**:
- InputTab.tsx: 768行（大きすぎる）
- 表示ロジックと入力ロジックが混在
- 再利用が困難

**推奨アプローチ**:

```typescript
// components/HanchanTable.tsx（新規作成）
interface HanchanTableProps {
  hanchans: HanchanData[]
  settings: SessionSettings
  mode: 'input' | 'view' | 'edit'
  onScoreChange?: (hanchanIdx: number, playerIdx: number, score: number) => void
  onUmaMarkChange?: (hanchanIdx: number, playerIdx: number, mark: UmaMark) => void
  // ... その他のコールバック
}

export function HanchanTable({ hanchans, settings, mode, ... }: HanchanTableProps) {
  // 表示ロジックのみ
  // mode='input': InputTabで使用（編集可能）
  // mode='view': HistoryTabの詳細で使用（閲覧専用）
  // mode='edit': HistoryTabの編集モードで使用（編集可能）
}
```

**メリット**:
- InputTabとHistoryTabで同じUI
- ロジックの一元管理
- テストしやすい

**実装手順**:
1. InputTab.tsx内の表部分を特定
2. HanchanTable.tsxとして切り出し
3. InputTabで動作確認
4. HistoryTabで再利用

### 2. セッションサマリー計算の最適化

#### 計算ロジックの分離

**推奨アプローチ**:

```typescript
// lib/session-utils.ts（新規作成）

/**
 * 半荘内のプレイヤーの着順を計算（点数ベース）
 */
export function calculateRanks(playerResults: PlayerResult[]): Map<string, number> {
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

/**
 * 収支計算（InputTabのロジックを移植）
 */
export function calculatePayout(
  score: number,
  umaMark: UmaMark,
  chips: number,
  rate: number,
  umaValue: number,
  chipRate: number,
  parlorFee: number
): number {
  // InputTabと同じロジック
}

/**
 * セッションサマリー計算
 */
export async function calculateSessionSummary(
  sessionId: string,
  mainUserId: string
): Promise<SessionSummary> {
  const sessionDetails = await getSessionWithDetails(sessionId)

  const rankCounts = { first: 0, second: 0, third: 0, fourth: 0 }
  let totalPayout = 0
  let totalChips = 0

  // 各半荘で着順を計算
  for (const hanchan of sessionDetails.hanchans) {
    const ranks = calculateRanks(hanchan.players)

    const mainUserResult = hanchan.players.find(p => p.userId === mainUserId)
    if (mainUserResult) {
      const rank = ranks.get(mainUserResult.id) || 0

      // 着順カウント
      if (rank === 1) rankCounts.first++
      else if (rank === 2) rankCounts.second++
      else if (rank === 3) rankCounts.third++
      else if (rank === 4) rankCounts.fourth++

      // 収支とチップを加算
      totalPayout += calculatePayout(
        mainUserResult.score,
        mainUserResult.umaMark,
        mainUserResult.chips,
        sessionDetails.session.rate,
        sessionDetails.session.umaValue,
        sessionDetails.session.chipRate,
        sessionDetails.session.parlorFee
      )
      totalChips += mainUserResult.chips
    }
  }

  // 平均着順
  const totalHanchans = rankCounts.first + rankCounts.second +
                        rankCounts.third + rankCounts.fourth
  const averageRank = totalHanchans > 0
    ? (rankCounts.first * 1 + rankCounts.second * 2 +
       rankCounts.third * 3 + rankCounts.fourth * 4) / totalHanchans
    : 0

  return {
    sessionId,
    date: sessionDetails.session.date,
    mode: sessionDetails.session.mode,
    hanchanCount: sessionDetails.hanchans.length,
    totalPayout,
    totalChips,
    averageRank,
    rankCounts
  }
}
```

**メリット**:
- テストしやすい純粋関数
- InputTabとHistoryTabで共通ロジック
- パフォーマンス最適化しやすい

### 3. カスタムフックの設計

#### useSessions.ts

**推奨アプローチ**:

```typescript
// hooks/useSessions.ts

export interface SessionWithSummary {
  session: Session
  summary: SessionSummary
}

export function useSessions(mainUserId: string) {
  const [sessions, setSessions] = useState<SessionWithSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Dexie useLiveQueryで自動更新
  const allSessions = useLiveQuery(() => db.sessions.toArray(), [])

  useEffect(() => {
    if (!allSessions) return

    // サマリー計算（並列処理）
    const loadSummaries = async () => {
      try {
        const sessionsWithSummary = await Promise.all(
          allSessions.map(async (session) => ({
            session,
            summary: await calculateSessionSummary(session.id, mainUserId)
          }))
        )

        // 日付降順ソート
        sessionsWithSummary.sort((a, b) =>
          b.session.date.localeCompare(a.session.date)
        )

        setSessions(sessionsWithSummary)
        setLoading(false)
      } catch (err) {
        setError(err as Error)
        setLoading(false)
      }
    }

    loadSummaries()
  }, [allSessions, mainUserId])

  return { sessions, loading, error, refreshSessions: () => {} }
}
```

**メリット**:
- 自動更新（useLiveQuery）
- 並列計算で高速化
- エラーハンドリング統合

### 4. 削除機能の安全性

#### カスケード削除とトランザクション

**推奨アプローチ**:

```typescript
// db-utils.ts

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    // Dexieのtransactionで原子性を保証
    await db.transaction('rw', [db.sessions, db.hanchans, db.playerResults], async () => {
      // 1. 半荘取得
      const hanchans = await db.hanchans
        .where('sessionId')
        .equals(sessionId)
        .toArray()

      // 2. PlayerResult削除
      for (const hanchan of hanchans) {
        await db.playerResults
          .where('hanchanId')
          .equals(hanchan.id)
          .delete()
      }

      // 3. Hanchan削除
      await db.hanchans
        .where('sessionId')
        .equals(sessionId)
        .delete()

      // 4. Session削除
      await db.sessions.delete(sessionId)
    })

    logger.info('セッション削除成功', { sessionId })
  } catch (err) {
    const error = new DatabaseError('セッション削除に失敗しました', {
      originalError: err
    })
    logger.error(error.message, { context: 'deleteSession', error })
    throw error
  }
}
```

**メリット**:
- トランザクションで原子性保証
- 削除失敗時のロールバック
- データ整合性の確保

---

## 📐 UI/UXの推奨事項

### 1. セッションカードのデザイン

**推奨レイアウト**:

```tsx
<Card className="cursor-pointer hover:shadow-lg transition-shadow">
  <CardHeader className="pb-3">
    <div className="flex justify-between items-start">
      <CardTitle className="text-lg">📅 {session.date}</CardTitle>
      <span className="text-sm text-muted-foreground">{hanchanCount}半荘</span>
    </div>
  </CardHeader>
  <CardContent className="space-y-2">
    <div className="flex gap-4">
      <span className={cn(
        "font-bold",
        totalPayout > 0 ? "text-green-600" : "text-red-600"
      )}>
        収支: {totalPayout > 0 ? '+' : ''}{totalPayout}
      </span>
      <span>チップ: {totalChips > 0 ? '+' : ''}{totalChips}枚</span>
    </div>
    <div className="text-sm text-muted-foreground">
      平均: {averageRank.toFixed(2)}位 |
      1位:{rankCounts.first}回 2位:{rankCounts.second}回 ...
    </div>
  </CardContent>
</Card>
```

### 2. 詳細モーダルのデザイン

**推奨構成**:

```tsx
<Dialog>
  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <div className="flex justify-between items-center">
        <DialogTitle>📅 {session.date}</DialogTitle>
        <div className="flex gap-2">
          {!isEditMode && (
            <Button variant="outline" onClick={() => setIsEditMode(true)}>
              編集
            </Button>
          )}
          {isEditMode && (
            <>
              <Button variant="outline" onClick={handleCancel}>
                キャンセル
              </Button>
              <Button onClick={handleSave}>
                保存
              </Button>
            </>
          )}
        </div>
      </div>
    </DialogHeader>

    {/* セッション設定表示 */}
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div>レート: {session.rate}</div>
      <div>ウマ: {session.umaValue}</div>
      {/* ... */}
    </div>

    {/* 半荘テーブル */}
    <HanchanTable
      hanchans={hanchans}
      settings={sessionSettings}
      mode={isEditMode ? 'edit' : 'view'}
      onScoreChange={isEditMode ? handleScoreChange : undefined}
      // ...
    />

    {/* 削除ボタン */}
    {isEditMode && (
      <Button variant="destructive" onClick={handleDelete}>
        このセッションを削除
      </Button>
    )}
  </DialogContent>
</Dialog>
```

### 3. 空状態の表示

**推奨メッセージ**:

```tsx
{sessions.length === 0 && !loading && (
  <Card className="border-dashed">
    <CardContent className="flex flex-col items-center justify-center py-12">
      <p className="text-lg font-medium text-muted-foreground mb-2">
        まだセッションがありません
      </p>
      <p className="text-sm text-muted-foreground">
        「新規入力」タブから麻雀の記録を追加しましょう
      </p>
    </CardContent>
  </Card>
)}
```

---

## 🧪 テスト戦略

### 単体テスト（推奨）

```typescript
// session-utils.test.ts

describe('calculateRanks', () => {
  it('点数順に正しい着順を返す', () => {
    const players = [
      { id: '1', score: 10, isSpectator: false },
      { id: '2', score: 20, isSpectator: false },
      { id: '3', score: -15, isSpectator: false },
      { id: '4', score: -15, isSpectator: false },
    ]
    const ranks = calculateRanks(players)
    expect(ranks.get('2')).toBe(1)  // 20点 → 1位
    expect(ranks.get('1')).toBe(2)  // 10点 → 2位
    expect(ranks.get('3')).toBe(3)  // -15点 → 3位（同点）
    expect(ranks.get('4')).toBe(3)  // -15点 → 3位（同点）
  })

  it('見学者を着順計算から除外する', () => {
    const players = [
      { id: '1', score: 10, isSpectator: false },
      { id: '2', score: 20, isSpectator: true },  // 見学者
    ]
    const ranks = calculateRanks(players)
    expect(ranks.get('1')).toBe(1)
    expect(ranks.has('2')).toBe(false)  // 見学者は着順なし
  })
})

describe('calculatePayout', () => {
  it('正しい収支を計算する', () => {
    const payout = calculatePayout(10, '○○○', 2, 100, 10, 100, 500)
    expect(payout).toBe(/* 期待値 */)
  })
})
```

### 統合テスト（Playwright）

```typescript
// e2e/history-tab.spec.ts

test('セッション一覧が表示される', async ({ page }) => {
  // 1. InputTabでセッション作成
  // 2. Historyタブへ移動
  // 3. セッションカードが表示されることを確認
})

test('セッション詳細が表示される', async ({ page }) => {
  // 1. セッションカードをクリック
  // 2. モーダルが開くことを確認
  // 3. 詳細データが表示されることを確認
})

test('セッション編集ができる', async ({ page }) => {
  // 1. 詳細モーダルを開く
  // 2. 編集ボタンをクリック
  // 3. データを変更
  // 4. 保存
  // 5. DBが更新されることを確認
})
```

---

## 🚦 実装の進め方（推奨フロー）

### Step 1: 基盤整備（2-3時間）

1. **session-utils.ts作成**
   - 着順計算関数
   - 収支計算関数（InputTabから移植）
   - サマリー計算関数

2. **DB関数追加**
   - `calculateSessionSummary()`実装
   - 単体テスト作成

3. **useSessions.ts作成**
   - 基本的なフック実装
   - エラーハンドリング

### Step 2: 一覧表示実装（1-2時間）

4. **HistoryTab.tsx更新**
   - セッションカード実装
   - 一覧表示ロジック
   - 空状態、ローディング状態

5. **動作確認**
   - dev server起動
   - InputTabでセッション作成
   - HistoryTabで表示確認

### Step 3: 詳細表示実装（2-3時間）

6. **HanchanTable.tsx作成**（オプション）
   - InputTabから表部分を切り出し
   - mode切り替え実装

7. **SessionDetailDialog.tsx作成**
   - モーダルUI実装
   - データ表示
   - 閲覧専用モード

8. **HistoryTabと統合**
   - カードクリックでモーダル表示
   - 動作確認

### Step 4: 編集・削除実装（3-4時間）

9. **DB関数追加**
   - `updateSession()`
   - `deleteSession()`

10. **編集機能実装**
    - 編集モード切り替え
    - 保存・キャンセル処理

11. **削除機能実装**
    - 削除確認ダイアログ
    - カスケード削除

12. **最終テスト**
    - 全機能の動作確認
    - エッジケーステスト

---

## 📊 各Stageでのコミット推奨

### Stage 1完了時
```
git add .
git commit -m "Phase 4 Stage 1完了: 履歴タブ一覧表示実装

- session-utils.ts: サマリー計算関数追加
- useSessions.ts: セッション管理フック作成
- HistoryTab.tsx: セッションカード一覧表示
- 動作確認: セッション作成→履歴表示
"
```

### Stage 2完了時
```
git add .
git commit -m "Phase 4 Stage 2完了: 詳細表示実装

- HanchanTable.tsx: InputTabから表コンポーネント切り出し
- SessionDetailDialog.tsx: 詳細モーダル実装
- 動作確認: セッション詳細表示
"
```

### Stage 3完了時
```
git add .
git commit -m "Phase 4完了: 編集・削除機能実装

- db-utils.ts: updateSession, deleteSession追加
- SessionDetailDialog.tsx: 編集モード、削除機能追加
- 動作確認: 編集・削除の完全テスト
"
```

---

## ⚠️ 注意事項

### パフォーマンス

1. **サマリー計算の最適化**
   - 初回レンダリング時に全セッションのサマリー計算は重い
   - 将来的にはセッション作成時にサマリーをSessionテーブルに保存することも検討

2. **無限スクロール**
   - セッション数が増えると一覧が重くなる
   - 将来的には仮想スクロールやページネーション導入を検討

### データ整合性

1. **編集時のゼロサム検証**
   - 編集後も必ずゼロサム、ウママーク合計チェック
   - InputTabと同じバリデーション関数を使用

2. **削除の確認**
   - 削除は復元不可能
   - 必ず確認ダイアログを表示

---

**更新履歴**:
- 2025-10-04 14:47: 初回作成、実装推奨アプローチ策定
