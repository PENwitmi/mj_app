# Chips/ParlorFee 6倍バグ - 実装計画（ステップバイステップ）

## 実装の全体フロー

```
Step 1: 準備作業
  ↓
Step 2: コア計算ロジックの修正
  ↓
Step 3: ユニットテストの作成
  ↓
Step 4: マイグレーション処理の実装
  ↓
Step 5: 統合テスト
  ↓
Step 6: コード品質向上（任意）
  ↓
Step 7: 最終確認とデプロイ
```

---

## Step 1: 準備作業

### 1-1. バックアップの作成

**目的**: 修正失敗時のロールバック準備

**作業内容**:
```bash
# 作業ディレクトリ
cd /Users/nishimototakashi/claude_code/mj_app/app

# 関連ファイルのバックアップ
mkdir -p _old_files/backup_chips_parlorfee_bugfix_$(date "+%Y%m%d_%H%M")

# バックアップ対象ファイル
cp src/lib/session-utils.ts _old_files/backup_chips_parlorfee_bugfix_$(date "+%Y%m%d_%H%M")/
cp src/components/input/TotalsPanel.tsx _old_files/backup_chips_parlorfee_bugfix_$(date "+%Y%m%d_%H%M")/
cp src/App.tsx _old_files/backup_chips_parlorfee_bugfix_$(date "+%Y%m%d_%H%M")/
```

**チェックポイント**:
- ✅ バックアップディレクトリが作成されている
- ✅ 3つのファイルが正しくバックアップされている

### 1-2. ブランチの作成（Gitリポジトリの場合）

**目的**: 修正作業の分離

```bash
# 現在の状態を確認
git status

# バグ修正用ブランチを作成
git checkout -b fix/chips-parlorfee-bug

# ブランチの確認
git branch
```

**チェックポイント**:
- ✅ `fix/chips-parlorfee-bug`ブランチが作成されている
- ✅ ワーキングツリーがクリーンである

---

## Step 2: コア計算ロジックの修正

### 2-1. 新規ヘルパー関数の追加

**ファイル**: `src/lib/session-utils.ts`

**追加位置**: `calculatePayout`関数の後（L88付近）

**実装内容**:

```typescript
/**
 * chips/parlorFeeを除いた単一半荘での収支を計算
 *
 * この関数は calculateSessionSummary で使用され、セッション全体の
 * chips/parlorFee を後で一括加算するための補助関数です。
 *
 * @param score ±点数
 * @param umaMark ウママーク
 * @param rate 点数レート
 * @param umaValue ウマ1個あたりの価値
 * @returns chips/parlorFeeを除いた収支
 */
export function calculatePayoutWithoutExtras(
  score: number,
  umaMark: import('./db').UmaMark,
  rate: number,
  umaValue: number
): number {
  const umaPoints = umaMarkToValue(umaMark)
  const subtotal = score + umaPoints * umaValue
  const payout = subtotal * rate

  return payout
}
```

**コミット**:
```bash
git add src/lib/session-utils.ts
git commit -m "feat: Add calculatePayoutWithoutExtras helper function

- chips/parlorFeeを除いた収支計算用のヘルパー関数を追加
- セッション全体でchips/parlorFeeを1回のみカウントするための準備"
```

**チェックポイント**:
- ✅ 関数が正しく追加されている
- ✅ JSDocコメントが記載されている
- ✅ 型定義が正しい
- ✅ コンパイルエラーがない

### 2-2. `calculateSessionSummary`関数の修正（メインユーザーの収支計算）

**ファイル**: `src/lib/session-utils.ts`

**修正箇所**: L99-169（メインユーザーの収支計算部分）

**実装内容**:

