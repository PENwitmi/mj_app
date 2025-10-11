# Phase 6-1: iOS設定ガイド

**作成日**: 2025-10-10 18:21
**対象**: iOS 13.0+
**開発環境**: Xcode 15+, macOS Sonoma+

---

## 📋 目次

1. [Info.plist完全設定](#infoplist完全設定)
2. [Signing & Capabilities](#signing--capabilities)
3. [アプリアイコン設定](#アプリアイコン設定)
4. [スプラッシュスクリーン設定](#スプラッシュスクリーン設定)
5. [ビルド設定](#ビルド設定)
6. [デバッグ設定](#デバッグ設定)

---

## Info.plist完全設定

**対象ファイル**: `ios/App/App/Info.plist`

### 基本設定

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- アプリ名（ホーム画面表示名） -->
  <key>CFBundleDisplayName</key>
  <string>麻雀記録</string>

  <!-- Bundle Identifier（capacitor.config.tsと一致させる） -->
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>

  <!-- バージョン番号 -->
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>

  <!-- ビルド番号（App Store提出時に増加） -->
  <key>CFBundleVersion</key>
  <string>1</string>

  <!-- 最小iOS対応バージョン -->
  <key>MinimumOSVersion</key>
  <string>13.0</string>

  <!-- アプリ種別 -->
  <key>CFBundlePackageType</key>
  <string>APPL</string>

  <!-- 実行ファイル名 -->
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
</dict>
</plist>
```

---

### オリエンテーション設定

**縦向き固定（推奨）**:

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
</array>

<!-- iPadサポート時（将来的に） -->
<key>UISupportedInterfaceOrientations~ipad</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
  <string>UIInterfaceOrientationPortraitUpsideDown</string>
</array>
```

**全方向サポート（オプション）**:

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
  <string>UIInterfaceOrientationPortraitUpsideDown</string>
  <string>UIInterfaceOrientationLandscapeLeft</string>
  <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```

---

### ステータスバー設定

```xml
<!-- ステータスバーをViewController単位で制御 -->
<key>UIViewControllerBasedStatusBarAppearance</key>
<true/>

<!-- デフォルトスタイル（黒文字） -->
<key>UIStatusBarStyle</key>
<string>UIStatusBarStyleDefault</string>

<!-- または白文字（ダークモード用） -->
<!-- <string>UIStatusBarStyleLightContent</string> -->

<!-- ステータスバー非表示にする場合 -->
<!-- <key>UIStatusBarHidden</key> -->
<!-- <true/> -->
```

---

### セーフエリア・ノッチ対応

```xml
<!-- ホームインジケーター非表示（オプション） -->
<key>UIRequiresFullScreen</key>
<false/>

<!-- セーフエリア自動対応 -->
<!-- capacitor.config.ts の ios.contentInset: 'automatic' で制御 -->
```

---

### Capacitor設定

```xml
<!-- Capacitorサーバー設定 -->
<key>WKAppBoundDomains</key>
<array>
  <string>app</string>
</array>

<!-- ファイルアクセス許可 -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsLocalNetworking</key>
  <true/>
  <key>NSAllowsArbitraryLoadsInWebContent</key>
  <true/>
</dict>
```

---

### 権限設定（必要に応じて）

**カメラアクセス（将来的に）**:

```xml
<key>NSCameraUsageDescription</key>
<string>麻雀の記録写真を撮影するために使用します</string>
```

**フォトライブラリアクセス（将来的に）**:

```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>麻雀の記録写真を保存・読み込むために使用します</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>麻雀の記録写真を保存するために使用します</string>
```

**位置情報アクセス（将来的に）**:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>麻雀の対局場所を記録するために使用します</string>
```

---

### その他の推奨設定

```xml
<!-- ダークモード対応（自動） -->
<key>UIUserInterfaceStyle</key>
<string>Automatic</string>

<!-- または強制ライトモード -->
<!-- <string>Light</string> -->

<!-- バックグラウンド更新（必要に応じて） -->
<key>UIBackgroundModes</key>
<array>
  <!-- <string>fetch</string> -->
  <!-- <string>remote-notification</string> -->
</array>

<!-- アプリアイコン代替名（将来的に） -->
<key>CFBundleIcons</key>
<dict>
  <key>CFBundlePrimaryIcon</key>
  <dict>
    <key>CFBundleIconFiles</key>
    <array>
      <string>AppIcon</string>
    </array>
  </dict>
</dict>
```

---

## Signing & Capabilities

### Automatic Signingの設定

1. **Xcodeプロジェクトナビゲーターで「App」を選択**
2. **Signing & Capabilities タブを開く**
3. **Automatically manage signing にチェック**
4. **Team を選択**:
   - Apple IDでログイン（Xcode > Settings > Accounts）
   - **Personal Team** (無料) または **Developer Program Team** (有料$99/年)

---

### Bundle Identifier

**重要**: 一意である必要があり、変更後は再ビルド必須

**形式**: 逆ドメイン形式（例: `com.nishimoto.mahjongtracker`）

**変更方法**:
1. `capacitor.config.ts`の`appId`を変更
2. Xcodeで**General > Identity > Bundle Identifier**を変更
3. `npx cap sync ios`を実行

---

### Capabilities（必要に応じて追加）

Xcode > Signing & Capabilities > **+ Capability**

**現時点で不要**:
- Push Notifications
- iCloud
- Game Center
- Sign in with Apple

**将来的に検討**:
- **App Groups**: データ共有（ウィジェット等）
- **Background Modes**: バックグラウンド処理

---

### Provisioning Profile

**開発時（Development）**:
- **Personal Team**: 自動生成（7日間有効、期限切れ後は再署名）
- **Developer Program**: 自動生成（1年間有効）

**配信時（Distribution）**:
- **App Store**: App Store Connectで設定
- **Ad Hoc**: Developer Portalで手動作成
- **Enterprise**: Enterprise Programのみ

---

## アプリアイコン設定

### 必要なサイズ一覧

| 用途 | サイズ | ファイル名 |
|------|--------|-----------|
| iPhone Notification | 20x20@2x (40x40) | icon-20@2x.png |
| iPhone Notification | 20x20@3x (60x60) | icon-20@3x.png |
| iPhone Settings | 29x29@2x (58x58) | icon-29@2x.png |
| iPhone Settings | 29x29@3x (87x87) | icon-29@3x.png |
| iPhone Spotlight | 40x40@2x (80x80) | icon-40@2x.png |
| iPhone Spotlight | 40x40@3x (120x120) | icon-40@3x.png |
| iPhone App | 60x60@2x (120x120) | icon-60@2x.png |
| iPhone App | 60x60@3x (180x180) | icon-60@3x.png |
| App Store | 1024x1024@1x | icon-1024.png |

---

### 設定手順

#### 方法1: Xcodeで手動設定

1. **Xcodeでプロジェクトを開く**
2. **Assets.xcassets > AppIcon を選択**
3. **各サイズの画像をドラッグ&ドロップ**

#### 方法2: アイコン生成ツール使用（推奨）

**ツール例**:
- [appicon.co](https://appicon.co/) - オンライン無料
- [Icon Set Creator](https://apps.apple.com/app/icon-set-creator/id939343785) - Mac App Store
- [App Icon Generator](https://www.npmjs.com/package/app-icon) - npm CLI

**手順（appicon.co）**:
1. 1024x1024pxのアイコン画像をアップロード
2. **iOS** を選択してダウンロード
3. 生成されたファイルをXcodeの`AppIcon.appiconset/`に配置

---

### デザインガイドライン

**Apple Human Interface Guidelines**:
- **シンプル**: 複雑なディテールは避ける
- **認識しやすい**: 小さいサイズでも識別可能
- **背景透明不可**: 必ず背景色を設定
- **角丸不要**: iOSが自動で角丸処理
- **テキスト最小限**: アプリ名はアイコン下に表示される

**麻雀アプリのアイコン案**:
- 麻雀牌のシンプルなシルエット（例: 「發」「中」）
- カラースキーム: 緑と白（麻雀牌の定番色）
- または数字（点数をイメージ）

---

## スプラッシュスクリーン設定

### 画像設定

**対象**: `ios/App/App/Assets.xcassets/Splash.imageset/`

**必要なサイズ**:
- 1x: 2048x2048px
- 2x: 4096x4096px (通常2xで十分)
- 3x: 6144x6144px (通常不要)

**設定手順**:
1. Xcodeで**Assets.xcassets > Splash**を選択
2. 各サイズの画像をドラッグ&ドロップ

---

### Storyboard設定

**対象**: `ios/App/App/Base.lproj/LaunchScreen.storyboard`

**シンプルな実装（背景色のみ）**:
1. Xcodeで`LaunchScreen.storyboard`を開く
2. **View Controller**を選択
3. **Attributes Inspector**で**Background Color**を設定
4. 中央にアプリ名ラベル配置（オプション）

---

### capacitor.config.ts設定

```typescript
plugins: {
  SplashScreen: {
    launchShowDuration: 2000, // 2秒表示
    launchAutoHide: true,     // 自動非表示
    backgroundColor: '#ffffff',
    androidSpinnerStyle: 'small',
    iosSpinnerStyle: 'small',
    spinnerColor: '#000000',
    showSpinner: false,        // スピナー非表示
    splashFullScreen: true,
    splashImmersive: true,
  },
}
```

---

### プログラムから制御

**対象ファイル**: `app/src/main.tsx`

```typescript
import { SplashScreen } from '@capacitor/splash-screen';

// アプリ初期化完了後に非表示
initializeApp()
  .then(() => {
    SplashScreen.hide();
  });

// または表示を延長
SplashScreen.show({
  showDuration: 3000,
  autoHide: true,
});
```

---

## ビルド設定

### Xcode Build Settings

**推奨設定**:

| 項目 | 設定値 | 理由 |
|------|--------|------|
| **iOS Deployment Target** | 13.0 | iOS 13以上サポート |
| **Swift Language Version** | Swift 5 | 最新安定版 |
| **Build Active Architecture Only** | Debug: Yes, Release: No | ビルド時間短縮 |
| **Enable Bitcode** | No | Capacitorはビットコード非対応 |
| **Optimization Level** | Debug: -Onone, Release: -O | デバッグ効率とパフォーマンス |

---

### Build Phases

**既定の順序**:
1. **Target Dependencies**
2. **[CP] Check Pods Manifest.lock** (CocoaPods)
3. **Sources** (Swift/Objective-Cコンパイル)
4. **Resources** (アセットコピー)
5. **Embed Frameworks**
6. **[CP] Embed Pods Frameworks** (CocoaPods)
7. **[CP] Copy Pods Resources** (CocoaPods)

**カスタムスクリプト（必要に応じて）**:
- ビルド番号自動増加
- 環境変数設定

---

## デバッグ設定

### Safari Web Inspector

**有効化手順**:
1. **iPhoneで設定 > Safari > 詳細 > Webインスペクタ ON**
2. **Mac Safari > 開発メニュー有効化**:
   - Safari > Settings > Advanced > Show Develop menu in menu bar
3. **アプリ実行中にSafari > 開発 > [デバイス名] > [アプリ名] を選択**

**できること**:
- Console.logの確認
- DOMインスペクション
- Network監視
- JavaScript デバッグ

---

### Xcode Console

**ログの確認**:
1. **Xcodeでアプリを実行**
2. **下部のConsoleエリアで出力確認**

**フィルター**:
- `logger.info` → `[INFO]`で検索
- `logger.error` → `[ERROR]`で検索

---

### React DevTools

**セットアップ（オプション）**:
```bash
npm install -g react-devtools

# 別ターミナルで起動
react-devtools
```

**接続**:
- アプリ起動時に自動接続（開発ビルドの場合）

---

## トラブルシューティング

### ビルドエラー: "Code Signing Error"

**原因**: 証明書・Provisioning Profile不足

**解決策**:
1. Xcode > Settings > Accounts > Download Manual Profiles
2. Signing & Capabilities再設定
3. Clean Build Folder (Cmd + Shift + K) → 再ビルド

---

### 実行エラー: "Could not launch [App]"

**原因**: 開発者信頼設定未完了

**解決策（iPhone側）**:
1. 設定 > 一般 > VPNとデバイス管理
2. 開発元（Apple IDのメールアドレス）をタップ
3. **信頼**をタップ

---

### アセットが表示されない

**原因**: `base`設定ミス、または同期忘れ

**解決策**:
1. `vite.config.ts`で`base: ''`を確認
2. `npm run build`を再実行
3. `npx cap sync ios`を実行
4. Xcodeで再ビルド

---

## チェックリスト

### 初回セットアップ完了時

- [ ] Info.plist設定完了
- [ ] Signing & Capabilities設定完了
- [ ] アプリアイコン設定完了（1024x1024含む）
- [ ] スプラッシュスクリーン設定完了
- [ ] ビルド設定確認完了
- [ ] Safari Web Inspector接続確認
- [ ] シミュレーターで正常起動
- [ ] 実機で正常起動（オプション）

### App Store提出前（将来）

- [ ] バージョン番号更新（CFBundleShortVersionString）
- [ ] ビルド番号増加（CFBundleVersion）
- [ ] Release構成でビルド成功
- [ ] App Storeアイコン1024x1024設定
- [ ] スクリーンショット準備（各サイズ）
- [ ] プライバシーポリシー準備
- [ ] App Store Connectメタデータ入力

---

**更新履歴**:
- 2025-10-10 18:21: 初回作成（iOS設定完全ガイド）
