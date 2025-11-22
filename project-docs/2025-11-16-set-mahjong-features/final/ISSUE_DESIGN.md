# GitHub Issue最終設計

**作成日**: 2025-11-21 14:50
**目的**: セット麻雀特化機能の最終的なIssue設計（機能ドメイン別分類）

---

## 📋 設計方針

### Domain（Label方式）によるグルーピング

**原則**: 機能ドメインでグルーピング（時系列的な"Phase"は使用しない）

**Domain Labelの性質**:
- **永続的なカテゴリ**: 完了後も削除せず、将来の同ドメイン追加機能で再利用
- **多軸分類**: `feature`/`bug`等の変更タイプラベルと併用
- **参考**: Kubernetes `area:XXX`, React `Component: XXX`と同様のパターン

**理由**:
- 機能的に関連するIssueをまとめる
- Projects V2でのフィルタリングが容易
- gh CLIで完結（Sub-issuesはUI操作必須）
- ラベル数が爆発しない（機能ドメインの数だけで安定）

---

## 🎯 Issue構成（全10 Issues、5 Domains）

### Domain 1: セッション詳細ダイアログ拡張

**Domain Label**: `domain:session-detail-dialog`

**対象Issue**: #1, #2, #3（3 Issues）

**共通編集ファイル**: `SessionDetailDialog.tsx`

#### Issue #1: [履歴] セッション詳細ダイアログに合計表示を追加

**ラベル**: `domain:session-detail-dialog`, `feature`, `priority-high`
**見積**: 0.5日

**説明**:
セッション詳細ダイアログの総収支タブに、全プレイヤーの合計表示エリアを追加する。

**実装内容**:
- 総収支（全プレイヤー合計）: ゼロサム確認用
- 総ポイント（全プレイヤー合計）
- チップ合計（全プレイヤー合計）
- 場代合計（全プレイヤー合計）

**関連ドキュメント**:
- `01-FEATURE_IDEAS.md` (L163-182)
- `06-HISTORY_ANALYSIS_TABS_ROADMAP.md`

**修正ファイル**:
- `src/components/SessionDetailDialog.tsx`

**成功条件**:
- [ ] セッション詳細ダイアログに合計セクションが表示される
- [ ] 4つの合計値（総収支/ポイント/チップ/場代）が正しく計算される
- [ ] ゼロサム原則が確認できる（総収支=0）

---

#### Issue #2: [履歴] セッション共有機能（クリップボード）を実装

**ラベル**: `domain:session-detail-dialog`, `feature`, `priority-high`
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
- `03-SESSION_SHARE_CLIPBOARD.md`
- `06-HISTORY_ANALYSIS_TABS_ROADMAP.md`

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

#### Issue #3: [履歴] セッション一言メモ機能を実装

**ラベル**: `domain:session-detail-dialog`, `feature`, `priority-medium`
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
- `01-FEATURE_IDEAS.md` (L64-87)
- `06-HISTORY_ANALYSIS_TABS_ROADMAP.md`

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

### Domain 2: 分析タブ統計追加

**Domain Label**: `domain:analysis-statistics`

**対象Issue**: #4, #5（2 Issues）

**共通編集ファイル**: `AnalysisTab.tsx`

#### Issue #4: [分析] 基本成績セクションを追加

**ラベル**: `domain:analysis-statistics`, `feature`, `priority-high`
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
- `04-PLAYER_PROFILE_FUTURE_PLAN.md` (L36-68)
- `05-PROFILE_VS_CURRENT_COMPARISON.md` (L61-84)

**修正ファイル**:
- `src/components/tabs/AnalysisTab.tsx`

**成功条件**:
- [ ] 基本成績セクションが統合統計カードの上部に表示される
- [ ] 5つの統計値が正しく計算される
- [ ] フィルター変更時に自動更新される
- [ ] ユーザー切り替え時に自動更新される

---

#### Issue #5: [分析] 記録セクションを追加

**ラベル**: `domain:analysis-statistics`, `feature`, `priority-high`
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
- `04-PLAYER_PROFILE_FUTURE_PLAN.md` (L96-112)
- `05-PROFILE_VS_CURRENT_COMPARISON.md` (L115-145)

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

### Domain 3: データ管理

**Domain Label**: `domain:data-management`

**対象Issue**: #6（1 Issue）

**概要**: バックアップ、復元、データインポート等のデータ管理機能。

#### Issue #6: [データ管理] バックアップ・復元機能（JSON）を実装

