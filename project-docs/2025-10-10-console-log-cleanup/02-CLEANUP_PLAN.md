# Console.log整理計画

**作成日時**: 2025-10-10 03:43
**関連ドキュメント**: `01-CONSOLE_LOG_MAPPING.md`

---

## 🎯 整理方針

### 基本原則

1. **本番環境の品質向上**: 不要なconsole出力を削除
2. **開発体験の維持**: 有用なログはlogger.debug()へ移行
3. **統一されたロギング**: loggerシステムの活用
4. **段階的実施**: Phase 1（削除）→ Phase 2（移行）→ Phase 3（警告）

---

## 📊 作業概要

| Phase | 対象 | 件数 | 所要時間（目安） |
|-------|------|------|-----------------|
| Phase 1 | 削除 | 14件 | 30分 |
| Phase 2 | logger.debug()移行 | 4件 | 20分 |
| Phase 3 | logger.warn/error移行 | 4件 | 15分 |
| **合計** | - | **22件** | **約65分** |

※ lib/logger.ts内の4件は**保持**（正当な実装）

---

## 🔧 Phase 1: デバッグログ削除（14件）

### 対象ファイルと作業内容

#### 1. lib/session-utils.ts（7件削除）

**対象関数**: `calculateSessionSummary`

```typescript
// 🗑️ 削除対象（7行）

// 109行: 関数開始ログ
console.log(`[DEBUG] calculateSessionSummary: sessionId=${sessionId}, 半荘数=${hanchans.length}`)

// 123行: プレイヤー一覧デバッグ
console.log(`  プレイヤー一覧:`, hanchan.players.map(p => ({ name: p.playerName, userId: p.userId })))

// 131行: スキップ通知
console.log(`[DEBUG] 半荘${hanchan.hanchanNumber}: メインユーザーのscore=${mainUserResult.score} - スキップ`)

// 137行: 計算状況
console.log(`[DEBUG] 半荘${hanchan.hanchanNumber}: メインユーザーscore=${mainUserResult.score}, rank=${rank}`)

// 173行: 最終集計
console.log(`[DEBUG] 最終集計: totalHanchans=${totalHanchans}, rankCounts=`, rankCounts)
```

**判断理由**:
- 本番環境で不要なデバッグ情報
- logger経由でも冗長すぎる（各半荘ごとのログ）
- 必要時はブレークポイントで確認可能

#### 2. components/tabs/InputTab.tsx（3件削除）

```typescript
// 🗑️ 削除対象（3行）

// 148行: ハンチャン数確認
console.log(`[DEBUG] InputTab: 総ハンチャン数=${hanchans.length}, 有効ハンチャン数=${validHanchans.length}`)

// 185行: saveData半荘数確認
console.log('[DEBUG] InputTab: saveDataの半荘数 =', saveData.hanchans.length)

// 186行: 半荘番号リスト確認
console.log('[DEBUG] InputTab: 半荘番号リスト =', saveData.hanchans.map((h) => h.hanchanNumber))
```

**判断理由**:
- 保存処理の確認用デバッグログ
- ValidationErrorで十分なエラーハンドリング済み
- UI上でトースト通知で成功/失敗を表示

#### 3. components/SessionDetailDialog.tsx（2件削除）

```typescript
// 🗑️ 削除対象（2行）

// 70行: 読み込み開始
console.log(`[DEBUG] 🔍 詳細ダイアログ: セッション詳細読み込み開始 (sessionId=${sessionId})`)

// 77行: 読み込み完了
console.log(`[DEBUG] ✅ 詳細ダイアログ: 読み込み完了 (${totalTime.toFixed(1)}ms)`, {
  hanchanCount: sessionDetails.hanchans.length,
  playerCount: sessionDetails.hanchans.reduce((sum, h) => sum + h.players.length, 0)
})
```

**判断理由**:
- モーダルの読み込みログ
- エラー時はlogger.error()で記録（86行）
- パフォーマンス測定は必要時のみプロファイリングツールで確認

#### 削除作業の実施方法

```bash
# Editツールで各ファイルを編集
# - 該当行を完全に削除（改行含む）
# - 周辺コードの整合性を確認
```

---

## 📝 Phase 2: logger.debug()移行（4件）

### 対象: パフォーマンス測定ログ

開発時のパフォーマンス分析に有用なログを統一システムへ移行。

#### 1. lib/session-utils.ts（4件移行）