```typescript
export async function calculateSessionSummary(
  sessionId: string,
  mainUserId: string
): Promise<SessionSummary> {
  const sessionDetails = await getSessionWithDetails(sessionId)

  if (!sessionDetails) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const { session, hanchans } = sessionDetails

  const rankCounts = { first: 0, second: 0, third: 0, fourth: 0 }
  let totalPayout = 0
  let totalChips = 0

  // ✅ セッション全体のchips/parlorFeeを最初の半荘から取得
  let sessionChips = 0
  let sessionParlorFee = 0
  let chipsInitialized = false

  // 各半荘で着順と収支を計算
  for (const hanchan of hanchans) {
    const ranks = calculateRanks(hanchan.players)

    const mainUserResult = hanchan.players.find((p) => p.userId === mainUserId)

    if (!mainUserResult) {
      logger.warn('半荘にメインユーザーが見つかりません', {
        context: 'session-utils.calculateSessionSummary',
        data: {
          hanchanNumber: hanchan.hanchanNumber,
          mainUserId,
          players: hanchan.players.map(p => ({ name: p.playerName, userId: p.userId }))
        }
      })
      continue
    }

    // ✅ 初回のみchips/parlorFeeを取得
    if (!chipsInitialized) {
      sessionChips = mainUserResult.chips
      sessionParlorFee = mainUserResult.parlorFee
      chipsInitialized = true

      logger.debug('セッションのchips/parlorFeeを取得', {
        context: 'session-utils.calculateSessionSummary',
        data: {
          sessionChips,
          sessionParlorFee,
          hanchanNumber: hanchan.hanchanNumber
        }
      })
    }

    // 点数が入力されていない半荘はスキップ（未入力の半荘は集計対象外）
    if (mainUserResult.score === null || mainUserResult.score === 0) {
      continue
    }

    const rank = ranks.get(mainUserResult.id) || 0

    // 着順カウント
    if (rank === 1) rankCounts.first++
    else if (rank === 2) rankCounts.second++
    else if (rank === 3) rankCounts.third++
    else if (rank === 4) rankCounts.fourth++
    else {
      logger.warn('rankがカウント範囲外です', {
        context: 'session-utils.calculateSessionSummary',
        data: {
          hanchanNumber: hanchan.hanchanNumber,
          rank,
          expectedRange: '1-4'
        }
      })
    }

    // ✅ chips/parlorFeeを除いた収支を加算
    totalPayout += calculatePayoutWithoutExtras(
      mainUserResult.score,
      mainUserResult.umaMark,
      session.rate,
      session.umaValue
    )
  }

  // ✅ セッション全体でchips/parlorFeeを1回のみ加算
  totalPayout += sessionChips * session.chipRate - sessionParlorFee
  totalChips = sessionChips

  logger.debug('セッション収支計算完了', {
    context: 'session-utils.calculateSessionSummary',
    data: {
      totalPayout,
      totalChips,
      sessionChips,
      sessionParlorFee,
      chipRate: session.chipRate
    }
  })

  // 平均着順（入力済み半荘のみ）
  const totalHanchans = rankCounts.first + rankCounts.second + rankCounts.third + rankCounts.fourth
  const averageRank =
    totalHanchans > 0
      ? (rankCounts.first * 1 +
          rankCounts.second * 2 +
          rankCounts.third * 3 +
          rankCounts.fourth * 4) /
        totalHanchans
      : 0

  // ...総合順位計算（次のステップで修正）
}
```

**コミット**:
```bash
git add src/lib/session-utils.ts
git commit -m "fix: Fix chips/parlorFee counting for main user in calculateSessionSummary

- chips/parlorFeeをセッション全体で1回のみカウントするように修正
- 最初の半荘からchips/parlorFeeを取得
- calculatePayoutWithoutExtrasを使用してループ内での重複加算を防止
- デバッグログを追加"
```

**チェックポイント**:
- ✅ `chipsInitialized`フラグが正しく機能している
- ✅ ループ外でchips/parlorFeeが加算されている
- ✅ ログメッセージが適切
- ✅ コンパイルエラーがない

### 2-3. `calculateSessionSummary`関数の修正（全プレイヤーの収支計算）

**ファイル**: `src/lib/session-utils.ts`

**修正箇所**: L186-230（全プレイヤーの総収支計算部分）

**実装内容**:

