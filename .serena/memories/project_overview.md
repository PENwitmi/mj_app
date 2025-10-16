# プロジェクト概要

Last updated: 2025-10-12

## 目的
麻雀（Mahjong）点数記録・計算アプリ。iOS向けのネイティブアプリ（Capacitor使用）。

## 技術スタック
- **Frontend**: Vite 7.1.8 + React 19.2.0 + TypeScript 5.9.3
- **Styling**: Tailwind CSS v4.1.14 (Vite plugin使用)
- **Database**: Dexie.js 4.2.0 (IndexedDB wrapper)
- **UI Components**: shadcn/ui (Radix UI + Tailwind)
- **Charts**: Recharts 2.15.4
- **Toast Notifications**: sonner 2.0.7
- **Icons**: lucide-react 0.544.0
- **Native**: Capacitor 7.4.3 (iOS対応完了)

## データモデル (4層構造)
```
User (ユーザー)
  ↓ 1:N
Session (セッション - 1日の麻雀記録)
  ↓ 1:N
Hanchan (半荘 - 1ゲーム)
  ↓ 1:N
PlayerResult (プレイヤー結果)
  ↓ N:1 (nullable)
User (登録ユーザー)
```

## 主要エンティティ
- **User**: メインユーザー(固定ID: `main-user-fixed-id`)と登録ユーザー
  - **アーカイブシステム**: isArchived/archivedAtで論理削除管理
- **Session**: 日付単位の麻雀記録。rate、umaValue、chipRate、umaRule等の設定を保持
  - **サマリー事前計算**: summary フィールドでパフォーマンス最適化（300-800倍高速化）
  - **overallRank**: セッション内総合順位（総収支ベース）
- **Hanchan**: 個別ゲーム。半荘番号でソート、autoCalculatedフラグで自動計算済み判定
- **PlayerResult**: 各プレイヤーの点数(±形式)、ウママーク、チップ数、見学フラグ
  - **列順保持**: position フィールドで InputTab での列順を保持
  - **場代**: parlorFee フィールドでプレイヤー個別の場代を管理

## 重要な型定義
- `GameMode`: `'4-player' | '3-player'`
- `UmaRule`: `'standard' | 'second-minus'`
- `UmaMark`: `'○○○' | '○○' | '○' | '' | '✗' | '✗✗' | '✗✗✗'`
- `SessionSummary`: 事前計算されたサマリー情報（overallRank含む）

## ビジネスルール
- **ゼロサム原則**: 各半荘の点数合計は0（見学者を除く）
- **ウママーク合計**: 各半荘で必ず0になる
- **自動計算**: N-1人入力時、最後の1人を自動計算（初回のみ）
- **ウママーク自動割り当て**: 点数順位に基づき自動割り当て（手動変更可）
- **空ハンチャンフィルタリング**: 全員0点の半荘は保存前に自動除外
- **Boolean値制限**: IndexedDBのインデックスに使用不可 → in-memory filteringで対応

## 実装状況（2025-10-12更新）
- ✅ Phase 1: データベース層完成（db.ts, db-utils分割版、logger, errors）
- ✅ Phase 2: UI基盤実装完了
  - タブレイアウト（4タブ）
  - 新規入力タブ（InputTab）完成
  - PlayerSelectコンポーネント（ユーザー選択・追加）
  - NewPlayerDialogコンポーネント（新規ユーザー登録ダイアログ）
  - SettingsTab（ユーザー管理＋デフォルトウマルール設定）
  - useUsers カスタムフック（ユーザー一覧管理・アーカイブシステム）
  - ErrorBoundary実装
- ✅ Phase 2.5: ユーザーアーカイブシステム実装完了
  - 論理削除（archiveUser/restoreUser）
  - アクティブユーザー・アーカイブ済みユーザー分離管理
- ✅ Phase 3: InputTab DB保存機能実装完了
  - saveSessionWithSummary() - サマリー事前計算保存
  - toast通知システム統合
  - 保存後の履歴タブ自動遷移
- ✅ Phase 4: 履歴タブ実装完了
  - セッション一覧表示（日付降順、createdAtベース）
  - セッション詳細表示（SessionDetailDialog）
  - セッション削除機能（カスケード削除）
  - **編集機能実装完了**: セッション編集（InputTabベース）
  - useSessions カスタムフック（リアルタイムDB監視）
  - パフォーマンス最適化（サマリー事前計算で300-800倍高速化達成）
  - **総合順位表示**: SessionSummaryにoverallRank追加
- ✅ Phase 5: 分析タブ実装完了
  - 型定義6つ（PeriodType, AnalysisFilter, RankStatistics, RevenueStatistics等）
  - 統計計算関数4つ（着順・収支・ポイント・チップ）
  - フィルター関数2つ（期間・モード）
  - AnalysisFiltersコンポーネント（ユーザー・期間・モード選択）
  - 統計カード統合（4カード→1統合カード、モバイルファースト設計）
  - グラフ表示（着順統計、収支推移）
  - **着順判定方法変更**: umaMark→点数ベース（より正確な統計）
  - **重大バグ修正**: ユーザー不参加セッション除外（3層フィルター）
  - **UI改善**: 累積モードy=0参照線、createdAtソート、ラベル改善
- ✅ Phase 6: Capacitor統合・iOS対応完了
  - iOS実機・シミュレータ対応
  - safe-area調整（二重計算修正）
  - レイアウト修正（TotalsPanel flexbox化、各タブスクロール対応）
  - トースト通知位置変更（bottom-center → top-center）
  - 初期化画面遷移修正（useUsers手動リフレッシュ関数追加）
  - capacitor.config.ts設定完了
- ✅ 空ハンチャンフィルタリング機能（2025-10-07完了）
  - 全員0点データを保存前除外
  - 3層チェック実装（見学者判定、点数判定、統計精度向上）
- ✅ db-utils.ts リファクタリング完了（2025-10-09）
  - 1,380行→5モジュールに分割（users, sessions, hanchans, validation, analysis）
  - 後方互換性確保（db-utils.tsからre-export）
  - デバッグログ統一（console.log→logger.debug、構造化ログ）
- ✅ プレイヤー個別場代機能（2025-10-12完了）
  - PlayerResult型にparlorFeeフィールド追加
  - 収支計算ロジック修正（プレイヤー別場代反映）
  - SessionDetailDialog改善（不要な場代表示削除）
  - 分析タブUI改善（収支統計4段構成: プラス/マイナス/場代/計）

## コードベース統計（2025-10-12更新）
- **総ファイル数**: 44個のTS/TSXファイル
- **総コード行数**: 7,336行（TypeScript/TSX）
- **ビルドサイズ**: 961KB (minified) / 283KB (gzip)
- **主要コンポーネント**: 31個
- **カスタムフック**: 2個（useUsers, useSessions）

## データベースバージョン
- **Version 1**: 初期スキーマ
- **Version 2**: Session.summary フィールド追加（パフォーマンス最適化）

## 次のステップ
- Phase 6拡張: Android対応・ネイティブ機能実装
- データエクスポート機能（CSV/JSON）
- 高度な分析機能（対戦相手別成績、時間帯別分析）
- テストコード整備（ビジネスロジック優先）
- バンドルサイズ削減（動的import、Tree Shaking）
