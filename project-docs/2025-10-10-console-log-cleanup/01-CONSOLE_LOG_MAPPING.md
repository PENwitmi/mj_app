# Console.log使用箇所マッピング

**作成日時**: 2025-10-10 03:43
**対象**: app/src/配下のすべてのconsole.log/warn/error/debug

---

## 📊 全体サマリー

- **総数**: 24件
- **内訳**:
  - `console.log`: 17件
  - `console.warn`: 3件
  - `console.error`: 4件

### ファイル別集計

| ファイル | 件数 | 種別 | 目的 |
|---------|------|------|------|
| lib/logger.ts | 4 | log/warn/error | ✅ Loggerクラス実装（正当な使用） |
| lib/session-utils.ts | 11 | log/warn | 🔧 デバッグログ（削除候補） |
| hooks/useSessions.ts | 2 | log | 🔧 デバッグログ（削除候補） |
| components/tabs/InputTab.tsx | 3 | log | 🔧 デバッグログ（削除候補） |
| components/tabs/HistoryTab.tsx | 1 | error | ⚠️ エラーログ（logger移行候補） |
| components/SessionDetailDialog.tsx | 3 | log/error | 🔧 デバッグログ（削除候補） |

---

## 📁 詳細マッピング

### 1. lib/logger.ts（4件）- ✅ 正当な使用

**状態**: **保持**（Loggerクラスの実装として必要）

| 行 | コード | 用途 |
|---|--------|------|
| 21 | `console.log(fullMessage, options?.data);` | DEBUGレベルログ出力 |
| 27 | `console.warn(fullMessage, options?.data);` | WARNレベルログ出力 |
| 30 | `console.error(fullMessage, options?.error \|\| options?.data);` | ERRORレベルログ出力 |
| 32 | `console.error('Stack:', options.error.stack);` | スタックトレース出力 |

**判定**: この4件はLoggerクラスの正当な実装であり、**削除不要**。

---

### 2. lib/session-utils.ts（11件）- 🔧 デバッグログ

**状態**: **削除/logger移行候補**

#### calculateSessionSummary関数（7件）

| 行 | レベル | コード | 目的 |
|----|--------|--------|------|
| 109 | log | `console.log(\`[DEBUG] calculateSessionSummary: sessionId=${sessionId}, 半荘数=${hanchans.length}\`)` | 処理開始ログ |
| 122 | warn | `console.warn(\`[WARNING] 半荘${hanchan.hanchanNumber}: メインユーザー(${mainUserId})が見つかりません\`)` | 警告ログ |
| 123 | log | `console.log(\`  プレイヤー一覧:\`, hanchan.players.map(p => ({ name: p.playerName, userId: p.userId })))` | デバッグ情報 |
| 131 | log | `console.log(\`[DEBUG] 半荘${hanchan.hanchanNumber}: メインユーザーのscore=${mainUserResult.score} - スキップ\`)` | スキップ通知 |
| 137 | log | `console.log(\`[DEBUG] 半荘${hanchan.hanchanNumber}: メインユーザーscore=${mainUserResult.score}, rank=${rank}\`)` | 計算状況 |
| 145 | warn | `console.warn(\`[WARNING] 半荘${hanchan.hanchanNumber}: メインユーザーのrank=${rank}がカウントされません\`)` | 警告ログ |
| 173 | log | `console.log(\`[DEBUG] 最終集計: totalHanchans=${totalHanchans}, rankCounts=\`, rankCounts)` | 集計結果 |

#### saveSessionWithSummary関数（4件）

| 行 | レベル | コード | 目的 |
|----|--------|--------|------|
| 204 | log | `console.log(\`[DEBUG] 📝 saveSessionWithSummary開始:\`, {...})` | 処理開始 |
| 217 | log | `console.log(\`[DEBUG] ✅ セッション保存完了 (${saveTime.toFixed(1)}ms):\`, { sessionId })` | 保存完了 |
| 224 | log | `console.log(\`[DEBUG] 📊 サマリー計算完了 (${summaryTime.toFixed(1)}ms):\`, summary)` | 計算完了 |
| 233 | log | `console.log(\`[DEBUG] 💾 サマリー保存完了 (${updateTime.toFixed(1)}ms) - 合計時間: ${totalTime.toFixed(1)}ms\`)` | 全体完了 |

**対応方針**:
- **削除**: 本番環境では不要
- または**logger.debug()移行**: 開発時のみ出力

---

### 3. hooks/useSessions.ts（2件）- 🔧 デバッグログ

**状態**: **削除/logger移行候補**

| 行 | レベル | コード | 目的 |
|----|--------|--------|------|
| 37 | log | `console.log(\`[DEBUG] 📋 履歴タブ: セッション読み込み開始 (全${allSessions.length}件)\`)` | 読み込み開始 |
| 99 | log | `console.log(\`[DEBUG] ✅ 履歴タブ: 読み込み完了 (${totalTime.toFixed(1)}ms)\`, {...})` | 読み込み完了 |

**対応方針**:
- **logger.debug()移行**: パフォーマンス測定として有用

---

### 4. components/tabs/InputTab.tsx（3件）- 🔧 デバッグログ

**状態**: **削除/logger移行候補**

| 行 | レベル | コード | 目的 |
|----|--------|--------|------|
| 148 | log | `console.log(\`[DEBUG] InputTab: 総ハンチャン数=${hanchans.length}, 有効ハンチャン数=${validHanchans.length}\`)` | データ確認 |
| 185 | log | `console.log('[DEBUG] InputTab: saveDataの半荘数 =', saveData.hanchans.length)` | 保存データ確認 |
| 186 | log | `console.log('[DEBUG] InputTab: 半荘番号リスト =', saveData.hanchans.map((h) => h.hanchanNumber))` | 半荘番号確認 |

