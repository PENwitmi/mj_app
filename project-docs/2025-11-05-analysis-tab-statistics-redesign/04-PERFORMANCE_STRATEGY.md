# パフォーマンス戦略 - 分析タブ統計機能

## 1. パフォーマンス目標

### 1.1 応答時間目標

| 操作 | 目標時間 | 許容時間 | データ量 |
|-----|---------|---------|---------|
| フィルター切り替え（ユーザー） | 100ms | 200ms | 100セッション |
| フィルター切り替え（期間） | 100ms | 200ms | 100セッション |
| フィルター切り替え（モード） | 100ms | 200ms | 100セッション |
| 初期表示 | 300ms | 500ms | 100セッション |
| タブ切り替え（分析タブへ） | 200ms | 300ms | 100セッション |

### 1.2 スケーラビリティ目標

| データ量 | 想定ケース | 目標時間 |
|---------|----------|---------|
| 10セッション | 初心者（1ヶ月） | < 50ms |
| 50セッション | 中級者（3ヶ月） | < 100ms |
| 100セッション | 上級者（6ヶ月） | < 200ms |
| 500セッション | ヘビーユーザー（2年） | < 500ms |

**想定**:
- 平均3半荘/セッション
- 500セッション = 1500半荘 = 6000 PlayerResult

## 2. 現在のパフォーマンス分析

### 2.1 計算量分析

**filteredSessions計算**:
```
O(N) where N = セッション数
- filterSessionsByPeriod: O(N)
- filterSessionsByMode: O(N)
- user participation filter: O(N * H * P)
  where H = 平均半荘数/セッション, P = 平均プレイヤー数/半荘
```

**hanchans収集**:
```
O(N * H) where N = filteredSessions数, H = 平均半荘数/セッション
```

**rankStats計算**:
```
O(H * P * log P)
- H = 全半荘数（filteredSessions内）
- P = プレイヤー数/半荘（3 or 4）
- log P はソートのコスト（点数降順）
```

**revenueStats/chipStats/pointStats計算**:
```
O(N * H * P)
- N = filteredSessions数
- H = 平均半荘数/セッション
- P = プレイヤー数/半荘（userResult検索）
```

**合計計算量**:
```
O(N * H * P) = 最悪ケース O(500 * 3 * 4) = O(6000)
```

**評価**: ✅ 許容範囲内（現代のブラウザで十分高速）

### 2.2 メモリ使用量分析

**filteredSessions**:
```
メモリ: O(N * H * P) = 100セッション × 3半荘 × 4人 = 1200オブジェクト
各PlayerResult ≈ 200 bytes
合計 ≈ 240KB
```

**hanchans配列**:
```
メモリ: O(H) = 300半荘（参照のみ、コピーなし）
合計 ≈ 数KB
```

**統計結果**:
```
メモリ: O(1) = 各統計4-5個の数値のみ
合計 ≈ 数百bytes
```

**合計メモリ**:
```
≈ 300KB（100セッションの場合）
```

**評価**: ✅ 許容範囲内（モバイル端末でも問題なし）

## 3. useMemoの最適化戦略

### 3.1 依存配列の設計原則

**原則1: 必要最小限の依存**
- 過剰な依存 → 不要な再計算
- 不足な依存 → 古いデータの表示（バグ）

**原則2: プリミティブ値の使用**
- ✅ `selectedUserId` (string)
- ✅ `selectedPeriod` (string)
- ✅ `selectedMode` (string)
- ❌ オブジェクト/配列（参照が毎回変わる）

**原則3: 派生状態の依存関係**
```
sessions → filteredSessions → hanchans → rankStats
                            ↓
                   revenueStats/chipStats/pointStats
```

### 3.2 依存配列の最適化

**filteredSessions**:
```typescript
const filteredSessions = useMemo(() => {
  // ...
}, [sessions, selectedPeriod, selectedMode, selectedUserId])
```

**最適化ポイント**:
- `sessions`は`useSessions`フックから取得（変更時のみ更新）
- プリミティブ値のみ依存（string）
- ✅ 最適

