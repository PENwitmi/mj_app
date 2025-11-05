# 📊 麻雀アプリ - マスターステータスダッシュボード

**最終更新**: 2025-11-05 18:40

---

## 🎯 プロジェクト統計サマリー

| 項目 | 状態 |
|------|------|
| **開始日** | 2025-10-03 00:17 |
| **現在のフェーズ** | Phase 6完了 → Phase 7（テスト・最適化）準備中 |
| **総フェーズ数** | 6（Phase 1-6全完了） + バグ修正・機能追加複数件 |
| **総ドキュメント数** | 37+ (設計9 + 実装12 + バグ修正3 + 開発知見1 + 新規機能2 + 分析タブ設計10) |
| **総ファイル数** | 44ファイル（src配下 .ts/.tsx） |
| **総コード行数** | 7,336行 (TypeScript/TSX) |
| **ビルドサイズ** | 961KB (minified) / 283KB (gzip) |
| **完了タスク** | 全Phase完了、主要バグ修正完了、iOS実機デプロイ完了 |
| **現在のGitコミット** | b1e49c4 (マイグレーション機能完全修正) |

---

## 🚀 現在進行中のプロジェクト

### 分析タブ包括的修正計画（2025-11-05開始）
**目的**: エッジケース判定の誤り修正 + selectedUserId対応の完全実装

**Phase 1完了（2025-11-05 16:58）**:
- 5つのドキュメント作成（要件分析、アーキテクチャ、実装仕様、パフォーマンス戦略、テスト計画）
- project-docs/2025-11-05-analysis-tab-statistics-redesign/

**新規問題発見（2025-11-05 18:40）**:
1. **エッジケース判定の誤り（Critical）**
   - 0点（score === 0）を未入力として扱っている
   - 麻雀で±0点は正常なプレイ結果
   - 修正箇所: 4箇所（session-utils.ts×2, InputTab.tsx, AnalysisTab.tsx）

2. **selectedUserId非対応（Critical）**
   - revenueStats/chipStatsがsession.summary依存（mainUserのみ）
   - ユーザー切り替えで統計が更新されない
   - 修正箇所: 2箇所（AnalysisTab.tsx revenueStats/chipStats）

**Phase 2完了（2025-11-05 18:40）**:
- 完全版設計仕様書作成（5ドキュメント）
  - 01-BUG_ANALYSIS.md: 問題の詳細分析と影響範囲
  - 02-DESIGN_SPECIFICATION.md: エッジケース定義と統計計算仕様
  - 03-IMPLEMENTATION_PLAN.md: 修正箇所の完全なリスト（行番号、修正前後コード）
  - 04-TEST_STRATEGY.md: 12のテストケース（110分想定）
  - 05-MIGRATION_GUIDE.md: デプロイ計画とリスク評価
- project-docs/2025-11-05-analysis-tab-comprehensive-fix/

**実装計画**:
- **Phase 1: エッジケース修正**（優先度: Critical）
  - 4箇所の条件分岐修正（`|| score === 0`削除）
  - 実装時間: 5-10分
  - リスク: 極めて低い

- **Phase 2: selectedUserId対応**（Phase 1完了後）
  - revenueStats/chipStatsの完全書き換え
  - 実装時間: 30-45分
  - リスク: 中程度

**次のステップ**: 実装開始（03-IMPLEMENTATION_PLAN.mdに従う）

---

### 次の候補:
1. **Phase 7: テストコード整備**
   - ビジネスロジックのユニットテスト（session-utils, uma-utils, validation）
   - カスタムフックのテスト（useUsers, useSessions）
   - 見積: 2-3日

2. **バンドルサイズ削減**
   - 動的import実装（分析タブ、設定タブ）
   - Tree Shaking最適化
   - 目標: 500KB以下
   - 見積: 1-2日

3. **Phase 6拡張: Android対応**
   - Capacitor Android設定
   - ネイティブ機能実装
   - 見積: 3-5日

4. **データエクスポート機能**
   - CSV/JSON出力
   - バックアップ・復元機能
   - 見積: 2-3日

---

## ✅ 直近完了プロジェクト（2週間以内）

### マイグレーション機能完全修正 + iOS実機デプロイ（2025-11-04完了）
**目的**: 既存データの再計算機能の修正と実機デプロイメント問題解決