**ラベル**: `domain:data-management`, `feature`, `priority-high`
**見積**: 1-2日

**説明**:
データバックアップ・復元機能を実装する（JSON形式）。

**実装内容**:
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
- `02-BACKUP_RESTORE_SPECIFICATION.md`

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

### Domain 4: テンプレート機能

**Domain Label**: `domain:template-management`

**対象Issue**: #7, #8, #9（3 Issues）

**概要**: 定例メンバー・レート設定を保存し、新規セッション開始時に素早く再利用できる機能。

#### Issue #7: [設定] テンプレート管理機能を実装

**ラベル**: `domain:template-management`, `feature`, `priority-medium`
**見積**: 2-3日

**説明**:
テンプレート管理機能の基盤を実装する。データモデル、CRUD操作、設定タブでのテンプレート一覧・作成・編集・削除UI。

**実装内容**:
- Template型の定義（Dexieスキーマ）
- テンプレートCRUD操作（`template-utils.ts`）
- 設定タブにテンプレート管理セクション追加
- テンプレート一覧表示
- 新規作成・編集・削除UI

**データ構造**:
```typescript
interface Template {
  id: string
  name: string
  gameMode: GameMode
  playerIds: string[]
  rate: number
  umaValue: number
  chipRate: number
  umaRule: UmaRule
  createdAt: Date
  updatedAt: Date
}
```

**関連ドキュメント**:
- `01-FEATURE_IDEAS.md` (L17-61)

**新規ファイル**:
- `src/lib/template-utils.ts`
- `src/components/TemplateManagementSection.tsx`
- `src/components/TemplateDialog.tsx`

**修正ファイル**:
- `src/lib/db.ts` (Template型追加)
- `src/components/tabs/SettingsTab.tsx`

**成功条件**:
- [ ] Template型がdb.tsに定義される
- [ ] テンプレートCRUD操作が動作する
- [ ] 設定タブにテンプレート管理セクションが表示される
- [ ] テンプレート作成・編集・削除ができる
- [ ] テンプレート一覧が表示される

---

#### Issue #8: [入力] テンプレート選択機能を実装

**ラベル**: `domain:template-management`, `feature`, `priority-medium`
**見積**: 1-2日

**説明**:
新規セッション入力時にテンプレートを選択し、設定を自動入力できる機能を実装する。

**実装内容**:
- InputTab上部にテンプレート選択ドロップダウン追加
- テンプレート選択時に設定を自動入力
- 「テンプレートなし」「4人打ち」「3人打ち」「ユーザーテンプレート」の選択肢
- テンプレート選択後も個別編集可能

**UI変化**:
```
┌─────────────────────────┐
│ テンプレート選択         │
│ [選択してください ▼]    │ ← NEW
│   - テンプレートなし    │
│   - 4人打ち             │
│   - 3人打ち             │
│   - 金曜麻雀会          │
│   - 月イチ麻雀          │
├─────────────────────────┤
│ （既存の入力フォーム）   │
└─────────────────────────┘
```

**関連ドキュメント**:
- `01-FEATURE_IDEAS.md` (L17-61)

**修正ファイル**:
- `src/components/tabs/InputTab.tsx`

**依存関係**:
- **Blocked by**: #7（テンプレート管理機能）

**成功条件**:
- [ ] テンプレート選択ドロップダウンが表示される
- [ ] テンプレート選択時に設定が自動入力される
- [ ] 「4人打ち」「3人打ち」選択が既存機能と同じ動作をする
- [ ] テンプレート選択後も手動編集可能
- [ ] テンプレートなしを選択すると初期状態に戻る

---

#### Issue #9: [履歴] 既存セッションからテンプレート保存機能を実装

**ラベル**: `domain:template-management`, `feature`, `priority-medium`
**見積**: 1日

**説明**:
セッション詳細ダイアログから「テンプレート保存」ボタンを追加し、既存セッションの設定をテンプレートとして保存できる機能を実装する。

**実装内容**:
- セッション詳細ダイアログに「💾 テンプレート保存」ボタン追加
- テンプレート名入力ダイアログ
- セッションの設定（メンバー、レート等）をTemplate型に変換して保存
- 保存成功後にトースト通知

**UI変化**:
```
┌─────────────────────────┐
│ セッション詳細           │
│ ...                      │
├─────────────────────────┤
│ [💾 テンプレート保存]    │ ← NEW
│ [📋 結果をコピー]        │
│ [編集] [削除] [閉じる]   │
└─────────────────────────┘
```

