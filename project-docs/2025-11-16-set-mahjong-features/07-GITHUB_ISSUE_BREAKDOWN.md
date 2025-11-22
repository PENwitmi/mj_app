# GitHub Issue分割計画

**作成日**: 2025-11-18 01:26
**目的**: セット麻雀特化機能をGitHub Issueに分割して管理するための整理

---

## 📋 Issue階層構造の方針

### 採用方式: Epic（Label方式） + Individual Issues

**理由**:
- Sub-issuesはUI操作必須（gh CLI未対応）
- Epic Label方式なら `gh label create` で完結
- Projects V2でのフィルタリングが容易

**Epic Label**:
```bash
gh label create "epic:phase1-set-features" \
  --description "Phase 1: セット麻雀特化機能" \
  --color "0052CC"
```

---

## 🎯 Issue分割構造（全6 Issues）

### Epic: Phase 1 - セット麻雀特化機能

**Epic Label**: `epic:phase1-set-features`

#### グループ1: 履歴タブ改善（3 Issues）

##### Issue #1: [履歴] セッション詳細ダイアログに合計表示を追加
**優先度**: `priority-high`
**ラベル**: `epic:phase1-set-features`, `feature`, `priority-high`
**見積**: 0.5日

**説明**:
セッション詳細ダイアログの総収支タブに、全プレイヤーの合計表示エリアを追加する。

**実装内容**:
- 総収支（全プレイヤー合計）: ゼロサム確認用
- 総ポイント（全プレイヤー合計）
- チップ合計（全プレイヤー合計）
- 場代合計（全プレイヤー合計）

**関連ドキュメント**:
- `project-docs/2025-11-16-set-mahjong-features/01-FEATURE_IDEAS.md` (L163-182)
- `project-docs/2025-11-16-set-mahjong-features/06-HISTORY_ANALYSIS_TABS_ROADMAP.md` (L12-43)

**修正ファイル**:
- `src/components/SessionDetailDialog.tsx`

**成功条件**:
- [ ] セッション詳細ダイアログに合計セクションが表示される
- [ ] 4つの合計値（総収支/ポイント/チップ/場代）が正しく計算される
- [ ] ゼロサム原則が確認できる（総収支=0）

---

##### Issue #2: [履歴] セッション共有機能（クリップボード）を実装
**優先度**: `priority-high`
**ラベル**: `epic:phase1-set-features`, `feature`, `priority-high`
**見積**: 0.5日

**説明**:
セッション詳細ダイアログに「📋 結果をコピー」ボタンを追加し、セッション結果をテキスト形式でクリップボードにコピーできるようにする。

**実装内容**:
- テキストフォーマット生成（日付、モード、半荘数、各プレイヤーの結果）
- クリップボードAPI実装（フォールバック含む）
- トースト通知

**出力例**:
```
📊 2025-11-18 金曜麻雀会
4人打ち・3半荘・標準ウマ

1位 山田太郎  +15,000円
2位 佐藤花子   +5,000円
3位 鈴木一郎   -8,000円
4位 田中次郎  -12,000円

麻雀アプリで記録
```

**関連ドキュメント**:
- `project-docs/2025-11-16-set-mahjong-features/03-SESSION_SHARE_CLIPBOARD.md`
- `project-docs/2025-11-16-set-mahjong-features/06-HISTORY_ANALYSIS_TABS_ROADMAP.md` (L45-92)

**新規ファイル**:
- `src/lib/share-utils.ts`

**修正ファイル**:
- `src/components/SessionDetailDialog.tsx`

**成功条件**:
- [ ] 「📋 結果をコピー」ボタンが表示される
- [ ] クリックでクリップボードにコピーされる
- [ ] トースト通知が表示される
- [ ] フォーマットが仕様通りに生成される
- [ ] フォールバック（execCommand）が動作する

---

##### Issue #3: [履歴] セッション一言メモ機能を実装
**優先度**: `priority-medium`
**ラベル**: `epic:phase1-set-features`, `feature`, `priority-medium`
**見積**: 1-2日

**説明**:
各セッションに一言メモを追加できる機能を実装する。

**実装内容**:
- Session型に `memo?: string` フィールド追加
- セッション一覧カードにメモ表示
- セッション詳細ダイアログにメモ表示・編集機能
- メモ入力コンポーネント

**想定ユースケース**:
- 「役満達成！」
- 「新メンバー参加」
- 「次回は来週土曜日」

**関連ドキュメント**:
- `project-docs/2025-11-16-set-mahjong-features/01-FEATURE_IDEAS.md` (L64-87)
- `project-docs/2025-11-16-set-mahjong-features/06-HISTORY_ANALYSIS_TABS_ROADMAP.md` (L94-117)

