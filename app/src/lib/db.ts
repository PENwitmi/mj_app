import { Dexie, type EntityTable } from 'dexie';

// ========================================
// Type Definitions
// ========================================

export type GameMode = '4-player' | '3-player';
export type UmaRule = 'standard' | 'second-minus';
export type UmaMark = '○○○' | '○○' | '○' | '' | '✗' | '✗✗' | '✗✗✗';

// ========================================
// Entity Interfaces
// ========================================

export interface User {
  id: string;                // UUID
  name: string;              // ユーザー名
  isMainUser: boolean;       // メインユーザーフラグ
  createdAt: Date;           // 登録日時
}

export interface Session {
  id: string;                // UUID
  date: string;              // YYYY-MM-DD形式
  mode: GameMode;            // '4-player' | '3-player'
  rate: number;              // 点数レート（デフォルト: 30）
  umaValue: number;          // ウマ1個あたりの価値（デフォルト: 10）
  chipRate: number;          // チップレート（デフォルト: 100）
  parlorFee: number;         // 場代（デフォルト: 0）
  umaRule: UmaRule;          // 'standard' | 'second-minus'
  createdAt: Date;           // 作成日時
  updatedAt: Date;           // 更新日時
}

export interface Hanchan {
  id: string;                // UUID
  sessionId: string;         // 外部キー（Session.id）
  hanchanNumber: number;     // 半荘番号（1, 2, 3...）
  autoCalculated: boolean;   // 自動計算済みフラグ（初回のみtrue）
  createdAt: Date;           // 作成日時
}

export interface PlayerResult {
  id: string;                // UUID
  hanchanId: string;         // 外部キー（Hanchan.id）
  userId: string | null;     // 外部キー（User.id）、null = 未登録ユーザー
  playerName: string;        // 表示名（登録ユーザーの名前 or 仮名）
  score: number;             // ±点数（例: +10, -5）
  umaMark: UmaMark;          // ウママーク
  isSpectator: boolean;      // 見学フラグ
  chips: number;             // チップ枚数（セッション終了後に入力）
  createdAt: Date;           // 作成日時
}

// ========================================
// Dexie Database Declaration
// ========================================

export const db = new Dexie('MahjongDB') as Dexie & {
  users: EntityTable<User, 'id'>;
  sessions: EntityTable<Session, 'id'>;
  hanchans: EntityTable<Hanchan, 'id'>;
  playerResults: EntityTable<PlayerResult, 'id'>;
};

db.version(1).stores({
  users: 'id, name, createdAt',
  sessions: 'id, date, mode, createdAt, updatedAt',
  hanchans: 'id, sessionId, hanchanNumber, createdAt',
  playerResults: 'id, hanchanId, userId, playerName, createdAt'
});

// ========================================
// Initialization Functions
// ========================================

/**
 * メインユーザーを初期化する（初回起動時のみ）
 * 固定IDを使用して重複作成を防止
 */
export async function initializeMainUser(): Promise<User> {
  const MAIN_USER_ID = 'main-user-fixed-id';

  // 固定IDでメインユーザーを取得
  const existingMainUser = await db.users.get(MAIN_USER_ID);

  if (existingMainUser) {
    return existingMainUser;
  }

  const mainUser: User = {
    id: MAIN_USER_ID,
    name: '自分',
    isMainUser: true,
    createdAt: new Date()
  };

  // putを使用して、既に存在する場合は上書きせずにエラーを避ける
  try {
    await db.users.add(mainUser);
  } catch (err) {
    // 既に存在する場合は取得して返す
    const user = await db.users.get(MAIN_USER_ID);
    if (user) return user;
    throw err;
  }

  return mainUser;
}

/**
 * アプリ初期化処理
 */
export async function initializeApp(): Promise<void> {
  await initializeMainUser();
}

/**
 * データベース全削除（開発用）
 */
export async function clearAllData(): Promise<void> {
  await db.users.clear();
  await db.sessions.clear();
  await db.hanchans.clear();
  await db.playerResults.clear();
}