**実装内容**:
- **Phase 1**: マイグレーション機能修正
  - mainUser ID バグ修正（固定ID → 実際のUUID使用）
  - NaN表示バグ修正（undefined fallback追加）
  - 分析タブUI改善（収支表示順変更：計→うち場代）
  - デバッグログ削除（session-utils.ts, useSessions.ts）
- **Phase 2**: iOS実機デプロイメント問題解決
  - 誤った入れ子ディレクトリ構造発見（app/ios/App/）
  - 古いビルド成果物削除（index-m6QcyouO.js）
  - クリーンビルド＆実機インストール成功

**技術的課題**:
- Xcodeが実機ビルド時に誤ったディレクトリから古いファイルをコピー
- シミュレータは正常動作（正しいディレクトリ使用）
- SHA256ハッシュ検証で全パイプライン検証

**解決策**:
- `rm -rf app/ios/` - 誤った入れ子構造削除
- DerivedData完全削除＆再ビルド
- `xcrun devicectl install` で実機に直接インストール

**検証結果**:
- ✅ マイグレーション12/12セッション成功
- ✅ NaN表示問題完全解決
- ✅ iOS実機で最新コード反映確認
- ✅ TypeScriptビルド成功

**変更ファイル**:
- MigrationTool.tsx, SettingsTab.tsx (+約20行)
- session-utils.ts (-約40行デバッグログ)
- AnalysisTab.tsx (+約30行UI改善)

**ドキュメント**:
- project-docs/2025-10-31-migration-enhancement-analysis-tab/05-IMPLEMENTATION_REPORT.md
- Serena Memory: 2025-11-04-ios-deployment-nested-directory-issue

コミット: b1e49c4, e181ebf

---

### プレイヤー重複選択問題の修正（2025-10-17完了）
**目的**: 同一ユーザーが複数のプレイヤー列で選択されないようにする

**実装内容**:
- **Phase 1**: UI層での重複防止
  - `excludeUserIds`統合（`excludeMainUser`削除）
  - `getExcludeUserIds`関数実装（useCallback使用、mainUser含む）
  - PlayerSelect修正（useMemoでフィルタリング最適化）
  - Props Drilling（3階層: InputTab → ScoreInputTable → PlayerSelect）
  - SessionDetailDialog対応（編集モード）
- **Phase 2**: 保存時バリデーション
  - `hasDuplicatePlayers`関数実装（O(n)の効率的な重複検出）
  - `getDuplicatePlayerInfo`関数実装（詳細なエラーメッセージ生成）
  - handleSave修正（保存前の最終チェック）

**技術的特徴**:
- 統一された除外メカニズム（excludeUserIdsのみ）
- 二重の安全装置（UI層 + 保存時バリデーション）
- パフォーマンス最適化（useMemo/useCallback使用）
- 動的な選択肢更新（リアクティブ）

**設計判断**:
- 公開前プロジェクトのため、段階的移行なしで理想形を一気に実装
- Props Drilling採用（3階層は許容範囲、Context APIは過剰設計）
- Phase 3（UX改善）は不要と判断（選択肢から完全除外がベストプラクティス）

**テスト結果**: Playwright自動テスト完了（全テスト成功 ✅）

**変更ファイル**: PlayerSelect.tsx, InputTab.tsx, ScoreInputTable.tsx, SessionDetailDialog.tsx (+約120行)

**ドキュメント**: project-docs/2025-10-17-duplicate-player-selection-issue/

---

### ウマルールのリアルタイム同期機能（2025-10-16完了）
**目的**: 設定タブでウマルールを変更した際、入力タブにリアルタイムで反映

**実装内容**:
- Custom Events APIによるコンポーネント間通信（Context API不要）
- `utils.ts`: localStorage破損自動修正、カスタムイベント発行機能、TypeScript型定義
- `InputTab.tsx`: イベントリスナー実装、トースト通知、functional state update
- ForceMount戦略と完全互換、データロスリスクなし

**技術的特徴**:
- Custom Events API（疎結合、型安全、パフォーマンスオーバーヘッドなし）
- Functional State Update（他の設定フィールド保持）
- ユーザー通知（トースト表示、明確な説明）

**テスト結果**: 4人打ち3半荘でルール切り替え動作確認、Playwright自動テスト完了

**変更ファイル**: utils.ts, InputTab.tsx (+55行)

コミット: ba4b685

---

### プレイヤー個別場代機能と分析タブUI改善（2025-10-12完了）
**目的**: PlayerResultに場代フィールド追加、収支計算ロジック改善、分析タブUI最適化