**新規ファイル**:
- `src/components/SessionMemoInput.tsx`

**修正ファイル**:
- `src/lib/db.ts` (Session型)
- `src/components/tabs/HistoryTab.tsx`
- `src/components/SessionDetailDialog.tsx`

**成功条件**:
- [ ] Session型にmemoフィールドが追加される
- [ ] セッション一覧にメモが表示される（💬アイコン付き）
- [ ] セッション詳細でメモ編集ができる
- [ ] 空のメモは表示されない

---

#### グループ2: 分析タブ拡張（2 Issues）

##### Issue #4: [分析] 基本成績セクションを追加
**優先度**: `priority-high`
**ラベル**: `epic:phase1-set-features`, `feature`, `priority-high`
**見積**: 0.5日

**説明**:
分析タブに基本成績セクション（総セッション数、総半荘数、総収支、平均収支、平均着順）を追加する。

**実装内容**:
- 統合統計カードの上部に基本成績セクションを追加
- `calculateBasicStats()` 関数を実装（useMemoで最適化）
- レスポンシブ表示

**表示項目**:
- 総セッション数
- 総半荘数
- 総収支（円）
- 平均収支（セッションあたり）
- 平均着順

**関連ドキュメント**:
- `project-docs/2025-11-16-set-mahjong-features/04-PLAYER_PROFILE_FUTURE_PLAN.md` (L36-68)
- `project-docs/2025-11-16-set-mahjong-features/05-PROFILE_VS_CURRENT_COMPARISON.md` (L61-84)

**修正ファイル**:
- `src/components/tabs/AnalysisTab.tsx`

**成功条件**:
- [ ] 基本成績セクションが統合統計カードの上部に表示される
- [ ] 5つの統計値が正しく計算される
- [ ] フィルター変更時に自動更新される
- [ ] ユーザー切り替え時に自動更新される

---

##### Issue #5: [分析] 記録セクションを追加
**優先度**: `priority-high`
**ラベル**: `epic:phase1-set-features`, `feature`, `priority-high`
**見積**: 1-2日

**説明**:
分析タブに記録セクション（最高/最低得点、連続トップ/ラス記録）を追加する。

**実装内容**:
- 収支推移グラフの下に記録セクションを追加
- `calculateRecordStats()` 関数を実装（useMemoで最適化）
- 半荘単位の最高/最低得点
- セッション単位の最高/最低得点/収支
- 連続トップ/ラス記録

**計算ロジック**:
```typescript
interface RecordStats {
  maxScoreInHanchan: number
  minScoreInHanchan: number
  maxPointsInSession: number
  minPointsInSession: number
  maxRevenueInSession: number
  minRevenueInSession: number
  consecutiveTopStreak: number
  consecutiveLastStreak: number
}
```

**関連ドキュメント**:
- `project-docs/2025-11-16-set-mahjong-features/04-PLAYER_PROFILE_FUTURE_PLAN.md` (L96-112)
- `project-docs/2025-11-16-set-mahjong-features/05-PROFILE_VS_CURRENT_COMPARISON.md` (L115-145)

**修正ファイル**:
- `src/components/tabs/AnalysisTab.tsx`

**依存関係**:
- **Blocked by**: #4（基本成績セクション実装で計算パターン確立）

**成功条件**:
- [ ] 記録セクションが収支推移グラフの下に表示される
- [ ] 半荘単位の最高/最低得点が正しく計算される
- [ ] セッション単位の最高/最低が正しく計算される
- [ ] 連続トップ/ラス記録が正しく計算される
- [ ] フィルター変更時に自動更新される

---

#### グループ3: データ管理機能（1 Issue）

##### Issue #6: [データ管理] バックアップ・復元機能（JSON）を実装
**優先度**: `priority-high`
**ラベル**: `epic:phase1-set-features`, `feature`, `priority-high`
**見積**: 1-2日

**説明**:
データバックアップ・復元機能を実装する（Phase 1: JSON形式のみ）。

**実装内容（Phase 1）**:
- JSONエクスポート機能
- JSONインポート機能
- データ検証・エラーハンドリング
- マージ方法選択（上書き/追加/差分）

**データ構造**:
```typescript
interface BackupData {
  version: string
  exportDate: string
  appVersion: string
  users: User[]
  sessions: Session[]
  hanchans: Hanchan[]
  playerResults: PlayerResult[]
}
```

**関連ドキュメント**:
- `project-docs/2025-11-16-set-mahjong-features/02-BACKUP_RESTORE_SPECIFICATION.md`

