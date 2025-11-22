# Chips/ParlorFee 6倍バグ - テスト計画

## テスト戦略

### テストの目的
1. chips/parlorFeeが**セッション全体で1回のみ**カウントされることを検証
2. 既存データのマイグレーションが正しく動作することを検証
3. UI表示の一貫性を検証
4. 後方互換性を検証

### テストレベル
1. **ユニットテスト**: コア計算ロジックの正確性
2. **統合テスト**: データベース操作とサマリー計算の統合
3. **手動テスト**: UI/UXの確認、エッジケース検証

---

## ユニットテスト

### テスト環境
- **テストフレームワーク**: Vitest
- **テスト対象**: `src/lib/session-utils.ts`

### テストケース

#### TC-U1: `calculatePayoutWithoutExtras`の正確性

**目的**: chips/parlorFeeを除いた収支計算が正しいことを検証

```typescript
describe('calculatePayoutWithoutExtras', () => {
  it('should calculate payout without chips and parlorFee', () => {
    const payout = calculatePayoutWithoutExtras(
      10,    // score
      '○',   // umaMark (+1)
      30,    // rate
      10     // umaValue
    )

    // (10 + 1 * 10) * 30 = 20 * 30 = 600
    expect(payout).toBe(600)
  })

  it('should handle negative scores correctly', () => {
    const payout = calculatePayoutWithoutExtras(
      -10,   // score
      '✗',   // umaMark (-1)
      30,    // rate
      10     // umaValue
    )

    // (-10 + (-1) * 10) * 30 = -20 * 30 = -600
    expect(payout).toBe(-600)
  })

  it('should handle zero uma correctly', () => {
    const payout = calculatePayoutWithoutExtras(
      5,     // score
      '',    // umaMark (0)
      30,    // rate
      10     // umaValue
    )

    // (5 + 0 * 10) * 30 = 5 * 30 = 150
    expect(payout).toBe(150)
  })
})
```

**期待結果**: すべてのテストケースが合格

---

#### TC-U2: `calculateSessionSummary`でのchips/parlorFee単一カウント

**目的**: セッション全体でchips/parlorFeeが1回のみカウントされることを検証

```typescript
describe('calculateSessionSummary - chips/parlorFee counting', () => {
  it('should count chips only once for 5 hanchans', async () => {
    // Setup: 5半荘、chips=-2
    const summary = await calculateSessionSummary(sessionId, mainUserId)

    expect(summary.totalChips).toBe(-2)
    // NOT -10 (which would be -2 * 5)
  })

  it('should count parlorFee only once for 5 hanchans', async () => {
    // Setup: 5半荘、chips=-2, parlorFee=2000
    const summary = await calculateSessionSummary(sessionId, mainUserId)

    // totalPayout = (基本収支 * 5) + (chips * chipRate) - parlorFee
    // = (10 + 1*10) * 30 * 5 + (-2 * 100) - 2000
    // = 3000 - 200 - 2000 = 800
    expect(summary.totalPayout).toBe(800)
  })

  it('should handle 6 hanchans correctly', async () => {
    // Setup: 6半荘、chips=-2
    const summary = await calculateSessionSummary(sessionId, mainUserId)

    expect(summary.totalChips).toBe(-2)
    // NOT -12 (which would be -2 * 6)
  })
})
```

**期待結果**: すべてのテストケースが合格

---

#### TC-U3: 全プレイヤーのchips/parlorFee計算

**目的**: 総合順位計算でchips/parlorFeeが正しく扱われることを検証

```typescript
describe('calculateSessionSummary - overall rank calculation', () => {
  it('should calculate correct overall rank with chips/parlorFee', async () => {
    // Setup: 4プレイヤー、各自異なるchips/parlorFee
    const summary = await calculateSessionSummary(sessionId, mainUserId)

    expect(summary.overallRank).toBeGreaterThan(0)
    expect(summary.overallRank).toBeLessThanOrEqual(4)
  })

  it('should handle players without userId (unregistered)', async () => {
    // Setup: 未登録プレイヤーを含むセッション
    const summary = await calculateSessionSummary(sessionId, mainUserId)

    expect(summary.overallRank).toBeGreaterThan(0)
  })
})
```

**期待結果**: すべてのテストケースが合格

---

## 統合テスト

### テスト環境
- **実行環境**: ブラウザ（開発サーバー: `npm run dev`）
- **データベース**: IndexedDB（実データ）

### テストケース

#### TC-I1: 新規セッションの保存と表示

**目的**: 修正後のロジックで新規セッションが正しく保存・表示されることを検証

**手順**:
1. 「新規入力」タブで4人打ちを選択
2. 5半荘分のデータを入力
   - メインユーザー: score=10, uma=○, chips=-2, parlorFee=2000
   - 他プレイヤー: 適切な値