**対応方針**:
- **削除**: 本番環境では不要

---

### 5. components/tabs/HistoryTab.tsx（1件）- ⚠️ エラーログ

**状態**: **logger移行推奨**

| 行 | レベル | コード | 目的 |
|----|--------|--------|------|
| 50 | error | `console.error('Failed to delete session:', err)` | セッション削除エラー |

**対応方針**:
- **logger.error()移行**: 統一されたエラーハンドリングへ

---

### 6. components/SessionDetailDialog.tsx（3件）- 🔧 デバッグログ

**状態**: **削除/logger移行候補**

| 行 | レベル | コード | 目的 |
|----|--------|--------|------|
| 70 | log | `console.log(\`[DEBUG] 🔍 詳細ダイアログ: セッション詳細読み込み開始 (sessionId=${sessionId})\`)` | 読み込み開始 |
| 77 | log | `console.log(\`[DEBUG] ✅ 詳細ダイアログ: 読み込み完了 (${totalTime.toFixed(1)}ms)\`, {...})` | 読み込み完了 |
| 86 | error | `console.error('Failed to load session:', err)` | セッション読み込みエラー |

**対応方針**:
- **logger.debug()移行**: デバッグログ（70, 77行）
- **logger.error()移行**: エラーログ（86行）

---

## 🎯 整理計画サマリー

### 削除対象（14件）

デバッグ用のconsole.logで、本番環境では不要：

1. **lib/session-utils.ts**: 7件（calculateSessionSummary内）
2. **components/tabs/InputTab.tsx**: 3件（全て）
3. **components/SessionDetailDialog.tsx**: 2件（デバッグログのみ）

### logger移行対象（6件）

統一されたロギングシステムへ移行：

1. **lib/session-utils.ts**: 4件（saveSessionWithSummary内）→ logger.debug()
2. **hooks/useSessions.ts**: 2件 → logger.debug()
3. **components/tabs/HistoryTab.tsx**: 1件 → logger.error()
4. **components/SessionDetailDialog.tsx**: 1件（エラーログ）→ logger.error()

### 保持対象（4件）

正当な実装として保持：

1. **lib/logger.ts**: 4件（Loggerクラス実装）

---

## 📋 作業チェックリスト

### Phase 1: 削除（14件）

- [ ] lib/session-utils.ts（7件）
  - [ ] 109行: calculateSessionSummary開始ログ
  - [ ] 123行: プレイヤー一覧デバッグ
  - [ ] 131行: スキップ通知
  - [ ] 137行: 計算状況
  - [ ] 173行: 最終集計
- [ ] components/tabs/InputTab.tsx（3件）
  - [ ] 148行: ハンチャン数確認
  - [ ] 185行: saveData半荘数確認
  - [ ] 186行: 半荘番号リスト確認
- [ ] components/SessionDetailDialog.tsx（2件）
  - [ ] 70行: 読み込み開始
  - [ ] 77行: 読み込み完了

### Phase 2: logger移行（6件）

- [ ] lib/session-utils.ts（4件）→ logger.debug()
  - [ ] 204行: saveSessionWithSummary開始
  - [ ] 217行: セッション保存完了
  - [ ] 224行: サマリー計算完了
  - [ ] 233行: サマリー保存完了
- [ ] hooks/useSessions.ts（2件）→ logger.debug()
  - [ ] 37行: 読み込み開始
  - [ ] 99行: 読み込み完了
- [ ] components/tabs/HistoryTab.tsx（1件）→ logger.error()
  - [ ] 50行: 削除エラー
- [ ] components/SessionDetailDialog.tsx（1件）→ logger.error()
  - [ ] 86行: 読み込みエラー

### Phase 3: 警告ログ対応（2件）

- [ ] lib/session-utils.ts（2件）→ logger.warn()
  - [ ] 122行: メインユーザー未検出警告
  - [ ] 145行: rankカウント警告

---

## 💡 実装ガイドライン

### 削除パターン

```typescript
// Before
console.log(`[DEBUG] InputTab: 総ハンチャン数=${hanchans.length}`)

// After
// 単純に削除
```

### logger.debug()移行パターン

```typescript
// Before
console.log(`[DEBUG] 📋 履歴タブ: セッション読み込み開始 (全${allSessions.length}件)`)

// After
logger.debug('セッション読み込み開始', {
  context: 'useSessions.loadSessionsWithSummaries',
  data: { totalSessions: allSessions.length }
})
```

### logger.error()移行パターン

```typescript
// Before
console.error('Failed to delete session:', err)

// After
logger.error('セッション削除に失敗しました', {
  context: 'HistoryTab.handleDelete',
  error: err as Error
})
```

### logger.warn()移行パターン

```typescript
// Before
console.warn(`[WARNING] 半荘${hanchan.hanchanNumber}: メインユーザー(${mainUserId})が見つかりません`)

// After
logger.warn('メインユーザーが見つかりません', {
  context: 'session-utils.calculateSessionSummary',
  data: { hanchanNumber: hanchan.hanchanNumber, mainUserId }
})
```

---

## 📈 期待される効果

### 本番ビルド

- **ファイルサイズ削減**: 約1-2KB（console.log文字列削除）
- **パフォーマンス向上**: 不要なログ出力の排除

### 開発体験

- **統一されたログ形式**: logger経由で一貫性のあるログ
- **条件付き出力**: 開発環境のみでログ出力
- **構造化ログ**: contextとdataで追跡容易

### コード品質

- **保守性向上**: ログ出力ロジックの一元管理
- **可読性向上**: デバッグコードの削除で本質的なロジックが明確に

---

**次のステップ**: `02-CLEANUP_PLAN.md`で詳細な実装計画を策定