**実装内容**:
- PlayerResult型に`parlorFee: number`フィールド追加
- 収支計算ロジック修正（プレイヤー別場代反映）
- SessionDetailDialog改善（不要な場代表示削除）
- 分析タブ収支統計UI改善（4段構成: プラス/マイナス/場代/計）

**変更ファイル**: db.ts, session-utils.ts, SessionDetailDialog.tsx, AnalysisTab.tsx

コミット: e88ec50

---

### Input UI改善（2025-10-12完了）
**目的**: ウママーク配置最適化、テーブル可読性向上

**実装内容**:
- ウママークボタン配置改善（padding調整、視認性向上）
- 点数入力テーブル可読性向上（ボーダー、セル幅調整）

**変更ファイル**: ScoreInputTable.tsx

コミット: 0cc85b6

---

### Phase 6: Capacitor統合・iOS対応（2025-10-12完了）
**目的**: iOS実機・シミュレータ対応、ネイティブアプリ化

**実装内容**:
- iOS実機・シミュレータ対応完了
- safe-area調整（二重計算修正、body padding-bottom削除）
- レイアウト修正（TotalsPanel flexbox化、各タブスクロール対応）
- トースト通知位置変更（bottom-center → top-center）
- 初期化画面遷移修正（useUsers手動リフレッシュ関数追加）
- capacitor.config.ts設定完了

**変更ファイル**: App.tsx, useUsers.ts, index.css, sonner.tsx, TotalsPanel.tsx, ScoreInputTable.tsx, HistoryTab.tsx, AnalysisTab.tsx, SettingsTab.tsx

コミット: dbe6c95, 39b2ea0, c3ee428

---

### Phase 4拡張: 履歴タブ総合順位機能（2025-10-10完了）
**目的**: セッション内総合順位の表示

**実装内容**:
- SessionSummary型に`overallRank`フィールド追加
- `calculateSessionSummary`に総合順位計算ロジック追加（総収支ベース）
- HistoryTab左グリッドに総合順位表示追加

**変更ファイル**: db.ts, session-utils.ts, HistoryTab.tsx

コミット: 15c2033

---

### Phase 5拡張: 収支推移グラフUI改善（2025-10-10完了）
**目的**: グラフ視認性向上、累積モード改善

**実装内容**:
- 累積モードy=0参照線追加（視認性向上）
- createdAtソート修正（date→タイムスタンプ、同日複数セッション対応）
- ボタンラベル改善（"単発"→"個別"）

**変更ファイル**: RevenueTimelineChart.tsx

コミット: (未コミット)

---

### Phase 5拡張: ユーザー参加フィルタリングバグ修正（2025-10-10完了）
**目的**: 分析タブの統計精度向上（重大バグ修正）

**実装内容**:
- 選択ユーザー不参加セッションを統計から正しく除外
- 3層フィルター実装（期間→モード→ユーザー参加）
- データ整合性確保（0点誤計上防止）

**変更ファイル**: AnalysisTab.tsx

コミット: (未コミット)

---

## 📅 月別プロジェクトアーカイブ

### 2025年11月

#### 分析タブ包括的修正計画（2025-11-05）
- **分析タブ包括的修正計画** (2025-11-05開始、Phase 2完了): 2つの重大問題（エッジケース判定の誤り、selectedUserId非対応）の完全版設計仕様書作成。Phase 1（16:58）: 5つのドキュメント（要件分析、アーキテクチャ、実装仕様、パフォーマンス戦略、テスト計画）。Phase 2（18:40）: 5つの実装ドキュメント（バグ分析、設計仕様、実装計画、テスト戦略、マイグレーションガイド）。修正箇所: 6箇所（4箇所エッジケース + 2箇所selectedUserId対応）。ドキュメント: project-docs/2025-11-05-analysis-tab-statistics-redesign/（Phase 1）, project-docs/2025-11-05-analysis-tab-comprehensive-fix/（Phase 2）

#### マイグレーション＆デプロイメント（2025-11-04）
- **マイグレーション機能完全修正 + iOS実機デプロイ** (2025-11-04完了): mainUser ID修正、NaN表示修正、分析タブUI改善、iOS誤った入れ子ディレクトリ問題解決。コミット: b1e49c4, e181ebf。ドキュメント: project-docs/2025-10-31-migration-enhancement-analysis-tab/, Serena Memory: 2025-11-04-ios-deployment-nested-directory-issue

### 2025年10月

