# Phase 6: Capacitor統合 - プロジェクト概要

**作成日**: 2025-10-10 18:21
**ステータス**: 計画中
**予想工数**: 3-4時間（初回セットアップ）

---

## 📋 目次

1. [プロジェクト目的](#プロジェクト目的)
2. [対象プラットフォーム](#対象プラットフォーム)
3. [技術スタック](#技術スタック)
4. [フェーズ構成](#フェーズ構成)
5. [前提条件](#前提条件)
6. [成果物](#成果物)

---

## 🎯 プロジェクト目的

### 主要目標

**既存のVite + React Webアプリを、iOS/Androidネイティブアプリに変換する**

- **Phase 6-1**: iOSアプリ化（優先）
- **Phase 6-2**: Androidアプリ化（次フェーズ）

### 背景

- Phase 1-5でWebアプリの基本機能が完成
- IndexedDBでローカルデータ永続化済み
- モバイルファーストUI設計済み（iPhone対応済み）
- ネイティブアプリ化により、アプリストア配信・オフライン動作を実現

### 期待効果

1. **App Store配信**: iOSユーザーへの配信
2. **ネイティブ体験**: フルスクリーン、ステータスバー制御
3. **将来的な拡張**: ネイティブ機能（カメラ、位置情報、共有等）利用可能に
4. **オフライン完全対応**: PWAより信頼性の高いオフライン動作

---

## 📱 対象プラットフォーム

### Phase 6-1: iOS（優先）

| 項目 | 詳細 |
|------|------|
| **最小対応バージョン** | iOS 13.0+ |
| **推奨対応バージョン** | iOS 15.0+ |
| **対象デバイス** | iPhone（縦向き固定） |
| **開発環境** | Xcode 15+, macOS Sonoma+ |
| **テスト環境** | iPhone実機 + シミュレーター |

### Phase 6-2: Android（次フェーズ）

| 項目 | 詳細 |
|------|------|
| **最小対応バージョン** | Android 5.0 (API 21)+ |
| **推奨対応バージョン** | Android 8.0 (API 26)+ |
| **開発環境** | Android Studio |
| **テスト環境** | エミュレーター + 実機 |

---

## 🛠️ 技術スタック

### Capacitor

**バージョン**: 6.x（最新安定版）

**主要パッケージ**:
- `@capacitor/core` - コアAPI
- `@capacitor/cli` - CLIツール
- `@capacitor/ios` - iOSプラットフォーム
- `@capacitor/android` - Androidプラットフォーム（Phase 6-2）

**推奨プラグイン**:
- `@capacitor/status-bar` - ステータスバー制御
- `@capacitor/preferences` - ネイティブストレージ（IndexedDB補完）
- `@capacitor/splash-screen` - スプラッシュスクリーン
- `@capacitor/app` - アプリライフサイクル管理

### 既存技術スタック（変更なし）

- **Frontend**: Vite + React 19 + TypeScript
- **UI**: Tailwind CSS v4, shadcn/ui
- **Database**: Dexie.js (IndexedDB wrapper)
- **State Management**: React Context API
- **Charts**: Recharts

---

## 📐 フェーズ構成

### Phase 6-1: iOS統合（本フェーズ）

```
Stage 1: 環境セットアップ（30分）
├── Capacitorパッケージインストール
├── cap init（アプリID、名前設定）
└── Vite設定調整（base: ''）

Stage 2: iOSプラットフォーム追加（20分）
├── npm run build
├── npx cap add ios
└── npx cap sync ios

Stage 3: Xcode初回実行（30分）
├── npx cap open ios
├── Signing & Capabilities設定
└── シミュレーター/実機実行

Stage 4: ネイティブ機能最適化（1-2時間）
├── ステータスバー設定
├── オリエンテーション固定（縦向き）
├── スプラッシュスクリーン設定
└── アプリアイコン設定

Stage 5: 動作検証・問題修正（1時間）
├── 全機能テスト（InputTab, HistoryTab, AnalysisTab, SettingsTab）
├── IndexedDB動作確認
└── UI調整（必要に応じて）
```

### Phase 6-2: Android統合（次フェーズ）

```
Stage 1: Android Studio環境準備
Stage 2: npx cap add android
Stage 3: Android固有設定
Stage 4: 動作検証
```

---

## ✅ 前提条件

### 開発環境

- [x] **macOS**: Xcode実行環境
- [x] **Xcode 15+**: App Storeからインストール済み
- [x] **Xcode Command Line Tools**: `xcode-select --install`
- [x] **Node.js 18+**: npm利用可能
- [x] **iPhone実機**: 実機テスト用（オプション）

### プロジェクト状態

- [x] **Phase 1-5完了**: 全機能実装済み
- [x] **動作確認済み**: `npm run dev`で正常動作
- [x] **ビルド成功**: `npm run build`でエラーなし
- [x] **Git管理**: コミット済み、クリーンな状態

### Apple Developer

- [ ] **Apple ID**: 無料でもテスト可能（7日間制限あり）
- [ ] **Apple Developer Program**: App Store配信には年間$99必要（TestFlightも含む）

---

## 📦 成果物

### コード成果物

```
mj_app/
├── app/
│   ├── capacitor.config.ts        # NEW: Capacitor設定
│   ├── ios/                       # NEW: iOSプロジェクト
│   │   ├── App/
│   │   │   ├── App/
│   │   │   │   ├── public/        # Webアプリのビルド結果
│   │   │   │   ├── Assets.xcassets/  # アプリアイコン
│   │   │   │   └── Info.plist     # iOS設定
│   │   │   └── App.xcodeproj/     # Xcodeプロジェクト
│   │   └── Podfile                # CocoaPods依存関係
│   ├── src/
│   │   └── main.tsx               # MODIFIED: Capacitor初期化処理追加
│   └── vite.config.ts             # MODIFIED: base: '' 追加
```

### ドキュメント成果物

- [x] `01-CAPACITOR_INTEGRATION_OVERVIEW.md` - 本ドキュメント
- [ ] `02-IMPLEMENTATION_PLAN.md` - 詳細実装計画
- [ ] `03-IOS_SETUP_GUIDE.md` - iOS設定ガイド
- [ ] `04-DEVELOPMENT_WORKFLOW.md` - 開発ワークフロー
- [ ] `05-TROUBLESHOOTING.md` - トラブルシューティング

---

## 🎯 次のステップ

1. **実装計画書レビュー**: `02-IMPLEMENTATION_PLAN.md`
2. **環境確認**: Xcode、Command Line Toolsインストール確認
3. **Stage 1実行**: Capacitorセットアップ開始

---

## 📚 参考リンク

- [Capacitor公式ドキュメント](https://capacitorjs.com/docs)
- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [Vite + Capacitor Guide](https://capacitorjs.com/docs/guides/vite)
- [Apple Developer Portal](https://developer.apple.com)

---

**更新履歴**:
- 2025-10-10 18:21: 初回作成（Phase 6プロジェクト概要）
