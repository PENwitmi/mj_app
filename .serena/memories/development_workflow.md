# 開発ワークフロー

Last updated: 2025-10-12

## 開発環境

### 必須ツール
- Node.js 18+ / npm
- Git
- iOS開発: Xcode 15+, CocoaPods
- エディタ: Claude Code推奨

### 開発サーバー起動
```bash
cd app
npm run dev  # localhost:5173
```

**Claude Code使用時の注意**:
- `/run` スラッシュコマンド使用推奨（screenセッション、タイムアウト回避）
- または `@agent-npm-run-dev` サブエージェント使用

### ビルド・検証
```bash
npm run build    # 本番ビルド
npm run lint     # ESLint実行
npm run preview  # ビルドプレビュー
```

## Git ワークフロー

### コミットメッセージ規約
- **日本語推奨**: コミットメッセージは日本語で記述
- **形式**: `[機能名/修正内容]: 具体的な変更内容`
- **例**:
  - `Phase 6完了: iOS対応・safe-area調整`
  - `バグ修正: ユーザー参加フィルタリング`
  - `UI改善: 収支推移グラフy=0参照線追加`

### ブランチ戦略
- **main**: 本番環境（常に動作する状態）
- **フィーチャーブランチ**: 大規模変更時のみ使用（通常はmain直接コミット）

### コミット前チェックリスト
1. ✅ `npm run build` 成功
2. ✅ `npm run lint` エラーなし
3. ✅ 主要機能の動作確認（手動テスト）
4. ✅ バックアップ作成（重要ファイル編集時）

## 開発サイクル

### フェーズ開始時
1. **要件整理**
   - CLAUDE.mdで現状確認
   - MASTER_STATUS_DASHBOARD.mdで進捗確認
   - project-docs/で過去ドキュメント参照

2. **設計書作成**
   - 新規project-docs/YYYY-MM-DD-feature-name/ディレクトリ作成
   - 01-SPECIFICATION.md作成（仕様書）
   - 必要に応じて02-IMPLEMENTATION_PLAN.md作成

3. **実装開始**
   - ファイルバックアップ（重要ファイル編集時）
   - 小刻みなコミット（1機能1コミット）

### 実装中
1. **デバッグログ活用**
   - `logger.debug()` で詳細ログ出力
   - 本番では自動的に非表示（DEV環境のみ）

2. **エラーハンドリング必須**
   ```typescript
   try {
     // DB操作
   } catch (err) {
     const error = new DatabaseError('メッセージ', { context });
     logger.error(error.message, { context, error });
     throw error;
   }
   ```

3. **型安全性重視**
   - `any` 型禁止
   - `as` キャスト最小限
   - ユニオン型活用

### フェーズ完了時
1. **ドキュメント更新**
   - CLAUDE.md更新（重要な設計変更）
   - MASTER_STATUS_DASHBOARD.md更新（進捗記録）
   - Serena Memory更新（設計パターン・教訓）

2. **コミット＆プッシュ**
   - 説明的なコミットメッセージ
   - 必要に応じてタグ付け

3. **振り返り**
   - うまくいった点・改善点を記録
   - 再利用可能なパターンをメモリー化

## ドキュメント管理

### CLAUDE.md
- **内容**: プロジェクト憲法（基本方針・設計思想・ルール）
- **更新頻度**: 低（重要な設計変更時のみ）
- **サイズ制限**: 20KB以下推奨
- **記録内容**:
  - Tech Stack
  - Architecture
  - Critical Implementation Notes
  - Configuration
  - Next Steps

### MASTER_STATUS_DASHBOARD.md
- **内容**: プロジェクト日記（詳細進捗・作業履歴）
- **更新頻度**: 高（タスク開始・完了時）
- **記録内容**:
  - プロジェクト統計サマリー
  - 現在進行中のプロジェクト
  - 直近完了プロジェクト（2週間以内）
  - 月別アーカイブ
  - 各詳細への参照パス

### project-docs/
- **命名規則**: `YYYY-MM-DD-feature-description-keywords/`
- **ファイル命名**: `NN-DESCRIPTIVE_TITLE.md`（NNは2桁連番）
- **内容**:
  - 仕様書、実装計画、技術提案
  - バグ修正記録、性能測定結果
  - 設計判断の理由・トレードオフ

### Serena Memory
- **内容**: 設計パターン・教訓・頻繁に参照する情報
- **更新頻度**: 中（フェーズ完了時、重要な学びがあった時）
- **主要メモリー**:
  - project_overview: プロジェクト概要
  - project_structure: ディレクトリ構造
  - database_implementation: DB実装詳細
  - ui_implementation_patterns: UIパターン
  - code_style_conventions: コーディング規約

## トラブルシューティング

### よくある問題

#### 1. ビルドエラー
```bash
# キャッシュクリア
rm -rf node_modules dist
npm install
npm run build
```

#### 2. 型エラー
- `tsconfig.json` 確認
- `@/*` パスエイリアス正常動作確認

#### 3. IndexedDB関連
- ブラウザのDevTools > Application > IndexedDB確認
- 開発中は手動削除可能（`clearAllData()`）

#### 4. React 19 Strict Mode二重実行
- 固定ID使用で重複作成回避
- useEffect依存配列を慎重に設定

#### 5. Recharts タブ切り替えエラー
- `mountedTabs` + 100ms遅延レンダリング
- 状態保持が必要なタブは条件なしレンダリング

### iOS特有の問題

#### 1. safe-area問題
- CSS変数: `--safe-area-inset-*` 使用
- タブナビゲーション: `env(safe-area-inset-bottom)` 加算

#### 2. スクロール問題
- 各タブに適切な`overflow-y-auto`設定
- `h-full`クラスで高さ制約

#### 3. シミュレータ/実機デバッグ
```bash
# ログ確認
npx cap open ios
# Xcodeでビルド＆実行
```

## パフォーマンス最適化

### 実績
- **サマリー事前計算**: 300-800倍高速化
- **セッション一覧表示**: ~10ms（100セッション）
- **分析タブフィルタリング**: ~5ms（フィルター適用後）

### ベストプラクティス
1. **DB読み取り最小化**
   - サマリー事前計算活用
   - 不要なクエリ削減

2. **リアクティビティ最適化**
   - useLiveQuery（Dexie）活用
   - useEffect依存配列最小化

3. **コンポーネント最適化**
   - React.memo使用（必要時のみ）
   - 状態管理の集約（カスタムフック）

4. **バンドルサイズ削減**
   - 動的import検討（Phase 7以降）
   - Tree Shaking確認

## テスト戦略（未実装）

### 優先度高（Phase 7予定）
1. **ビジネスロジック**
   - session-utils.ts（収支計算、着順計算）
   - uma-utils.ts（ウママーク変換）
   - db/validation.ts（ゼロサム、ウママーク検証）

2. **カスタムフック**
   - useUsers.ts
   - useSessions.ts

### テストフレームワーク
- Vitest推奨
- @testing-library/react（コンポーネントテスト）

## デプロイ（未実装）

### Web版（将来）
- Vercel/Netlify等へのデプロイ
- PWA化検討

### iOS版（Phase 6完了）
- App Store Connect設定
- TestFlight配信
- 本番リリース

### Android版（Phase 6以降）
- Capacitor Android設定
- Google Play Console設定
