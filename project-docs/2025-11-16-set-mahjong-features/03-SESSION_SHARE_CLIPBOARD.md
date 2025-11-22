# セッション共有機能（クリップボード）仕様書

**作成日**: 2025-11-18 00:44
**ステータス**: 採用決定（すぐ実装可能）
**優先度**: 高（Phase 1で実装）

---

## 📋 概要

セッション結果をテキスト形式でクリップボードにコピーし、LINE・Twitter・メール等に簡単に貼り付けられる機能。実装が簡単で、すぐに価値を提供できる。

---

## 🎯 目的

1. **結果共有の簡素化**: 手入力不要、ワンタップでコピー
2. **グループ連絡**: LINEグループ等での結果報告が楽
3. **記録の保存**: 外部メモアプリへの保存
4. **SNS投稿**: Twitterでの戦績シェア

---

## 📝 出力フォーマット

### 基本フォーマット

```
📊 2025-11-18 金曜麻雀会
4人打ち・3半荘・標準ウマ

1位 山田太郎  +15,000円
2位 佐藤花子   +5,000円
3位 鈴木一郎   -8,000円
4位 田中次郎  -12,000円

麻雀アプリで記録
```

### フォーマット詳細

```typescript
interface ShareFormat {
  header: string;      // "📊 {date} {memo}"
  settings: string;    // "{mode}・{半荘数}半荘・{umaRule}"
  results: string[];   // 各プレイヤーの結果
  footer: string;      // "麻雀アプリで記録"
}
```

### 出力例（バリエーション）

#### 例1: 3人打ち
```
📊 2025-11-18 土曜麻雀会
3人打ち・4半荘・2着マイナス

1位 山田太郎  +18,000円
2位 佐藤花子   -3,000円
3位 鈴木一郎  -15,000円

麻雀アプリで記録
```

#### 例2: メモ付き
```
📊 2025-11-18 役満達成記念
4人打ち・3半荘・標準ウマ

1位 山田太郎  +15,000円
2位 佐藤花子   +5,000円
3位 鈴木一郎   -8,000円
4位 田中次郎  -12,000円

💬 山田さんが大三元達成！

麻雀アプリで記録
```

#### 例3: チップ・場代表示
```
📊 2025-11-18 金曜麻雀会
4人打ち・3半荘・標準ウマ

1位 山田太郎  +15,000円 🪙+2
2位 佐藤花子   +5,000円 🪙+1
3位 鈴木一郎   -8,000円 🪙-1
4位 田中次郎  -12,000円 🪙-2

場代: 各500円

麻雀アプリで記録
```

---

## 🎨 UI設計

### 配置場所

#### Option A: 履歴タブ（推奨）
**セッション詳細ダイアログ内**

```
┌─────────────────────────┐
│ 2025-11-18 金曜麻雀会    │
│                          │
│ [総収支] [半荘詳細] ...  │ ← タブ
├─────────────────────────┤
│ 1位 山田太郎  +15,000円  │
│ 2位 佐藤花子   +5,000円  │
│ ...                      │
├─────────────────────────┤
│ [📋 結果をコピー]        │ ← 新規追加ボタン
│ [編集] [削除] [閉じる]   │
└─────────────────────────┘
```

#### Option B: 共有ボタン（iOS/Android風）
```
┌─────────────────────────┐
│ 2025-11-18 金曜麻雀会  📤│ ← 共有アイコン
│                          │
│ ...                      │
└─────────────────────────┘
```

### 実行フロー

1. **ボタンタップ**
   - 「📋 結果をコピー」ボタン

2. **クリップボードにコピー**
   - `navigator.clipboard.writeText()`実行

3. **トースト通知**
   ```
   ✅ クリップボードにコピーしました
   ```

4. **ユーザーが貼り付け**
   - LINE等のアプリを開く
   - 長押し → 貼り付け

---

## 🔧 技術仕様

### 実装関数