**対象関数**: `saveSessionWithSummary`

```typescript
// Before（削除）
console.log(`[DEBUG] 📝 saveSessionWithSummary開始:`, {
  date: data.date,
  mode: data.mode,
  hanchanCount: data.hanchans.length,
  mainUserId
})

// After（追加）
logger.debug('セッション保存開始', {
  context: 'session-utils.saveSessionWithSummary',
  data: {
    date: data.date,
    mode: data.mode,
    hanchanCount: data.hanchans.length,
    mainUserId
  }
})
```

**移行対象**:

| 行 | Before | After |
|----|--------|-------|
| 204 | `console.log('[DEBUG] 📝 saveSessionWithSummary開始:', {...})` | `logger.debug('セッション保存開始', {...})` |
| 217 | `console.log('[DEBUG] ✅ セッション保存完了 (Xms):', {...})` | `logger.debug('セッション保存完了', {...})` |
| 224 | `console.log('[DEBUG] 📊 サマリー計算完了 (Xms):', {...})` | `logger.debug('サマリー計算完了', {...})` |
| 233 | `console.log('[DEBUG] 💾 サマリー保存完了 (Xms) - 合計時間: Xms')` | `logger.debug('サマリー保存完了', {...})` |

#### 2. hooks/useSessions.ts（削除 → 不要）

**再検討**: パフォーマンスログは開発時のみ必要

```typescript
// 37行、99行: 削除が適切
// 理由: useLiveQueryが既にDexieのパフォーマンス管理を行っている
```

**結論**: Phase 1で削除対象に変更

---

## ⚠️ Phase 3: logger.warn/error移行（4件）

### エラーハンドリングの統一

#### 1. lib/session-utils.ts（2件移行）

**警告ログ**: データ不整合の警告

```typescript
// 122行: Before
console.warn(`[WARNING] 半荘${hanchan.hanchanNumber}: メインユーザー(${mainUserId})が見つかりません`)
console.log(`  プレイヤー一覧:`, hanchan.players.map(p => ({ name: p.playerName, userId: p.userId })))

// After
logger.warn('半荘にメインユーザーが見つかりません', {
  context: 'session-utils.calculateSessionSummary',
  data: {
    hanchanNumber: hanchan.hanchanNumber,
    mainUserId,
    players: hanchan.players.map(p => ({ name: p.playerName, userId: p.userId }))
  }
})
```

```typescript
// 145行: Before
console.warn(`[WARNING] 半荘${hanchan.hanchanNumber}: メインユーザーのrank=${rank}がカウントされません`)

// After
logger.warn('rankがカウント範囲外です', {
  context: 'session-utils.calculateSessionSummary',
  data: {
    hanchanNumber: hanchan.hanchanNumber,
    rank,
    expectedRange: '1-4'
  }
})
```

#### 2. components/tabs/HistoryTab.tsx（1件移行）

```typescript
// 50行: Before
try {
  await deleteSession(sessionId)
  toast.success('セッションを削除しました')
  onRefresh()
} catch (err) {
  console.error('Failed to delete session:', err)
  toast.error('削除に失敗しました')
}

// After
try {
  await deleteSession(sessionId)
  toast.success('セッションを削除しました')
  onRefresh()
} catch (err) {
  const error = err instanceof Error ? err : new Error('Unknown error')
  logger.error('セッション削除に失敗しました', {
    context: 'HistoryTab.handleDelete',
    data: { sessionId },
    error
  })
  toast.error('削除に失敗しました')
}
```

#### 3. components/SessionDetailDialog.tsx（1件移行）

```typescript
// 86行: Before
} catch (err) {
  console.error('Failed to load session:', err)
  setError(err instanceof Error ? err : new Error('Failed to load session details'))
}

// After
} catch (err) {
  const error = err instanceof Error ? err : new Error('Failed to load session details')
  logger.error('セッション詳細の読み込みに失敗しました', {
    context: 'SessionDetailDialog.loadSession',
    data: { sessionId },
    error
  })
  setError(error)
}
```

---

## 🔄 Phase 2再検討: hooks/useSessions.ts

**当初計画**: logger.debug()移行（2件）
**再評価**: 削除が適切

### 理由

1. **useLiveQueryの特性**: Dexie React Hooksが自動的にパフォーマンス管理
2. **測定の重複**: calculateSessionSummaryで既にログ記録
3. **冗長性**: 各セッション変更時にログが出力され、ノイズになる

