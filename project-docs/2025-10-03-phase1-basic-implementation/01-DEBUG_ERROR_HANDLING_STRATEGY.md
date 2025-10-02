# デバッグ・エラーハンドリング統一方針

**作成日**: 2025-10-03 02:52
**目的**: プロジェクト全体で一貫したデバッグ・エラーハンドリングを実現

---

## 基本方針

### 1. 開発体験を最優先
- 開発環境では詳細なログを出力
- 本番環境ではユーザーに優しいメッセージのみ

### 2. 型安全を維持
- TypeScriptの型システムを活用
- エラーの種類を型で区別

### 3. 一貫性のあるパターン
- プロジェクト全体で同じ関数・クラスを使用
- コピペで使えるテンプレート提供

---

## 実装構成

### ファイル構造
```
src/
├── lib/
│   ├── logger.ts           # 統一ロガー
│   ├── errors.ts           # カスタムエラークラス
│   └── error-messages.ts   # エラーメッセージ定義
├── components/
│   └── ErrorBoundary.tsx   # エラーバウンダリ
└── hooks/
    └── useErrorHandler.ts  # エラーハンドリングフック
```

---

## 1. 統一ロガー (`src/lib/logger.ts`)

### ログレベル
- **DEBUG**: 開発用の詳細ログ
- **INFO**: 一般的な情報ログ
- **WARN**: 警告（動作には影響なし）
- **ERROR**: エラー（動作に影響あり）

### 実装
```typescript
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogOptions {
  context?: string;    // どこで発生したか (例: 'db-utils.getMainUser')
  data?: unknown;      // 関連データ
  error?: Error;       // エラーオブジェクト
}

class Logger {
  private isDev = import.meta.env.DEV;

  private log(level: LogLevel, message: string, options?: LogOptions) {
    if (!this.isDev && level === 'DEBUG') return; // 本番ではDEBUGを出力しない

    const prefix = `[${level}]`;
    const contextStr = options?.context ? `[${options.context}]` : '';
    const fullMessage = `${prefix}${contextStr} ${message}`;

    switch (level) {
      case 'DEBUG':
        console.log(fullMessage, options?.data);
        break;
      case 'INFO':
        console.info(fullMessage, options?.data);
        break;
      case 'WARN':
        console.warn(fullMessage, options?.data);
        break;
      case 'ERROR':
        console.error(fullMessage, options?.error || options?.data);
        if (options?.error) {
          console.error('Stack:', options.error.stack);
        }
        break;
    }
  }

  debug(message: string, options?: LogOptions) {
    this.log('DEBUG', message, options);
  }

  info(message: string, options?: LogOptions) {
    this.log('INFO', message, options);
  }

  warn(message: string, options?: LogOptions) {
    this.log('WARN', message, options);
  }

  error(message: string, options?: LogOptions) {
    this.log('ERROR', message, options);
  }
}

export const logger = new Logger();
```

### 使用例
```typescript
import { logger } from '@/lib/logger';

// 一般的なログ
logger.debug('メインユーザーを取得開始', { context: 'db-utils.getMainUser' });

// データ付きログ
logger.info('ユーザー作成完了', {
  context: 'db-utils.addUser',
  data: { userId: user.id, userName: user.name }
});

// エラーログ
try {
  await db.users.add(user);
} catch (err) {
  logger.error('ユーザー追加失敗', {
    context: 'db-utils.addUser',
    error: err as Error,
    data: { userName: user.name }
  });
}
```

---

## 2. カスタムエラークラス (`src/lib/errors.ts`)

### エラー種別
- **AppError**: アプリケーション全般のエラー（基底クラス）
- **DatabaseError**: データベース関連エラー
- **ValidationError**: バリデーションエラー
- **NotFoundError**: データが見つからない
- **ConflictError**: データの競合