**関連ドキュメント**:
- `01-FEATURE_IDEAS.md` (L42-50)

**修正ファイル**:
- `src/components/SessionDetailDialog.tsx`
- `src/lib/template-utils.ts`（保存ロジック追加）

**依存関係**:
- **Blocked by**: #7（テンプレート管理機能）

**成功条件**:
- [ ] 「💾 テンプレート保存」ボタンが表示される
- [ ] クリックでテンプレート名入力ダイアログが開く
- [ ] セッション設定がテンプレートとして保存される
- [ ] 保存後にトースト通知が表示される
- [ ] 設定タブのテンプレート一覧に反映される

---

### Domain 5: 精算タブ

**Domain Label**: `domain:settlement-tracking`

**対象Issue**: #10（1 Issue）

**概要**: 未精算の記録・管理機能（例外ケース対応）。

#### Issue #10: [精算] 精算タブ（出納帳機能）を実装

**ラベル**: `domain:settlement-tracking`, `feature`, `priority-medium`
**見積**: 2-3日

**説明**:
プレイヤーごとの未精算残高を管理する精算タブを実装する。原則としてセッション終了時にその場で精算済みだが、例外的な未精算のみ記録・管理する。

**基本方針**:
- **通常ケース（95%）**: セッション終了→その場で現金精算→精算タブに記録なし
- **例外ケース（5%）**: セッション終了→現金なし・立て替え→精算タブに未精算として記録

**実装内容**:
- PlayerBalance型・Settlement型の定義（Dexieスキーマ）
- 精算タブUI（独立タブ）
- 未精算リスト表示（プレイヤーごと）
- 未精算の手動追加・編集・削除機能
- セッションとの紐付け
- 精算完了ボタン（未精算削除）

**データ構造**:
```typescript
interface PlayerBalance {
  id: string
  userId: string
  balance: number  // 未精算残高（マイナス=借り）
  lastUpdated: Date
}

interface Settlement {
  id: string
  userId: string
  amount: number
  sessionId?: string  // 関連セッション（オプション）
  description: string  // 「場代立て替え by Bさん」等
  createdAt: Date
  settledAt?: Date  // 精算完了日時
}
```

**UI構成**:
```
┌─────────────────────────────────────┐
│ 精算タブ                             │
├─────────────────────────────────────┤
│ 📊 未精算なし                        │
│                                     │
│ [未精算を追加]                       │
└─────────────────────────────────────┘

（未精算がある場合）
┌─────────────────────────────────────┐
│ 精算タブ                             │
├─────────────────────────────────────┤
│ Aさん: -3,000円                      │
│   └ 11/10 金曜麻雀会 (-3,000円)     │
│   [精算完了]                         │
│                                     │
│ [未精算を追加]                       │
└─────────────────────────────────────┘
```

**関連ドキュメント**:
- `01-FEATURE_IDEAS.md` (L90-160)

**新規ファイル**:
- `src/lib/settlement-utils.ts`
- `src/components/tabs/SettlementTab.tsx`
- `src/components/SettlementAddDialog.tsx`

**修正ファイル**:
- `src/lib/db.ts` (PlayerBalance型・Settlement型追加)
- `src/App.tsx` (精算タブ追加)

**成功条件**:
- [ ] PlayerBalance型・Settlement型がdb.tsに定義される
- [ ] 精算タブが独立タブとして表示される
- [ ] 未精算がない場合「📊 未精算なし」が表示される
- [ ] 未精算リストが表示される（プレイヤーごと）
- [ ] 未精算の追加・編集・削除ができる
- [ ] 精算完了ボタンで未精算が削除される
- [ ] セッションとの紐付けが動作する

---

## 🏷️ Label設定コマンド

### Domain Label作成

```bash
# Domain 1: セッション詳細ダイアログ拡張
gh label create "domain:session-detail-dialog" \
  --description "セッション詳細ダイアログの機能拡張" \
  --color "0052CC"

# Domain 2: 分析タブ統計追加
gh label create "domain:analysis-statistics" \
  --description "分析タブの統計機能追加" \
  --color "0052CC"

# Domain 3: データ管理
gh label create "domain:data-management" \
  --description "データ管理（バックアップ、復元、インポート等）" \
  --color "0052CC"

# Domain 4: テンプレート機能
gh label create "domain:template-management" \
  --description "テンプレート管理機能" \
  --color "0052CC"

# Domain 5: 精算タブ
gh label create "domain:settlement-tracking" \
  --description "精算タブ（出納帳機能）" \
  --color "0052CC"
```

