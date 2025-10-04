Last updated: 2025-10-05

# コーディングスタイルと規約

## TypeScript規約

### 命名規則
- **コンポーネント**: PascalCase (`InputTab`, `ErrorBoundary`)
- **関数**: camelCase (`assignUmaMarks`, `calculateAutoScore`)
- **定数**: UPPER_SNAKE_CASE (`DEFAULT_SETTINGS`, `UMA_MARK_OPTIONS`)
- **型定義**: PascalCase (`SessionSettings`, `PlayerResult`)

### 型定義スタイル
```typescript
// interface使用（拡張可能な構造）
export interface Session {
  id: string;
  date: string;
  mode: GameMode;
  // ...
}

// type使用（リテラル型、ユニオン型）
export type GameMode = '4-player' | '3-player';
export type UmaRule = 'standard' | 'second-minus';
```

### インポート規約
```typescript
// Reactインポート
import { useState, useEffect } from 'react';

// ライブラリインポート
import { Card } from '@/components/ui/card';

// 内部モジュール（@エイリアス使用）
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
```

## エラーハンドリング規約

### 統一パターン
```typescript
import { logger } from '@/lib/logger';
import { DatabaseError, ValidationError } from '@/lib/errors';

try {
  // 処理
} catch (err) {
  const error = new DatabaseError('エラーメッセージ', { originalError: err });
  logger.error(error.message, { context: 'module.function', error });
  throw error;
}
```

### ログレベル
- `DEBUG`: 開発環境のみ
- `INFO`: 一般的な情報
- `WARN`: 警告（動作影響なし）
- `ERROR`: エラー（動作影響あり）

### カスタムエラー
- `AppError`: 基底クラス
- `DatabaseError`: DB操作エラー
- `ValidationError`: バリデーションエラー
- `NotFoundError`: データ未検出
- `ConflictError`: データ競合

## React規約

### コンポーネント構造
```typescript
// 1. インポート
// 2. 型定義
// 3. 定数
// 4. ヘルパー関数
// 5. メインコンポーネント
// 6. エクスポート
```

### Hooks使用
- React 19 Strict Mode: `useEffect`が2回実行される点に注意
- 競合状態(race condition)を避ける設計

## Dexie.js規約

### EntityTableパターン
```typescript
EntityTable<Type, 'primaryKey'>
```

### 制約
- Boolean値はインデックスに使用不可
- in-memory filteringで対応

### クエリパターン
```typescript
// 外部キー検索
.where('foreignKey').equals(id)

// 複数ID検索
.where('id').anyOf([id1, id2, ...])
```

## Tailwind CSS規約

### Tailwind v4 設定
- Vite plugin使用 (`@tailwindcss/vite`)
- PostCSS config不要
- `src/index.css`: `@import "tailwindcss";` のみ

### クラス名
- `cn()`ヘルパー使用（tailwind-merge）
- コンポーネント内で動的クラス結合
