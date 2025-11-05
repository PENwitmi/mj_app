# テスト計画 - 分析タブ統計機能

## 1. テスト戦略

### 1.1 テストレベル

| レベル | 範囲 | 優先度 | 実施方法 |
|-------|-----|-------|---------|
| **手動E2Eテスト** | UI操作 → データベース → 統計表示 | 最高 | ブラウザでの手動操作 |
| **コンポーネントテスト** | AnalysisTabの動作 | 中 | Vitest + React Testing Library |
| **単体テスト** | 計算ロジック（将来的にヘルパー関数化した場合） | 低 | Vitest |

**判断**: 現時点では手動E2Eテストを優先
- 理由: 計算ロジックがuseMemo内に記述されている（単体テスト不可）
- 将来的にヘルパー関数化したら単体テスト追加を検討

### 1.2 テスト目的

**機能テスト**:
- ✅ selectedUserId変更で統計が更新される
- ✅ chips/parlorFeeがセッション単位で1回のみカウントされる
- ✅ 見学者・未入力データが除外される

**整合性テスト**:
- ✅ session-utils.tsのcalculateSessionSummaryと同じ計算結果

**パフォーマンステスト**:
- ✅ 100セッションで200ms以内
- ✅ 500セッションで500ms以内

## 2. テストデータ準備

### 2.1 テストデータセット

**Dataset 1: 基本ケース**
```
目的: 基本的な統計計算の検証
セッション数: 1
半荘数: 1
プレイヤー: 4人（mainUser含む）
データ特性:
  - 点数入力済み
  - chips/parlorFee設定あり
  - ウママークあり
```

**Dataset 2: 複数半荘ケース**
```
目的: chips/parlorFeeの1回カウント検証
セッション数: 1
半荘数: 6
プレイヤー: 4人（mainUser含む）
データ特性:
  - 全半荘で点数入力済み
  - chips/parlorFeeは同一値
  - ウママークは半荘ごとに異なる
```

**Dataset 3: 複数ユーザーケース**
```
目的: selectedUserId切り替え検証
セッション数: 3
半荘数: 各3半荘
プレイヤー: 4人（mainUser + 登録ユーザー3人）
データ特性:
  - 全プレイヤーが全セッションに参加
  - chips/parlorFeeはユーザーごとに異なる
  - ウママークはユーザーごとに異なる成績
```

**Dataset 4: エッジケース**
```
目的: 見学者・未入力の除外検証
セッション数: 1
半荘数: 4
プレイヤー: 4人
データ特性:
  - 半荘1: 全員入力済み
  - 半荘2: 1人が見学者
  - 半荘3: 1人が点数未入力（null）
  - 半荘4: 全員が0点（未入力扱い）
```

**Dataset 5: パフォーマンステスト**
```
目的: 大規模データでのパフォーマンス検証
セッション数: 100, 500
半荘数: 各3半荘
プレイヤー: 4人
データ特性:
  - ランダムな点数・ウママーク
  - chips/parlorFeeはランダム
```

### 2.2 テストデータ生成スクリプト

**基本ケース生成**:
```typescript
// scripts/generate-test-data.ts
import { db } from '@/lib/db'
import { saveSessionWithSummary } from '@/lib/session-utils'

async function generateBasicCase() {
  const mainUserId = 'main-user-fixed-id'

  const sessionData = {
    date: '2025-11-05',
    mode: '4-player' as const,
    rate: 30,
    umaValue: 10,
    chipRate: 100,
    parlorFee: 0,
    umaRule: 'standard' as const,
    hanchans: [
      {
        hanchanNumber: 1,
        autoCalculated: false,
        players: [
          {
            userId: mainUserId,
            playerName: '自分',
            score: 10,
            umaMark: '○○○' as const,
            isSpectator: false,
            chips: 5,
            parlorFee: 500,
            position: 0
          },
          // ... 他3人
        ]
      }
    ]
  }

  await saveSessionWithSummary(sessionData, mainUserId)
}
```

**複数半荘ケース生成**:
```typescript
async function generateMultiHanchanCase() {
  const mainUserId = 'main-user-fixed-id'

  const sessionData = {
    date: '2025-11-05',
    mode: '4-player' as const,
    rate: 30,
    umaValue: 10,
    chipRate: 100,
    parlorFee: 0,
    umaRule: 'standard' as const,
    hanchans: Array.from({ length: 6 }, (_, i) => ({
      hanchanNumber: i + 1,
      autoCalculated: false,
      players: [
        {
          userId: mainUserId,
          playerName: '自分',
          score: (i % 2 === 0) ? 10 : -10,  // 交互にプラス/マイナス
          umaMark: '○' as const,
          isSpectator: false,
          chips: 5,       // ✅ 全半荘で同一値
          parlorFee: 500, // ✅ 全半荘で同一値
          position: 0
        },
        // ... 他3人
      ]
    }))
  }

  await saveSessionWithSummary(sessionData, mainUserId)
}
```

