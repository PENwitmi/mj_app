# Phase 6: 開発ワークフロー

**作成日**: 2025-10-10 18:21
**対象**: Capacitor + iOS開発の日常作業

---

## 📋 目次

1. [日常の開発フロー](#日常の開発フロー)
2. [コマンドリファレンス](#コマンドリファレンス)
3. [デバッグワークフロー](#デバッグワークフロー)
4. [ビルド＆リリース](#ビルドリリース)
5. [ベストプラクティス](#ベストプラクティス)

---

## 日常の開発フロー

### パターン1: Web開発中心（推奨）

**Web機能実装 → 定期的にiOS確認**

```bash
# 1. 通常のWeb開発
cd /Users/nishimototakashi/claude_code/mj_app/app
npm run dev
# → http://localhost:5173 で開発

# 2. 機能実装・デバッグ（Web）

# 3. 定期的にiOSで動作確認（1日1回〜週1回）
npm run build
npx cap sync ios
npx cap open ios
# → Xcodeで実行
```

**メリット**:
- ホットリロードで高速開発
- Chrome DevToolsでデバッグ効率が良い
- ネイティブビルド時間を節約

**デメリット**:
- iOS固有の問題に気づきにくい

---

### パターン2: iOS中心開発（iOS固有機能実装時）

**iOS実機で常時確認しながら開発**

```bash
# 1. 初回ビルド＆Xcode起動
npm run build
npx cap sync ios
npx cap open ios

# 2. コード変更

# 3. 再ビルド＆同期（都度）
npm run build && npx cap sync ios

# 4. Xcodeで再実行（Cmd + R）
```

**メリット**:
- iOS固有の問題を即座に発見
- ネイティブ機能のテストが容易

**デメリット**:
- ビルド時間がかかる（毎回30秒〜1分）
- ホットリロードなし

---

### パターン3: ハイブリッド開発（バランス型）

**Web開発 + Live Reload（実験的）**

```bash
# 1. 開発サーバー起動
npm run dev

# 2. capacitor.config.tsに開発サーバーURLを設定（一時的）
```

**capacitor.config.ts（開発時のみ）**:
```typescript
const config: CapacitorConfig = {
  appId: 'com.nishimoto.mahjongtracker',
  appName: '麻雀記録アプリ',
  webDir: 'dist',
  server: {
    url: 'http://localhost:5173', // ← 開発時のみ追加
    cleartext: true,
  },
};
```

**手順**:
```bash
# 3. 同期＆Xcode起動
npx cap sync ios
npx cap open ios

# 4. Xcodeで実行 → localhost:5173に接続
# 5. コード変更でブラウザ自動リロード（Web開発と同じ）
```

**注意**:
- **本番ビルド前に`server.url`を削除すること**
- ネットワーク接続必要（Mac - iPhone同一ネットワーク）

---

## コマンドリファレンス

### 基本コマンド

#### `npm run dev`
```bash
npm run dev
```
- **用途**: Web開発サーバー起動
- **URL**: http://localhost:5173
- **ホットリロード**: 有効

---

#### `npm run build`
```bash
npm run build
```
- **用途**: 本番ビルド（静的ファイル生成）
- **出力先**: `dist/`
- **実行内容**:
  1. TypeScriptコンパイル (`tsc -b`)
  2. Viteビルド（最適化、バンドル）

---

#### `npx cap sync [platform]`
```bash
npx cap sync ios
```
- **用途**: Webアプリの変更をネイティブプロジェクトに同期
- **実行内容**:
  1. `dist/`を`ios/App/App/public/`にコピー
  2. Capacitor設定を`ios/App/App/capacitor.config.json`に反映
  3. CocoaPods依存関係更新（`pod install`）

**全プラットフォーム同期**:
```bash
npx cap sync
```

---

#### `npx cap open [platform]`
```bash
npx cap open ios
```
- **用途**: ネイティブIDEを開く（iOS: Xcode）
- **重要**: `.xcworkspace`を開く（`.xcodeproj`ではない）

---

#### `npx cap update [platform]`
```bash
npx cap update ios
```
- **用途**: Capacitor依存関係を最新に更新
- **実行内容**:
  1. `npm install`でCapacitorパッケージ更新
  2. `cap sync`と同じ処理

---

### 便利なコマンド

#### ビルド＆同期（一括）
```bash
npm run build && npx cap sync ios
```

#### ビルド＆同期＆Xcode起動（一括）
```bash
npm run build && npx cap sync ios && npx cap open ios
```

#### クリーンビルド（問題発生時）
```bash
# 1. node_modules削除＆再インストール
rm -rf node_modules package-lock.json
npm install

# 2. ビルド
npm run build

# 3. iOSプロジェクト削除＆再作成
rm -rf ios
npx cap add ios

# 4. 同期
npx cap sync ios
```

---

### Capacitorプラグイン管理

#### プラグイン追加
```bash
npm install @capacitor/[plugin-name]
npx cap sync ios
```

例:
```bash
npm install @capacitor/camera
npx cap sync ios
```

#### プラグイン削除
```bash
npm uninstall @capacitor/[plugin-name]
npx cap sync ios
```

---

## デバッグワークフロー

### Web（Chrome DevTools）

**推奨: 開発の80%はWebで**

```bash
npm run dev
```

**Chrome DevTools**:
- Console: `logger.debug/info/warn/error`出力
- Network: API通信監視
- Application > Storage > IndexedDB: データ確認
- Performance: パフォーマンス計測

---

### iOS（Safari Web Inspector）

**iOS固有の問題デバッグ時**

**手順**:
1. **iPhone設定 > Safari > 詳細 > Webインスペクタ ON**
2. **Mac Safari > 開発メニュー有効化**
3. **アプリ実行中にSafari > 開発 > [iPhone名] > [アプリ] を選択**

**できること**:
- Console出力確認
- DOM/CSSインスペクション
- Networkタブ（API通信）
- JavaScript デバッガー

**Tips**:
- `logger.info`等の出力が`[INFO]`形式で表示される
- ブレークポイント設定可能

---

### Xcode Console

**ネイティブログ確認時**

**手順**:
1. Xcodeでアプリ実行
2. 下部コンソールエリアでログ確認

**フィルター**:
```
# 特定のログレベルのみ表示
[INFO]     # logger.info出力
[ERROR]    # logger.error出力
[DEBUG]    # logger.debug出力（開発環境のみ）
```

---

### IndexedDBデバッグ

#### Web（Chrome）
```
Chrome DevTools > Application > Storage > IndexedDB > mj-app-db
```

#### iOS（Safari Web Inspector）
```
Safari Web Inspector > Storage > IndexedDB > mj-app-db
```

**確認項目**:
- `users` テーブル: 登録ユーザー
- `sessions` テーブル: セッション一覧
- `hanchans` テーブル: 半荘データ
- `player_results` テーブル: プレイヤー結果

**データ操作**:
```javascript
// Consoleで直接操作
import { db } from '@/lib/db';

// 全ユーザー取得
await db.users.toArray();

// 全セッション取得
await db.sessions.toArray();

// データ削除（テスト用）
await db.delete();
await db.open();
```

---

## ビルド＆リリース

### 開発ビルド（Development）

**用途**: 開発・テスト用

```bash
# 1. Webアプリビルド
npm run build

# 2. 同期
npx cap sync ios

# 3. Xcode起動
npx cap open ios

# 4. Xcodeで実行
# - Signing: Personal Team（無料、7日間制限）
# - Configuration: Debug
```

---

### リリースビルド（Production）

**用途**: App Store提出、TestFlight配信

#### Step 1: バージョン更新

**対象ファイル**: `app/package.json`
```json
{
  "version": "1.0.0"
}
```

**対象ファイル**: `ios/App/App/Info.plist`
```xml
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>

<key>CFBundleVersion</key>
<string>1</string>  <!-- ビルド番号、提出ごとに増加 -->
```

---

#### Step 2: 本番ビルド

```bash
# 1. クリーンビルド
rm -rf dist/
npm run build

# 2. 同期
npx cap sync ios
```

---

#### Step 3: Xcodeでリリースビルド

**手順**:
1. **Xcodeで Product > Scheme > Edit Scheme**
2. **Run > Build Configuration: Release**
3. **Archive > Build Configuration: Release**
4. **Product > Archive**（アーカイブ作成）
5. **Organizer > Distribute App**

**署名**:
- **Team**: Developer Program Team（有料$99/年）
- **Distribution Certificate**: 自動生成

---

#### Step 4: App Store Connect提出

**手順**:
1. **App Store Connectで新規アプリ作成**
   - Bundle ID: `com.nishimoto.mahjongtracker`
   - アプリ名: 麻雀記録アプリ
2. **スクリーンショット・説明文等を準備**
3. **Xcode Organizer > Distribute App > App Store Connect**
4. **App Store Connectで審査申請**

---

### TestFlight配信

**用途**: ベータテスター配信

**手順**:
1. **Xcode Organizer > Distribute App > TestFlight**
2. **App Store Connectでテスター招待**
3. **テスターがTestFlightアプリでインストール**

**メリット**:
- App Store審査より簡易
- 最大100名の外部テスター
- 90日間有効

---

## ベストプラクティス

### 1. Web開発優先

**80%の開発はWebで実施**:
- ホットリロード活用
- Chrome DevToolsで効率的デバッグ
- ビルド時間節約

**iOSは定期確認のみ**:
- 大きな機能追加後
- UI変更後
- ネイティブ機能追加時

---

### 2. Git管理

**.gitignore（既存）**:
```
dist/
ios/
android/
node_modules/
```

**重要**: `ios/`はGit管理外（`npx cap add ios`で再生成可能）

**コミット対象**:
- `capacitor.config.ts`
- `package.json` / `package-lock.json`
- `src/` (全ソースコード)
- `vite.config.ts`

---

### 3. ビルド最適化

**Vite設定**:
```typescript
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
```

**効果**:
- 初回ロード時間短縮
- キャッシュ効率向上

---

### 4. エラーハンドリング

**ネイティブプラットフォーム判定**:
```typescript
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();
const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

if (isNative) {
  // ネイティブ限定処理
}

if (platform === 'ios') {
  // iOS限定処理
}
```

**API利用時のエラーハンドリング**:
```typescript
import { StatusBar } from '@capacitor/status-bar';

try {
  if (Capacitor.isNativePlatform()) {
    await StatusBar.setStyle({ style: Style.Dark });
  }
} catch (err) {
  logger.warn('ステータスバー設定失敗', { error: err });
  // Web環境では無視
}
```

---

### 5. パフォーマンス監視

**定期的に測定**:
- アプリ起動時間（目標: < 2秒）
- セッション保存時間（目標: < 500ms）
- グラフ描画時間（目標: < 500ms）

**ツール**:
- Xcode Instruments: Time Profiler
- Safari Web Inspector: Timeline
- React DevTools: Profiler

---

### 6. テスト戦略

**開発フェーズ**:
- Web: Chrome（メイン）+ Safari（定期）
- iOS: シミュレーター（デバッグ）+ 実機（最終確認）

**リリース前**:
- 複数のiOSバージョンでテスト（iOS 13, 15, 17）
- 複数のデバイスサイズでテスト（iPhone SE, 14, 14 Pro Max）
- 低速ネットワークでテスト（オフライン含む）

---

### 7. ドキュメント更新

**変更時に即座に更新**:
- `CLAUDE.md`: プロジェクト全体の変更
- `MASTER_STATUS_DASHBOARD.md`: 進捗記録
- `project-docs/`: 詳細設計・実装ドキュメント

**記録すべき内容**:
- 新機能追加
- 問題発生＆解決
- ネイティブ設定変更

---

## トラブルシューティング

### 問題: ビルドは成功するがアプリが真っ白

**原因**: アセットパスの問題

**解決策**:
```typescript
// vite.config.ts
export default defineConfig({
  base: '', // 相対パス使用
});
```

```bash
npm run build
npx cap sync ios
```

---

### 問題: IndexedDBが動作しない（iOS）

**原因**: WKWebViewのストレージ制約

**解決策**:
1. `capacitor.config.ts`で設定確認:
```typescript
ios: {
  contentInset: 'automatic',
},
```

2. Capacitor Preferencesプラグイン追加検討:
```bash
npm install @capacitor/preferences
```

---

### 問題: CocoaPods依存関係エラー

**エラー例**:
```
[error] Error running pod install
```

**解決策**:
```bash
cd ios/App
pod repo update
pod install
cd ../..
npx cap sync ios
```

---

### 問題: Xcodeビルドエラー

**エラー例**: "Swift Compiler Error"

**解決策**:
1. **Xcode > Product > Clean Build Folder** (Cmd + Shift + K)
2. **Derived Data削除**:
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
```
3. 再ビルド

---

## チェックリスト

### 日常開発

- [ ] Web開発中心（`npm run dev`）
- [ ] 定期的にiOS確認（週1回〜）
- [ ] Git定期コミット
- [ ] ドキュメント更新

### 機能追加時

- [ ] Webで実装＆テスト
- [ ] `npm run build`成功
- [ ] iOS同期＆動作確認
- [ ] Safari Web Inspectorでデバッグ
- [ ] IndexedDBデータ確認

### リリース前

- [ ] バージョン番号更新
- [ ] Release構成でビルド
- [ ] 複数デバイス・OSでテスト
- [ ] パフォーマンス測定
- [ ] スクリーンショット準備
- [ ] App Store Connect準備

---

**更新履歴**:
- 2025-10-10 18:21: 初回作成（Capacitor開発ワークフロー）