3. 「保存」ボタンをクリック
4. 「履歴」タブに遷移

**期待結果**:
- セッションカードの「チップ: -2枚」が表示される
- 収支が正しく計算されている（chips=-2, parlorFee=2000が1回のみカウント）
- コンソールにエラーが出ない

**検証方法**:
```
期待: 収支 = (10 + 1*10) * 30 * 5 + (-2 * 100) - 2000 = 800
実際: 「収支: +800」が表示される
```

---

#### TC-I2: 既存セッションのマイグレーション

**目的**: 修正前に作成した既存セッションが正しく再計算されることを検証

**前提条件**:
- 修正前のコードで作成したセッションが存在する
- chips=-2, parlorFee=2000が5半荘分保存されている
- 現在の表示: chips=-10（誤）

**手順**:
1. `localStorage.removeItem('migration_chips_parlorfee_v1')`を実行
2. アプリを再起動（ページリロード）
3. マイグレーション中のUI表示を確認
4. マイグレーション完了後、「履歴」タブを確認

**期待結果**:
- マイグレーション中のUI表示が表示される
- 進捗状況が表示される（例: 1/3, 2/3, 3/3）
- マイグレーション完了後、「データ修正が完了しました」のトースト表示
- 履歴タブで「チップ: -2枚」が表示される（-10ではない）
- 収支が正しく修正されている

**検証方法**:
```
修正前: chips=-10, 収支=誤った値
修正後: chips=-2, 収支=800（正しい値）
```

---

#### TC-I3: マイグレーションの冪等性

**目的**: マイグレーションが複数回実行されても問題ないことを検証

**手順**:
1. TC-I2でマイグレーションを実行
2. `localStorage.removeItem('migration_chips_parlorfee_v1')`を実行
3. アプリを再起動してマイグレーションを再実行
4. 「履歴」タブで値を確認

**期待結果**:
- 2回目のマイグレーション後も値が変わらない
- chips=-2, 収支=800（1回目と同じ）
- コンソールにエラーが出ない

---

#### TC-I4: セッション詳細ダイアログの表示

**目的**: 詳細ダイアログでchips/parlorFeeが正しく表示されることを検証

**手順**:
1. 「履歴」タブでセッションカードをクリック
2. セッション詳細ダイアログを確認

**期待結果**:
- chips/parlorFeeが正しく表示される
- 各半荘の収支が正しい
- コンソールにエラーが出ない

---

## 手動テスト（エッジケース）

### テストケース

#### TC-M1: 半荘数が異なるケース

**目的**: 1半荘、3半荘、10半荘などでchips/parlorFeeが正しくカウントされることを検証

**テストデータ**:
| ケース | 半荘数 | chips | parlorFee | 期待: totalChips |
|---|---|---|---|---|
| 1 | 1 | -2 | 2000 | -2 |
| 2 | 3 | -2 | 2000 | -2 |
| 3 | 10 | -2 | 2000 | -2 |

**手順**:
1. 各ケースで新規セッションを作成
2. 「履歴」タブで確認

**期待結果**: すべてのケースで`totalChips = -2`

---

#### TC-M2: chips/parlorFeeが0の場合

**目的**: chips=0, parlorFee=0の場合に正しく動作することを検証

**手順**:
1. 新規セッションを作成（chips=0, parlorFee=0）
2. 「履歴」タブで確認

**期待結果**:
- chips: 0枚
- 収支 = 基本収支のみ（chips/parlorFeeの影響なし）

---

#### TC-M3: プレイヤーごとに異なるchips/parlorFee

**目的**: 各プレイヤーが異なるchips/parlorFeeを持つ場合に正しく計算されることを検証

**テストデータ**:
| プレイヤー | chips | parlorFee |
|---|---|---|
| メインユーザー | -2 | 2000 |
| プレイヤー2 | 1 | 2000 |
| プレイヤー3 | 0 | 2000 |
| プレイヤー4 | 1 | 2000 |

**手順**:
1. 新規セッションを作成（5半荘）
2. 「履歴」タブで確認

**期待結果**:
- 総合順位が正しく計算される
- 各プレイヤーのchips/parlorFeeが1回のみカウントされている

---

#### TC-M4: 見学者が含まれるケース

**目的**: 見学者がいる半荘でchips/parlorFeeが正しく扱われることを検証

**手順**:
1. 新規セッションを作成
2. 一部の半荘で見学者を設定
3. 「履歴」タブで確認

**期待結果**:
- 見学者のchips/parlorFeeがカウントされない
- アクティブプレイヤーのchips/parlorFeeのみカウントされる

---

#### TC-M5: 点数未入力の半荘が含まれるケース

**目的**: 点数が未入力の半荘がある場合にchips/parlorFeeが正しく扱われることを検証