## 3. 機能テストケース

### 3.1 ユーザー切り替えテスト

**テストケース ID**: TC-001

**目的**: selectedUserId変更で全統計が更新されることを確認

**前提条件**:
- Dataset 3（複数ユーザーケース）が存在
- mainUserと登録ユーザー3人がデータに含まれる

**テスト手順**:
1. 分析タブを開く
2. デフォルト（mainUser）の統計を確認・記録
   - 収支統計（totalIncome, totalExpense, totalBalance, totalParlorFee）
   - チップ統計（plusChips, minusChips, chipBalance）
   - スコア統計（plusPoints, minusPoints, pointBalance）
   - 着順統計（averageRank, rankCounts）
3. ユーザー選択で「登録ユーザー1」を選択
4. 統計が更新されることを確認
   - 全統計項目が変化する
   - 収支統計が「登録ユーザー1」の実績を反映
   - チップ統計が「登録ユーザー1」の実績を反映
5. ユーザー選択で「登録ユーザー2」を選択
6. 統計が再度更新されることを確認
7. ユーザー選択でmainUserに戻す
8. 統計が元の値に戻ることを確認

**期待結果**:
- ✅ ユーザー切り替えで全統計が即座に更新される
- ✅ 各ユーザーの実績が正しく反映される
- ✅ mainUserに戻すと元の値に戻る

**判定基準**:
- 手動でsession-utils.tsのcalculateSessionSummaryを実行し、結果を比較
- または、ブラウザのコンソールでlogger.debugの出力を確認

---

### 3.2 chips/parlorFee 1回カウントテスト

**テストケース ID**: TC-002

**目的**: chips/parlorFeeがセッション単位で1回のみカウントされることを確認

**前提条件**:
- Dataset 2（複数半荘ケース）が存在
- 6半荘で全てchips=5, parlorFee=500

**テスト手順**:
1. 分析タブを開く
2. chipStatsを確認
   - plusChips = 5（6半荘分の30ではない）
3. revenueStatsを確認
   - totalParlorFee = 500（6半荘分の3000ではない）
4. ブラウザのコンソールでlogger.debugを確認
   - "チップ統計計算完了"のログでplusChips=5を確認
   - "収支統計計算完了"のログでtotalParlorFee=500を確認

**期待結果**:
- ✅ chips = 5（1回のみカウント）
- ✅ parlorFee = 500（1回のみカウント）

**計算検証**:
```
期待値:
  sessionChips = 5 (最初の半荘から取得、1回のみ)
  sessionParlorFee = 500 (最初の半荘から取得、1回のみ)

間違った実装の場合:
  sessionChips = 5 * 6 = 30 (全半荘で加算)
  sessionParlorFee = 500 * 6 = 3000 (全半荘で加算)
```

---

### 3.3 見学者除外テスト

**テストケース ID**: TC-003

**目的**: 見学者のデータが統計から除外されることを確認

**前提条件**:
- Dataset 4（エッジケース）が存在
- 半荘2で1人が見学者（isSpectator=true）

**テスト手順**:
1. 分析タブを開く
2. 見学者のユーザーを選択
3. 統計を確認
   - 半荘2のデータが統計に含まれない
   - 半荘1, 3の2半荘分のみ集計される

**期待結果**:
- ✅ 見学者の半荘が統計から除外される
- ✅ rankStats.totalHanchans = 2（半荘1, 3のみ）
- ✅ pointStatsも2半荘分のみ集計

---

### 3.4 点数未入力スキップテスト

**テストケース ID**: TC-004

**目的**: 点数未入力（null/0）の半荘が統計から除外されることを確認

**前提条件**:
- Dataset 4（エッジケース）が存在
- 半荘3: score=null
- 半荘4: score=0

**テスト手順**:
1. 分析タブを開く
2. 点数未入力のユーザーを選択
3. 統計を確認
   - 半荘3, 4が統計から除外される
   - 半荘1, 2の2半荘分のみ集計される

**期待結果**:
- ✅ score=nullの半荘が除外される
- ✅ score=0の半荘が除外される
- ✅ rankStats.totalHanchans = 2（半荘1, 2のみ）

## 4. 整合性テストケース

### 4.1 session.summaryとの整合性テスト

**テストケース ID**: TC-101

**目的**: 動的計算の結果がsession.summaryと一致することを確認（mainUserの場合）

**前提条件**:
- Dataset 1, 2, 3のいずれか
- session.summaryが事前計算済み

**テスト手順**:
1. 分析タブを開く（mainUser選択状態）
2. 統計を確認・記録
   - revenueStats.totalBalance
   - chipStats.chipBalance
   - pointStats.pointBalance
   - rankStats.averageRank
