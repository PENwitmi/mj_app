# Phase 4 修正: プレイヤー順序保持の実装

**作成日**: 2025-10-05
**ステータス**: 実装待ち
**優先度**: 高（Critical Bug Fix）

---

## 🐛 問題の詳細

### 症状
- 履歴詳細表示で、各半荘のプレイヤー列順がバラバラになる
- InputTabでの入力時の列順と、詳細表示の列順が一致しない
- メインユーザーの点数が正しくても、他の列に表示されるため混乱を招く

### 具体例
**InputTab（入力時）:**
```
| 自分 | A  | B   |
| +31  | +50| -81 |  → 自分は2位
```

**HistoryTab詳細表示（取得時）:**
```
| A   | B   | 自分 |  ← 順序が違う！
| +50 | -81 | +31  |
```

ユーザーは1列目を見て「+31で1位」と誤認するが、実際の集計は正しく「2位」となっている。

---

## 🔍 根本原因の分析

### 1. データ保存時
**InputTab.tsx 327-338行目:**
```typescript
hanchans: hanchans.map(h => ({
  hanchanNumber: h.hanchanNumber,
  players: h.players.map(p => ({  // ← 配列の順序で保存
    playerName: p.playerName,
    userId: p.userId,
    score: p.score ?? 0,
    // ... positionフィールドがない
  }))
}))
```

### 2. データ取得時
**db-utils.ts getPlayerResultsByHanchan:**
```typescript
export async function getPlayerResultsByHanchan(hanchanId: string): Promise<PlayerResult[]> {
  return await db.playerResults
    .where('hanchanId')
    .equals(hanchanId)
    .toArray();  // ← IndexedDBは順序を保証しない
}
```

### 3. 表示時
**SessionDetailDialog.tsx 64行目:**
```typescript
const playerNames = hanchans[0]?.players.map(p => p.playerName) || []
// ← 取得した順序のまま表示（元の順序は失われている）
```

### 問題の本質
**PlayerResultテーブルにposition（列番号）情報が存在しないため、取得時に元の順序を復元できない。**

---

## ✅ 解決策の設計

### アプローチ: positionフィールドの追加

PlayerResultに`position`フィールドを追加し、列番号を明示的に保存する。

#### 1. データモデル変更

**lib/db.ts:**
```typescript
export interface PlayerResult {
  id: string;
  hanchanId: string;
  userId: string | null;
  playerName: string;
  score: number;
  umaMark: UmaMark;
  isSpectator: boolean;
  chips: number;
  position: number;  // ← 追加（0, 1, 2, 3）
  createdAt: Date;
}
```

**Dexieスキーマ変更（バージョンアップ不要）:**
- positionはインデックス不要
- 既存テーブル構造に影響なし

#### 2. 保存処理の修正

**InputTab.tsx 329行目付近:**
```typescript
players: h.players.map((p, idx) => ({
  playerName: p.playerName,
  userId: p.userId,
  score: p.score ?? 0,
  umaMark: p.umaMark,
  chips: p.chips,
  parlorFee: p.parlorFee,
  isSpectator: p.isSpectator,
  position: idx  // ← 追加
}))
```

**db-utils.ts saveSession:**
```typescript
const playerResult: PlayerResult = {
  id: crypto.randomUUID(),
  hanchanId,
  userId: playerData.userId,
  playerName: playerData.playerName,
  score: playerData.score,
  umaMark: playerData.umaMark,
  isSpectator: playerData.isSpectator,
  chips: playerData.chips,
  position: playerData.position,  // ← 追加
  createdAt: now
};
```

#### 3. 取得処理の修正

**db-utils.ts getPlayerResultsByHanchan:**
```typescript
export async function getPlayerResultsByHanchan(hanchanId: string): Promise<PlayerResult[]> {
  const results = await db.playerResults
    .where('hanchanId')
    .equals(hanchanId)
    .toArray();

  // positionでソート（0, 1, 2, 3の順）
  return results.sort((a, b) => a.position - b.position);
}
```

