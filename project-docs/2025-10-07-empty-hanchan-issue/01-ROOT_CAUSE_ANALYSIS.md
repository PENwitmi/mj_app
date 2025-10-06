# 空ハンチャン保存問題 - 根本原因分析

**作成日**: 2025-10-07 01:19
**分析者**: sc-analyze agent

---

## 🚨 問題の概要

履歴タブおよび分析タブで、**全員が0点（または未入力）のハンチャンデータが保存され、統計に含まれてしまう**問題が発見された。

**具体例**:
- InputTabで初期表示時に3ハンチャンが表示される
- ユーザーが2ハンチャンのみを入力して保存
- 結果: **3ハンチャン目の空データ（全員0点）もDBに保存される**
- 影響: 履歴表示・統計計算に空データが含まれ、数値が不正確になる

---

## 🔍 根本原因の特定

### 1️⃣ InputTab: 初期表示で3ハンチャン作成

**ファイル**: `app/src/components/tabs/InputTab.tsx`
**該当箇所**: 行86-96

```typescript
const handleModeSelect = (mode: GameMode) => {
  setSelectedMode(mode)
  const initialPlayerCount = mode === '4-player' ? 4 : 3
  const playerNames = getInitialPlayerNames(mode, initialPlayerCount, mainUser?.name)

  // 初期表示で3つの半荘を作成
  const initialHanchans: Hanchan[] = [1, 2, 3].map((num) => ({
    hanchanNumber: num,
    players: playerNames.map((name, idx) => ({
      ...createInitialPlayerResult(name),
      userId: idx === 0 && mainUser ? mainUser.id : null,
    })),
    autoCalculated: false,
  }))

  setHanchans(initialHanchans)
}
```

**問題点**:
- 初期表示で必ず3ハンチャンが作成される
- 各プレイヤーの`score`は初期値として`null`または`0`が設定される

---

### 2️⃣ InputTab保存処理: 不十分なバリデーション

**ファイル**: `app/src/components/tabs/InputTab.tsx`
**該当箇所**: 行136-185

```typescript
const handleSave = async () => {
  try {
    // バリデーション：最低1半荘は入力が必要
    const hasData = hanchans.some((h) => h.players.some((p) => !p.isSpectator && p.score !== null))
    if (!hasData) {
      toast.error('点数が入力されていません')
      return
    }

    // セッションデータを作成
    const saveData: SessionSaveData = {
      date: settings.date,
      mode: selectedMode === '4-player' ? 'four-player' : 'three-player',
      rate: settings.rate,
      umaValue: settings.umaValue,
      chipRate: settings.chipRate,
      umaRule: settings.umaRule === 'standard' ? 'standard' : 'second-minus',
      hanchans: hanchans.map((h) => ({  // ⚠️ 全ハンチャンをそのまま保存
        hanchanNumber: h.hanchanNumber,
        players: h.players.map((p, idx) => ({
          playerName: p.playerName,
          userId: p.userId,
          score: p.score ?? 0,  // ⚠️ nullは0に変換される
          umaMark: p.umaMark,
          chips: p.chips,
          parlorFee: p.parlorFee,
          isSpectator: p.isSpectator,
          position: idx,
        })),
      })),
    }

    // DB保存（サマリーも事前計算して保存）
    await saveSessionWithSummary(saveData, mainUser!.id)

    // ...
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '保存に失敗しました')
  }
}
```

**問題点**:
1. **バリデーションが不十分**:
   - 「最低1半荘に点数入力があるか」のみチェック
   - **空のハンチャン（全員0点）はフィルタリングされない**

2. **score: p.score ?? 0**:
   - `null`の場合は`0`に変換される
   - DBには`score=0`として保存される

3. **全ハンチャンをそのまま保存**:
   - `hanchans.map((h) => ...)`で全てのハンチャンをマッピング
   - **空のハンチャンもフィルタリングせずに保存**

---

### 3️⃣ db-utils.saveSession: フィルタリングなし

**ファイル**: `app/src/lib/db-utils.ts`
**該当箇所**: 行766-879

