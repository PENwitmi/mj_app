Last updated: 2025-10-05

# プロジェクト概要

## 目的
麻雀（Mahjong）点数記録・計算アプリ。iOS向けのネイティブアプリを想定（Capacitor使用予定）。

## 技術スタック
- **Frontend**: Vite + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 (Vite plugin使用)
- **Database**: Dexie.js (IndexedDB wrapper)
- **UI Components**: shadcn/ui (Radix UI + Tailwind)
- **Toast Notifications**: sonner (shadcn/ui)
- **Icons**: lucide-react
- **Utils**: class-variance-authority, clsx, tailwind-merge
- **Future**: Capacitor for iOS native app

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
- **Hanchan**: 個別ゲーム。半荘番号でソート、autoCalculatedフラグで自動計算済み判定
- **PlayerResult**: 各プレイヤーの点数(±形式)、ウママーク、チップ数、見学フラグ
  - **列順保持**: position フィールドで InputTab での列順を保持

## 重要な型定義
- `GameMode`: `'4-player' | '3-player'`
- `UmaRule`: `'standard' | 'second-minus'`
- `UmaMark`: `'○○○' | '○○' | '○' | '' | '✗' | '✗✗' | '✗✗✗'`
- `SessionSummary`: 事前計算されたサマリー情報

## ビジネスルール
- **ゼロサム原則**: 各半荘の点数合計は0（見学者を除く）
- **ウママーク合計**: 各半荘で必ず0になる
- **自動計算**: N-1人入力時、最後の1人を自動計算（初回のみ）
- **ウママーク自動割り当て**: 点数順位に基づき自動割り当て（手動変更可）
- **Boolean値制限**: IndexedDBのインデックスに使用不可 → in-memory filteringで対応

## 実装状況（2025-10-05更新）
- ✅ Phase 1: データベース層完成（db.ts, db-utils.ts, logger, errors）
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
- ✅ Phase 4: 履歴タブ実装（Stage 1-3完了）
  - セッション一覧表示（日付降順）
  - セッション詳細表示（SessionDetailDialog）
  - セッション削除機能（カスケード削除）
  - useSessions カスタムフック（リアルタイムDB監視）
  - パフォーマンス最適化（300-800倍高速化達成）
- 🚧 Phase 4: 編集機能・UI/UX改善（未実装）
- 🚧 Phase 5: 分析タブ実装予定

## データベースバージョン
- **Version 1**: 初期スキーマ
- **Version 2**: Session.summary フィールド追加（パフォーマンス最適化）
