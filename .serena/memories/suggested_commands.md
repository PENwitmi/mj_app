Last updated: 2025-10-05

# 推奨コマンド

## 開発コマンド

### 開発サーバー起動（Claude Code環境）
**推奨**: サブエージェント/スラッシュコマンドを使用
```
@agent-npm-run-dev dev serverを起動して
```
または
```
/run
```

**通常環境**:
```bash
cd app && npm run dev
# → localhost:5173 で起動
```

### ビルド
```bash
cd app && npm run build
# → TypeScriptコンパイル → Vite build
```

### Lint実行
```bash
cd app && npm run lint
```

### ビルドプレビュー
```bash
cd app && npm run preview
```

## ファイル操作 (macOS/Darwin)

### ディレクトリ・ファイル一覧
```bash
ls -la                    # 詳細表示
find . -name "*.tsx"      # ファイル検索
```

### 内容検索
```bash
grep -r "pattern" ./app/src      # 再帰検索
grep -n "pattern" file.tsx       # 行番号付き
```

### Git操作
```bash
git status                # 状態確認
git add .                 # ステージング
git commit -m "message"   # コミット
git log --oneline         # ログ確認
```

## データベース操作

### 主要関数（app/src/lib/db-utils.ts）
```typescript
// アプリ初期化
initializeApp()

// ユーザー管理
archiveUser(userId)                // ユーザーアーカイブ（論理削除）
restoreUser(userId)                // アーカイブ済みユーザー復元
getActiveUsers()                   // アクティブユーザー取得
getArchivedUsers()                 // アーカイブ済みユーザー取得

// セッション管理
saveSessionWithSummary(data)       // セッション保存（サマリー事前計算版）
deleteSession(sessionId)           // セッション削除（カスケード削除）
getSessionWithDetails(sessionId)   // セッション詳細取得

// バリデーション
validateZeroSum(hanchanId)         // ゼロサム検証
validateUmaMarks(hanchanId)        // ウママーク検証
```

### セッションユーティリティ（app/src/lib/session-utils.ts）
```typescript
calculateSessionSummary(session, hanchansWithDetails)  // サマリー事前計算
getRankForScore(score, allScores)                      // 点数から着順を算出
getPlayerSessionStats(playerIndex, hanchans, settings) // プレイヤー別統計
```

## パス設定
- エイリアス: `@/*` → `src/*`
- 作業ディレクトリ: `/Users/nishimototakashi/claude_code/mj_app`
