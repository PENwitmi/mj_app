# Issue #16 ユーザー間ランキング機能 設計書

## 1. 現状分析

### 1.1 現在のAnalysisTab構成

```
AnalysisTab
├── AnalysisFilters (フィルターUI)
│   ├── ユーザー選択 (select): mainUser + 登録ユーザー
│   ├── 期間選択 (select): 今月/今年/年別/全期間
│   └── モードタブ: 4人打ち/3人打ち/全体
│
└── 統計表示
    ├── 基本成績カード (BasicStats)
    ├── 記録カード (RecordStats)
    └── DetailStatsTabs (着順/収支/スコア/チップ)
```

### 1.2 現在のデータフロー

```
useSessions(mainUserId) → sessions
    ↓
フィルター適用 (期間, モード, ユーザー参加)
    ↓
calculateAllStatistics(sessions, userId, mode)
    ↓
個人統計表示
```

## 2. 設計方針

### 2.1 アプローチ: 表示モード切り替え

```
AnalysisFilters
├── 表示モード: [個人統計] / [全ユーザー比較]  ← 新規追加
├── ユーザー選択 (個人統計モード時のみ有効)
├── 期間選択
└── モードタブ
```

**個人統計モード**: 既存の動作（変更なし）
**全ユーザー比較モード**: 新規ランキング表示

### 2.2 コンポーネント構成（案）

```
src/components/analysis/
├── AnalysisFilters.tsx      # 修正: 表示モード切り替え追加
├── UserRankingView.tsx      # 新規: ランキング表示コンテナ
├── RankingSection.tsx       # 新規: ランキングセクション（カテゴリ別）
└── RankingItem.tsx          # 新規: ランキング行（1ユーザー分）
```

## 3. UI設計

### 3.1 フィルター部分

```
┌─────────────────────────────────────────────────┐
│ 表示モード                                        │
│ ┌─────────────────┐ ┌─────────────────┐          │
│ │   個人統計     │ │ 全ユーザー比較 │ ← セグメント │
│ └─────────────────┘ └─────────────────┘          │
├─────────────────────────────────────────────────┤
│ ユーザー        期間                              │
│ [自分    ▼]    [全期間  ▼]                       │
│ ↑ 比較モード時は非活性 or 非表示                  │
├─────────────────────────────────────────────────┤
│ [4人打ち] [3人打ち] [全体]                        │
└─────────────────────────────────────────────────┘
```

### 3.2 ランキング表示部分

```
┌─────────────────────────────────────────────────┐
│ 📊 基本成績ランキング                             │
├─────────────────────────────────────────────────┤
│ 平均着順                                         │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🥇 1位  田中    2.15位                      │ │
│ │ 🥈 2位  鈴木    2.32位                      │ │
│ │ 🥉 3位  自分    2.45位  ← ハイライト        │ │
│ │    4位  佐藤    2.67位                      │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ トップ率                                         │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🥇 1位  鈴木    35.2%                       │ │
│ │ 🥈 2位  自分    28.5%  ← ハイライト         │ │
│ │ ...                                         │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 💰 収支ランキング                                │
├─────────────────────────────────────────────────┤
│ 通算収支                                         │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🥇 1位  田中    +125,000pt                  │ │
│ │ 🥈 2位  自分    +82,300pt  ← ハイライト     │ │
│ │ ...                                         │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 3.3 ランキングカテゴリ

#### 基本成績ランキング
| 項目 | ソート順 | 表示形式 |
|-----|---------|---------|
| 平均着順 | 昇順（低いほど上位） | X.XX位 |
| トップ率 | 降順 | XX.X% |
| 連対率 | 降順 | XX.X% |
| ラス回避率 | 降順 | XX.X% |

#### 収支ランキング
| 項目 | ソート順 | 表示形式 |
|-----|---------|---------|
| 通算収支 | 降順 | ±XXX,XXXpt |
| 平均収支/セッション | 降順 | ±X,XXXpt |

#### 記録ランキング
| 項目 | ソート順 | 表示形式 |
|-----|---------|---------|
| 半荘最高得点 | 降順 | +XX,XXX点 |
| 参加半荘数 | 降順 | XXX半荘 |
| 参加セッション数 | 降順 | XX回 |

## 4. データフロー設計

### 4.1 全体フロー

```
┌────────────────────────────────────────────────────────┐
│ AnalysisTab                                             │
│                                                         │
│   viewMode === 'comparison' ?                           │
│       │                                                 │
│       ├─ Yes → UserRankingView                          │
│       │           │                                     │
│       │           ├─ useAllUsersRanking(sessions, mode) │
│       │           │       │                             │
│       │           │       ├─ 全ユーザー取得             │
│       │           │       ├─ 各ユーザーの統計計算       │
│       │           │       └─ ソート・ランキング生成     │
│       │           │                                     │
│       │           └─ RankingSection × N                 │
│       │                                                 │
│       └─ No → 既存の個人統計表示                        │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### 4.2 新規Hook: useAllUsersRanking

