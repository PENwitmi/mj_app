Last updated: 2025-10-05

# 開発ワークフロー

## プロジェクト開始

### 1. 初期セットアップ
```bash
cd /Users/nishimototakashi/claude_code/mj_app/app
npm install
```

### 2. 開発サーバー起動

**重要**: Claude Codeで開発サーバーを起動する際は、タイムアウト問題を回避するため専用のサブエージェント/コマンドを使用してください。

**推奨方法**:

1. **サブエージェント使用**:
   ```
   @agent-npm-run-dev dev serverを起動して
   ```

2. **スラッシュコマンド使用**:
   ```
   /run
   ```

**仕組み**:
- screenセッションでdev serverを分離実行
- Claude Codeの2分タイムアウトを回避
- ポート5173で起動、バックグラウンド実行

**セッション管理**:
```bash
# ログ確認
screen -r dev-server

# デタッチ (Ctrl+A → D)

# サーバー停止
screen -X -S dev-server quit
```

**通常の起動方法（非Claude Code環境）**:
```bash
npm run dev
# → http://localhost:5173 でアクセス
```

## 開発サイクル

### 1. 機能実装フロー
1. **要件確認**: CLAUDE.md、project-docs/を確認
2. **設計**: データモデル、コンポーネント構造を検討
3. **実装**: 
   - データベース層 → ビジネスロジック → UI
   - 小さい単位で動作確認
4. **検証**: 
   - `npm run lint` でコード品質確認
   - ブラウザで動作確認
   - エラーログ確認（console、logger）
5. **ドキュメント更新**: 
   - CLAUDE.md更新
   - MASTER_STATUS_DASHBOARD.md更新
   - project-docs/に詳細記録

### 2. コミットフロー
```bash
# 変更確認
git status
git diff

# ステージング
git add .

# コミット（説明的なメッセージ）
git commit -m "feat: InputTab実装完成 - 自動計算・ウママーク割り当て機能"

# プッシュ
git push origin main
```

## デバッグ戦略

### 1. ロガー活用
```typescript
import { logger } from '@/lib/logger';

logger.debug('処理開始', { context: 'Component.function', data: { ... } });
logger.info('成功', { context: 'Component.function', data: { ... } });
logger.warn('警告', { context: 'Component.function', data: { ... } });
logger.error('エラー', { context: 'Component.function', error });
```

### 2. React DevTools
- コンポーネント階層確認
- Props/State確認
- パフォーマンス分析

### 3. IndexedDB確認
- Chrome DevTools → Application → Storage → IndexedDB → MahjongDB
- テーブルデータ確認
- クエリ結果確認

### 4. ネットワーク確認
- Chrome DevTools → Network
- リソース読み込み確認
- エラーレスポンス確認

## テストアプローチ

### 1. 手動テスト（現在）
- **正常系**: 想定される操作フロー
- **異常系**: エラーハンドリング確認
- **境界値**: 最小/最大値、空入力等
- **ゼロサム検証**: 点数合計が0になるか
- **ウママーク検証**: 合計が0になるか

### 2. 将来のテスト戦略
- **単体テスト**: Vitest + Testing Library
- **E2Eテスト**: Playwright
- **統合テスト**: DB操作含む

## パフォーマンス最適化

### 1. React最適化
- `useMemo`: 高コストな計算結果のメモ化
- `useCallback`: コールバック関数のメモ化
- `React.memo`: コンポーネントのメモ化
- 不要な再レンダリング回避

### 2. Dexie.js最適化
- インデックス活用（外部キー検索）
- 一括操作（bulkAdd, bulkPut）
- 不要なクエリ削減
- 複合クエリの最適化

### 3. 状態管理最適化
- 状態の分離（関係ないデータは分ける）
- ローカルストレージ活用（設定値）
- 不変性パターン（新しいオブジェクト作成）

## トラブルシューティング

### 1. ビルドエラー
```bash
# TypeScriptエラー確認
npm run build

# Lint実行
npm run lint

# キャッシュクリア
rm -rf node_modules/.vite
npm run dev
```

### 2. IndexedDB問題
```typescript
// 開発用: データベース全削除
import { clearAllData } from '@/lib/db';
await clearAllData();

// 再初期化
import { initializeApp } from '@/lib/db';
await initializeApp();
```

### 3. React Strict Mode
- `useEffect`が2回実行される
- 冪等性を保つ実装が必要
- 重複作成防止（固定ID使用等）

## ドキュメント管理

### 1. CLAUDE.md
- プロジェクト概要
- 技術スタック
- アーキテクチャ
- 実装ノート
- **頻繁に更新**

### 2. MASTER_STATUS_DASHBOARD.md
- プロジェクト統計
- 現在進行中タスク
- 完了履歴
- 月別アーカイブ
- **毎日更新**

### 3. project-docs/
- フェーズ別ドキュメント
- 詳細な設計書
- 実装記録
- 問題解決記録
- **重要な変更時に更新**

### 4. .serena/memories/
- プロジェクト概要
- プロジェクト構造
- データベース実装
- UI実装パターン
- コードスタイル規約
- **メジャー実装完了時に更新**

## チェックリスト

### 実装完了前
- [ ] コードが動作する
- [ ] エラーハンドリング実装
- [ ] ログ出力実装
- [ ] Lint通過
- [ ] ビルド成功
- [ ] ドキュメント更新

### コミット前
- [ ] git statusで変更確認
- [ ] git diffで内容確認
- [ ] 不要なファイル除外
- [ ] コミットメッセージ準備

### フェーズ完了時
- [ ] すべての機能動作確認
- [ ] ドキュメント完全更新
- [ ] .serenaメモリ更新
- [ ] MASTER_STATUS_DASHBOARD更新
- [ ] git commit & push