### 実装
```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string, // ユーザー向けメッセージ（日本語）
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(
      message,
      'DATABASE_ERROR',
      'データベースエラーが発生しました',
      context
    );
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(
      message,
      'VALIDATION_ERROR',
      '入力内容に問題があります',
      { field }
    );
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource} not found${id ? `: ${id}` : ''}`,
      'NOT_FOUND',
      `${resource}が見つかりません`,
      { resource, id }
    );
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(
      message,
      'CONFLICT',
      'データの競合が発生しました',
      context
    );
    this.name = 'ConflictError';
  }
}
```

### 使用例
```typescript
import { DatabaseError, ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export async function addUser(name: string): Promise<User> {
  // バリデーション
  if (!name.trim()) {
    const error = new ValidationError('ユーザー名が空です', 'name');
    logger.error(error.message, {
      context: 'db-utils.addUser',
      error
    });
    throw error;
  }

  try {
    const user: User = {
      id: crypto.randomUUID(),
      name,
      isMainUser: false,
      createdAt: new Date()
    };

    await db.users.add(user);
    logger.info('ユーザー追加成功', {
      context: 'db-utils.addUser',
      data: { userId: user.id }
    });

    return user;
  } catch (err) {
    const dbError = new DatabaseError('ユーザーの追加に失敗しました', {
      userName: name,
      originalError: err
    });
    logger.error(dbError.message, {
      context: 'db-utils.addUser',
      error: dbError
    });
    throw dbError;
  }
}
```

---

## 3. エラーバウンダリ (`src/components/ErrorBoundary.tsx`)

### 目的
Reactコンポーネントツリーで予期せぬエラーをキャッチ

### 実装
```typescript
import React, { Component, ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('予期せぬエラーが発生しました', {
      context: 'ErrorBoundary',
      error,
      data: { errorInfo }
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            エラーが発生しました
          </h1>
          <p className="text-gray-600 mb-4">
            アプリケーションで予期せぬエラーが発生しました。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            再読み込み
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 使用例（main.tsxまたはApp.tsx）
```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';

<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

## 4. エラーハンドリングフック (`src/hooks/useErrorHandler.ts`)

### 目的
コンポーネント内で統一的にエラーハンドリング + Toast通知

### 実装
```typescript
import { useCallback } from 'react';
import { toast } from 'sonner'; // shadcn/uiのToast (後で追加)
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/errors';

export function useErrorHandler(context: string) {
  const handleError = useCallback((error: unknown, customMessage?: string) => {
    let userMessage = 'エラーが発生しました';
    let logMessage = 'Unknown error';

    if (error instanceof AppError) {
      userMessage = error.userMessage;
      logMessage = error.message;
      logger.error(logMessage, {
        context,
        error,
        data: error.context
      });
    } else if (error instanceof Error) {
      logMessage = error.message;
      logger.error(logMessage, {
        context,
        error
      });
    } else {
      logger.error('Unknown error', {
        context,
        data: { error }
      });
    }

    // ユーザーにToast通知
    toast.error(customMessage || userMessage);
  }, [context]);

  return { handleError };
}
```

### 使用例
```typescript
import { useErrorHandler } from '@/hooks/useErrorHandler';

function MyComponent() {
  const { handleError } = useErrorHandler('MyComponent');

  const handleAddUser = async () => {
    try {
      await addUser(newUserName);
      toast.success('ユーザーを追加しました');
    } catch (err) {
      handleError(err);
    }
  };

  return <button onClick={handleAddUser}>追加</button>;
}
```

---

## 5. Dexie.jsエラーハンドリング

### Dexie特有のエラー
```typescript
import { DexieError } from 'dexie';

try {
  await db.users.add(user);
} catch (err) {
  if (err instanceof DexieError) {
    switch (err.name) {
      case 'ConstraintError':
        throw new ConflictError('ユーザーIDが重複しています', {
          userId: user.id
        });
      case 'DataError':
        throw new ValidationError('データ形式が不正です');
      case 'NotFoundError':
        throw new NotFoundError('ユーザー', user.id);
      default:
        throw new DatabaseError(`Dexieエラー: ${err.message}`, {
          dexieErrorName: err.name
        });
    }
  }
  throw err;
}
```

---

## 6. Toast通知の統合（shadcn/ui）

### インストール（後で実施）
```bash
npx shadcn@latest add toast
```

### 使用例
```typescript
import { toast } from 'sonner';

// 成功
toast.success('保存しました');

// エラー
toast.error('保存に失敗しました');

// 警告
toast.warning('データが古い可能性があります');

// 情報
toast.info('処理を開始しました');
```

---

## 実装の優先順位

### Phase 1: 基本実装（今すぐ）
1. ✅ `logger.ts` - 統一ロガー
2. ✅ `errors.ts` - カスタムエラークラス
3. ⬜ `ErrorBoundary.tsx` - エラーバウンダリ
4. ⬜ 既存コード(`db-utils.ts`等)をリファクタリング

### Phase 2: UI統合（次回）
1. ⬜ shadcn/ui Toastの追加
2. ⬜ `useErrorHandler.ts` フックの実装
3. ⬜ コンポーネントでの使用

---

## 開発時のチェックリスト

### エラーハンドリングのベストプラクティス
- [ ] try-catchで適切にエラーをキャッチ
- [ ] カスタムエラークラスを使用
- [ ] ログを適切なレベルで出力
- [ ] ユーザーに分かりやすいメッセージを表示
- [ ] エラーのコンテキスト情報を記録

### ログ出力のベストプラクティス
- [ ] 開発環境ではDEBUGレベルを活用
- [ ] 本番環境ではERRORとWARNのみ
- [ ] 個人情報をログに含めない
- [ ] context（関数名・ファイル名）を必ず指定

---

## まとめ

このドキュメントで定義した方針に従うことで：
- ✅ プロジェクト全体で一貫したエラーハンドリング
- ✅ 開発者は詳細なデバッグ情報を取得
- ✅ ユーザーには分かりやすいメッセージ
- ✅ 型安全で保守しやすいコード

---

**更新履歴**:
- 2025-10-03 02:52: 初回作成、統一方針の策定
