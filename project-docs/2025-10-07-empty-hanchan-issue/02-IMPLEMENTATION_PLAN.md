# 空ハンチャンフィルタリング実装計画書

**作成日**: 2025-10-07 01:23
**ベース**: `01-ROOT_CAUSE_ANALYSIS.md`
**方針**: 保存時フィルタリング（推奨方針A）
**既存データ対応**: 不要（β版テスト環境）

---

## 📋 目次

1. [実装概要](#実装概要)
2. [実装詳細](#実装詳細)
3. [テスト戦略](#テスト戦略)
4. [リスク分析](#リスク分析)
5. [実装手順](#実装手順)

---

## 🎯 実装概要

### 目的
保存時に空ハンチャンをフィルタリングし、データベースに不要なデータが保存されないようにする。

### スコープ
- ✅ **InputTab**: 保存前に空ハンチャンをフィルタリング
- ✅ **db-utils**: 二重チェックとして空ハンチャンを検証
- ✅ **統計計算**: 防御的プログラミングとして空データチェック追加
- ❌ **既存データクリーンアップ**: β版のため不要

### 修正対象ファイル
1. `app/src/lib/db-utils.ts` - ヘルパー関数追加、saveSession修正
2. `app/src/components/tabs/InputTab.tsx` - handleSave修正
3. `app/src/lib/session-utils.ts` - calculateSessionSummary防御的修正（オプション）
4. `app/src/lib/db-utils.ts` - 統計計算関数防御的修正（オプション）

---

## 🔧 実装詳細

### Phase 1: ヘルパー関数実装

#### 1.1 空ハンチャン判定関数

**ファイル**: `app/src/lib/db-utils.ts`
**配置場所**: saveSession関数の前（行765付近）

```typescript
/**
 * 空ハンチャン判定
 *
 * 空ハンチャンの定義:
 * - 全プレイヤーが見学者、または
 * - 全プレイヤーのscoreがnullまたは0
 *
 * @param hanchan - 判定対象のハンチャンデータ
 * @returns true: 空ハンチャン, false: 有効なハンチャン
 *
 * @example
 * // 全員0点
 * isEmptyHanchan({ players: [{ score: 0 }, { score: 0 }] }) // true
 *
 * // 1人でも点数入力あり
 * isEmptyHanchan({ players: [{ score: 100 }, { score: 0 }] }) // false
 *
 * // 全員見学者
 * isEmptyHanchan({ players: [{ isSpectator: true }, { isSpectator: true }] }) // true
 */
function isEmptyHanchan(hanchan: { players: Array<{ score: number | null; isSpectator: boolean }> }): boolean {
  return hanchan.players.every(p =>
    p.isSpectator || p.score === null || p.score === 0
  )
}
```

**配置理由**:
- `saveSession`から呼び出すため、近くに配置
- 内部ヘルパー関数のため`function`宣言（export不要）

**型安全性**:
- 引数型を最小限のインターフェースに限定
- InputTabとdb-utilsの両方から呼び出せる柔軟性

---

#### 1.2 非空ハンチャンフィルタリング関数（オプション）

**ファイル**: `app/src/lib/db-utils.ts`
**配置場所**: isEmptyHanchan関数の直後

```typescript
/**
 * 空ハンチャンをフィルタリング（有効なハンチャンのみ返す）
 *
 * @param hanchans - ハンチャンデータ配列
 * @returns 有効なハンチャンのみの配列
 */
function filterValidHanchans<T extends { players: Array<{ score: number | null; isSpectator: boolean }> }>(
  hanchans: T[]
): T[] {
  return hanchans.filter(h => !isEmptyHanchan(h))
}
```

**使用目的**:
- InputTabで配列フィルタリングに使用
- 型安全性を保ちつつコードの可読性向上

---

### Phase 2: InputTab修正

#### 2.1 保存処理の修正

**ファイル**: `app/src/components/tabs/InputTab.tsx`
**該当箇所**: 行136-185 (handleSave関数)

**Before**:
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
    // ...
  }
}
```

**After**:
```typescript
const handleSave = async () => {
  try {
    // 空ハンチャン判定関数（ローカルヘルパー）
    const isEmptyHanchan = (h: Hanchan): boolean => {
      return h.players.every(p =>
        p.isSpectator || p.score === null || p.score === 0
      )
    }

    // 1. 空ハンチャンをフィルタリング（有効なハンチャンのみ抽出）
    const validHanchans = hanchans.filter(h => !isEmptyHanchan(h))

    console.log(`[DEBUG] InputTab: 総ハンチャン数=${hanchans.length}, 有効ハンチャン数=${validHanchans.length}`)

    // 2. バリデーション：最低1半荘の有効データが必要
    if (validHanchans.length === 0) {
      toast.error('点数が入力されていません')
      return
    }

    // 3. 半荘番号を振り直し（1から連番）
    const renumberedHanchans = validHanchans.map((h, index) => ({
      ...h,
      hanchanNumber: index + 1
    }))

    // 4. セッションデータを作成
    const saveData: SessionSaveData = {
      date: settings.date,
      mode: selectedMode === '4-player' ? 'four-player' : 'three-player',
      rate: settings.rate,
      umaValue: settings.umaValue,
      chipRate: settings.chipRate,
      umaRule: settings.umaRule === 'standard' ? 'standard' : 'second-minus',
      hanchans: renumberedHanchans.map((h) => ({
        hanchanNumber: h.hanchanNumber,
        players: h.players.map((p, idx) => ({
          playerName: p.playerName,
          userId: p.userId,
          score: p.score ?? 0,  // 有効ハンチャンのみなので、ここでのnullは想定外
          umaMark: p.umaMark,
          chips: p.chips,
          parlorFee: p.parlorFee,
          isSpectator: p.isSpectator,
          position: idx,
        })),
      })),
    }

    console.log('[DEBUG] InputTab: saveDataの半荘数 =', saveData.hanchans.length)
    console.log('[DEBUG] InputTab: 半荘番号リスト =', saveData.hanchans.map((h) => h.hanchanNumber))

    // DB保存（サマリーも事前計算して保存）
    await saveSessionWithSummary(saveData, mainUser!.id)

    // 成功通知
    toast.success('セッションを保存しました')

    // リセット
    handleReset()

    // 履歴タブへ遷移
    onSaveSuccess?.()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '保存に失敗しました')
  }
}
```

**変更点**:
1. ✅ **空ハンチャン判定関数をローカル定義**: db-utilsに依存せず、InputTab内で完結
2. ✅ **有効ハンチャンのみフィルタリング**: `validHanchans`変数に抽出
3. ✅ **半荘番号振り直し**: 1から連番にリナンバリング（例: 2, 3 → 1, 2）
4. ✅ **バリデーション改善**: `validHanchans.length === 0`でチェック
5. ✅ **デバッグログ追加**: フィルタリング前後の件数を記録

**理由**:
- **半荘番号振り直し**: DB内の半荘番号が1, 2, 3と連続することを保証（表示時の混乱を防ぐ）
- **ローカルヘルパー**: db-utilsをimportせず、InputTab内で完結させる（依存関係を最小化）

---

### Phase 3: db-utils.saveSession修正（二重チェック）

#### 3.1 二重チェックの追加

**ファイル**: `app/src/lib/db-utils.ts`
**該当箇所**: 行766-879 (saveSession関数)

**Before**:
```typescript
export async function saveSession(data: SessionSaveData): Promise<string> {
  try {
    logger.info('セッション保存開始', {
      context: 'db-utils.saveSession',
      data: { date: data.date, mode: data.mode }
    });

    // バリデーション
    if (!data.date || !data.mode) {
      throw new ValidationError('必須項目が入力されていません', 'date, mode');
    }

    if (data.hanchans.length === 0) {
      throw new ValidationError('半荘データがありません', 'hanchans');
    }

    // ... Session作成 ...
  }
}
```

**After**:
```typescript
export async function saveSession(data: SessionSaveData): Promise<string> {
  try {
    logger.info('セッション保存開始', {
      context: 'db-utils.saveSession',
      data: { date: data.date, mode: data.mode }
    });

    // バリデーション
    if (!data.date || !data.mode) {
      throw new ValidationError('必須項目が入力されていません', 'date, mode');
    }

    if (data.hanchans.length === 0) {
      throw new ValidationError('半荘データがありません', 'hanchans');
    }

    // ⭐ 追加: 空ハンチャンの二重チェック（防御的プログラミング）
    const validHanchans = data.hanchans.filter(h => !isEmptyHanchan(h))

    if (validHanchans.length === 0) {
      logger.warn('全ハンチャンが空データでした', {
        context: 'db-utils.saveSession',
        data: { totalHanchans: data.hanchans.length }
      })
      throw new ValidationError('有効な半荘データがありません', 'hanchans')
    }

    if (validHanchans.length < data.hanchans.length) {
      logger.warn('空ハンチャンが検出されました（フィルタリング済み）', {
        context: 'db-utils.saveSession',
        data: {
          totalHanchans: data.hanchans.length,
          validHanchans: validHanchans.length,
          filtered: data.hanchans.length - validHanchans.length
        }
      })
    }

    // ⭐ 修正: 有効ハンチャンのみを保存
    const dataToSave = { ...data, hanchans: validHanchans }

    // Session作成
    const sessionId = crypto.randomUUID();
    const now = new Date();

    const session: Session = {
      id: sessionId,
      date: dataToSave.date,
      mode: dataToSave.mode === 'four-player' ? '4-player' : '3-player',
      rate: dataToSave.rate,
      umaValue: dataToSave.umaValue,
      chipRate: dataToSave.chipRate,
      parlorFee: dataToSave.hanchans[0]?.players[0]?.parlorFee || 0,
      umaRule: dataToSave.umaRule as 'standard' | 'second-minus',
      createdAt: now,
      updatedAt: now
    };

    // トランザクション内で全て保存
    await db.transaction('rw', [db.sessions, db.hanchans, db.playerResults], async () => {
      await db.sessions.add(session);

      // 各半荘とプレイヤー結果を作成（有効ハンチャンのみ）
      for (const hanchanData of dataToSave.hanchans) {
        // ... 既存のループ処理 ...
      }
    });

    logger.info('セッション保存成功', {
      context: 'db-utils.saveSession',
      data: { sessionId, hanchanCount: dataToSave.hanchans.length }
    });

    return sessionId;
  } catch (err) {
    // ... 既存のエラーハンドリング ...
  }
}
```

**変更点**:
1. ✅ **空ハンチャン二重チェック**: `isEmptyHanchan`でフィルタリング
2. ✅ **警告ログ出力**: 空ハンチャンが混入していた場合に警告
3. ✅ **ValidationError**: 全ハンチャンが空の場合にエラー
4. ✅ **有効データのみ保存**: `dataToSave`を使用

**意図**:
- **防御的プログラミング**: InputTabでフィルタリング済みだが、他の呼び出し元からの保護
- **デバッグ支援**: 空ハンチャン混入を警告ログで検知

---

### Phase 4: 統計計算の防御的修正（オプション）

既存データ対応は不要だが、将来的な安全性のため、統計計算関数にも防御的チェックを追加。

#### 4.1 calculateSessionSummary修正

**ファイル**: `app/src/lib/session-utils.ts`
**該当箇所**: 行96-185

**修正内容**:
```typescript
// 各半荘で着順と収支を計算
for (const hanchan of hanchans) {
  const ranks = calculateRanks(hanchan.players)
  const mainUserResult = hanchan.players.find((p) => p.userId === mainUserId)

  if (!mainUserResult) {
    console.warn(`[WARNING] 半荘${hanchan.hanchanNumber}: メインユーザー(${mainUserId})が見つかりません`)
    continue
  }

  // ⭐ 修正: null or 0 の両方をスキップ（防御的プログラミング）
  if (mainUserResult.score === null || mainUserResult.score === 0) {
    console.log(`[DEBUG] 半荘${hanchan.hanchanNumber}: メインユーザーのscore=${mainUserResult.score} - スキップ`)
    continue
  }

  // ... 既存のロジック ...
}
```

**変更点**:
- `score === null` → `score === null || score === 0`

**理由**:
- β版では空データは保存されないが、将来的な安全性のため
- 0点が有効なゲーム結果として存在する可能性は麻雀では考えにくい

---

#### 4.2 calculateRankStatistics修正

**ファイル**: `app/src/lib/db-utils.ts`
**該当箇所**: 行1124-1188

**修正内容**:
```typescript
// 各半荘ごとに着順を計算
for (const hanchan of hanchans) {
  // ⭐ 追加: 空ハンチャンをスキップ（全員0点の場合）
  const hasValidScores = hanchan.players.some(p =>
    !p.isSpectator && p.score !== null && p.score !== 0
  )

  if (!hasValidScores) {
    continue // 全員0点 or null の場合はスキップ
  }

  // 半荘内の全プレイヤーの着順を計算（点数順）
  const ranks = calculateRanksFromScores(hanchan.players)

  // 対象ユーザーのPlayerResultを見つける
  const targetPlayer = hanchan.players.find(p => p.userId === targetUserId)
  if (!targetPlayer || targetPlayer.isSpectator || targetPlayer.score === null || targetPlayer.score === 0) {
    continue // 見学者 or 点数未入力 or 0点 はスキップ
  }

  // ... 既存のロジック ...
}
```

**変更点**:
1. ✅ **半荘レベルでの空チェック**: 全員0点の半荘をスキップ
2. ✅ **個別プレイヤーチェック拡張**: `score === 0`も除外

---

#### 4.3 他の統計計算関数

同様の修正を以下の関数にも適用:

1. **calculateRevenueStatistics** (行1190-1206)
2. **calculatePointStatistics** (行1208-1224)
3. **calculateChipStatistics** (行1226-1240)

**修正パターン**:
```typescript
// Before
if (!targetPlayer || targetPlayer.isSpectator || targetPlayer.score === null) {
  continue
}

// After
if (!targetPlayer || targetPlayer.isSpectator || targetPlayer.score === null || targetPlayer.score === 0) {
  continue
}
```

---

## 🧪 テスト戦略

### テストケース

#### TC-1: 基本的なフィルタリング
- **入力**: 3ハンチャン（1, 2は入力済み、3は全員0点）
- **期待結果**: 2ハンチャンのみ保存、半荘番号は1, 2

#### TC-2: 空ハンチャンのみ
- **入力**: 3ハンチャン（全て空）
- **期待結果**: バリデーションエラー「点数が入力されていません」

#### TC-3: 中間の空ハンチャン
- **入力**: 3ハンチャン（1は入力済み、2は空、3は入力済み）
- **期待結果**: 2ハンチャン保存、半荘番号は1, 2（元の1と3）

#### TC-4: 全てのハンチャンが有効
- **入力**: 3ハンチャン（全て入力済み）
- **期待結果**: 3ハンチャンすべて保存、半荘番号は1, 2, 3

#### TC-5: 見学者のみのハンチャン
- **入力**: 1ハンチャン（全員見学者）
- **期待結果**: バリデーションエラー

#### TC-6: 一部見学者＋空データ
- **入力**: 1ハンチャン（2人は見学者、残りは0点）
- **期待結果**: 空ハンチャンと判定され除外

#### TC-7: 統計計算の正確性
- **入力**: 有効2ハンチャン＋空1ハンチャン保存（既存データ想定）
- **期待結果**: 統計には2ハンチャンのみカウント

---

### 手動テスト手順

1. **準備**:
   ```bash
   npm run dev
   ```

2. **TC-1実行**:
   - 4人打ちモード選択
   - 半荘1: 点数入力（例: 100, -50, -30, -20）
   - 半荘2: 点数入力（例: 80, 20, -60, -40）
   - 半荘3: 入力なし（全員0点のまま）
   - 保存ボタンクリック
   - **確認**:
     - コンソールログ「総ハンチャン数=3, 有効ハンチャン数=2」
     - 履歴タブで2ハンチャンのみ表示
     - 分析タブで総ゲーム数=2

3. **TC-2実行**:
   - 新規セッション開始
   - 全ハンチャン未入力
   - 保存ボタンクリック
   - **確認**: トーストエラー「点数が入力されていません」

4. **TC-3実行**:
   - 新規セッション開始
   - 半荘1: 点数入力
   - 半荘2: 未入力
   - 半荘3: 点数入力
   - 保存ボタンクリック
   - **確認**:
     - 保存成功
     - 履歴詳細で半荘番号が1, 2（元の1と3が1, 2にリナンバリング）

---

### 自動テスト（将来拡張）

```typescript
// test/unit/db-utils.test.ts
describe('isEmptyHanchan', () => {
  test('全員0点 → true', () => {
    const hanchan = { players: [{ score: 0, isSpectator: false }, { score: 0, isSpectator: false }] }
    expect(isEmptyHanchan(hanchan)).toBe(true)
  })

  test('1人でも点数あり → false', () => {
    const hanchan = { players: [{ score: 100, isSpectator: false }, { score: 0, isSpectator: false }] }
    expect(isEmptyHanchan(hanchan)).toBe(false)
  })

  test('全員見学者 → true', () => {
    const hanchan = { players: [{ score: 0, isSpectator: true }, { score: 0, isSpectator: true }] }
    expect(isEmptyHanchan(hanchan)).toBe(true)
  })
})
```

---

## ⚠️ リスク分析

### リスク1: 半荘番号振り直しによる混乱

**リスク内容**:
- ユーザーが半荘1, 3を入力 → DBには半荘1, 2として保存
- 保存後に履歴表示で「あれ？3半荘目はどこ？」と混乱する可能性

**発生確率**: 中
**影響度**: 低

**対策**:
- ✅ **実装済み**: 半荘番号は自動的に連番になるため、DBの整合性は保たれる
- ✅ **UX改善案**: 保存時のトーストメッセージで「2半荘を保存しました」と件数を明示
- ⏭️ **将来対応**: 保存確認ダイアログで「空の半荘はスキップされます」と警告

**結論**: 実装を進める（低リスク）

---

### リスク2: 0点が有効なゲーム結果として存在する場合

**リスク内容**:
- 麻雀で全員が±0点（完全に25,000点ちょうどで終了）は理論上ありえる
- この場合、有効なゲーム結果が誤って除外される可能性

**発生確率**: 極低
**影響度**: 中

**分析**:
- 麻雀で全員が±0点になるのは以下のケースのみ:
  1. 全員が25,000点ちょうどで終了（流局続きで点数移動なし）
  2. 点数計算ミスでキャンセル

**対策**:
- ✅ **現状の判定ロジック維持**: `score === 0`を空と判定
- ⏭️ **将来的な改善案**:
  - ウママークが設定されている場合は有効データと判定
  - チップが設定されている場合は有効データと判定
  - 改良版判定ロジック:
    ```typescript
    function isEmptyHanchan(hanchan: Hanchan): boolean {
      return hanchan.players.every(p =>
        p.isSpectator ||
        (
          (p.score === null || p.score === 0) &&
          p.umaMark === '' &&  // ウママークなし
          p.chips === 0        // チップなし
        )
      )
    }
    ```

**結論**: 現状のロジックで実装、将来的に改善を検討

---

### リスク3: db-utilsの二重チェックでパフォーマンス低下

**リスク内容**:
- InputTabとdb-utilsの両方でフィルタリング → 重複処理

**発生確率**: 高（必ず発生）
**影響度**: 極低

**分析**:
- フィルタリング処理は`O(n*m)` (n=半荘数, m=プレイヤー数)
- 最大でも3半荘×4人=12回のチェック
- パフォーマンス影響は無視できるレベル

**結論**: 防御的プログラミングのメリットが上回る

---

### リスク4: 統計計算の防御的修正による後方互換性

**リスク内容**:
- 既存データに0点のハンチャンが存在する場合、統計が変わる

**発生確率**: 不明（β版のため）
**影響度**: 低

**対策**:
- ✅ **要件確認済み**: 「既存データへの対応は不要」（ユーザー指示）
- ✅ **実装方針**: 統計計算の防御的修正は実施する（将来の安全性のため）

**結論**: 実装を進める

---

## 📝 実装手順

### Step 1: ヘルパー関数実装 (15分)

1. `app/src/lib/db-utils.ts` を開く
2. 行765付近（saveSession関数の前）に`isEmptyHanchan`を追加
3. TypeScriptコンパイルエラーがないか確認
4. ビルド確認: `npm run build`

---

### Step 2: InputTab修正 (20分)

1. `app/src/components/tabs/InputTab.tsx` を開く
2. `handleSave`関数を修正（行136-185）:
   - 空ハンチャン判定ローカル関数追加
   - `validHanchans`フィルタリング
   - 半荘番号振り直し
   - バリデーション修正
   - デバッグログ追加
3. TypeScriptコンパイルエラーがないか確認
4. ビルド確認: `npm run build`

---

### Step 3: db-utils.saveSession修正 (15分)

1. `app/src/lib/db-utils.ts` を開く
2. `saveSession`関数を修正（行766-879）:
   - 空ハンチャン二重チェック追加
   - 警告ログ追加
   - `dataToSave`使用
3. TypeScriptコンパイルエラーがないか確認
4. ビルド確認: `npm run build`

---

### Step 4: 統計計算防御的修正（オプション） (20分)

1. `app/src/lib/session-utils.ts` を開く
2. `calculateSessionSummary`修正:
   - `score === 0`チェック追加
3. `app/src/lib/db-utils.ts` を開く
4. 以下の関数を修正:
   - `calculateRankStatistics`
   - `calculateRevenueStatistics`
   - `calculatePointStatistics`
   - `calculateChipStatistics`
5. TypeScriptコンパイルエラーがないか確認
6. ビルド確認: `npm run build`

---

### Step 5: 手動テスト (30分)

1. `npm run dev`でdev server起動
2. TC-1〜TC-6を実行
3. コンソールログ確認
4. 履歴タブ確認
5. 分析タブ確認
6. IndexedDB確認（Chrome DevTools → Application → IndexedDB）

---

### Step 6: ドキュメント更新 (10分)

1. `MASTER_STATUS_DASHBOARD.md`更新:
   - 完了タスクに追記
   - 実装日時記録
2. `CLAUDE.md`更新（必要に応じて）:
   - 空ハンチャンフィルタリングについて言及

---

### Step 7: Gitコミット (5分)

```bash
git add -A
git commit -m "空ハンチャンフィルタリング実装

- InputTab: 保存前に空ハンチャンをフィルタリング
- db-utils: 二重チェックとして空ハンチャン検証
- 統計計算: 防御的プログラミングでscore=0チェック追加
- 半荘番号の自動リナンバリング実装

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push
```

---

## ⏱️ 見積もり時間

| タスク | 時間 |
|--------|------|
| Step 1: ヘルパー関数実装 | 15分 |
| Step 2: InputTab修正 | 20分 |
| Step 3: db-utils.saveSession修正 | 15分 |
| Step 4: 統計計算防御的修正 | 20分 |
| Step 5: 手動テスト | 30分 |
| Step 6: ドキュメント更新 | 10分 |
| Step 7: Gitコミット | 5分 |
| **合計** | **115分（約2時間）** |

---

## ✅ 完了基準

1. ✅ TypeScriptコンパイルエラーなし
2. ✅ `npm run build`成功
3. ✅ TC-1〜TC-6の全テストケースがパス
4. ✅ コンソールログで空ハンチャンフィルタリングが確認できる
5. ✅ 履歴タブで正しい半荘数が表示される
6. ✅ 分析タブの統計が正確（空ハンチャンを含まない）
7. ✅ IndexedDBに空ハンチャンが保存されていない
8. ✅ ドキュメント更新完了
9. ✅ Gitコミット完了

---

## 🔗 参照

- **根本原因分析**: `01-ROOT_CAUSE_ANALYSIS.md`
- **InputTab**: `app/src/components/tabs/InputTab.tsx`
- **db-utils**: `app/src/lib/db-utils.ts`
- **session-utils**: `app/src/lib/session-utils.ts`
