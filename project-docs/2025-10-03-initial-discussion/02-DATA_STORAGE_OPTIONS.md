# Capacitorアプリでのデータ保存方法

**作成日**: 2025-10-03 00:29
**目的**: iOSアプリでのデータ保存のベストプラクティスを検討

---

## Capacitorアプリで使える保存方法

### 1. **IndexedDB** (推奨候補)
**概要**: ブラウザのDB技術だが、Capacitorアプリでも使える

**メリット**:
- 大容量対応（数十MB〜数百MB可能）
- 構造化データに強い（テーブル、インデックス）
- 非同期処理でパフォーマンス良好
- TypeScript対応ライブラリ豊富（Dexie.js等）
- Web版とアプリ版でコード共通化可能

**デメリット**:
- LocalStorageよりやや複雑
- SQLiteより若干遅い（体感差はほぼなし）

**向いているケース**:
- 数百〜数千件のデータ
- 複雑なクエリは少ない
- Web版も視野に入れる場合

---

### 2. **SQLite** (Capacitorプラグイン)
**概要**: ネイティブのデータベース

**メリット**:
- 非常に高速
- SQLクエリで複雑な検索可能
- 大容量対応（GB級も可）
- オフライン完結
- より「ネイティブアプリらしい」

**デメリット**:
- Capacitorプラグインのインストール必要
- Web版では動かない（別途対応必要）
- SQLの知識が必要

**向いているケース**:
- 数万件以上のデータ
- 複雑な集計・検索が多い
- 完全にネイティブアプリ専用

---

### 3. **LocalStorage**
**概要**: シンプルなkey-value保存

**メリット**:
- 超シンプル、学習コストゼロ
- 同期的に動作（async/await不要）

**デメリット**:
- 容量制限（5-10MB程度）
- 文字列のみ（JSON変換必要）
- 遅い（同期処理）
- 構造化データに不向き

**向いているケース**:
- 設定値の保存のみ
- データ量が極小

---

### 4. **Capacitor Preferences API**
**概要**: Capacitorの設定保存専用API

**メリット**:
- 設定値保存に最適
- プラットフォーム間で統一的

**デメリット**:
- key-valueのみ
- 大量データには不向き

**向いているケース**:
- レート設定、馬の価値設定等

---

## 麻雀アプリでの推奨

### データ量の想定
- 1日のセッション: 1件
- 1セッションの半荘: 平均5-10件
- 1半荘のプレイヤー結果: 3-4件
- 1年間で: 約365セッション × 8半荘 × 4人 = 約12,000レコード
- 5年間で: 約60,000レコード

### 推奨案

**案1: IndexedDB（おすすめ）**
- 理由:
  - データ量的に十分（数万件余裕）
  - TypeScriptとの相性良好
  - 学習コストも妥当
  - 将来Web版も作れる
- ライブラリ: Dexie.js

**案2: SQLite**
- 理由:
  - より本格的
  - 将来的に複雑な統計機能を追加する場合に有利
- プラグイン: @capacitor-community/sqlite

**設定値は Capacitor Preferences API を併用**
- レート、馬の価値等はPreferencesで保存
- データ本体とは分ける

---

## 具体的な実装イメージ（IndexedDBの場合）

```typescript
// Dexie.jsでのスキーマ定義例
import Dexie, { Table } from 'dexie';

interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  rate: number;
  umaValue: number; // ○1個の価値
}

interface Hanchan {
  id: string;
  sessionId: string;
  order: number; // 何半荘目
}

interface PlayerResult {
  id: string;
  hanchanId: string;
  playerName: string;
  score: number; // +10形式の点数
  umaMarks: number; // ○なら+2、✗なら-1など
}

class MahjongDB extends Dexie {
  sessions!: Table<Session>;
  hanchans!: Table<Hanchan>;
  playerResults!: Table<PlayerResult>;

  constructor() {
    super('MahjongDB');
    this.version(1).stores({
      sessions: 'id, date',
      hanchans: 'id, sessionId, order',
      playerResults: 'id, hanchanId, playerName'
    });
  }
}

export const db = new MahjongDB();

// 使用例
await db.sessions.add({
  id: '123',
  date: '2025-10-03',
  rate: 0.5,
  umaValue: 1000
});
```

---

## 次のステップ

仕様設計が固まったら、どちらを使うか決定する。
現時点では**IndexedDB（Dexie.js）を推奨**。

---

**更新履歴**:
- 2025-10-03 00:29: 初回作成