**hanchans**:
```typescript
const hanchans = useMemo(() => {
  // ...
}, [filteredSessions])
```

**最適化ポイント**:
- `filteredSessions`のみ依存（派生状態）
- ✅ 最適

**統計計算**:
```typescript
const revenueStats = useMemo(() => {
  // ...
}, [filteredSessions, selectedUserId])
```

**最適化ポイント**:
- `filteredSessions`で既にフィルタリング済み
- `selectedUserId`で個別計算
- `session`オブジェクトは依存配列に不要（filteredSessions内に含まれる）
- ✅ 最適

### 3.3 不要な再計算の回避

**シナリオ1: selectedUserIdのみ変更**
```
selectedUserId変更
  ↓
filteredSessions再計算（ユーザー参加フィルター）
  ↓
hanchans再計算（filteredSessions変更のため）
  ↓
全統計再計算（filteredSessions/hanchans変更のため）
```

**評価**: ✅ 必要な再計算のみ（最適化の余地なし）

**シナリオ2: selectedPeriodのみ変更**
```
selectedPeriod変更
  ↓
filteredSessions再計算（期間フィルター）
  ↓
hanchans再計算（filteredSessions変更のため）
  ↓
全統計再計算（filteredSessions/hanchans変更のため）
```

**評価**: ✅ 必要な再計算のみ（最適化の余地なし）

**シナリオ3: タブ切り替え（分析タブ非表示→表示）**
```
タブ切り替え
  ↓
AnalysisTabコンポーネント再マウント
  ↓
全useMemo初回実行
```

**評価**: ✅ 初回のみ（その後はキャッシュ）

## 4. 早期リターンの最適化

### 4.1 空配列チェック

**全統計で実装**:
```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null  // 早期リターン

  // メインロジック（実行されない）
}, [filteredSessions, selectedUserId])
```

**効果**:
- フィルター結果が0件の場合、即座にnullを返す
- メインロジックの実行をスキップ（数ミリ秒の節約）

### 4.2 短絡評価の活用

**hanchanループ内**:
```typescript
hanchans.forEach(hanchan => {
  const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)

  // ✅ 短絡評価による早期リターン
  if (!userResult || userResult.isSpectator || userResult.score === null || userResult.score === 0) {
    return  // この半荘をスキップ
  }

  // メインロジック
})
```

**効果**:
- 見学者・未入力の半荘を即座にスキップ
- 不要な計算を避ける

### 4.3 chipsInitializedフラグ

**chipStats**:
```typescript
for (const hanchan of hanchans) {
  // ...
  if (!chipsInitialized) {
    sessionChips = userResult.chips || 0
    chipsInitialized = true
    break  // ✅ ループを即座に終了
  }
}
```

**効果**:
- 最初の有効な半荘でchipsを取得したらループを終了
- 不要なループ継続を避ける

## 5. ループ最適化

### 5.1 forEach vs for...of vs for

**forEach** (現在の実装):
```typescript
filteredSessions.forEach(({ session, hanchans }) => {
  // ...
})
```

**利点**:
- コードが読みやすい
- 関数スコープで変数の隔離

**欠点**:
- breakが使えない（早期終了不可）

**for...of**:
```typescript
for (const { session, hanchans } of filteredSessions) {
  // ...
}
```

**利点**:
- breakが使える
- forEachとほぼ同等の可読性

**評価**:
- **revenueStats/pointStats**: forEachで問題なし（全セッション処理が必要）
- **chipStats**: for...ofが最適（break使用）

### 5.2 find vs filter

**現在の実装**:
```typescript
const userResult = hanchan.players.find((p: PlayerResult) => p.userId === selectedUserId)
```

**評価**: ✅ 最適
- `find`は最初の一致で停止（O(P)、最悪ケース）
- `filter`は全要素をスキャン（常にO(P)）

### 5.3 不要な中間配列の回避

**❌ 中間配列を作成**:
```typescript
const sessionPayouts = filteredSessions.map(({ session, hanchans }) => {
  // セッションの収支を計算
  return sessionPayout
})

const totalIncome = sessionPayouts.filter(p => p >= 0).reduce((sum, p) => sum + p, 0)
const totalExpense = sessionPayouts.filter(p => p < 0).reduce((sum, p) => sum + p, 0)
```

