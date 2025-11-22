# Chips/ParlorFee 6倍バグ - 修正戦略

## 修正の基本方針

### 設計原則

1. **データモデル変更なし**: PlayerResultのchips/parlorFeeフィールドは維持
2. **後方互換性の確保**: 既存の保存済みデータも正しく表示される
3. **UI一貫性の維持**: InputTab、HistoryTab、将来のAnalysisTabで一貫した表示
4. **最小限の変更**: 影響範囲を限定し、新しいバグの混入を防ぐ

### アーキテクチャ的な決定

#### データ保存方法: 現状維持（冗長保存）

**決定**: chips/parlorFeeは各PlayerResultに保存（全半荘で同じ値）

**理由**:
- データモデル変更は制約により不可
- 既存データとの互換性を保持
- 計算ロジック側で対応可能

**トレードオフ**:
- ✅ メリット: 修正範囲が限定的、既存データの移行不要
- ❌ デメリット: データの冗長性、将来的な設計負債

#### 計算方法: セッション全体で1回のみカウント

**決定**: chips/parlorFeeは最初の半荘から1回のみ取得

**実装方法**:
```typescript
// 修正前（誤）
for (const hanchan of hanchans) {
  totalChips += mainUserResult.chips        // ❌ 各半荘で加算
  totalPayout += ... + chips * chipRate     // ❌ 各半荘で計算
}

// 修正後（正）
// chips/parlorFeeは最初の半荘から1回のみ取得
let sessionChips = 0
let sessionParlorFee = 0
let chipsInitialized = false

for (const hanchan of hanchans) {
  const mainUserResult = hanchan.players.find(p => p.userId === mainUserId)

  if (!chipsInitialized && mainUserResult) {
    sessionChips = mainUserResult.chips
    sessionParlorFee = mainUserResult.parlorFee
    chipsInitialized = true
  }

  // 各半荘の収支計算（chips/parlorFeeを除く）
  totalPayout += calculatePayoutWithoutChipsAndFee(...)
}

// セッション全体でのchips/parlorFee加算（1回のみ）
totalPayout += sessionChips * chipRate - sessionParlorFee
totalChips = sessionChips
```

## 修正対象と具体的な変更内容

### Phase 1: コア計算ロジックの修正（必須 - P0）

#### 1-A. `calculateSessionSummary`関数の修正

**ファイル**: `src/lib/session-utils.ts`

**修正箇所**: L99-245

**変更内容**:

```typescript
// 修正前
export async function calculateSessionSummary(
  sessionId: string,
  mainUserId: string
): Promise<SessionSummary> {
  // ...
  let totalPayout = 0
  let totalChips = 0

  for (const hanchan of hanchans) {
    // ...
    if (mainUserResult) {
      // ❌ 各半荘でchips/parlorFeeを含めて計算
      totalPayout += calculatePayout(
        mainUserResult.score,
        mainUserResult.umaMark,
        mainUserResult.chips,
        session.rate,
        session.umaValue,
        session.chipRate,
        session.parlorFee
      )
      totalChips += mainUserResult.chips // ❌ 各半荘で加算
    }
  }
  // ...
}
```

```typescript
// 修正後
export async function calculateSessionSummary(
  sessionId: string,
  mainUserId: string
): Promise<SessionSummary> {
  // ...
  let totalPayout = 0
  let totalChips = 0

  // セッション全体のchips/parlorFeeを最初の半荘から取得
  let sessionChips = 0
  let sessionParlorFee = 0
  let chipsInitialized = false

  for (const hanchan of hanchans) {
    const mainUserResult = hanchan.players.find((p) => p.userId === mainUserId)

    if (!mainUserResult) {
      // ...警告ログ
      continue
    }

    // 初回のみchips/parlorFeeを取得
    if (!chipsInitialized) {
      sessionChips = mainUserResult.chips
      sessionParlorFee = mainUserResult.parlorFee
      chipsInitialized = true
    }

    // 点数が入力されていない半荘はスキップ
    if (mainUserResult.score === null || mainUserResult.score === 0) {
      continue
    }

    // 着順カウント
    const rank = ranks.get(mainUserResult.id) || 0
    // ...着順カウントロジック（変更なし）

    // ✅ chips/parlorFeeを除いた収支を計算
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

  // ...残りのロジック（変更なし）
}
```

#### 1-B. 新規ヘルパー関数の追加

**ファイル**: `src/lib/session-utils.ts`

**追加内容**:

```typescript
/**
 * chips/parlorFeeを除いた単一半荘での収支を計算
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

**既存の`calculatePayout`関数は維持**（後方互換性のため）:
```typescript
/**
 * 単一半荘での収支を計算（chips/parlorFee含む）
 * ⚠️ この関数は後方互換性のために維持
 * 新しいコードでは calculatePayoutWithoutExtras を使用すること
 */
