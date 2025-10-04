Last updated: 2025-10-05

# タスク完了時のチェックリスト

## 1. コード品質チェック

### Lint実行
```bash
cd app && npm run lint
```

### TypeScriptコンパイル確認
```bash
cd app && npm run build
```

## 2. エラーハンドリング確認

### 必須項目
- [ ] try-catchブロックでエラーをキャッチ
- [ ] 適切なカスタムエラークラス使用（DatabaseError, ValidationError等）
- [ ] logger.error()でログ出力
- [ ] エラーを適切にthrow

### パターン確認
```typescript
try {
  // 処理
} catch (err) {
  const error = new DatabaseError('メッセージ', { originalError: err });
  logger.error(error.message, { context: 'module.function', error });
  throw error;
}
```

## 3. データベース操作確認

### ビジネスルール検証
- [ ] ゼロサム原則: 各半荘の点数合計 = 0（見学者除く）
- [ ] ウママーク合計: 各半荘で必ず0
- [ ] Boolean値をIndexedDBインデックスに未使用

### 主要関数の動作確認
- [ ] `validateZeroSum()` - ゼロサム検証
- [ ] `validateUmaMarks()` - ウママーク検証
- [ ] データ整合性チェック

## 4. React規約確認

### Strict Mode対応
- [ ] `useEffect`の2回実行に対応
- [ ] 競合状態(race condition)を回避

### コンポーネント構造
- [ ] 適切な型定義
- [ ] エラーバウンダリでラップ（必要に応じて）

## 5. ドキュメント更新

### 更新対象
- [ ] CLAUDE.md（重要な変更の場合）
- [ ] MASTER_STATUS_DASHBOARD.md（進捗・完了記録）
- [ ] project-docs/（詳細設計・実装記録）
- [ ] .serena/memories/（メジャー実装完了時）
- [ ] コード内コメント（複雑なロジックの場合）

## 6. 動作確認

### ブラウザテスト
```bash
cd app && npm run dev
# → localhost:5173 で動作確認
```

### 確認項目
- [ ] UI表示正常
- [ ] データ入力・更新正常
- [ ] エラー処理正常
- [ ] コンソールエラーなし

## 7. Git操作（必要に応じて）

```bash
git status                    # 変更確認
git add .                     # ステージング
git commit -m "message"       # コミット
```