```typescript
/**
 * セッション結果をクリップボード用テキストに変換
 */
function generateShareText(
  session: Session,
  hanchans: Hanchan[],
  playerResults: PlayerResult[],
  users: User[]
): string {
  // ヘッダー
  const date = format(session.date, 'yyyy-MM-dd');
  const memo = session.memo ? ` ${session.memo}` : '';
  const header = `📊 ${date}${memo}`;

  // 設定情報
  const mode = session.gameMode === '4-player' ? '4人打ち' : '3人打ち';
  const hanchanCount = `${hanchans.length}半荘`;
  const umaRule = session.umaRule === 'standard' ? '標準ウマ' : '2着マイナス';
  const settings = `${mode}・${hanchanCount}・${umaRule}`;

  // プレイヤー結果（ソート済み）
  const results = playerResults
    .sort((a, b) => b.totalRevenue - a.totalRevenue) // 収支降順
    .map((result, index) => {
      const user = users.find(u => u.id === result.userId);
      const name = user?.name || '見学者';
      const rank = index + 1;
      const revenue = result.totalRevenue >= 0
        ? `+${result.totalRevenue.toLocaleString()}円`
        : `${result.totalRevenue.toLocaleString()}円`;

      // チップ表示（オプション）
      const chips = result.totalChips !== 0
        ? ` 🪙${result.totalChips > 0 ? '+' : ''}${result.totalChips}`
        : '';

      return `${rank}位 ${name}  ${revenue}${chips}`;
    })
    .join('\n');

  // 場代表示（全員同額の場合のみ）
  const parlorFeeText = shouldShowParlorFee(playerResults)
    ? `\n\n場代: 各${playerResults[0].totalParlorFee.toLocaleString()}円`
    : '';

  // メモ表示（セッションメモがある場合）
  const memoText = session.memo
    ? `\n\n💬 ${session.memo}`
    : '';

  // フッター
  const footer = '\n\n麻雀アプリで記録';

  return `${header}\n${settings}\n\n${results}${parlorFeeText}${memoText}${footer}`;
}

/**
 * 場代を表示すべきか判定
 */
function shouldShowParlorFee(results: PlayerResult[]): boolean {
  const fees = results.map(r => r.totalParlorFee);
  const allSame = fees.every(f => f === fees[0]);
  const nonZero = fees[0] !== 0;
  return allSame && nonZero;
}
```

### クリップボードAPI

```typescript
/**
 * クリップボードにコピー
 */
async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showSuccessToast('クリップボードにコピーしました');
    logger.info('Share text copied to clipboard', {
      textLength: text.length
    });
  } catch (error) {
    logger.error('Failed to copy to clipboard', { error });

    // フォールバック: 旧API
    try {
      fallbackCopyToClipboard(text);
      showSuccessToast('クリップボードにコピーしました');
    } catch (fallbackError) {
      showErrorToast('コピーに失敗しました');
      throw fallbackError;
    }
  }
}

/**
 * フォールバック: execCommand使用
 */
function fallbackCopyToClipboard(text: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
```

---

## 📱 実装ファイル

### 新規作成

1. **`src/lib/share-utils.ts`** (100-150行)
   - `generateShareText()`
   - `generateUmaMarks()`
   - `shouldShowParlorFee()`
   - `copyToClipboard()`
   - `fallbackCopyToClipboard()`

### 修正

2. **`src/components/SessionDetailDialog.tsx`** (+20行)
   - 「📋 結果をコピー」ボタン追加
   - `copyToClipboard()`呼び出し

---

## ✅ テスト計画

### ユニットテスト

1. **share-utils.ts**
   - `generateShareText()`: 各フォーマットが正しいか
   - `generateUmaMarks()`: ウママーク生成が正しいか
   - `shouldShowParlorFee()`: 場代表示判定が正しいか

### E2Eテスト（Playwright）

1. **コピー機能**
   - 履歴タブ > セッション詳細 > 結果をコピー
   - クリップボードに正しいテキストがコピーされるか
   - トースト通知が表示されるか

2. **フォーマット検証**
   - 4人打ち・3人打ち
   - メモあり・なし
   - チップあり・なし
   - 場代あり・なし

---

## 🎯 拡張案（Phase 2以降）

### 1. 画像生成
- HTMLをCanvas化 → PNG出力
- より見栄えの良い共有画像
- 詳細: 別ドキュメント参照

### 2. QRコード共有
- セッション結果のURL生成
- QRコード表示
- スキャンして詳細閲覧

### 3. SNSダイレクト投稿
- Twitter API連携
- 画像付きツイート

---

## 🚧 実装上の注意点

### 1. Clipboard API互換性

- **モダンブラウザ**: `navigator.clipboard.writeText()` 使用
- **古いブラウザ**: `document.execCommand('copy')` フォールバック
- **iOS Safari**: HTTPS必須、ユーザージェスチャー必須

### 2. テキストの可読性

- 絵文字は控えめに（環境依存文字に注意）
- 全角スペースでレイアウト調整
- 改行コードは`\n`（LF）

### 3. プライバシー配慮

- ユーザー名が含まれる → 公開範囲に注意喚起
- オプション: 匿名化機能（プレイヤーA/B/C/D）

---

## 📈 成功指標

- コピー成功率: 99%以上
- ユーザー利用率: セッション終了時に30%以上が使用
- 共有先: LINE > Twitter > メール の順と予想

---

## 🔗 関連ドキュメント

- `01-FEATURE_IDEAS.md`: セット麻雀特化機能企画
- `02-BACKUP_RESTORE_SPECIFICATION.md`: バックアップ機能
- `src/components/SessionDetailDialog.tsx`: セッション詳細ダイアログ

---

## 📝 更新履歴

- **2025-11-18 00:44**: 初版作成（Phase 1仕様策定）