export function calculatePayout(
  score: number,
  umaMark: import('./db').UmaMark,
  chips: number,
  rate: number,
  umaValue: number,
  chipRate: number,
  parlorFee: number
): number {
  // ...既存の実装（変更なし）
}
```

#### 1-C. プレイヤー間の総収支計算の修正

**ファイル**: `src/lib/session-utils.ts`

**修正箇所**: L186-209

**変更内容**:

```typescript
// 修正前
for (const hanchan of hanchans) {
  for (const player of hanchan.players) {
    // ...
    const payout = calculatePayout(
      player.score,
      player.umaMark,
      player.chips,      // ❌ 各半荘で加算される
      session.rate,
      session.umaValue,
      session.chipRate,
      session.parlorFee
    )
    // ...
  }
}
```

```typescript
// 修正後
// プレイヤーごとのchips/parlorFeeマップ（セッション全体で1回）
const playerChipsMap = new Map<string, { chips: number; parlorFee: number }>()
let extrasInitialized = false

for (const hanchan of hanchans) {
  for (const player of hanchan.players) {
    // 見学者を除外、点数未入力もスキップ
    if (player.isSpectator || player.score === null || player.score === 0) {
      continue
    }

    const playerKey = player.userId ?? player.playerName

    // 初回のみchips/parlorFeeを記録
    if (!extrasInitialized) {
      if (!playerChipsMap.has(playerKey)) {
        playerChipsMap.set(playerKey, {
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
for (const [playerKey, extras] of playerChipsMap.entries()) {
  const currentTotal = playerPayouts.get(playerKey) || 0
  const finalTotal = currentTotal + extras.chips * session.chipRate - extras.parlorFee
  playerPayouts.set(playerKey, finalTotal)
}
```

### Phase 2: マイグレーション処理の実装（必須 - P0）

#### 2-A. マイグレーション関数の作成

**新規ファイル**: `src/lib/migrations.ts`

**内容**:

```typescript
import { db } from './db'
import { calculateSessionSummary } from './session-utils'
import { logger } from './logger'

/**
 * chips/parlorFeeバグ修正に伴うマイグレーション
 * 全既存セッションのサマリーを再計算して更新
 *
 * @param mainUserId メインユーザーID
 * @param onProgress 進捗コールバック (現在位置, 全体数)
 */
export async function migrateChipsParlorFeeBugFix(
  mainUserId: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  logger.info('chips/parlorFeeバグ修正マイグレーション開始', {
    context: 'migrations.migrateChipsParlorFeeBugFix'
  })

  try {
    // 全セッションを取得
    const sessions = await db.sessions.toArray()
    const total = sessions.length

    logger.info(`マイグレーション対象: ${total}件のセッション`, {
      context: 'migrations.migrateChipsParlorFeeBugFix'
    })

    // 各セッションのサマリーを再計算
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i]

      try {
        // 修正済みのcalculateSessionSummaryで再計算
        const newSummary = await calculateSessionSummary(session.id, mainUserId)

        // サマリーを更新
        await db.sessions.update(session.id, { summary: newSummary })

        // 進捗コールバック
        onProgress?.(i + 1, total)

        logger.debug(`セッション ${i + 1}/${total} 更新完了`, {
          context: 'migrations.migrateChipsParlorFeeBugFix',
          data: { sessionId: session.id }
        })
      } catch (err) {
        logger.error(`セッション ${session.id} のマイグレーション失敗`, {
          context: 'migrations.migrateChipsParlorFeeBugFix',
          data: { sessionId: session.id },
          error: err as Error
        })
        // エラーがあっても続行
      }
    }

    // マイグレーション完了フラグを保存
    localStorage.setItem('migration_chips_parlorfee_v1', 'completed')

    logger.info('chips/parlorFeeバグ修正マイグレーション完了', {
      context: 'migrations.migrateChipsParlorFeeBugFix',
      data: { totalSessions: total }
    })
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error')
    logger.error('マイグレーション中にエラーが発生しました', {
      context: 'migrations.migrateChipsParlorFeeBugFix',
      error
    })
    throw error
  }
}

/**
 * マイグレーションが必要かどうかをチェック
 */
export function isMigrationNeeded(): boolean {
  return localStorage.getItem('migration_chips_parlorfee_v1') !== 'completed'
}
```

#### 2-B. アプリ起動時のマイグレーション実行

**ファイル**: `src/App.tsx`

**変更内容**:

```typescript
import { migrateChipsParlorFeeBugFix, isMigrationNeeded } from '@/lib/migrations'

function App() {
  // ...既存のstate

  const [migrationInProgress, setMigrationInProgress] = useState(false)
  const [migrationProgress, setMigrationProgress] = useState({ current: 0, total: 0 })

  useEffect(() => {
    const runMigrations = async () => {
      if (!mainUser) return

      // マイグレーションが必要かチェック
      if (isMigrationNeeded()) {
        setMigrationInProgress(true)

        try {
          await migrateChipsParlorFeeBugFix(
            mainUser.id,
            (current, total) => {
              setMigrationProgress({ current, total })
            }
          )

          toast.success('データ修正が完了しました')
        } catch (err) {
          logger.error('マイグレーション失敗', {
            context: 'App.runMigrations',
            error: err as Error
          })
          toast.error('データ修正中にエラーが発生しました')
        } finally {
          setMigrationInProgress(false)
        }
      }
    }

    runMigrations()
  }, [mainUser])

  // マイグレーション中は専用UIを表示
  if (migrationInProgress) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">データを更新中...</div>
          <div className="text-sm text-muted-foreground">
            {migrationProgress.current} / {migrationProgress.total}
          </div>
          <div className="text-xs text-muted-foreground mt-4">
            このプロセスは一度だけ実行されます
          </div>
        </div>
      </div>
    )
  }

  // ...通常のUIレンダリング
}
```

### Phase 3: コード品質向上（推奨 - P1）

#### 3-A. `TotalsPanel.tsx`の明示的な実装

**ファイル**: `src/components/input/TotalsPanel.tsx`

**修正箇所**: L22-55

**変更内容**:

```typescript
// 修正前（偶然正しく動作）
function calculatePlayerTotals(
  playerIndex: number,
  hanchans: Hanchan[],
  settings: SessionSettings
): PlayerTotals {
  // ...
  hanchans.forEach((hanchan) => {
    const player = hanchan.players[playerIndex]
    // ...
    chips = player.chips         // 上書きのみ
    parlorFee = player.parlorFee // 上書きのみ
  })
  // ...
}
```

```typescript
// 修正後（明示的に最初の半荘から取得）
function calculatePlayerTotals(
  playerIndex: number,
  hanchans: Hanchan[],
  settings: SessionSettings
): PlayerTotals {
  let scoreTotal = 0
  let umaTotal = 0

  // chips/parlorFeeは最初の半荘から取得（セッション全体で1回）
  const firstHanchan = hanchans[0]
  const chips = firstHanchan?.players[playerIndex]?.chips ?? 0
  const parlorFee = firstHanchan?.players[playerIndex]?.parlorFee ?? 0

  // 各半荘のスコアとウマを集計
  hanchans.forEach((hanchan) => {
    const player = hanchan.players[playerIndex]
    if (!player.isSpectator && player.score !== null) {
      scoreTotal += player.score
      umaTotal += umaMarkToValue(player.umaMark)
    }
  })

  // 計算ロジックは変更なし
  const subtotal = scoreTotal + umaTotal * settings.umaValue
  const payout = subtotal * settings.rate + chips * settings.chipRate
  const finalPayout = payout - parlorFee

  return {
    scoreTotal,
    umaTotal,
    subtotal,
    chips,
    payout,
    parlorFee,
    finalPayout,
  }
}
```

## 修正の実施順序

### ステップ1: コア計算ロジックの修正
1. `calculatePayoutWithoutExtras`関数を追加
2. `calculateSessionSummary`を修正
3. プレイヤー間の総収支計算を修正

### ステップ2: マイグレーション処理の実装
1. `migrations.ts`を作成
2. `App.tsx`にマイグレーション実行ロジックを追加

### ステップ3: テスト実行
1. 新規セッションの保存・表示テスト
2. 既存セッションの再計算テスト
3. マイグレーション処理のテスト

### ステップ4: コード品質向上（任意）
1. `TotalsPanel.tsx`の明示的な実装

## リスク管理

### リスク軽減策

#### リスク1: 既存データの表示変更
**対策**:
- マイグレーション実行前にユーザー通知
- マイグレーション進捗の可視化
- localStorage にマイグレーション完了フラグを保存（重複実行防止）

#### リスク2: 新しいバグの混入
**対策**:
- 包括的なテストケース作成
- 手動テストの実施
- ロールバック手順の準備

#### リスク3: パフォーマンス劣化
**対策**:
- マイグレーション処理の最適化
- 進捗表示でユーザーに状況を伝える
- バックグラウンド処理の検討（必要に応じて）

## 成功基準

### 機能的成功基準
1. ✅ 新規セッションのchips/parlorFeeが正しくカウントされる
2. ✅ 既存セッションのサマリーが正しく再計算される
3. ✅ 履歴タブの表示が正しい値になる
4. ✅ マイグレーションが1回のみ実行される

### 品質的成功基準
1. ✅ すべてのテストケースが合格
2. ✅ コンソールにエラーが出ない
3. ✅ パフォーマンスが劣化していない
4. ✅ コードの意図が明確（可読性）

### ユーザー体験的成功基準
1. ✅ マイグレーション中のフィードバックが適切
2. ✅ 修正前後の値の違いが説明できる
3. ✅ ユーザーが混乱しない
