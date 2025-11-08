# 📊 麻雀アプリ - マスターステータスダッシュボード

**最終更新**: 2025-11-08 21:23

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
| **現在のGitコミット** | b24be71 (Phase 1テスト自動化完了) |
| **現在のブランチ** | fix/analysis-tab-statistics（マージ待ち） |

---

## 🚀 現在進行中のプロジェクト

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

### 分析タブ包括的修正計画（2025-11-08完了）
**目的**: エッジケース判定の誤り修正 + selectedUserId対応の完全実装 + Playwrightテスト自動化

**実装内容**:
- **Phase 1実装（2025-11-08）**: エッジケース修正（6箇所）
  - `score === 0`を未入力として誤って扱っていた問題を修正
  - session-utils.ts: Line 142, 203
  - InputTab.tsx: Line 260
  - AnalysisTab.tsx: Line 135
  - analysis.ts: Line 130, 142
- **Phase 2実装（2025-11-08）**: selectedUserId対応
  - revenueStats/chipStatsを完全書き換え
  - chips/parlorFee 1回カウント（初期化フラグ使用）
  - 動的統計計算（session.summary非依存）
- **Playwrightテスト自動化（2025-11-08）**:
  - 4つのテストケース実装（507行）
  - TC-001: ユーザー切り替えで全統計更新
  - TC-002: chips/parlorFee 1回カウント検証
  - TC-101: 動的計算とsession.summary整合性
  - TC-401: 既存機能への影響なし
  - 全テスト成功（12.6秒）

**技術的特徴**:
- エッジケース完全対応（score === 0は正常な±0点）
- 二段階計算パターン（スコア支払→チップ/場代）
- テストの実コード検証（SettingsTab.tsx, NewPlayerDialog.tsx読み取り）
- セマンティックセレクター使用（getByRole, getByPlaceholder）

**設計判断**:
- 設計フェーズ完了（2025-11-05〜11-06、11ドキュメント）
- 外部AIレビュー検証（analysis.ts 2箇所追加発見）
- テストファースト実装（実装→テストではなく、設計→テスト→検証）

**検証結果**:
- ✅ TypeScriptビルド成功
- ✅ Playwrightテスト全4件成功
- ✅ chips/parlorFee 6倍バグ修正確認
- ✅ selectedUserId動的計算確認

**変更ファイル**:
- session-utils.ts, InputTab.tsx, AnalysisTab.tsx, analysis.ts（Phase 1: 6箇所）
- AnalysisTab.tsx（Phase 2: revenueStats/chipStats完全書き換え）
- 03-analysis-tab-statistics.spec.ts（新規、507行）

**ドキュメント**:
- project-docs/2025-11-05-analysis-tab-statistics-redesign/（Phase 1設計）
- project-docs/2025-11-05-analysis-tab-comprehensive-fix/（Phase 2設計、11ドキュメント）
- Serena Memory:
  - 2025-11-05-analysis-tab-statistics-bug-fix-design.md
  - 2025-11-06-external-ai-review-analysis-ts-bugs.md
  - 2025-11-08-analysis-tab-statistics-fix-session.md

コミット: 446f914（Phase 1）, 5bd06ee（Phase 2）, b24be71（テスト）

---

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

#### 分析タブ包括的修正計画（2025-11-08完了）
- **分析タブ包括的修正計画** (2025-11-05開始、2025-11-08完了): エッジケース判定の誤り（6箇所）、selectedUserId対応（2箇所）、Playwrightテスト自動化（4テストケース）。設計フェーズ（2025-11-05〜11-06、11ドキュメント）→実装フェーズ（2025-11-08）→テスト完全成功。コミット: 446f914（Phase 1）, 5bd06ee（Phase 2）, b24be71（テスト）。ドキュメント: project-docs/2025-11-05-analysis-tab-statistics-redesign/, project-docs/2025-11-05-analysis-tab-comprehensive-fix/, Serena Memory: 2025-11-05-analysis-tab-statistics-bug-fix-design.md, 2025-11-06-external-ai-review-analysis-ts-bugs.md, 2025-11-08-analysis-tab-statistics-fix-session.md

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
1. **分析タブ統計バグ**: エッジケース判定の誤り + selectedUserId非対応（設計完了、実装待ち）
2. **テストコード不在**: ビジネスロジックのテストが必要
3. **バンドルサイズ**: 961KB（目標500KB以下）
4. **型安全性**: 1件のany型使用（TestTab.tsx）

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

**2025-11-05 21:18**:
- ✅ 2025-11-05-analysis-tab-statistics-bug-fix-design: 分析タブ統計機能バグ修正の設計フェーズ完了記録（2つの重大バグ、11ドキュメント、実装計画）

**2025-11-05 16:42**:
- ✅ 2025-11-04-ios-deployment-nested-directory-issue: iOS実機デプロイメント問題解決記録（誤った入れ子ディレクトリ構造）

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
- 2025-11-08 21:23: 分析タブ包括的修正計画完全完了。Phase 1（エッジケース6箇所）+ Phase 2（selectedUserId対応2箇所）+ Playwrightテスト自動化（4テストケース全成功）。コミット: 446f914, 5bd06ee, b24be71。ダッシュボード更新（現在進行中→直近完了へ移動）。
- 2025-11-05 21:18: 分析タブ統計機能バグ修正の設計フェーズ完全完了。Git commit (e9d04fe) + 新ブランチ作成（fix/analysis-tab-statistics）。Serena Memory作成（2025-11-05-analysis-tab-statistics-bug-fix-design）。実装準備完了。
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