#### バグ修正・機能追加（2025-10-17）
- **プレイヤー重複選択問題の修正** (2025-10-17完了): excludeUserIds統合、Props Drilling実装、保存時バリデーション、Playwrightテスト完了。ドキュメント: project-docs/2025-10-17-duplicate-player-selection-issue/

#### 機能追加（2025-10-16）
- **ウマルールのリアルタイム同期機能** (2025-10-16完了): Custom Events API、localStorage破損修正、トースト通知、ForceMount互換。コミット: ba4b685

#### Phase 6関連
- **Capacitor統合・iOS対応** (2025-10-12完了): iOS実機・シミュレータ対応、safe-area調整、レイアウト修正、トースト通知位置変更、初期化画面遷移修正。コミット: dbe6c95, 39b2ea0, c3ee428

#### 機能追加・UI改善
- **プレイヤー個別場代機能** (2025-10-12完了): PlayerResult.parlorFee追加、収支計算改善、分析タブUI改善。コミット: e88ec50
- **Input UI改善** (2025-10-12完了): ウママーク配置最適化、テーブル可読性向上。コミット: 0cc85b6
- **Phase 4拡張: 履歴タブ総合順位機能** (2025-10-10完了): overallRank表示。コミット: 15c2033

#### Phase 5拡張・バグ修正
- **Phase 5-8: 収支推移グラフUI改善** (2025-10-10完了): y=0参照線、createdAtソート、ラベル改善
- **Phase 5-7: ユーザー参加フィルタリングバグ修正** (2025-10-10完了): 3層フィルター、データ整合性確保
- **Phase 5-6: 分析タブUI最適化** (2025-10-09完了): 統計カード統合（4→1）、モバイルファースト設計。コミット: b9864ed

#### リファクタリング
- **db-utils.ts Phase 2: ドメイン別分割** (2025-10-09完了): 1,380行→5モジュール、後方互換性確保
- **db-utils.ts Phase 1: デバッグログ統一** (2025-10-09完了): console.log→logger.debug、構造化ログ

#### Phase 5: 分析タブ
- **Phase 5完了** (2025-10-09完了): 型定義6つ、統計関数4つ、フィルター2つ実装、全6ステージ完了。コミット: b9864ed
- **空ハンチャンフィルタリング** (2025-10-07完了): 全員0点データ保存前除外、3層チェック実装。コミット: 4793601

#### Phase 4: 履歴タブ
- **Phase 4完了** (2025-10-05完了): 一覧・詳細・削除・編集機能、サマリー事前計算（300-800倍高速化）。コミット: bc0e505

#### Phase 1-3
- **Phase 3: InputTab DB保存機能** (2025-10-04完了): toast通知、DB保存、リセット機能。コミット: 6f8f48f
- **Phase 2.5: ユーザーアーカイブシステム** (2025-10-04完了): 論理削除方式、アーカイブ・復元機能。コミット: 次回予定
- **Phase 2: UI実装フル完成** (2025-10-04完了): 4タブ実装、InputTab・SettingsTab完全実装、約28時間。コミット: eae3afe
- **Phase 1: 基本実装** (2025-10-03完了): Vite+React19+TypeScript、Dexie.js、エラーハンドリング、shadcn/ui。コミット: 8855ff9
- **Phase 0: 初期設計・要件定義** (2025-10-03完了): 設計ドキュメント9件作成、データモデル・UI設計・ルール定義完成。コミット: 設計フェーズ

---

## 🎯 次のステップ

### Phase 7: テスト・最適化
1. **テストコード整備**
   - ビジネスロジックのユニットテスト
   - カスタムフックのテスト
   - 見積: 2-3日

2. **バンドルサイズ削減**
   - 動的import（分析タブ、設定タブ）
   - Tree Shaking最適化
   - 目標: 500KB以下
   - 見積: 1-2日

3. **パフォーマンス測定**
   - React DevTools Profiler
   - Lighthouseスコア計測

### Phase 6拡張: モバイル対応
1. **Android対応**
   - Capacitor Android設定
   - ネイティブ機能実装

2. **PWA化検討**
   - Service Worker
   - オフライン対応

### 将来構想
1. **データエクスポート機能**
   - CSV/JSON出力
   - バックアップ・復元機能

2. **高度な分析機能**
   - 対戦相手別成績
   - 時間帯別分析
   - AI予測機能（将来構想）

---

## 📝 技術的な注意事項