```typescript
export async function saveSession(data: SessionSaveData): Promise<string> {
  try {
    // バリデーション
    if (!data.date || !data.mode) {
      throw new ValidationError('必須項目が入力されていません', 'date, mode');
    }

    if (data.hanchans.length === 0) {
      throw new ValidationError('半荘データがありません', 'hanchans');
    }

    // ... Session作成 ...

    // トランザクション内で全て保存
    await db.transaction('rw', [db.sessions, db.hanchans, db.playerResults], async () => {
      await db.sessions.add(session);

      // 各半荘とプレイヤー結果を作成
      for (const hanchanData of data.hanchans) {  // ⚠️ 全ハンチャンをそのまま保存
        const hanchanId = crypto.randomUUID();

        // ... Hanchan作成・保存 ...

        // プレイヤー結果を作成
        for (const playerData of hanchanData.players) {
          const playerResult: PlayerResult = {
            id: crypto.randomUUID(),
            hanchanId,
            userId: playerData.userId,
            playerName: playerData.playerName,
            score: playerData.score,  // ⚠️ 0もそのまま保存
            umaMark: playerData.umaMark,
            isSpectator: playerData.isSpectator,
            chips: playerData.chips,
            position: playerData.position,
            createdAt: now
          };

          await db.playerResults.add(playerResult);
        }

        // ...
      }
    });

    return sessionId;
  } catch (err) {
    // ...
  }
}
```

**問題点**:
- **空ハンチャンのフィルタリング処理が存在しない**
- 受け取ったデータをそのままDBに保存
- `score=0`は有効な値として扱われる

---

### 4️⃣ 統計計算: score=0を有効データとして扱う

#### calculateSessionSummary (履歴タブサマリー)

**ファイル**: `app/src/lib/session-utils.ts`
**該当箇所**: 行96-185

```typescript
export async function calculateSessionSummary(
  sessionId: string,
  mainUserId: string
): Promise<SessionSummary> {
  // ...

  // 各半荘で着順と収支を計算
  for (const hanchan of hanchans) {
    const ranks = calculateRanks(hanchan.players)
    const mainUserResult = hanchan.players.find((p) => p.userId === mainUserId)

    if (mainUserResult) {
      // 点数が入力されていない半荘はスキップ（未入力の半荘は集計対象外）
      if (mainUserResult.score === null) {  // ⚠️ nullのみチェック
        continue
      }

      const rank = ranks.get(mainUserResult.id) || 0

      // 着順カウント
      if (rank === 1) rankCounts.first++
      else if (rank === 2) rankCounts.second++
      else if (rank === 3) rankCounts.third++
      else if (rank === 4) rankCounts.fourth++

      // ...
    }
  }

  // ...
}
```

**問題点**:
- **`score === null`のみスキップ**
- **`score === 0`は有効なデータとして統計に含まれる**
- 結果: 全員0点のハンチャンも着順計算・収支計算に含まれる

---

#### calculateRankStatistics (分析タブ統計)

**ファイル**: `app/src/lib/db-utils.ts`
**該当箇所**: 行1124-1188

```typescript
export function calculateRankStatistics(
  hanchans: Array<{ players: PlayerResult[] }>,
  targetUserId: string,
  mode: '4-player' | '3-player'
): RankStatistics {
  const rankCounts = { first: 0, second: 0, third: 0, fourth: 0 }
  let totalGames = 0

  // 各半荘ごとに着順を計算
  for (const hanchan of hanchans) {
    // 半荘内の全プレイヤーの着順を計算（点数順）
    const ranks = calculateRanksFromScores(hanchan.players)

    // 対象ユーザーのPlayerResultを見つける
    const targetPlayer = hanchan.players.find(p => p.userId === targetUserId)
    if (!targetPlayer || targetPlayer.isSpectator || targetPlayer.score === null) {
      continue // 見学者 or 点数未入力はスキップ
    }

    // ⚠️ score=0は有効データとして着順計算に含まれる

    // ...
  }

  // ...
}
```

**問題点**:
- **`score === null`のみスキップ**
- **`score === 0`は有効なデータとして統計に含まれる**

---

#### calculateRanksFromScores (着順計算ヘルパー)