### 優先度Label作成

```bash
gh label create "priority-high" --description "緊急、即座対応" --color "d73a4a"
gh label create "priority-medium" --description "重要、計画的対応" --color "fbca04"
gh label create "priority-low" --description "余裕があれば対応" --color "0e8a16"
```

### カテゴリLabel作成

```bash
gh label create "feature" --description "新機能追加" --color "a2eeef"
```

---

## 📋 Issue作成コマンド例

### Issue #1

```bash
gh issue create \
  --title "[履歴] セッション詳細ダイアログに合計表示を追加" \
  --label "domain:session-detail-dialog,feature,priority-high" \
  --body "$(cat <<'EOF'
セッション詳細ダイアログの総収支タブに、全プレイヤーの合計表示エリアを追加する。

## 実装内容
- 総収支（全プレイヤー合計）: ゼロサム確認用
- 総ポイント（全プレイヤー合計）
- チップ合計（全プレイヤー合計）
- 場代合計（全プレイヤー合計）

## 関連ドキュメント
- project-docs/2025-11-16-set-mahjong-features/01-FEATURE_IDEAS.md (L163-182)
- project-docs/2025-11-16-set-mahjong-features/06-HISTORY_ANALYSIS_TABS_ROADMAP.md

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

**Domain単位で表示**:
```
label:"domain:session-detail-dialog"
label:"domain:analysis-statistics"
label:"domain:data-management"
label:"domain:template-management"
label:"domain:settlement-tracking"
```

**優先度別表示**:
```
label:"priority-high"
label:"priority-medium"
label:"priority-low"
```

---

## 📝 関連ドキュメント

### 親ディレクトリ（企画・検討段階）

- `../01-FEATURE_IDEAS.md` - 初期アイデア整理
- `../02-BACKUP_RESTORE_SPECIFICATION.md` - バックアップ仕様書
- `../03-SESSION_SHARE_CLIPBOARD.md` - クリップボード共有仕様書
- `../04-PLAYER_PROFILE_FUTURE_PLAN.md` - プロフィール将来構想
- `../05-PROFILE_VS_CURRENT_COMPARISON.md` - 既存実装比較
- `../06-HISTORY_ANALYSIS_TABS_ROADMAP.md` - ビジョンドキュメント
- `../07-GITHUB_ISSUE_BREAKDOWN.md` - 旧Issue設計（Phase概念使用）

### このディレクトリ（最終設計）

- `ISSUE_DESIGN.md`（本ファイル）- 最終的なIssue設計
- `README.md` - このディレクトリの説明

---

## 📝 更新履歴

- **2025-11-21 17:05**: Domain構成整理
  - 「独立Issue」概念を削除（Domain概念と矛盾）
  - Issue #6を`domain:data-management`に分類
  - Domain数: 4 → 5に変更
  - 全Issueが明確なDomainに属する構成に修正
- **2025-11-21 17:00**: Epic→Domain用語変更
  - "Epic"を"Domain"に変更（永続的なカテゴリとして使い回す方針）
  - `epic:XXX` → `domain:XXX` ラベル名変更
  - Domain Labelの性質を明記（永続的、多軸分類、参考: Kubernetes/React）
  - GitHub Issue管理skillも同様に更新完了
- **2025-11-21 16:23**: 優先度ラベル追加
  - priority-high/medium/lowラベルを全Issue定義に追加
  - Issue #1, #2, #4, #5, #6: priority-high
  - Issue #3, #7, #8, #9, #10: priority-medium
- **2025-11-21 16:18**: 優先順序の削除
  - 「実装優先順序」セクションを削除（ユーザーが設定していない）
  - priority-high/medium/lowラベルを全Issue定義から削除
  - 依存関係（Blocked by）は技術的事実として保持
- **2025-11-21 16:14**: テンプレート機能と精算タブを追加
  - Domain 3: `domain:template-management` 追加（Issue #7-9）
  - Domain 4: `domain:settlement-tracking` 追加（Issue #10）
  - Issue数: 6 → 10に拡張
- **2025-11-21 14:50**: 初版作成
  - Domain設計を機能ドメイン別に変更
  - `epic:phase1-set-features` を削除
  - `domain:session-detail-dialog` と `domain:analysis-statistics` を導入
  - Issue #6 は独立Issue（Domainなし）
