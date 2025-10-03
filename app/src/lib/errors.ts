/**
 * アプリケーション全般のエラー（基底クラス）
 */
export class AppError extends Error {
  code: string
  userMessage: string // ユーザー向けメッセージ（日本語）
  context?: Record<string, unknown>

  constructor(
    message: string,
    code: string,
    userMessage: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage;
    this.context = context;
  }
}

/**
 * データベース関連エラー
 */
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

/**
 * バリデーションエラー
 */
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

/**
 * データが見つからないエラー
 */
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

/**
 * データの競合エラー
 */
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