---

## 📋 実装手順

### Step 1: 型定義の更新
1. `lib/db.ts` の `PlayerResult` インターフェースに `position: number` を追加
2. `lib/db-utils.ts` の `SessionSaveData` 型に position を追加

### Step 2: InputTab修正
1. `InputTab.tsx` の saveData作成時に `position: idx` を追加

### Step 3: db-utils修正
1. `saveSession` 関数で playerResult に position を含める
2. `getPlayerResultsByHanchan` に sort 処理を追加

### Step 4: 既存データのクリア
1. ブラウザのIndexedDB削除（開発段階のみ）
2. アプリをリロードして新規データで確認

### Step 5: 動作確認
1. 新規セッション作成（5半荘）
2. 保存後、履歴詳細を開く
3. InputTabと同じ列順で表示されることを確認

---

## 🔧 型定義の詳細

### SessionSaveData型の拡張

**lib/db-utils.ts:**
```typescript
export interface SessionSaveData {
  date: string;
  mode: 'four-player' | 'three-player';
  rate: number;
  umaValue: number;
  chipRate: number;
  umaRule: 'standard' | 'second-minus';
  hanchans: {
    hanchanNumber: number;
    players: {
      playerName: string;
      userId: string | null;
      score: number;
      umaMark: UmaMark;
      chips: number;
      parlorFee: number;
      isSpectator: boolean;
      position: number;  // ← 追加
    }[];
  }[];
}
```

---

## ⚠️ 影響範囲

### 変更が必要なファイル
1. ✅ `lib/db.ts` - PlayerResult型定義
2. ✅ `lib/db-utils.ts` - SessionSaveData型、saveSession、getPlayerResultsByHanchan
3. ✅ `components/tabs/InputTab.tsx` - 保存時のデータ作成

### 影響を受けるが変更不要なファイル
- `SessionDetailDialog.tsx` - 自動的に正しい順序で表示される
- `session-utils.ts` - PlayerResult配列を扱うが順序は関係ない
- `useSessions.ts` - 変更不要

### 既存データへの影響
- **既存の保存データは positionフィールドがないため表示できない**
- 開発段階のため、IndexedDBを削除して新規作成が必要
- 本番環境では migration が必要（将来の課題）

---

## 🧪 テスト項目

### 1. 基本動作テスト
- [ ] 新規セッション作成（3半荘）
- [ ] 各半荘でプレイヤー順を確認（1列目=自分）
- [ ] 保存実行
- [ ] 履歴詳細を開く
- [ ] InputTabと同じ列順で表示されることを確認

### 2. 複数プレイヤーパターン
- [ ] 4人打ちでテスト
- [ ] 3人打ちでテスト
- [ ] プレイヤー変更（2列目を別ユーザーに変更）してテスト

### 3. 大量データテスト
- [ ] 10半荘のセッション作成
- [ ] 全半荘で列順が一致することを確認

### 4. エッジケース
- [ ] 見学者を含むケース
- [ ] 途中でプレイヤーを変更したケース

---

## 📝 実装後のコミットメッセージ

```
fix: プレイヤー順序保持機能の実装

- PlayerResultにpositionフィールド追加
- 保存時に列番号（0,1,2,3）を記録
- 取得時にpositionでソート
- 履歴詳細とInputTabの列順が一致

Fixes: 履歴詳細で列順がバラバラになる問題
Impact: 既存データはposition未定義のため再作成必要

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 🔄 今後の改善案（オプション）

1. **migration機能の実装**
   - 既存データに position を自動付与
   - メインユーザーを1列目に固定、他は任意の順序

2. **プレイヤー順の柔軟な変更**
   - 詳細表示で列をドラッグ&ドロップで並び替え
   - ユーザーごとに好みの順序を保存

3. **バリデーション強化**
   - position の重複チェック
   - 0から連番になっているかチェック

---

**更新履歴:**
- 2025-10-05 00:00: 初回作成、問題分析と解決策策定