### 修正後の対応

```typescript
// 37行、99行: 削除
// Phase 1に移動（合計16件削除）
```

---

## 📋 修正後の作業サマリー

| Phase | 対象 | 件数 | 内容 |
|-------|------|------|------|
| Phase 1 | 削除 | **16件** | デバッグログ完全削除 |
| Phase 2 | logger.debug()移行 | **4件** | パフォーマンスログ |
| Phase 3 | logger.warn/error移行 | **4件** | 警告・エラーログ |
| - | 保持 | 4件 | lib/logger.ts（Loggerクラス） |
| **合計** | **作業対象** | **24件** | - |

---

## ✅ 実装チェックリスト

### Phase 1: 削除（16件）

#### lib/session-utils.ts（7件）
- [ ] 109行: calculateSessionSummary開始ログ
- [ ] 123行: プレイヤー一覧デバッグ
- [ ] 131行: スキップ通知
- [ ] 137行: 計算状況
- [ ] 173行: 最終集計

#### hooks/useSessions.ts（2件）
- [ ] 37行: 読み込み開始
- [ ] 99行: 読み込み完了

#### components/tabs/InputTab.tsx（3件）
- [ ] 148行: ハンチャン数確認
- [ ] 185行: saveData半荘数確認
- [ ] 186行: 半荘番号リスト確認

#### components/SessionDetailDialog.tsx（2件）
- [ ] 70行: 読み込み開始
- [ ] 77行: 読み込み完了

### Phase 2: logger.debug()移行（4件）

#### lib/session-utils.ts（4件）
- [ ] 204行: saveSessionWithSummary開始 → logger.debug()
- [ ] 217行: セッション保存完了 → logger.debug()
- [ ] 224行: サマリー計算完了 → logger.debug()
- [ ] 233行: サマリー保存完了 → logger.debug()

### Phase 3: logger.warn/error移行（4件）

#### lib/session-utils.ts（2件）
- [ ] 122-123行: メインユーザー未検出警告 → logger.warn()
- [ ] 145行: rankカウント警告 → logger.warn()

#### components/tabs/HistoryTab.tsx（1件）
- [ ] 50行: 削除エラー → logger.error()

#### components/SessionDetailDialog.tsx（1件）
- [ ] 86行: 読み込みエラー → logger.error()

---

## 🧪 テスト計画

### 動作確認項目

1. **Phase 1実施後**
   - [ ] npm run build が成功する
   - [ ] npm run lint がエラーなし
   - [ ] 開発サーバーが起動する
   - [ ] 各機能が正常動作する

2. **Phase 2実施後**
   - [ ] logger.debug()が開発環境で出力される
   - [ ] 本番ビルドでlogger.debug()が出力されない

3. **Phase 3実施後**
   - [ ] エラー発生時にlogger.error()が正しく記録される
   - [ ] 警告がlogger.warn()で記録される

### 確認方法

```bash
# ビルド確認
npm run build

# Lint確認
npm run lint

# 開発サーバー起動
npm run dev

# ブラウザコンソール確認
# - logger.debug()のフォーマット確認
# - エラーログの動作確認
```

---

## 📈 期待される効果

### 定量的効果

- **削除行数**: 16行
- **移行行数**: 8行（logger移行）
- **ビルドサイズ削減**: 約1-2KB
- **console出力削減**: 開発時70%減（16/24件）

### 定性的効果

- **コードの可読性向上**: デバッグコードの削除で本質的ロジックが明確化
- **保守性向上**: 統一されたロギングシステムで管理容易
- **本番品質向上**: 不要なconsole出力の排除

---

## 🚀 次のステップ

1. **このドキュメントのレビュー**: 計画の妥当性確認
2. **Phase 1実施**: 削除作業（30分）
3. **Phase 2実施**: logger.debug()移行（20分）
4. **Phase 3実施**: logger.warn/error移行（15分）
5. **テスト**: 動作確認とビルド検証
6. **完了報告**: `03-CLEANUP_RESULT.md`作成

---

**作業開始前の確認事項**:
- [ ] バックアップ作成（git commit推奨）
- [ ] 作業時間の確保（約1時間）
- [ ] テスト環境の準備

**作業完了後のタスク**:
- [ ] npm run lintの実行
- [ ] npm run buildの実行
- [ ] 動作確認
- [ ] git commit
- [ ] CODE_ANALYSIS_REPORT.mdの更新