```typescript
  // 総合順位計算（セッション内の全プレイヤーの総収支ベース）
  const playerPayouts = new Map<string, number>()

  // ✅ プレイヤーごとのchips/parlorFeeマップ（セッション全体で1回）
  const playerExtrasMap = new Map<string, { chips: number; parlorFee: number }>()
  let extrasInitialized = false

  // 全プレイヤーの総収支を計算
  for (const hanchan of hanchans) {
    for (const player of hanchan.players) {
      // 見学者を除外、点数未入力もスキップ
      if (player.isSpectator || player.score === null || player.score === 0) {
        continue
      }

      const playerKey = player.userId ?? player.playerName

      // ✅ 初回のみchips/parlorFeeを記録
      if (!extrasInitialized) {
        if (!playerExtrasMap.has(playerKey)) {
          playerExtrasMap.set(playerKey, {
            chips: player.chips,
            parlorFee: player.parlorFee
          })
        }
      }

      // ✅ chips/parlorFeeを除いた収支を計算
      const payout = calculatePayoutWithoutExtras(
        player.score,
        player.umaMark,
        session.rate,
        session.umaValue
      )

      const currentTotal = playerPayouts.get(playerKey) || 0
      playerPayouts.set(playerKey, currentTotal + payout)
    }

    // 最初の半荘が終わったらフラグを立てる
    if (!extrasInitialized) {
      extrasInitialized = true
    }
  }

  // ✅ セッション全体でchips/parlorFeeを1回のみ加算
  for (const [playerKey, extras] of playerExtrasMap.entries()) {
    const currentTotal = playerPayouts.get(playerKey) || 0
    const finalTotal = currentTotal + extras.chips * session.chipRate - extras.parlorFee
    playerPayouts.set(playerKey, finalTotal)

    logger.debug('プレイヤー収支計算完了', {
      context: 'session-utils.calculateSessionSummary',
      data: {
        playerKey,
        baseTotal: currentTotal,
        chips: extras.chips,
        parlorFee: extras.parlorFee,
        finalTotal
      }
    })
  }

  // 収支降順でソート（高い収支が上位）
  const sortedPlayers = Array.from(playerPayouts.entries())
    .sort((a, b) => b[1] - a[1])

  // メインユーザーの順位を特定
  const overallRank = sortedPlayers.findIndex(
    ([userId]) => userId === mainUserId
  ) + 1

  // エラーケース: メインユーザーが見つからない場合
  if (overallRank === 0) {
    logger.warn('総合順位計算: メインユーザーが見つかりません', {
      context: 'session-utils.calculateSessionSummary',
      data: {
        sessionId,
        mainUserId,
        playerCount: playerPayouts.size
      }
    })
  }

  return {
    sessionId,
    date: session.date,
    mode: session.mode,
    hanchanCount: totalHanchans,
    totalPayout,
    totalChips,
    averageRank,
    rankCounts: session.mode === '3-player'
      ? { first: rankCounts.first, second: rankCounts.second, third: rankCounts.third }
      : rankCounts,
    overallRank
  }
}
```

**コミット**:
```bash
git add src/lib/session-utils.ts
git commit -m "fix: Fix chips/parlorFee counting for all players in calculateSessionSummary

- 全プレイヤーのchips/parlorFeeもセッション全体で1回のみカウント
- playerExtrasMapで各プレイヤーのchips/parlorFeeを管理
- 総合順位計算の正確性を向上
- デバッグログを追加"
```

**チェックポイント**:
- ✅ `playerExtrasMap`が正しく機能している
- ✅ 各プレイヤーのchips/parlorFeeが1回のみ加算されている
- ✅ 総合順位が正しく計算されている
- ✅ ログメッセージが適切
- ✅ コンパイルエラーがない

---

## Step 3: ユニットテストの作成

### 3-1. テストファイルの作成

**新規ファイル**: `src/lib/__tests__/session-utils.test.ts`

**実装内容**:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '../db'
import { calculateSessionSummary, calculatePayoutWithoutExtras } from '../session-utils'
import type { Session, Hanchan, PlayerResult } from '../db'