**手順**:
1. 新規セッションを作成（5半荘）
2. 最初の3半荘のみ点数を入力
3. 「保存」ボタンをクリック
4. 「履歴」タブで確認

**期待結果**:
- chips/parlorFeeは最初の半荘（点数入力済み）から取得される
- 半荘数は3と表示される
- chips: -2枚（3倍ではない）

---

## 回帰テスト

### 目的
修正により既存の正常機能が破壊されていないことを検証

### テストケース

#### TC-R1: 基本的なセッション保存・表示

**手順**:
1. 新規セッションを作成（chips/parlorFee以外のフィールド）
2. 保存
3. 「履歴」タブで確認

**期待結果**:
- セッション情報が正しく保存される
- 日付、モード、半荘数が正しい
- 平均着順が正しい
- 着順回数（1位、2位、3位、4位）が正しい

---

#### TC-R2: ウマルールの切り替え

**手順**:
1. 「設定」タブでウマルールを「2位マイナス判定」に変更
2. 新規セッションを作成
3. 保存
4. 「履歴」タブで確認

**期待結果**:
- ウマルールの変更が正しく反映される
- ウマ計算が正しい

---

#### TC-R3: プレイヤー名の変更

**手順**:
1. 「設定」タブでユーザー名を変更
2. 既存セッションの「履歴」タブで確認

**期待結果**:
- 既存セッションのプレイヤー名が更新される

---

## パフォーマンステスト

### 目的
マイグレーション処理が大量データで問題ないことを検証

### テストケース

#### TC-P1: 大量セッションのマイグレーション

**前提条件**:
- 100セッション（各5半荘）を作成

**手順**:
1. マイグレーションを実行
2. 処理時間を計測

**期待結果**:
- 処理時間が5秒以内
- 進捗表示が正しく動作する
- メモリリークが発生しない

**検証方法**:
```javascript
// ブラウザのコンソールで実行
console.time('migration')
await migrateChipsParlorFeeBugFix(mainUserId)
console.timeEnd('migration')
```

---

## テスト実施手順

### Phase 1: ユニットテスト
1. テストコードを実装
2. `npm run test`を実行
3. すべてのテストケースが合格することを確認

### Phase 2: 統合テスト
1. 開発サーバーを起動（`npm run dev`）
2. TC-I1〜TC-I4を順次実行
3. すべてのテストケースが合格することを確認

### Phase 3: 手動テスト（エッジケース）
1. TC-M1〜TC-M5を順次実行
2. すべてのテストケースが合格することを確認

### Phase 4: 回帰テスト
1. TC-R1〜TC-R3を順次実行
2. 既存機能が破壊されていないことを確認

### Phase 5: パフォーマンステスト（任意）
1. TC-P1を実行
2. パフォーマンスが許容範囲内であることを確認

---

## テスト結果の記録

### テスト結果テンプレート

```markdown
## テスト実行結果

**実行日**: 2025-10-28
**実行者**: [名前]
**環境**: [ブラウザ, OS]

### ユニットテスト
- TC-U1: ✅ 合格
- TC-U2: ✅ 合格
- TC-U3: ✅ 合格

### 統合テスト
- TC-I1: ✅ 合格
- TC-I2: ✅ 合格
- TC-I3: ✅ 合格
- TC-I4: ✅ 合格

### 手動テスト（エッジケース）
- TC-M1: ✅ 合格
- TC-M2: ✅ 合格
- TC-M3: ✅ 合格
- TC-M4: ✅ 合格
- TC-M5: ✅ 合格

### 回帰テスト
- TC-R1: ✅ 合格
- TC-R2: ✅ 合格
- TC-R3: ✅ 合格

### パフォーマンステスト
- TC-P1: ✅ 合格（処理時間: 2.3秒）

### 総合評価
すべてのテストケースが合格しました。修正は正常に動作しています。
```

---

## バグが見つかった場合の対応

### 重大なバグ（Critical）
1. 即座に修正作業を中断
2. バグの詳細を記録
3. 原因を特定
4. 修正方針を再検討
5. 修正後、すべてのテストを再実行

### 軽微なバグ（Minor）
1. バグの詳細を記録
2. 修正の優先度を判断
3. 修正後、関連するテストを再実行

---

## 完了基準

### 必須条件
- ✅ すべてのユニットテストが合格
- ✅ すべての統合テストが合格
- ✅ すべての手動テスト（エッジケース）が合格
- ✅ すべての回帰テストが合格

### 推奨条件
- ✅ パフォーマンステストが合格
- ✅ コンソールにエラーが出ない
- ✅ Lintエラーがない
- ✅ ビルドが成功する

### 品質条件
- ✅ テスト結果が記録されている
- ✅ バグが見つかった場合は修正済み
- ✅ 後方互換性が保たれている