### 解決済み問題
1. **React 19 Strict Mode**: メインユーザー重複作成 → 固定ID使用で解決
2. **IndexedDB Boolean制約**: isMainUserをインデックスに使用不可 → in-memory filteringで対応
3. **Tailwind CSS v4**: PostCSS設定不要 → Vite plugin使用
4. **Recharts タブ切り替えエラー**: width/height=0エラー → mountedTabs + 100ms遅延レンダリング
5. **iOS safe-area問題**: 二重計算 → CSS変数使用、body padding-bottom削除
6. **着順判定精度**: umaMark依存 → 点数ベース計算に変更

### 現在の課題
1. **テストコード不在**: ビジネスロジックのテストが必要
2. **バンドルサイズ**: 961KB（目標500KB以下）
3. **型安全性**: 1件のany型使用（TestTab.tsx）

### 検討事項
- 状態管理ライブラリ選定（Context API vs Zustand）
- ルーティング（React Router導入の必要性）
- 動的import（コード分割）

---

## 📚 重要リンク

- **メインドキュメント**: `CLAUDE.md`
- **設計ドキュメント**: `project-docs/2025-10-03-initial-discussion/`
- **実装ドキュメント**: `project-docs/各フェーズディレクトリ/`
- **Serena Memory**: `.serena/memories/`（設計パターン・教訓）
- **開発サーバー**: http://localhost:5173
- **GitHubリポジトリ**: (未設定)

---

## 🔄 Serena Memory更新履歴

**2025-10-16 14:37**:
- ✅ uma-rule-realtime-sync-implementation: ウマルールのリアルタイム同期機能実装記録

**2025-10-12 17:30**:
- ✅ project_overview: Phase 6完了、プレイヤー別場代機能追加、統計更新
- ✅ project_structure: db/モジュール分割反映、iOS対応追加、コンポーネント構成更新
- ✅ database_implementation: ドメイン別分割詳細、総合順位計算、プレイヤー別場代
- ✅ development_workflow: iOS対応ワークフロー、トラブルシューティング追加
- ✅ ui_implementation_patterns: Rechartsパターン、safe-area対応、タブ切り替え対策
- ✅ code_style_conventions: エラーハンドリング、ロギング、命名規則統一

---

**更新履歴**:
- 2025-11-05 18:40: 分析タブ包括的修正計画Phase 2完了（バグ分析、設計仕様、実装計画、テスト戦略、マイグレーションガイドの5ドキュメント）。2つの重大問題の完全版設計仕様書作成完了。project-docs/2025-11-05-analysis-tab-comprehensive-fix/
- 2025-11-05 16:58: 分析タブ統計機能の設計Phase 1完了（要件分析、アーキテクチャ、実装仕様、パフォーマンス戦略、テスト計画の5ドキュメント）
- 2025-11-05 16:42: マイグレーション機能完全修正 + iOS実機デプロイメント問題解決完了、Serena Memory追加（2025-11-04-ios-deployment-nested-directory-issue）
- 2025-10-17 22:28: プレイヤー重複選択問題の修正完了（Phase 1: UI層、Phase 2: 保存時バリデーション）
- 2025-10-16 14:37: ウマルールのリアルタイム同期機能完了、Serena Memory追加（uma-rule-realtime-sync-implementation）
- 2025-10-12 17:30: Serena Memory大規模更新（6個のメモリー最新化）、ダッシュボード全体更新
- 2025-10-12 11:42: プレイヤー別場代フィールド追加プロジェクト記録
- 2025-10-12 10:44: Phase 6（Capacitor統合・iOS対応）完了記録
- 2025-10-10 05:51: Phase 4拡張（履歴タブ総合順位機能）プロジェクト開始記録
- 2025-10-10 02:34: Phase 5-7, Phase 5-8完了記録追加
- 2025-10-09 16:52: db-utils.ts リファクタリング Phase 1完了記録
- 2025-10-09 16:32: Phase 5-6完了記録（分析タブUI最適化）
- 2025-10-09 15:43: Phase 5 Stage 5-5完了記録（タブ切り替えエラー修正）
- 2025-10-05 20:55: Phase 5完了記録、統計サマリー更新
- 2025-10-05 11:50: Phase 4 Stage 4-5実装計画書作成完了
- 2025-10-05 09:44: Git状態の正確性確認・修正
- 2025-10-05 02:23: Phase 4進捗更新（Stage 1-3完了）
- 2025-10-04 14:40: Phase 3完了記録
- 2025-10-04 07:10: Phase 2完了記録、統計サマリー更新
- 2025-10-03 03:19: 初回作成、Phase 1完了記録