3. ブラウザのDevToolsでsession.summaryを確認
   ```javascript
   // Console
   const sessions = await db.sessions.toArray()
   console.log(sessions[0].summary)
   ```
4. 比較
   - revenueStats.totalBalance === session.summary.totalPayout
   - chipStats.chipBalance === session.summary.totalChips
   - rankStats.averageRank === session.summary.averageRank

**期待結果**:
- ✅ 動的計算 === session.summary（完全一致）

**注意**:
- この整合性テストはmainUserの場合のみ有効
- 他のユーザーの場合、session.summaryは存在しない（mainUser専用）

---

### 4.2 calculateSessionSummaryとの整合性テスト

**テストケース ID**: TC-102

**目的**: 動的計算の結果がcalculateSessionSummaryと一致することを確認

**前提条件**:
- 任意のテストデータセット

**テスト手順**:
1. ブラウザのDevToolsで手動計算を実行
   ```javascript
   // Console
   import { calculateSessionSummary } from '@/lib/session-utils'

   const sessionId = 'セッションID'
   const userId = 'ユーザーID'
   const summary = await calculateSessionSummary(sessionId, userId)
   console.log('Expected:', summary)
   ```
2. 分析タブで該当セッション・ユーザーの統計を確認
3. 比較
   - revenueStats.totalBalance === summary.totalPayout
   - chipStats.chipBalance === summary.totalChips
   - rankStats.averageRank === summary.averageRank

**期待結果**:
- ✅ 動的計算 === calculateSessionSummary（完全一致）

## 5. パフォーマンステストケース

### 5.1 中規模データテスト

**テストケース ID**: TC-201

**目的**: 100セッションで200ms以内の応答時間を確認

**前提条件**:
- Dataset 5（100セッション）が存在

**テスト手順**:
1. 分析タブを開く
2. Chrome DevToolsのPerformanceタブで記録開始
3. ユーザー選択を変更
4. 記録停止
5. 「AnalysisTab」の再レンダリング時間を確認
6. ブラウザのコンソールでlogger.debugを確認
   - "収支統計計算完了"の`calculationTime`
   - "チップ統計計算完了"の`calculationTime`

**期待結果**:
- ✅ revenueStats計算時間 < 100ms
- ✅ chipStats計算時間 < 50ms
- ✅ 合計 < 200ms

**判定基準**:
- パフォーマンスログで確認
- React DevTools Profilerで確認

---

### 5.2 大規模データテスト

**テストケース ID**: TC-202

**目的**: 500セッションで500ms以内の応答時間を確認

**前提条件**:
- Dataset 5（500セッション）が存在

**テスト手順**:
- TC-201と同じ

**期待結果**:
- ✅ revenueStats計算時間 < 300ms
- ✅ chipStats計算時間 < 200ms
- ✅ 合計 < 500ms

**判断**:
- 500ms以内なら許容範囲
- 500ms超過ならsession.summary最適化を実装

## 6. UIテストケース

### 6.1 統計表示の正確性テスト

**テストケース ID**: TC-301

**目的**: UI表示が計算結果を正しく反映することを確認

**前提条件**:
- Dataset 1（基本ケース）が存在

**テスト手順**:
1. 分析タブを開く
2. 収支統計カードを確認
   - "+:" の値が正の数
   - "-:" の値が負の数
   - "計:" の値が正確（totalIncome + totalExpense）
   - "うち場代:" の値が正確
3. チップ統計カードを確認
   - "+:" の値が正の数
   - "-:" の値が負の数
   - "計:" の値が正確（plusChips + minusChips）

**期待結果**:
- ✅ UI表示が計算結果と一致
- ✅ 色分けが正しい（プラス=青、マイナス=赤）

---

### 6.2 フィルター連動テスト

**テストケース ID**: TC-302

**目的**: フィルター変更で統計が正しく更新されることを確認

**前提条件**:
- Dataset 3（複数ユーザーケース）が存在
- 複数の日付・モードのセッション

**テスト手順**:
1. 分析タブを開く
2. 期間フィルターを変更（all-time → this-month）
   - 統計が更新される
3. モードフィルターを変更（4-player → 3-player）
   - 統計が更新される
   - 着順統計が4位を表示しなくなる
4. ユーザーフィルターを変更
   - 統計が更新される

**期待結果**:
- ✅ 全フィルターが連動して動作
- ✅ 複数フィルターの組み合わせが正しく適用される

## 7. リグレッションテストケース

### 7.1 既存機能への影響確認

**テストケース ID**: TC-401

**目的**: revenueStats/chipStats修正が他の統計に影響しないことを確認

**前提条件**:
- 任意のテストデータセット