describe('session-utils: chips/parlorFee bug fix', () => {
  const mainUserId = 'test-main-user'
  let sessionId: string

  beforeEach(async () => {
    // テスト用セッションを作成
    const now = new Date()
    sessionId = crypto.randomUUID()

    const session: Session = {
      id: sessionId,
      date: '2025-10-28',
      mode: '4-player',
      rate: 30,
      umaValue: 10,
      chipRate: 100,
      parlorFee: 0,
      umaRule: 'standard',
      createdAt: now,
      updatedAt: now
    }

    await db.sessions.add(session)

    // 5半荘分のデータを作成
    for (let i = 1; i <= 5; i++) {
      const hanchanId = crypto.randomUUID()

      const hanchan: Hanchan = {
        id: hanchanId,
        sessionId,
        hanchanNumber: i,
        autoCalculated: false,
        createdAt: now
      }

      await db.hanchans.add(hanchan)

      // プレイヤー結果（chips=-2, parlorFee=2000）
      const players: PlayerResult[] = [
        {
          id: crypto.randomUUID(),
          hanchanId,
          userId: mainUserId,
          playerName: 'メインユーザー',
          score: 10,
          umaMark: '○',
          isSpectator: false,
          chips: -2,
          parlorFee: 2000,
          position: 0,
          createdAt: now
        },
        {
          id: crypto.randomUUID(),
          hanchanId,
          userId: 'user2',
          playerName: 'プレイヤー2',
          score: 5,
          umaMark: '',
          isSpectator: false,
          chips: 1,
          parlorFee: 2000,
          position: 1,
          createdAt: now
        },
        {
          id: crypto.randomUUID(),
          hanchanId,
          userId: 'user3',
          playerName: 'プレイヤー3',
          score: -5,
          umaMark: '',
          isSpectator: false,
          chips: 0,
          parlorFee: 2000,
          position: 2,
          createdAt: now
        },
        {
          id: crypto.randomUUID(),
          hanchanId,
          userId: 'user4',
          playerName: 'プレイヤー4',
          score: -10,
          umaMark: '✗',
          isSpectator: false,
          chips: 1,
          parlorFee: 2000,
          position: 3,
          createdAt: now
        }
      ]

      for (const player of players) {
        await db.playerResults.add(player)
      }
    }
  })

  afterEach(async () => {
    // テストデータをクリーンアップ
    await db.sessions.delete(sessionId)
    await db.hanchans.where('sessionId').equals(sessionId).delete()
  })

  it('chips/parlorFeeがセッション全体で1回のみカウントされる', async () => {
    const summary = await calculateSessionSummary(sessionId, mainUserId)

    // chips: -2（1回のみ、5倍されない）
    expect(summary.totalChips).toBe(-2)

    // totalPayout計算:
    // 5半荘 × (score: 10, uma: +1 → subtotal: 20 → payout: 600)
    // = 3000
    // + chips (-2) × chipRate (100) = -200
    // - parlorFee (2000) = -2000
    // = 3000 - 200 - 2000 = 800
    expect(summary.totalPayout).toBe(800)
  })

  it('calculatePayoutWithoutExtrasがchips/parlorFeeを含まない', () => {
    const payout = calculatePayoutWithoutExtras(
      10,    // score
      '○',   // umaMark (+1)
      30,    // rate
      10     // umaValue
    )

    // (10 + 1 * 10) * 30 = 20 * 30 = 600
    expect(payout).toBe(600)
  })

  it('複数プレイヤーのchips/parlorFeeが正しく計算される', async () => {
    const summary = await calculateSessionSummary(sessionId, mainUserId)

    // 総合順位が正しく計算されている（chips/parlorFee含む）
    expect(summary.overallRank).toBeGreaterThan(0)
    expect(summary.overallRank).toBeLessThanOrEqual(4)
  })
})
```

**実行**:
```bash
npm run test -- session-utils.test.ts
```

**チェックポイント**:
- ✅ すべてのテストケースが合格
- ✅ chips/parlorFeeが1回のみカウントされている
- ✅ totalPayoutの計算が正しい

---

## Step 4: マイグレーション処理の実装

### 4-1. マイグレーションモジュールの作成

**新規ファイル**: `src/lib/migrations.ts`

**実装内容**: `03-FIX_STRATEGY.md`の「2-A. マイグレーション関数の作成」を参照

**コミット**:
```bash
git add src/lib/migrations.ts
git commit -m "feat: Add migration for chips/parlorFee bug fix

- migrateChipsParlorFeeBugFix関数を実装
- 全既存セッションのサマリーを再計算
- 進捗コールバック機能を追加
- localStorageで完了フラグを管理"
```

**チェックポイント**:
- ✅ マイグレーション関数が正しく実装されている
- ✅ 進捗コールバックが機能している
- ✅ エラーハンドリングが適切
- ✅ コンパイルエラーがない

### 4-2. App.tsxへのマイグレーション実行ロジック追加

**ファイル**: `src/App.tsx`

**実装内容**: `03-FIX_STRATEGY.md`の「2-B. アプリ起動時のマイグレーション実行」を参照

**コミット**:
```bash
git add src/App.tsx
git commit -m "feat: Add migration execution on app startup

- アプリ起動時にマイグレーションが必要かチェック
- マイグレーション中は専用UIを表示
- 進捗状況をユーザーに表示"
```

**チェックポイント**:
- ✅ マイグレーション中のUI表示が正しい
- ✅ 進捗状況が表示される
- ✅ マイグレーション完了後に通常UIに遷移する
- ✅ コンパイルエラーがない

---

## Step 5: 統合テスト

### 5-1. 開発サーバーの起動

```bash
npm run dev
```

### 5-2. 手動テストシナリオ

#### シナリオ1: 新規セッションの作成
1. 「新規入力」タブで4人打ちを選択
2. 5半荘分のデータを入力（chips=-2, parlorFee=2000）
3. 保存して「履歴」タブに遷移
4. **期待結果**: chips=-2（-10ではない）、収支が正しい

#### シナリオ2: 既存セッションの再計算（マイグレーション）
1. 修正前に作成したセッションがある場合
2. アプリを再起動（または初回起動）
3. **期待結果**: マイグレーション中のUI表示、進捗状況が表示される
4. マイグレーション完了後、「履歴」タブで値が修正されている

#### シナリオ3: セッション詳細ダイアログ
1. 「履歴」タブでセッションカードをクリック
2. **期待結果**: 詳細ダイアログで正しい値が表示される

**チェックポイント**:
- ✅ 新規セッションのchips/parlorFeeが正しい
- ✅ 既存セッションが正しく再計算される
- ✅ マイグレーション中のUIが表示される
- ✅ コンソールにエラーが出ない

---

## Step 6: コード品質向上（任意 - P1）

### 6-1. TotalsPanel.tsxの明示的な実装

**ファイル**: `src/components/input/TotalsPanel.tsx`

**実装内容**: `03-FIX_STRATEGY.md`の「3-A. TotalsPanel.tsxの明示的な実装」を参照

**コミット**:
```bash
git add src/components/input/TotalsPanel.tsx
git commit -m "refactor: Make chips/parlorFee retrieval explicit in TotalsPanel

