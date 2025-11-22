# 最終Issue設計ディレクトリ

**作成日**: 2025-11-21 14:50
**ステータス**: 最終決定版（このディレクトリが最新の正式設計）

---

## 📁 このディレクトリの目的

このディレクトリには、セット麻雀特化機能のGitHub Issue作成用の**最終確定版設計**が格納されています。

**重要**: 親ディレクトリの他のドキュメント（`01-FEATURE_IDEAS.md`〜`07-GITHUB_ISSUE_BREAKDOWN.md`）は企画・検討段階のものです。実装時はこのディレクトリの情報を参照してください。

---

## 📄 ファイル構成

### `ISSUE_DESIGN.md` ⭐ 必読
**GitHub Issue作成用の最終設計書**

**内容**:
- Domain設計（機能ドメイン別）
- 全10 Issueの詳細仕様
- Issue作成コマンド例
- Label設定コマンド

**Domain構成**:
```
Domain 1: domain:session-detail-dialog
  └─ Issue #1, #2, #3（セッション詳細ダイアログ拡張）

Domain 2: domain:analysis-statistics
  └─ Issue #4, #5（分析タブ統計追加）

Domain 3: domain:data-management
  └─ Issue #6（データ管理：バックアップ・復元機能）

Domain 4: domain:template-management
  └─ Issue #7, #8, #9（テンプレート機能）

Domain 5: domain:settlement-tracking
  └─ Issue #10（精算タブ）
```

---

## 🔗 親ディレクトリのドキュメント（参考資料）

親ディレクトリ（`../`）には企画・検討段階のドキュメントがあります。これらは背景理解や詳細仕様の参照用です：

| ドキュメント | 用途 |
|-------------|------|
| `01-FEATURE_IDEAS.md` | 初期アイデア整理 |
| `02-BACKUP_RESTORE_SPECIFICATION.md` | バックアップ仕様書（Issue #6参照） |
| `03-SESSION_SHARE_CLIPBOARD.md` | クリップボード共有仕様書（Issue #2参照） |
| `04-PLAYER_PROFILE_FUTURE_PLAN.md` | プロフィール将来構想（Phase 2以降） |
| `05-PROFILE_VS_CURRENT_COMPARISON.md` | 既存実装比較分析 |
| `06-HISTORY_ANALYSIS_TABS_ROADMAP.md` | ビジョンドキュメント（理想形） |
| `07-GITHUB_ISSUE_BREAKDOWN.md` | 旧Issue設計（Phase概念使用、参考のみ） |

---

## 🚀 次のステップ

1. **`ISSUE_DESIGN.md`を読む** - Domain構成とIssue詳細を確認
2. **Labelを作成** - `gh label create`コマンドで5つのDomain Label作成
3. **Issueを作成** - 優先度順に10のIssueを作成
4. **Projects V2に自動追加** - Auto-add issuesを有効化
5. **実装開始** - Issue #1から順次着手

---

## 📝 設計変更履歴

### 最終版の主な変更点
- **2025-11-21 17:05**: Domain構成整理
  - 「独立Issue」概念を削除（Domain概念と矛盾）
  - Issue #6を`domain:data-management`に分類
  - Domain数: 4 → 5に変更
- **2025-11-21 17:00**: Epic→Domain用語変更
  - 永続的なカテゴリとして使い回す方針に変更
  - `epic:XXX` → `domain:XXX` ラベル名変更
  - GitHub Issue管理skillも同様に更新
- **Domain設計変更**: `epic:phase1-set-features`（時系列）→ 機能ドメイン別Domain
- **Issue数拡張**: 8 Issues → 6 Issues → 10 Issues
- **プロフィール設計変更**: 独立ダイアログ削除 → 分析タブ内セクション追加
- **テンプレート機能追加**: Domain 4として追加（Issue #7-9）
- **精算タブ追加**: Domain 5として追加（Issue #10）
- **ドキュメント分離**: ビジョン（`06-HISTORY_ANALYSIS_TABS_ROADMAP.md`）と実装設計（`ISSUE_DESIGN.md`）を明確化

詳細は`ISSUE_DESIGN.md`の「📝 更新履歴」セクション参照

---

## ⚠️ 注意事項

- **このディレクトリが最新**: 実装時は必ずこのディレクトリのドキュメントを参照
- **親ディレクトリは参考資料**: 検討過程を理解したい場合のみ参照
- **`07-GITHUB_ISSUE_BREAKDOWN.md`は旧版**: Phase概念を使用しているため非推奨

---

**最終更新**: 2025-11-21 17:05
