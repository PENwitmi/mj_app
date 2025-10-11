# Phase 6-1: iOS統合 - 詳細実装計画

**作成日**: 2025-10-10 18:21
**ステータス**: 計画中
**総予想工数**: 3-4時間

---

## 📋 目次

1. [Stage 1: 環境セットアップ](#stage-1-環境セットアップ)
2. [Stage 2: iOSプラットフォーム追加](#stage-2-iosプラットフォーム追加)
3. [Stage 3: Xcode初回実行](#stage-3-xcode初回実行)
4. [Stage 4: ネイティブ機能最適化](#stage-4-ネイティブ機能最適化)
5. [Stage 5: 動作検証・問題修正](#stage-5-動作検証問題修正)
6. [リスク分析](#リスク分析)

---

## Stage 1: 環境セットアップ

**予想工数**: 30分
**ステータス**: 未着手

### 1-1. 前提条件確認

```bash
# Node.js バージョン確認
node -v  # 18.x以上

# Xcode インストール確認
xcode-select -p  # /Applications/Xcode.app/Contents/Developer

# Xcode Command Line Tools確認
xcode-select --install  # 既にインストール済みならエラー

# CocoaPods確認（Xcodeが自動インストール）
pod --version
```

**チェックリスト**:
- [ ] Node.js 18+ インストール済み
- [ ] Xcode 15+ インストール済み
- [ ] Command Line Tools インストール済み
- [ ] `npm run build` が成功する
- [ ] Gitクリーンな状態（未コミット変更なし）

---

### 1-2. Capacitorパッケージインストール

```bash
cd /Users/nishimototakashi/claude_code/mj_app/app

# Capacitor本体
npm install @capacitor/core @capacitor/cli

# iOSプラットフォーム
npm install @capacitor/ios

# 推奨プラグイン
npm install @capacitor/status-bar @capacitor/splash-screen @capacitor/app
```

**期待される結果**:
- `package.json`の`dependencies`に追加される
- `node_modules/`に各パッケージがインストールされる

**検証方法**:
```bash
npx cap --version  # Capacitor CLIバージョン表示
```

---

### 1-3. Capacitor初期化

```bash
npx cap init
```

**対話式入力**:
```
? App name: 麻雀記録アプリ
? App ID (domain format): com.nishimoto.mahjongtracker
? Web asset directory: dist
```

**重要な設定**:
- **App ID**: 逆ドメイン形式、一意である必要あり（変更後は再ビルド必要）
- **Web asset directory**: Viteのデフォルト出力先`dist`を指定

**生成されるファイル**:
- `capacitor.config.ts` - Capacitor設定ファイル

**期待される`capacitor.config.ts`の内容**:
```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nishimoto.mahjongtracker',
  appName: '麻雀記録アプリ',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
```

---

### 1-4. Vite設定調整

**対象ファイル**: `app/vite.config.ts`

**変更内容**:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '', // ← 追加: 相対パスでアセットをロード（Capacitor対応）
});
```

**理由**:
- Capacitorでは`file://`プロトコルでアセットをロードするため
- `base: ''`で相対パスを使用することで、Webでもネイティブでも動作可能

**検証方法**:
```bash
npm run build  # エラーなくビルド成功すること
npm run preview  # ローカルプレビューで動作確認
```

---

### 1-5. main.tsx調整（Capacitor初期化）

**対象ファイル**: `app/src/main.tsx`

**変更内容**:
```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { initializeApp } from './lib/db-utils';
import { logger } from './lib/logger';
import { Capacitor } from '@capacitor/core'; // ← 追加
import { StatusBar, Style } from '@capacitor/status-bar'; // ← 追加
import { SplashScreen } from '@capacitor/splash-screen'; // ← 追加

// Capacitorネイティブ環境の判定
const isNative = Capacitor.isNativePlatform();

logger.info('アプリケーション起動開始', {
  context: 'main',
  platform: Capacitor.getPlatform(), // 'ios', 'android', 'web'
  isNative,
});

// ネイティブプラットフォーム固有の初期化
if (isNative) {
  // ステータスバー設定
  StatusBar.setStyle({ style: Style.Dark }).catch((err) => {
    logger.warn('ステータスバー設定失敗', { context: 'main', error: err });
  });

  // スプラッシュスクリーン非表示（アプリ準備完了後）
  SplashScreen.hide().catch((err) => {
    logger.warn('スプラッシュスクリーン非表示失敗', { context: 'main', error: err });
  });
}

// データベース初期化
initializeApp()
  .then(() => {
    logger.info('データベース初期化成功', { context: 'main' });

    // Reactアプリ起動
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
  })
  .catch((err) => {
    logger.error('アプリケーション初期化失敗', { context: 'main', error: err });
    // エラー表示UIを実装することも可能
    document.getElementById('root')!.innerHTML =
      '<div style="padding: 20px; text-align: center;">アプリの初期化に失敗しました。再起動してください。</div>';
  });
```

**変更点**:
- `Capacitor.isNativePlatform()`でネイティブ環境判定
- ネイティブ時のみステータスバー・スプラッシュスクリーン制御
- ログにプラットフォーム情報追加

---

### Stage 1 完了条件

- [ ] `npx cap --version`でバージョン表示
- [ ] `capacitor.config.ts`生成済み
- [ ] `vite.config.ts`に`base: ''`追加済み
- [ ] `main.tsx`にCapacitor初期化処理追加済み
- [ ] `npm run build`成功
- [ ] `npm run preview`でWebアプリ動作確認（機能性に影響なし）

---

## Stage 2: iOSプラットフォーム追加

**予想工数**: 20分
**ステータス**: 未着手

### 2-1. Webアプリビルド

```bash
cd /Users/nishimototakashi/claude_code/mj_app/app

npm run build
```

**期待される結果**:
- `dist/`ディレクトリに静的ファイル生成
- エラーなくビルド完了

**検証方法**:
```bash
ls -la dist/
# index.html, assets/ 等が存在すること
```

---

### 2-2. iOSプラットフォーム追加

```bash
npx cap add ios
```

**実行内容**:
- `ios/`ディレクトリ作成
- Xcodeプロジェクト生成
- CocoaPods初期化

**生成されるディレクトリ構造**:
```
ios/
├── App/
│   ├── App/
│   │   ├── public/          # Webアプリのコピー先（空）
│   │   ├── Assets.xcassets/ # アプリアイコン等
│   │   ├── AppDelegate.swift
│   │   ├── Info.plist       # iOS設定
│   │   └── capacitor.config.json
│   ├── App.xcodeproj/       # Xcodeプロジェクト
│   └── App.xcworkspace/     # CocoaPods使用時
├── Podfile                  # CocoaPods依存関係
└── Podfile.lock
```

---

### 2-3. 初回同期

```bash
npx cap sync ios
```

**実行内容**:
- `dist/`の内容を`ios/App/App/public/`にコピー
- CocoaPods依存関係インストール（`pod install`）
- Xcodeプロジェクト設定更新

**期待される結果**:
```
✔ Copying web assets from dist to ios/App/App/public in 123.45ms
✔ Creating capacitor.config.json in ios/App/App in 1.23ms
✔ copy ios in 456.78ms
✔ Updating iOS plugins in 12.34ms
✔ Updating iOS native dependencies with "pod install" (may take several minutes)
✔ update ios in 23.45s
```

---

### Stage 2 完了条件

- [ ] `ios/`ディレクトリ生成済み
- [ ] `ios/App/App/public/`に`dist/`の内容コピー済み
- [ ] CocoaPods依存関係インストール成功
- [ ] エラーなく`npx cap sync ios`完了

---

## Stage 3: Xcode初回実行

**予想工数**: 30分
**ステータス**: 未着手

### 3-1. Xcodeを開く

```bash
npx cap open ios
```

または直接：
```bash
open ios/App/App.xcworkspace
```

**重要**: `App.xcodeproj`ではなく`App.xcworkspace`を開くこと（CocoaPods使用時）

---

### 3-2. Signing & Capabilities設定

**手順**:
1. Xcodeプロジェクトナビゲーターで **App** をクリック
2. **Signing & Capabilities** タブを開く
3. **Automatically manage signing** にチェック
4. **Team** を選択:
   - Apple IDでログイン（Xcode > Preferences > Accounts）
   - Personal Teamを選択（無料、7日間制限あり）
   - または有料Developer Program Team
5. **Bundle Identifier** 確認:
   - `com.nishimoto.mahjongtracker`（`capacitor.config.ts`と一致）

**トラブルシューティング**:
- **Bundle Identifierが既に使用されている**: 別の一意なIDに変更
- **Team選択できない**: Apple IDログイン、または新規作成

---

### 3-3. シミュレーター実行

**手順**:
1. Xcode左上のデバイス選択で **iPhone 15 Pro** 等を選択
2. **▶️ Run** ボタンをクリック（またはCmd + R）

**期待される結果**:
- シミュレーター起動
- アプリが起動し、InputTabが表示される
- 全機能（入力、履歴、分析、設定）が動作する

**初回ビルド時間**: 3-5分（CocoaPods初回セットアップ）

---

### 3-4. 実機実行（オプション）

**手順**:
1. iPhoneをMacに接続（USBケーブル）
2. iPhone側で「このコンピュータを信頼しますか？」→ **信頼**
3. Xcode左上のデバイス選択で接続したiPhoneを選択
4. **▶️ Run** ボタンをクリック

**トラブルシューティング**:
- **デバイスが表示されない**: USB接続確認、iTunes/Finderで認識確認
- **署名エラー**: Signing & Capabilities再確認
- **「開発元を検証できません」エラー（iPhone側）**:
  - 設定 > 一般 > VPNとデバイス管理 > 開発元を信頼

---

### Stage 3 完了条件

- [ ] Xcodeでプロジェクト正常にオープン
- [ ] Signing & Capabilities設定完了
- [ ] シミュレーターでアプリ起動成功
- [ ] InputTabが正常に表示される
- [ ] （オプション）実機でアプリ起動成功

---

## Stage 4: ネイティブ機能最適化

**予想工数**: 1-2時間
**ステータス**: 未着手

### 4-1. Info.plist設定

**対象ファイル**: `ios/App/App/Info.plist`

**設定項目**:

#### オリエンテーション固定（縦向き）

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
</array>
```

#### ステータスバー設定

```xml
<key>UIViewControllerBasedStatusBarAppearance</key>
<true/>
<key>UIStatusBarStyle</key>
<string>UIStatusBarStyleLightContent</string>
```

#### アプリ名（日本語対応）

```xml
<key>CFBundleDisplayName</key>
<string>麻雀記録</string>
```

#### バージョン情報

```xml
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>
<key>CFBundleVersion</key>
<string>1</string>
```

---

### 4-2. スプラッシュスクリーン設定

**対象**: `ios/App/App/Assets.xcassets/Splash.imageset/`

**手順**:
1. スプラッシュ画像を用意（2048x2048px PNG推奨）
2. Xcodeで **Assets.xcassets** > **Splash** を開く
3. 各サイズ（1x, 2x, 3x）の画像をドラッグ&ドロップ

**シンプルな実装（背景色のみ）**:
- `ios/App/App/Assets.xcassets/Splash.imageset/Contents.json`でカラー指定
- または`LaunchScreen.storyboard`をカスタマイズ

---

### 4-3. アプリアイコン設定

**対象**: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

**必要なサイズ**:
- 20x20@2x (40x40)
- 20x20@3x (60x60)
- 29x29@2x (58x58)
- 29x29@3x (87x87)
- 40x40@2x (80x80)
- 40x40@3x (120x120)
- 60x60@2x (120x120)
- 60x60@3x (180x180)
- 1024x1024 (App Store用)

**簡単な方法**:
- アイコン生成ツール使用（例: [appicon.co](https://appicon.co/)）
- 1024x1024pxの元画像から全サイズ自動生成
- Xcodeで **Assets.xcassets** > **AppIcon** に各サイズをドラッグ&ドロップ

---

### 4-4. パフォーマンス最適化

#### Capacitor設定調整

**対象ファイル**: `capacitor.config.ts`

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nishimoto.mahjongtracker',
  appName: '麻雀記録アプリ',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // iOS WKWebView最適化
    iosScheme: 'capacitor',
    hostname: 'app',
  },
  ios: {
    contentInset: 'automatic', // セーフエリア対応
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000, // 2秒表示
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark', // 黒文字（白背景用）
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
```

#### Viteビルド最適化

**対象ファイル**: `app/vite.config.ts`

```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '',
  build: {
    target: 'es2015', // iOS Safari 10+対応
    minify: 'terser',
    sourcemap: false, // 本番では無効化
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['lucide-react', '@radix-ui/react-tabs'],
          'chart-vendor': ['recharts'],
          'db-vendor': ['dexie', 'dexie-react-hooks'],
        },
      },
    },
  },
});
```

---

### Stage 4 完了条件

- [ ] Info.plist設定完了（オリエンテーション、ステータスバー等）
- [ ] スプラッシュスクリーン設定完了
- [ ] アプリアイコン設定完了
- [ ] Capacitor設定最適化完了
- [ ] Viteビルド最適化完了
- [ ] 再ビルド＆実行で変更反映確認

---

## Stage 5: 動作検証・問題修正

**予想工数**: 1時間
**ステータス**: 未着手

### 5-1. 全機能テスト

#### InputTab（新規入力）

- [ ] プレイヤー選択（登録ユーザー、ゲスト）
- [ ] 半荘追加・削除
- [ ] 点数入力（ゼロサム検証）
- [ ] ウママーク入力（合計0検証）
- [ ] チップ入力
- [ ] レート・ウマルール変更
- [ ] 保存ボタン → IndexedDBに保存成功
- [ ] Toastメッセージ表示

#### HistoryTab（履歴）

- [ ] セッション一覧表示
- [ ] フィルタリング（期間、モード）
- [ ] ソート機能
- [ ] セッション詳細表示
- [ ] セッション削除（確認ダイアログ）
- [ ] 総合順位表示

#### AnalysisTab（分析）

- [ ] フィルター機能（期間、モード、プレイヤー）
- [ ] 統計カード表示（トータル収支、平均収支等）
- [ ] 着順分布グラフ表示
- [ ] 収支推移グラフ表示（個別/累積切替）
- [ ] チップ統計表示

#### SettingsTab（設定）

- [ ] 登録ユーザー一覧表示
- [ ] 新規ユーザー登録
- [ ] ユーザーアーカイブ
- [ ] アーカイブ済みユーザー復元
- [ ] タブ切り替えでコンソールエラーなし

---

### 5-2. IndexedDB動作確認

```javascript
// Chrome DevTools > Application > Storage > IndexedDB > mj-app-db
// または Xcodeデバッガーでログ確認
```

**確認項目**:
- [ ] セッション保存後、DBに永続化されている
- [ ] アプリ再起動後、データが保持されている
- [ ] ユーザーアーカイブ/復元が正常動作
- [ ] セッション削除が正常動作

---

### 5-3. UI調整（必要に応じて）

#### セーフエリア対応

iPhoneのノッチ・Dynamic Island対応:

**対象ファイル**: `app/src/index.css`

```css
/* セーフエリア対応（既存の場合は確認のみ） */
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

#### フォントサイズ調整

実機で文字が小さい/大きい場合の調整:

```css
/* モバイル最適化 */
@media (max-width: 640px) {
  body {
    font-size: 14px; /* 必要に応じて調整 */
  }
}
```

---

### 5-4. パフォーマンス測定

#### 起動時間

- アプリ起動からInputTab表示まで: **目標 < 2秒**

#### 操作レスポンス

- セッション保存: **目標 < 500ms**
- 履歴タブ初回表示: **目標 < 1秒**
- グラフ描画: **目標 < 500ms**

#### ツール

- Xcode Instruments: Time Profiler
- Safari Web Inspector: Timeline（ネットワーク、レンダリング）

---

### Stage 5 完了条件

- [ ] 全機能テスト完了（問題なし）
- [ ] IndexedDB動作確認完了
- [ ] UI調整完了（必要に応じて）
- [ ] パフォーマンス測定完了（目標達成）
- [ ] コンソールエラー0件
- [ ] 実機テスト完了（オプション）

---

## リスク分析

### 高リスク

| リスク | 影響 | 対策 |
|-------|-----|-----|
| **IndexedDBの互換性問題** | データ永続化失敗 | Capacitor Preferencesプラグイン追加検討 |
| **iOS WKWebViewの制約** | 一部CSS/JS動作不可 | 事前に既知の問題を調査、代替実装準備 |
| **署名・証明書問題** | アプリ実行不可 | Apple Developer Programドキュメント確認 |

### 中リスク

| リスク | 影響 | 対策 |
|-------|-----|-----|
| **パフォーマンス低下** | UI反応が遅い | Viteビルド最適化、コード分割 |
| **メモリ不足** | アプリクラッシュ | 大量データ時の最適化（ページネーション等） |

### 低リスク

| リスク | 影響 | 対策 |
|-------|-----|-----|
| **UI表示崩れ** | 一部レイアウト崩れ | CSSセーフエリア対応、実機テスト |

---

## 次のステップ

1. **Stage 1実行**: Capacitorセットアップ開始
2. **進捗記録**: MASTER_STATUS_DASHBOARD.md更新
3. **問題発生時**: `05-TROUBLESHOOTING.md`参照
4. **完了後**: Phase 6-2（Android統合）計画

---

**更新履歴**:
- 2025-10-10 18:21: 初回作成（Phase 6-1詳細実装計画）