**✅ 直接集計**:
```typescript
let totalIncome = 0
let totalExpense = 0

filteredSessions.forEach(({ session, hanchans }) => {
  // セッションの収支を計算
  if (sessionPayout >= 0) {
    totalIncome += sessionPayout
  } else {
    totalExpense += sessionPayout
  }
})
```

**効果**:
- メモリ使用量削減（中間配列不要）
- ループ回数削減（1回のみ）

## 6. session.summaryの活用可能性

### 6.1 mainUserの場合の最適化案

**現在の設計**: 全ユーザーで動的計算

**最適化案**: mainUserの場合のみsession.summaryを使用
```typescript
const revenueStats = useMemo(() => {
  if (filteredSessions.length === 0) return null

  // ✅ mainUserの場合は session.summary を使用（高速）
  if (selectedUserId === mainUser?.id) {
    let totalIncome = 0
    let totalExpense = 0
    let totalParlorFee = 0

    filteredSessions.forEach(({ session }) => {
      if (session.summary) {
        const totalPayout = session.summary.totalPayout
        totalParlorFee += session.summary.totalParlorFee

        if (totalPayout >= 0) {
          totalIncome += totalPayout
        } else {
          totalExpense += totalPayout
        }
      }
    })

    return {
      totalIncome,
      totalExpense,
      totalParlorFee,
      totalBalance: totalIncome + totalExpense
    }
  }

  // その他のユーザーは動的計算
  // ...
}, [filteredSessions, selectedUserId, mainUser?.id])
```

**効果**:
- mainUser（最も頻繁に使用）の場合、計算時間が大幅短縮
- O(N * H * P) → O(N)

**トレードオフ**:
- コード複雑性の増加
- mainUser?.idを依存配列に追加（通常は変わらない）

**判断**: 🔄 将来的な最適化として検討
- 現在の動的計算でパフォーマンス問題がなければ不要
- 500セッション以上でパフォーマンス問題が発生した場合に実装

### 6.2 パフォーマンス測定の必要性

**測定ポイント**:
```typescript
const revenueStats = useMemo(() => {
  const startTime = performance.now()

  // 計算ロジック...

  const endTime = performance.now()
  logger.debug('revenueStats計算時間', {
    context: 'AnalysisTab.revenueStats',
    data: {
      sessionCount: filteredSessions.length,
      calculationTime: `${(endTime - startTime).toFixed(2)}ms`
    }
  })

  return result
}, [filteredSessions, selectedUserId])
```

**開発時のみ測定**:
```typescript
if (import.meta.env.DEV) {
  // パフォーマンス測定
}
```

## 7. React DevTools Profilerの活用

### 7.1 プロファイリング手順

1. **React DevTools Profilerを開く**
   - Chrome DevTools → React → Profiler

2. **記録開始**
   - 「Record」ボタンをクリック

3. **操作実行**
   - ユーザー切り替え
   - 期間フィルター変更
   - モードフィルター変更

4. **記録停止**
   - 「Stop」ボタンをクリック

5. **結果分析**
   - AnalysisTabの再レンダリング時間を確認
   - useMemoの効果を確認

### 7.2 期待される結果

**最適化前** (session.summary依存):
```
AnalysisTab
  └─ revenueStats useMemo: 5ms (100セッション)
  └─ chipStats useMemo: 3ms (100セッション)
  └─ Total: 8ms
```

**最適化後** (動的計算):
```
AnalysisTab
  └─ revenueStats useMemo: 15ms (100セッション)
  └─ chipStats useMemo: 10ms (100セッション)
  └─ Total: 25ms
```

**評価**: ✅ 25ms増加は許容範囲内（目標200ms以内）

## 8. パフォーマンステストケース

### 8.1 小規模データ（10セッション）

**データ**:
- 10セッション × 3半荘 × 4人 = 120 PlayerResult

**期待結果**:
- フィルター切り替え: < 50ms
- 初期表示: < 100ms

### 8.2 中規模データ（100セッション）

