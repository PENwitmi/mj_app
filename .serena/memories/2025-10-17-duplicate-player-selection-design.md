# 同一ユーザー重複選択問題の設計完了

## セッションサマリー

**日時**: 2025-10-17 18:26 - 18:45
**タスク**: InputTabにおける同一ユーザー重複選択問題の分析と修正設計
**成果**: 完全な設計ドキュメント作成（分析・設計・統合判断）

## 問題概要

**発見された仕様上の欠陥**:
- InputTabで同じユーザー（登録済み/メインユーザー）を複数のプレイヤー列で選択可能
- データ整合性違反（同一人物が複数回麻雀に参加する不正状態）
- 視覚的フィードバックなし、保存時検証なし

## 設計決定

### 採用アプローチ: Props Drilling + excludeUserIds統合

**データフロー**:
```
InputTab (getExcludeUserIds計算)
  ↓ excludeUserIds: string[]
ScoreInputTable (props橋渡し)
  ↓ excludeUserIds: string[]
PlayerSelect (選択肢フィルタリング)
```

### 重要な設計判断: excludeMainUserとの統合

**従来案**: excludeMainUser + excludeUserIds（段階的移行）
**最終案**: excludeUserIdsのみ（一気に統合）

**判断理由**:
- 公開前プロジェクトのため、後方互換性不要
- 段階的移行のメリットなし
- 単一責務原則（SRP）に準拠
- インターフェースのシンプル化

## 実装設計の要点

### 1. InputTab.tsx

```typescript
const getExcludeUserIds = useCallback(
  (currentPlayerIndex: number): string[] => {
    const excludeIds: string[] = []
    
    // メインユーザーも含める（列1以外）
    if (currentPlayerIndex !== 0 && mainUser) {
      excludeIds.push(mainUser.id)
    }
    
    // 他列選択中のユーザー
    if (hanchans.length > 0) {
      hanchans[0].players.forEach((player, idx) => {
        if (idx !== currentPlayerIndex && player.userId) {
          excludeIds.push(player.userId)
        }
      })
    }
    
    return excludeIds
  },
  [hanchans, mainUser]  // mainUserを依存配列に追加
)
```

### 2. ScoreInputTable.tsx

```typescript
<PlayerSelect
  excludeUserIds={getExcludeUserIds(idx)}  // メインユーザーIDも含む
  // excludeMainUser={true}  ❌ 削除
/>
```

### 3. PlayerSelect.tsx

```typescript
interface PlayerSelectProps {
  excludeUserIds?: string[]  // 統一された除外メカニズム
  // excludeMainUser?: boolean  ❌ 削除
}

const selectableUsers = useMemo(
  () => users.filter(user => !excludeUserIds.includes(user.id)),
  [users, excludeUserIds]
)

const showMainUser = mainUser && !excludeUserIds.includes(mainUser.id)
```

## パフォーマンス分析

**計算量**:
- getExcludeUserIds: O(n) - n=プレイヤー数（最大4）
- フィルタリング: O(n×m) - n=users数（50）, m=excludeIds数（3）
- 実行時間: < 1ms（問題なし）

**最適化**:
- useMemoでフィルタリングをメモ化
- useCallbackでgetExcludeUserIdsをメモ化
- 60fps以上で動作保証

## 実装フェーズ

### Phase 1: コア機能（必須 - 2時間）
1. 型定義追加（10分）
2. PlayerSelect修正（20分）
3. InputTab修正（30分）
4. ScoreInputTable修正（15分）
5. 手動テスト（30分）

### Phase 2: 保存時バリデーション（推奨 - 1時間）
1. hasDuplicatePlayers実装（20分）
2. getDuplicatePlayerInfo実装（15分）
3. handleSave修正（15分）
4. テスト作成（30分）

### Phase 3: UX改善（オプション - 1時間）
- 視覚的インジケーター
- ツールチップ表示
- ホバーエフェクト

## 作成ドキュメント

### 1. 分析レポート
**パス**: `project-docs/2025-10-17-duplicate-player-selection-issue/01-DUPLICATE_PLAYER_ISSUE_ANALYSIS.md`

**内容**:
- 問題の詳細分析（データフロー、発生ケース）
- 影響範囲の特定
- 修正方針の比較検討

### 2. 設計仕様書
**パス**: `project-docs/2025-10-17-duplicate-player-selection-issue/02-DESIGN_SPECIFICATION.md`

**内容**:
- 3つのアプローチ比較（Props Drilling / Context / カスタムフック）
- 詳細な実装設計（型定義、コアロジック、コンポーネント修正）
- パフォーマンス分析
- テスト戦略
- 実装順序

### 3. 統合判断書
**パス**: `project-docs/2025-10-17-duplicate-player-selection-issue/03-DESIGN_REFINEMENT_EXCLUDE_PROPS.md`

**内容**:
- excludeMainUserとexcludeUserIdsの統合検討
- 3つの案の比較（分離 / 統合 / ハイブリッド）
- 単一責務原則（SRP）の解釈
- 公開前プロジェクトにおける判断
- 最終推奨：一気に統合

## 設計の教訓

### 1. 文脈依存の設計判断

**短期的（公開後）**: 段階的移行が正解
**長期的（公開前）**: 一気に理想形が正解

→ **プロジェクトの状態によって最適解は変わる**

### 2. 単一責務原則の柔軟な解釈

- 短期的には2つの責務として正当化可能
- 長期的には統一的な責務に集約すべき
- 実用性と原則のバランスが重要

### 3. Props Drillingの妥当性

**3階層のprops drilling**:
```
InputTab → ScoreInputTable → PlayerSelect
```

**判断基準**:
- 階層が3レベル以下 → 許容範囲
- 状態更新頻度が低い → 問題なし
- Contextは過剰設計 → 不採用

## テスト戦略

### 単体テスト

**getExcludeUserIds**:
- 空の半荘データ → 空配列
- 自分自身の列を含まない
- userId=nullを含まない
- メインユーザーIDを含む（列1以外）

**hasDuplicatePlayers**:
- 重複なし → false
- 重複あり → true
- userId=null重複 → false（許容）

**PlayerSelectフィルタリング**:
- excludeUserIds含むユーザー → 非表示
- excludeUserIds空 → 全ユーザー表示
- メインユーザー → excludeUserIdsで制御

### 統合テスト

- 列2でユーザーA選択 → 列3からユーザーA消える
- 列2をユーザーBに変更 → 列3にユーザーA復活
- 保存時重複チェック → エラーメッセージ

## 次のステップ

**実装準備完了**:
1. 設計レビュー完了
2. 実装方針確定（excludeUserIds統合）
3. Phase 1実装可能（約2時間）

**実装時の注意点**:
- メインユーザーIDをexcludeUserIdsに含めるロジック
- PlayerSelectからexcludeMainUser完全削除
- useCallbackの依存配列にmainUser追加
- テストケースの網羅

## 設計の成果

**達成**:
- ✅ 問題の完全な分析（データフロー、影響範囲）
- ✅ 3つのアプローチの比較検討
- ✅ 最適設計の選択（Props Drilling + 統合）
- ✅ 詳細な実装設計（コード例付き）
- ✅ パフォーマンス分析（< 1ms）
- ✅ テスト戦略の策定
- ✅ 段階的実装計画（Phase 1-3）
- ✅ 統合判断（excludeMainUser削除）

**未実装**:
- コードの実装（Phase 1-3）
- 実際のテスト実行
- 動作確認

---

**セッション完了: 2025-10-17 18:45**
**次回セッション**: Phase 1実装開始
