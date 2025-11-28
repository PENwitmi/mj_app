// ========================================
// Re-export from new modular structure
// このファイルは後方互換性のために残されています
// 新しいモジュール構造は src/lib/db/ にあります
// ========================================

// db.ts からの型定義とインスタンスを re-export（既存コードとの互換性のため）
export { db } from './db';
export type { User, Session, Hanchan, PlayerResult, UmaMark, UmaRule, GameMode, Template } from './db';

// 新しいモジュール構造からすべてをre-export
export * from './db/index';
