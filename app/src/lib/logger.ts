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