**新規ファイル**:
- `src/lib/backup-utils.ts`
- `src/components/BackupSection.tsx`
- `src/components/ImportDialog.tsx`

**修正ファイル**:
- `src/components/tabs/SettingsTab.tsx`

**成功条件**:
- [ ] JSONエクスポートが動作する
- [ ] ファイル名が `mahjong-backup-YYYYMMDD-HHMM.json` 形式
- [ ] JSONインポートが動作する
- [ ] データ検証が正しく動作する
- [ ] 3つのマージ方法（上書き/追加/差分）が動作する
- [ ] エラーハンドリングが適切

---

## 📊 Issue作成の優先順序

### 優先度1: すぐに実装可能（高価値・低依存）

1. **Issue #1**: セッション詳細に合計表示（0.5日）
2. **Issue #2**: セッション共有機能（0.5日）
3. **Issue #6**: バックアップ・復元機能（1-2日）

**合計**: 2-3日

### 優先度2: 分析タブ拡張（依存関係あり）

4. **Issue #4**: 基本成績セクション追加（0.5日）
5. **Issue #5**: 記録セクション追加（1-2日）

**合計**: 1.5-2.5日

### 優先度3: メモ機能

6. **Issue #3**: セッション一言メモ（1-2日）

**合計**: 1-2日

**総計**: 5-7.5日（約1週間）

---

## 🏷️ Label設定コマンド

### Epic Label作成
```bash
gh label create "epic:phase1-set-features" \
  --description "Phase 1: セット麻雀特化機能" \
  --color "0052CC"
```

### 既存ラベル確認
```bash
gh label list
```

必要に応じて以下を作成:
```bash
gh label create "priority-high" --description "緊急、即座対応" --color "d73a4a"
gh label create "priority-medium" --description "重要、計画的対応" --color "fbca04"
gh label create "priority-low" --description "余裕があれば対応" --color "0e8a16"
gh label create "feature" --description "新機能追加" --color "a2eeef"
```

---

## 📋 Issue作成コマンド例

### Issue #1
```bash
gh issue create \
  --title "[履歴] セッション詳細ダイアログに合計表示を追加" \
  --label "epic:phase1-set-features,feature,priority-high" \
  --body "$(cat <<'EOF'
セッション詳細ダイアログの総収支タブに、全プレイヤーの合計表示エリアを追加する。

## 実装内容
- 総収支（全プレイヤー合計）: ゼロサム確認用
- 総ポイント（全プレイヤー合計）
- チップ合計（全プレイヤー合計）
- 場代合計（全プレイヤー合計）

## 関連ドキュメント
- project-docs/2025-11-16-set-mahjong-features/01-FEATURE_IDEAS.md (L163-182)
- project-docs/2025-11-16-set-mahjong-features/06-HISTORY_ANALYSIS_TABS_ROADMAP.md (L12-43)

## 修正ファイル
- src/components/SessionDetailDialog.tsx

## 成功条件
- [ ] セッション詳細ダイアログに合計セクションが表示される
- [ ] 4つの合計値（総収支/ポイント/チップ/場代）が正しく計算される
- [ ] ゼロサム原則が確認できる（総収支=0）

## 見積
0.5日
EOF
)"
```

**注**: 残りのIssue作成コマンドは同様のパターンで作成可能

---

## 🔗 Projects V2での管理

### フィルタ例

**Epic単位で表示**:
```
label:"epic:phase1-set-features"
```

**優先度別表示**:
```
label:"priority-high"
```

**進行中のタスク**:
```
label:"in-progress"
```

---

## 📝 次のステップ

1. **Label作成**: Epic labelと優先度labelを作成
2. **Issue作成**: 優先度順に6つのIssueを作成
3. **Projects設定**: Auto-add issuesを有効化
4. **実装開始**: Issue #1から順次実装

---

## 📈 進捗管理の方針

### Issue（未完了タスク）
- タスクの詳細
- 成功条件
- 依存関係

### DASHBOARD.md（完了記録）
- 1-2行の簡潔な記録
- Issue番号を参照

### Projects V2（可視化）
- Epic/優先度でフィルタリング
- 進捗の可視化
- 読み取り専用（自動同期）

---

## 📝 更新履歴

- **2025-11-19 19:31**: Issue構成を全面修正（8→6 Issues）
  - 既存のAnalysisTab実装を考慮し、プロフィールダイアログ/ボタンを削除
  - Issue #4-5を「分析タブ内にセクション追加」に変更
  - 基本成績セクション・記録セクションを分析タブに直接追加する形に修正
- **2025-11-18 01:26**: 初版作成（8つのIssue分割計画、Epic Label方式採用）