**テスト手順**:
1. 分析タブを開く
2. pointStatsの値を確認
   - 修正前後で値が変わらない
3. rankStatsの値を確認
   - 修正前後で値が変わらない
4. グラフ表示を確認
   - RankStatisticsChartPiePrototypeが正常表示
   - RevenueTimelineChartが正常表示

**期待結果**:
- ✅ pointStats/rankStatsに影響なし
- ✅ グラフ表示に影響なし

---

### 7.2 履歴タブへの影響確認

**テストケース ID**: TC-402

**目的**: 分析タブの修正が履歴タブに影響しないことを確認

**前提条件**:
- 任意のテストデータセット

**テスト手順**:
1. 履歴タブを開く
2. セッション一覧を確認
   - 収支が正しく表示される
3. セッション詳細ダイアログを開く
   - サマリー情報が正しく表示される

**期待結果**:
- ✅ 履歴タブの表示に影響なし
- ✅ session.summaryが正常に使用される

## 8. テスト実行計画

### 8.1 テストフェーズ

**Phase 1: 開発者テスト（実装直後）**
- TC-001: ユーザー切り替えテスト
- TC-002: chips/parlorFee 1回カウントテスト
- TC-101: session.summaryとの整合性テスト
- TC-401: 既存機能への影響確認

**Phase 2: 詳細テスト（Phase 1通過後）**
- TC-003: 見学者除外テスト
- TC-004: 点数未入力スキップテスト
- TC-102: calculateSessionSummaryとの整合性テスト
- TC-301: 統計表示の正確性テスト
- TC-302: フィルター連動テスト

**Phase 3: パフォーマンステスト（Phase 2通過後）**
- TC-201: 中規模データテスト（100セッション）
- TC-202: 大規模データテスト（500セッション）

**Phase 4: リリース前テスト（Phase 3通過後）**
- TC-402: 履歴タブへの影響確認
- 全テストケースの再実行（回帰テスト）

### 8.2 テスト環境

**ブラウザ**:
- Chrome（最新版）
- Safari（最新版）- iOS想定
- Firefox（最新版）- 参考

**デバイス**:
- デスクトップ（開発環境）
- iPhone（実機またはシミュレータ）
- Android（実機またはエミュレータ）

### 8.3 テスト記録

**テスト実行ログ**:
```
テストケース ID: TC-001
実行日時: 2025-11-05 14:00
実行者: 開発者
結果: Pass
備考: 全統計が正しく更新された
```

**バグレポート**:
```
バグID: BUG-001
発見日時: 2025-11-05 14:30
テストケース: TC-002
症状: chips が 30 になっている（期待値: 5）
原因: chipsInitializedフラグが機能していない
修正状況: 修正中
```

## 9. 成功基準

### 9.1 機能テストの成功基準

- ✅ TC-001〜TC-004: 全てPass
- ✅ selectedUserId変更で全統計が更新される
- ✅ chips/parlorFeeがセッション単位で1回のみカウントされる
- ✅ 見学者・未入力データが除外される

### 9.2 整合性テストの成功基準

- ✅ TC-101〜TC-102: 全てPass
- ✅ session.summaryとの完全一致（mainUserの場合）
- ✅ calculateSessionSummaryとの完全一致（全ユーザー）

### 9.3 パフォーマンステストの成功基準

- ✅ TC-201: 100セッションで < 200ms
- ✅ TC-202: 500セッションで < 500ms

### 9.4 リグレッションテストの成功基準

- ✅ TC-401〜TC-402: 全てPass
- ✅ 既存機能（pointStats, rankStats, 履歴タブ）に影響なし

## 10. テスト完了条件

以下の全てを満たした場合、テスト完了とする：

1. **全テストケースがPass**
   - Phase 1〜4の全テストケースがPass
   - バグがゼロまたは許容範囲内

2. **パフォーマンス目標達成**
   - 100セッションで < 200ms
   - 500セッションで < 500ms

3. **整合性の確認**
   - session.summaryとの完全一致
   - calculateSessionSummaryとの完全一致

4. **リグレッションテストPass**
   - 既存機能への影響がない

5. **複数ブラウザでの動作確認**
   - Chrome, Safari, Firefoxで正常動作

6. **モバイル端末での動作確認**
   - iPhone, Androidで正常動作

## 11. 次のステップ

テスト計画作成完了後：

1. **テストデータ準備**
   - Dataset 1〜5の生成スクリプト作成
   - テストデータのインポート

2. **実装**
   - 03-IMPLEMENTATION_SPECIFICATION.mdに従って実装

3. **テスト実行**
   - Phase 1〜4の順に実行
   - バグ発見時は修正→再テスト

4. **ドキュメント更新**
   - MASTER_STATUS_DASHBOARD.mdに進捗記録
   - CLAUDE.mdに完了記録