**データ**:
- 100セッション × 3半荘 × 4人 = 1200 PlayerResult

**期待結果**:
- フィルター切り替え: < 200ms
- 初期表示: < 500ms

### 8.3 大規模データ（500セッション）

**データ**:
- 500セッション × 3半荘 × 4人 = 6000 PlayerResult

**期待結果**:
- フィルター切り替え: < 500ms
- 初期表示: < 1000ms

**判断**:
- 500ms以内なら許容範囲
- 1000ms以上ならsession.summary最適化を検討

## 9. モバイル端末での最適化

### 9.1 低スペック端末での考慮事項

**想定端末**:
- iPhone 8 (A11 Bionic, 2017年)
- Android中級機（Snapdragon 600シリーズ）

**対策**:
1. **useMemoの徹底**（既に実装済み）
2. **不要な再レンダリング防止**（React.memoの検討）
3. **大規模データでのページネーション**（将来的な改善）

### 9.2 React.memoの検討

**現在**: AnalysisTabは毎回再レンダリング

**最適化案**: 子コンポーネントをReact.memoでラップ
```typescript
// AnalysisFilters.tsx
export const AnalysisFilters = React.memo(function AnalysisFilters({
  selectedUserId,
  selectedPeriod,
  selectedMode,
  // ...
}) {
  // ...
})
```

**効果**:
- Props不変の場合、再レンダリングをスキップ
- 統計計算中でもUIが固まらない

**判断**: 🔄 将来的な最適化として検討
- 現在のパフォーマンスで問題なければ不要

## 10. パフォーマンスモニタリング

### 10.1 開発モードでの自動測定

**実装案**:
```typescript
function usePerformanceMonitor(name: string, value: any) {
  const prevTimeRef = useRef<number>(0)

  useEffect(() => {
    if (import.meta.env.DEV) {
      const now = performance.now()
      const duration = prevTimeRef.current > 0 ? now - prevTimeRef.current : 0

      logger.debug(`${name} 更新`, {
        context: 'PerformanceMonitor',
        data: {
          duration: `${duration.toFixed(2)}ms`,
          value: JSON.stringify(value).substring(0, 100)
        }
      })

      prevTimeRef.current = now
    }
  }, [name, value])
}

// 使用例
usePerformanceMonitor('revenueStats', revenueStats)
usePerformanceMonitor('chipStats', chipStats)
```

**判断**: 🔄 必要に応じて実装
- 現在はlogger.debugで十分
- 継続的なモニタリングが必要になったら検討

### 10.2 本番環境でのパフォーマンス収集

**実装案**: Web Vitals API
```typescript
import { onCLS, onFID, onLCP } from 'web-vitals'

onLCP(console.log)  // Largest Contentful Paint
onFID(console.log)  // First Input Delay
onCLS(console.log)  // Cumulative Layout Shift
```

**判断**: 🔄 将来的な実装
- 現在は開発フェーズ（不要）
- 本番リリース後に検討

## 11. パフォーマンス最適化のチェックリスト

### 11.1 実装時チェック

- [x] useMemoの適切な使用
- [x] 依存配列の正確性
- [x] 早期リターンの実装
- [x] 不要な中間配列の回避
- [x] findの使用（filterではない）
- [x] chipsInitialized + breakの使用
- [ ] React.memoの検討（将来）
- [ ] session.summary最適化の検討（500セッション以上で必要な場合）

### 11.2 テスト時チェック

- [ ] 小規模データ（10セッション）< 50ms
- [ ] 中規模データ（100セッション）< 200ms
- [ ] 大規模データ（500セッション）< 500ms
- [ ] モバイル端末での動作確認
- [ ] React DevTools Profilerでの分析

### 11.3 リリース前チェック

- [ ] 本番データでのパフォーマンステスト
- [ ] 低スペック端末での動作確認
- [ ] パフォーマンスログの確認（異常な遅延がないか）

## 12. 次のステップ

**05-TEST_PLAN.md**: テスト計画と検証方法
- ユーザー切り替えテスト
- 複数セッション・複数半荘テスト
- パフォーマンステスト
- session-utils.tsとの整合性テスト