**ファイル**: `app/src/lib/db-utils.ts`
**該当箇所**: 行1096-1114

```typescript
function calculateRanksFromScores(playerResults: PlayerResult[]): Map<string, number> {
  const rankMap = new Map<string, number>()

  // 見学者を除外、かつ点数が入力されているプレイヤーのみを対象
  const activePlayers = playerResults
    .filter((p) => !p.isSpectator && p.score !== null)  // ⚠️ nullのみ除外
    .sort((a, b) => b.score! - a.score!) // 点数降順

  // 着順を割り当て（同点の場合は同着）
  let currentRank = 1
  activePlayers.forEach((player, index) => {
    if (index > 0 && player.score! < activePlayers[index - 1].score!) {
      currentRank = index + 1
    }
    rankMap.set(player.id, currentRank)
  })

  return rankMap
}
```

**問題点**:
- **`score !== null`で有効データと判定**
- **全員score=0のハンチャンでも着順が計算される**（全員1位同着）

---

## 📊 問題の影響範囲

### 1. 履歴タブ (HistoryTab)
- ✅ **セッション一覧**: サマリー計算で`score === null`はスキップされるため、**影響は限定的**
- ⚠️ **セッション詳細**: 空のハンチャンも表示されてしまう

### 2. 分析タブ (AnalysisTab)
- ❌ **着順統計**: 空ハンチャン（全員0点）が着順計算に含まれる
- ❌ **収支統計**: 空ハンチャンの収支（0円）が統計に含まれる
- ❌ **総ゲーム数**: 空ハンチャンもカウントされ、実際より多くなる

### 3. データベース
- ❌ **不要なデータが蓄積**: 空のHanchan/PlayerResultレコードがDB内に保存される
- ❌ **パフォーマンス低下**: 無駄なデータ読み込みが発生

---

## 🎯 修正方針

### A. 保存時にフィルタリング（推奨）

**メリット**:
- データの正確性を根本から確保
- DBに無駄なデータが保存されない
- 統計計算が正確になる

**実装場所**:
1. **InputTab.handleSave()** (line 136-185)
   - 保存前に空ハンチャンをフィルタリング

2. **db-utils.saveSession()** (line 766-879)
   - 念のため二重チェック

**判定条件**:
```typescript
// 空ハンチャンの定義: 全プレイヤーがscore=0またはnull
function isEmptyHanchan(hanchan: Hanchan): boolean {
  return hanchan.players.every(p =>
    p.isSpectator || p.score === null || p.score === 0
  )
}
```

---

### B. 統計計算時にフィルタリング（部分対応）

**メリット**:
- 既存の保存済みデータにも対応可能

**デメリット**:
- DBには無駄なデータが残る
- 各統計計算関数で個別対応が必要

**実装場所**:
- `calculateSessionSummary()` (session-utils.ts)
- `calculateRankStatistics()` (db-utils.ts)
- `calculateRevenueStatistics()` (db-utils.ts)
- `calculatePointStatistics()` (db-utils.ts)
- `calculateChipStatistics()` (db-utils.ts)

---

### C. 既存データのクリーンアップ（オプション）

**対象**:
- 既にDBに保存されている空ハンチャンデータ

**実装方法**:
1. マイグレーションスクリプト作成
2. 空ハンチャン判定 → 削除
3. 影響を受けたSessionのsummaryを再計算

---

## 📝 次のステップ

1. **修正方針の決定**
   - A（保存時フィルタリング）を推奨
   - B（統計計算時フィルタリング）も併用して既存データに対応

2. **実装計画書の作成**
   - 詳細な実装手順
   - テストケース
   - リスク分析

3. **実装・テスト**
   - InputTab修正
   - db-utils修正
   - 統計計算関数修正
   - 既存データクリーンアップ（オプション）

---

## 🔗 参照

- **InputTab**: `app/src/components/tabs/InputTab.tsx` (行86-96, 136-185)
- **db-utils**: `app/src/lib/db-utils.ts` (行766-879, 1096-1188)
- **session-utils**: `app/src/lib/session-utils.ts` (行96-185)
