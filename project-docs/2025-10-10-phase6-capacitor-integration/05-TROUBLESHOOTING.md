# Phase 6: トラブルシューティングガイド

**作成日**: 2025-10-10 18:21
**対象**: Capacitor + iOS開発での一般的な問題と解決策

---

## 📋 目次

1. [ビルド＆同期エラー](#ビルド同期エラー)
2. [Xcodeエラー](#xcodeエラー)
3. [実行時エラー](#実行時エラー)
4. [UI表示問題](#ui表示問題)
5. [パフォーマンス問題](#パフォーマンス問題)
6. [IndexedDB問題](#indexeddb問題)
7. [ネイティブプラグイン問題](#ネイティブプラグイン問題)

---

## ビルド＆同期エラー

### エラー: "Cannot find module '@capacitor/core'"

**原因**: Capacitorパッケージ未インストール

**解決策**:
```bash
npm install @capacitor/core @capacitor/cli
```

---

### エラー: "capacitor.config.ts not found"

**原因**: Capacitor未初期化

**解決策**:
```bash
npx cap init
# 対話式で appId, appName, webDir を入力
```

---

### エラー: "webDir 'dist' does not exist"

**原因**: Webアプリ未ビルド

**解決策**:
```bash
npm run build  # 先にWebアプリをビルド
npx cap sync ios
```

---

### エラー: "[!] CocoaPods could not find compatible versions for pod..."

**原因**: CocoaPods依存関係の競合

**解決策1（推奨）**:
```bash
cd ios/App
pod repo update
pod install
cd ../..
npx cap sync ios
```

**解決策2（強制再インストール）**:
```bash
cd ios/App
rm -rf Pods/ Podfile.lock
pod install
cd ../..
```

---

### エラー: "Error: EACCES: permission denied"

**原因**: ファイル権限不足

**解決策**:
```bash
# node_modules, package-lock.json削除＆再インストール
rm -rf node_modules package-lock.json
npm install
```

**重要**: `sudo npm install`は使用しない（権限問題の原因）

---

### エラー: "npx cap sync ios" が途中で止まる

**原因**: CocoaPodsの初回インストールに時間がかかる

**確認方法**:
```bash
# 別ターミナルで進捗確認
tail -f ios/App/Pods/Pods.log
```

**解決策**: 10分程度待つ（初回のみ）

---

## Xcodeエラー

### エラー: "Signing for 'App' requires a development team"

**原因**: 署名設定未完了

**解決策**:
1. Xcode > Settings > Accounts > Add Apple ID
2. プロジェクト > Signing & Capabilities
3. **Automatically manage signing** チェック
4. **Team** を選択（Personal Team可）

---

### エラー: "Failed to code sign 'App'"

**原因**: Provisioning Profile問題

**解決策1（証明書再生成）**:
1. Xcode > Settings > Accounts > Manage Certificates
2. **+ 追加** > Apple Development
3. プロジェクトで再署名

**解決策2（クリーンビルド）**:
```bash
# Xcode
Product > Clean Build Folder (Cmd + Shift + K)

# Derived Data削除
rm -rf ~/Library/Developer/Xcode/DerivedData

# 再ビルド
```

---

### エラー: "No such module 'Capacitor'"

**原因**: CocoaPods依存関係未インストール

**解決策**:
```bash
cd ios/App
pod install
cd ../..
```

---

### エラー: "Swift Compiler Error" (大量のエラー)

**原因**: Swift/Objective-C混在、依存関係ミス

**解決策（全クリーン＆再構築）**:
```bash
# 1. iOSプロジェクト削除
rm -rf ios/

# 2. node_modules削除＆再インストール
rm -rf node_modules package-lock.json
npm install

# 3. Webアプリ再ビルド
npm run build

# 4. iOSプロジェクト再作成
npx cap add ios
npx cap sync ios

# 5. Xcode起動
npx cap open ios
```

---

### エラー: "Command PhaseScriptExecution failed with a nonzero exit code"

**原因**: カスタムビルドスクリプト実行失敗

**解決策**:
1. Xcode > Build Phases > Run Script で該当スクリプト確認
2. スクリプト内容を手動実行してエラー特定
3. 必要に応じてスクリプト修正

**一時回避（開発時のみ）**:
- 該当Run Scriptのチェックを外す

---

## 実行時エラー

### エラー: "Could not launch [App]"（iPhone実機）

**原因**: 開発者信頼設定未完了

**解決策（iPhone側）**:
1. 設定 > 一般 > VPNとデバイス管理
2. 開発元（Apple IDメールアドレス）タップ
3. **[開発元]を信頼** タップ

---

### エラー: アプリが真っ白（空白画面）

**原因1**: アセットパスの問題

**解決策**:
```typescript
// vite.config.ts
export default defineConfig({
  base: '', // 必須: 相対パスを使用
});
```

```bash
npm run build
npx cap sync ios
```

**原因2**: JavaScriptエラー

**デバッグ方法**:
1. Safari Web Inspector接続
2. Consoleでエラー確認
3. エラー箇所修正

---

### エラー: "Failed to load resource: net::ERR_FILE_NOT_FOUND"

**原因**: アセット同期ミス

**解決策**:
```bash
# 1. distディレクトリ削除＆再ビルド
rm -rf dist/
npm run build

# 2. 同期
npx cap sync ios

# 3. Xcodeで再実行
```

---

### エラー: "IndexedDB is not available"

**原因**: iOS WKWebViewのストレージ制約

**解決策**:

**capacitor.config.ts設定**:
```typescript
ios: {
  contentInset: 'automatic',
},
```

**Capacitor Preferencesプラグイン追加検討**:
```bash
npm install @capacitor/preferences
```

**代替実装例**:
```typescript
import { Preferences } from '@capacitor/preferences';

// 永続化データ保存
await Preferences.set({
  key: 'userData',
  value: JSON.stringify(data),
});

// データ取得
const { value } = await Preferences.get({ key: 'userData' });
const data = JSON.parse(value || '{}');
```

---

### エラー: アプリが起動後すぐクラッシュ

**デバッグ方法**:

**Xcode Console確認**:
```
# クラッシュログ確認
Xcode > Window > Devices and Simulators > View Device Logs
```

**Safari Web Inspector**:
1. アプリ起動直後にSafari > 開発 > [デバイス] > [アプリ]
2. Consoleでエラー確認

**一般的な原因**:
- `main.tsx`の初期化エラー
- IndexedDB初期化失敗
- ネイティブプラグインのAPI呼び出しエラー

---

## UI表示問題

### 問題: ステータスバーが透過して文字が重なる

**原因**: セーフエリア未対応

**解決策**:

**CSS対応**:
```css
/* src/index.css */
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

**または**:
```css
#root {
  padding-top: env(safe-area-inset-top);
  min-height: 100vh;
}
```

---

### 問題: 画面下部がホームバーに隠れる

**原因**: セーフエリア下部未対応

**解決策**:
```css
body {
  padding-bottom: env(safe-area-inset-bottom);
}

/* またはフッター要素に直接 */
.tab-bar {
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

### 問題: フォントが小さすぎる/大きすぎる

**原因**: iOS SafariのフォントレンダリングがChromeと異なる

**解決策**:
```css
/* モバイル専用フォントサイズ */
@media (max-width: 640px) {
  body {
    font-size: 16px; /* iOS最小推奨サイズ */
  }

  .text-sm {
    font-size: 14px;
  }

  .text-xs {
    font-size: 12px;
  }
}
```

---

### 問題: CSSアニメーションがカクカクする

**原因**: iOS Safari GPU加速未使用

**解決策**:
```css
.animated-element {
  /* GPU加速有効化 */
  transform: translateZ(0);
  will-change: transform;
}

/* または */
.animated-element {
  transform: translate3d(0, 0, 0);
}
```

---

### 問題: スクロールが慣性スクロールにならない

**原因**: iOS Safariのデフォルト挙動

**解決策**:
```css
.scrollable-area {
  -webkit-overflow-scrolling: touch;
  overflow-y: auto;
}
```

---

### 問題: インプットフォーカス時に画面がズームされる

**原因**: iOS Safariのフォントサイズ16px未満時の挙動

**解決策**:
```css
/* インプット要素のフォントサイズを16px以上に */
input, textarea, select {
  font-size: 16px;
}
```

**または`<meta>`タグで無効化**:
```html
<!-- index.htmlに追加 -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
```

**注意**: ユーザーのアクセシビリティを損なうため推奨しない

---

## パフォーマンス問題

### 問題: アプリ起動が遅い（3秒以上）

**原因1**: バンドルサイズ大きすぎ

**解決策（コード分割）**:
```typescript
// vite.config.ts
build: {
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

**原因2**: 初期化処理が重い

**解決策（遅延ロード）**:
```typescript
// main.tsx
import { SplashScreen } from '@capacitor/splash-screen';

// スプラッシュスクリーン表示延長
SplashScreen.show({ autoHide: false });

// 初期化完了後に非表示
initializeApp().then(() => {
  SplashScreen.hide();
  // Reactレンダリング
});
```

---

### 問題: スクロールがカクカクする

**原因**: 大量のDOM要素、重い再レンダリング

**解決策1（仮想スクロール）**:
```bash
npm install react-window
```

```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={sessions.length}
  itemSize={80}
>
  {({ index, style }) => (
    <div style={style}>
      <SessionItem session={sessions[index]} />
    </div>
  )}
</FixedSizeList>
```

**解決策2（React.memo）**:
```typescript
const SessionItem = React.memo(({ session }) => {
  // ...
}, (prevProps, nextProps) => {
  return prevProps.session.id === nextProps.session.id;
});
```

---

### 問題: グラフ描画が遅い

**原因**: Rechartsの再レンダリング最適化不足

**解決策**:
```typescript
const MemoizedChart = React.memo(() => {
  return (
    <BarChart data={data}>
      {/* ... */}
    </BarChart>
  );
}, (prevProps, nextProps) => {
  // データが変わってない場合は再レンダリングしない
  return JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data);
});
```

---

### 問題: メモリ使用量が多い（クラッシュ）

**原因**: メモリリーク、大量データ保持

**デバッグ方法**:
```
Xcode > Product > Profile > Allocations
```

**解決策**:
```typescript
// useEffect cleanup関数を必ず実装
useEffect(() => {
  const subscription = db.sessions.subscribe(...);

  return () => {
    subscription.unsubscribe(); // クリーンアップ
  };
}, []);

// 不要なデータはnull/undefinedにする
const [largeData, setLargeData] = useState(null);

// コンポーネントアンマウント時
useEffect(() => {
  return () => {
    setLargeData(null);
  };
}, []);
```

---

## IndexedDB問題

### 問題: データが保存されない

**原因1**: iOS WKWebViewのストレージクォータ

**確認方法**:
```javascript
navigator.storage.estimate().then(estimate => {
  console.log('使用量:', estimate.usage);
  console.log('制限:', estimate.quota);
});
```

**解決策**: Capacitor Preferencesに移行検討

**原因2**: トランザクションエラー

**デバッグ方法**:
```typescript
try {
  await db.sessions.add(session);
} catch (err) {
  logger.error('セッション保存失敗', { error: err, session });
  throw err;
}
```

---

### 問題: データがアプリ再起動後に消える

**原因**: iOS WKWebViewのデータ削除ポリシー

**対策**:

**1. Capacitor Preferencesで重要データをバックアップ**:
```typescript
import { Preferences } from '@capacitor/preferences';

// 保存時
await Preferences.set({
  key: 'backup_sessions',
  value: JSON.stringify(sessions),
});

// 復元時
const { value } = await Preferences.get({ key: 'backup_sessions' });
if (value) {
  const sessions = JSON.parse(value);
  // IndexedDBに復元
}
```

**2. IndexedDB永続化リクエスト**:
```typescript
if (navigator.storage && navigator.storage.persist) {
  const isPersisted = await navigator.storage.persist();
  logger.info('ストレージ永続化', { isPersisted });
}
```

---

### 問題: IndexedDB初期化が遅い

**原因**: 大量データ、インデックス再構築

**解決策（遅延初期化）**:
```typescript
// main.tsx
// スプラッシュスクリーン表示中に初期化
SplashScreen.show({ autoHide: false });

initializeApp()
  .then(() => {
    SplashScreen.hide();
    // Reactレンダリング
  });
```

---

## ネイティブプラグイン問題

### 問題: StatusBar.setStyle() が効かない

**原因1**: Info.plist設定ミス

**確認**: `ios/App/App/Info.plist`
```xml
<key>UIViewControllerBasedStatusBarAppearance</key>
<true/>
```

**原因2**: タイミング問題

**解決策**:
```typescript
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

App.addListener('appStateChange', ({ isActive }) => {
  if (isActive) {
    StatusBar.setStyle({ style: Style.Dark });
  }
});
```

---

### 問題: SplashScreen.hide() が効かない

**原因**: 設定ミス、または呼び出しタイミング

**デバッグ方法**:
```typescript
logger.info('スプラッシュスクリーン非表示開始');
await SplashScreen.hide();
logger.info('スプラッシュスクリーン非表示完了');
```

**解決策（強制非表示）**:
```typescript
setTimeout(() => {
  SplashScreen.hide();
}, 3000); // 3秒後に強制非表示
```

---

### 問題: プラグインAPI呼び出しでエラー

**エラー例**: "capacitor.plugins.[PluginName] is not available"

**原因**: プラグイン未同期、またはWeb非対応

**解決策**:
```bash
npx cap sync ios
```

**プラットフォーム判定して呼び出し**:
```typescript
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  // ネイティブのみ
  await StatusBar.setStyle({ style: Style.Dark });
}
```

---

## 緊急対応フロー

### 手順1: エラー箇所特定

1. **Xcode Console** でクラッシュログ確認
2. **Safari Web Inspector** でJavaScriptエラー確認
3. **logger.error** 出力確認

---

### 手順2: 最小再現コード作成

```typescript
// 問題のある機能を最小限のコードで再現
const TestComponent = () => {
  useEffect(() => {
    // 問題のある処理
    logger.info('テスト開始');
    // ...
  }, []);

  return <div>Test</div>;
};
```

---

### 手順3: 問題の切り分け

**Web vs iOS**:
```bash
# Webで動作確認
npm run dev
# → 動作するならiOS固有の問題
```

**Capacitor vs コード**:
```typescript
// Capacitorプラグイン無効化
if (false && Capacitor.isNativePlatform()) {
  // ...
}
// → 動作するならCapacitor問題
```

---

### 手順4: 解決策実装

- ドキュメント（本ガイド、Capacitor公式）参照
- Stack Overflow検索: "capacitor ios [エラーメッセージ]"
- GitHub Issues検索: capacitorjs/capacitor

---

### 手順5: 記録

**CLAUDE.md更新**:
```markdown
### 過去のインシデント教訓

#### [問題タイトル] (2025-10-XX)
- **原因**: ...
- **症状**: ...
- **教訓**: ...
- **対策**: ...
```

---

## チェックリスト

### 問題発生時の初動

- [ ] エラーメッセージ全文をコピー
- [ ] Xcode Console確認
- [ ] Safari Web Inspector接続
- [ ] logger出力確認
- [ ] 最後に動作していたコミットを確認

### デバッグ手順

- [ ] 最小再現コード作成
- [ ] Web vs iOS切り分け
- [ ] プラットフォーム判定して回避
- [ ] 公式ドキュメント確認
- [ ] 解決策実装

### 解決後

- [ ] 動作確認（複数デバイス）
- [ ] ドキュメント更新（本ガイド or CLAUDE.md）
- [ ] Git commit（問題修正記録）
- [ ] MASTER_STATUS_DASHBOARD更新

---

## 参考リンク

- [Capacitor公式ドキュメント](https://capacitorjs.com/docs)
- [Capacitor iOS Guide](https://capacitorjs.com/docs/ios)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/ios)
- [WKWebView制約について](https://developer.apple.com/documentation/webkit/wkwebview)
- [Stack Overflow - Capacitor Tag](https://stackoverflow.com/questions/tagged/capacitor)
- [Capacitor GitHub Issues](https://github.com/ionic-team/capacitor/issues)

---

**更新履歴**:
- 2025-10-10 18:21: 初回作成（トラブルシューティングガイド）
