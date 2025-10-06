# Phase 5 Architecture Fix Session - 2025-10-06

## Session Summary

**Task**: AnalysisTab アーキテクチャ統一（メインユーザー表示対応）
**Status**: 実装計画完了 → 実装待ち
**Duration**: 約2時間（調査・設計）

---

## 問題発見

### 初期状態
- Phase 5 (AnalysisTab) 実装完了と判断していた
- ユーザーから「自分のデータが見れない」という指摘

### 調査結果
**問題点**:
1. AnalysisTab が他タブと異なるアーキテクチャパターン使用
2. 内部で `useUsers()` を呼び出し、App.tsx との状態二重管理
3. `mainUser` を AnalysisFilters に渡していない
4. ユーザー選択ドロップダウンに「自分」が表示されない

**アーキテクチャ不統一の詳細**:
```
InputTab/HistoryTab (正しいパターン):
  App.tsx → mainUser, users props → Tab → 子コンポーネント

AnalysisTab (問題あり):
  App.tsx → props なし → Tab (内部でuseUsers呼び出し) → 子コンポーネント
```

---

## 設計判断プロセス

### アプローチ検討

**アプローチA (採用)**: 既存パターンへの統一
- App.tsx から props を受け取る形式に変更
- InputTab/HistoryTab と同じ Container/Presentational パターン
- 状態管理の一元化 (App.tsx = Single Source of Truth)

**アプローチB (非採用)**: 現状パターンのまま修正
- 内部で useUsers() を維持
- allUsers = [mainUser, ...activeUsers] で統合リスト作成
- mainUserId を別途渡す

### 判断理由
1. **アーキテクチャの一貫性が最優先**
2. **状態管理のベストプラクティス準拠**
3. **拡張性の確保**
4. **変更コストが低い** (3ファイル、25-30行)
5. **既存パターンの再利用** (InputTab/HistoryTab/PlayerSelect で実証済み)

---

## 実装計画

### 変更ファイル (3ファイル)

**1. AnalysisTab.tsx**:
- Props インターフェース追加 (AnalysisTabProps)
- 関数シグネチャ変更 (useUsers 削除、props 受け取り)
- AnalysisFilters への mainUser prop 追加
- import 修正 (User 型追加、useUsers 削除)

**2. AnalysisFilters.tsx**:
- Props 拡張 (mainUser: User | null 追加)
- 関数パラメータ追加
- UI 修正 (「自分」表示追加、PlayerSelect パターン参考)

**3. App.tsx**:
- AnalysisTab への props 配線 (mainUser, users, addNewUser)

### 実装順序
1. AnalysisTab.tsx 修正
2. AnalysisFilters.tsx 修正
3. App.tsx 修正
4. ビルド確認 (TypeScript + Vite)
5. 動作確認 (Dev server)
6. ドキュメント更新

---

## ドキュメント作成

**作成済み**: `project-docs/2025-10-05-phase5-analysis-tab/03-ARCHITECTURE_UNIFICATION_PLAN.md`

**内容**:
- 目的と背景
- 変更概要 (3ファイル、25-30行の変更)
- 詳細実装手順 (Step 1-5)
- 実装順序
- リスク管理
- 完了判定基準
- 変更ファイルサマリー
- 学習ポイント

---

## Key Learnings

### アーキテクチャパターン

**Container/Presentational パターン**:
- Container (App.tsx): 状態管理担当
- Presentational (各Tab): UI レンダリングのみ

**Single Source of Truth**:
- 状態は一箇所 (App.tsx) で管理
- Props drilling で子コンポーネントに渡す
- 状態の二重管理を避ける

**Props Injection**:
- 依存性注入パターン
- テスタビリティ向上
- コンポーネント再利用性向上

### 既存コード参照の重要性

**Phase 5 初期実装の教訓**:
- 着順計算を umaMark から判定していた問題
- 既存の `calculateRanks()` を参照せずに実装
- ユーザーから「既存のコードを何も読まずに実装したということが丸わかり」という指摘

**今回の対応**:
- InputTab/HistoryTab/PlayerSelect の既存パターンを詳細に調査
- Serena MCP の symbol 検索ツールを活用
- 既存実装との整合性を最優先

### React ベストプラクティス

**状態管理**:
- 最小限の状態管理スコープ
- 必要な場所でのみ状態を持つ
- Props drilling は 1-2 階層なら許容

**コンポーネント設計**:
- 単一責任の原則
- 疎結合・高凝集
- 既存パターンの踏襲

---

## Next Steps

1. ユーザーの実装開始許可待ち
2. 実装計画に基づいた段階的実装
3. TypeScript コンパイル確認
4. Vite ビルド確認
5. 動作確認
6. ドキュメント更新 (実装計画、ダッシュボード)

---

## Technical Context

### Project Architecture

**Tab Structure**:
```
App.tsx (Single Source of Truth)
  ├─ useUsers() → { mainUser, activeUsers, archivedUsers }
  ├─ InputTab({ mainUser, users: activeUsers, addNewUser })
  ├─ HistoryTab({ mainUser, users: activeUsers, addNewUser })
  ├─ AnalysisTab({ mainUser, users: activeUsers, addNewUser })  ← 統一予定
  └─ SettingsTab({ mainUser, activeUsers, archivedUsers, ... })
```

**User Data Flow**:
```
db.users (IndexedDB)
  ↓
getMainUser() → mainUser (isMainUser: true)
getRegisteredUsers() → activeUsers (isMainUser: false, isArchived: false)
getArchivedUsers() → archivedUsers (isArchived: true)
  ↓
App.tsx useUsers()
  ↓
各Tab (props)
  ↓
UI Components
```

### Key Files

**Modified Files**:
- `app/src/components/tabs/AnalysisTab.tsx` (現在 224行)
- `app/src/components/analysis/AnalysisFilters.tsx` (現在 89行)
- `app/src/App.tsx` (現在 114行)

**Reference Files**:
- `app/src/components/tabs/InputTab.tsx` (688行) - Props パターン参考
- `app/src/components/tabs/HistoryTab.tsx` - Props パターン参考
- `app/src/components/PlayerSelect.tsx` (128行) - 「自分」表示 UI パターン参考
- `app/src/hooks/useUsers.ts` (115行) - 状態管理参考

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| TypeScript errors | Low | Medium | 既存パターンの正確な模倣 |
| State sync errors | Very Low | Medium | Props drilling のみでシンプル |
| UI display bugs | Low | Low | PlayerSelect パターン再利用 |
| Performance degradation | None | - | 変更なし (既存 useMemo 維持) |

---

## Session Metadata

- **Session Start**: 2025-10-06 (調査開始)
- **Problem Identified**: AnalysisTab メインユーザー表示不可
- **Investigation**: 既存タブとの比較、アーキテクチャ分析
- **Design Decision**: アプローチA採用 (既存パターン統一)
- **Planning Complete**: 実装計画ドキュメント作成完了
- **Implementation Status**: 待機中 (ユーザー許可待ち)
- **Estimated Implementation Time**: 30分