```typescript
interface UserRankingData {
  userId: string
  userName: string
  isMainUser: boolean
  stats: {
    // 基本成績
    averageRank?: number       // 全体モード時はundefined
    topRate?: number           // 1位率
    rentaiRate?: number        // 連対率
    lastAvoidRate?: number     // ラス回避率

    // 収支
    totalRevenue: number       // 通算収支
    averageRevenuePerSession: number

    // 記録
    maxScore: number           // 半荘最高得点
    totalHanchans: number      // 参加半荘数
    totalSessions: number      // 参加セッション数
  }
}

interface RankingEntry {
  rank: number
  user: UserRankingData
  value: number | string       // ランキング対象の値
}

interface UseAllUsersRankingResult {
  rankings: {
    averageRank: RankingEntry[]
    topRate: RankingEntry[]
    rentaiRate: RankingEntry[]
    lastAvoidRate: RankingEntry[]
    totalRevenue: RankingEntry[]
    averageRevenue: RankingEntry[]
    maxScore: RankingEntry[]
    totalHanchans: RankingEntry[]
    totalSessions: RankingEntry[]
  }
  loading: boolean
  error: Error | null
}

function useAllUsersRanking(
  sessions: SessionWithSummary[],
  mode: GameMode | 'all',
  mainUserId: string
): UseAllUsersRankingResult
```

### 4.3 計算ロジック

```typescript
// 1. 全ユーザー取得
const allUsers = [mainUser, ...registeredUsers]

// 2. 各ユーザーの統計計算
const userStats = allUsers.map(user => {
  // ユーザーが参加しているセッションをフィルタ
  const userSessions = filterSessionsByUser(sessions, user.id)

  // 統計計算（既存ロジック流用）
  const stats = calculateAllStatistics(userSessions, user.id, mode)
  const rankStats = calculateRankStatistics(...)
  const recordStats = calculateRecordStatistics(...)

  return { userId: user.id, userName: user.name, stats: {...} }
})

// 3. ランキング生成（各項目でソート）
const rankings = {
  averageRank: sortByAsc(userStats, 'averageRank'),
  topRate: sortByDesc(userStats, 'topRate'),
  // ...
}
```

## 5. ファイル変更一覧

### 5.1 新規作成

| ファイル | 説明 |
|---------|------|
| `UserRankingView.tsx` | ランキング表示コンテナ |
| `RankingSection.tsx` | カテゴリ別ランキングセクション |
| `useAllUsersRanking.ts` | ランキング計算Hook |

### 5.2 修正

| ファイル | 変更内容 |
|---------|---------|
| `AnalysisFilters.tsx` | 表示モード切り替え追加 |
| `AnalysisTab.tsx` | モード分岐、ランキング表示統合 |

## 6. 実装順序

1. **Phase 1**: 型定義・Hook作成
   - `useAllUsersRanking` Hook
   - ランキング計算ロジック

2. **Phase 2**: UI実装
   - `UserRankingView` コンポーネント
   - `RankingSection` コンポーネント

3. **Phase 3**: 統合
   - `AnalysisFilters` に表示モード追加
   - `AnalysisTab` で分岐処理

4. **Phase 4**: テスト・調整
   - 動作確認
   - UI調整

## 7. 検討事項

### 7.1 パフォーマンス

- ユーザー数が多い場合の計算負荷
- → `useMemo` で適切にメモ化
- → 必要に応じて計算を分割

### 7.2 エッジケース

- ユーザーが1人のみの場合 → ランキング表示は可能だが意味が薄い
- セッション0件のユーザー → ランキングから除外 or 「データなし」表示
- 同点の場合 → 同順位表示（例: 1位、1位、3位）

### 7.3 UI/UX

- ランキング項目が多い → タブ or アコーディオンで整理?
- モバイル表示の考慮
- ハイライト表示のアクセシビリティ

---

**作成日**: 2025-12-03
**Issue**: #16
**ステータス**: 設計レビュー待ち