- 最初の半荘から明示的にchips/parlorFeeを取得
- 偶然の正常動作を明示的な実装に変更
- コードの意図を明確化"
```

**チェックポイント**:
- ✅ chips/parlorFeeが最初の半荘から取得されている
- ✅ コードの意図が明確
- ✅ 機能的な動作は変わらない
- ✅ コンパイルエラーがない

---

## Step 7: 最終確認とデプロイ

### 7-1. すべてのテストを実行

```bash
# ユニットテスト
npm run test

# Lint
npm run lint

# ビルド
npm run build
```

**チェックポイント**:
- ✅ すべてのテストが合格
- ✅ Lintエラーがない
- ✅ ビルドが成功する

### 7-2. 最終的な手動テスト

すべてのシナリオを再度実行し、問題がないことを確認

### 7-3. ドキュメントの更新

**ファイル**: `CLAUDE.md`

**追加内容**:

```markdown
## Recent Updates

### 2025-10-28: Chips/ParlorFee Bug Fix
- chips/parlorFeeが半荘数分カウントされるバグを修正
- セッション全体で1回のみカウントするように変更
- 既存データのマイグレーション処理を実装
- 詳細: `/project-docs/2025-10-28-chips-parlorfee-bug-fix/`
```

### 7-4. コミットとプッシュ（Gitリポジトリの場合）

```bash
# 最終確認
git status

# CLAUDE.mdをコミット
git add CLAUDE.md
git commit -m "docs: Update CLAUDE.md with chips/parlorFee bug fix"

# すべての変更をプッシュ
git push origin fix/chips-parlorfee-bug

# プルリクエストを作成（必要に応じて）
```

---

## トラブルシューティング

### 問題1: マイグレーション中にエラーが発生

**対処法**:
1. ブラウザのコンソールでエラーメッセージを確認
2. `localStorage.removeItem('migration_chips_parlorfee_v1')`を実行
3. アプリを再起動してマイグレーションを再実行

### 問題2: テストが失敗する

**対処法**:
1. テストデータのクリーンアップが正しく行われているか確認
2. IndexedDBのデータをクリアして再実行
3. エラーメッセージから原因を特定

### 問題3: 既存データの値が修正されない

**対処法**:
1. マイグレーションが実行されたか確認（localStorage）
2. `calculateSessionSummary`が正しく修正されているか確認
3. ブラウザのキャッシュをクリアして再起動

---

## 完了条件

### 必須条件（P0）
- ✅ `calculateSessionSummary`が修正されている
- ✅ ユニットテストがすべて合格
- ✅ マイグレーション処理が実装されている
- ✅ 既存セッションが正しく再計算される
- ✅ 新規セッションのchips/parlorFeeが正しい

### 推奨条件（P1）
- ✅ `TotalsPanel.tsx`が明示的な実装になっている
- ✅ すべての手動テストシナリオが合格
- ✅ ドキュメントが更新されている

### 品質条件
- ✅ Lintエラーがない
- ✅ ビルドが成功する
- ✅ コンソールにエラーが出ない
- ✅ パフォーマンスが劣化していない

---

## 所要時間見積もり

| ステップ | 作業内容 | 見積もり時間 |
|---|---|---|
| Step 1 | 準備作業 | 10分 |
| Step 2 | コア計算ロジックの修正 | 60分 |
| Step 3 | ユニットテストの作成 | 45分 |
| Step 4 | マイグレーション処理の実装 | 45分 |
| Step 5 | 統合テスト | 30分 |
| Step 6 | コード品質向上（任意） | 20分 |
| Step 7 | 最終確認とデプロイ | 20分 |
| **合計** | | **3.5時間（P0のみ: 3時間）** |
