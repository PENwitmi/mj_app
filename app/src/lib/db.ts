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
  isArchived: boolean;       // アーカイブフラグ
  archivedAt?: Date;         // アーカイブ日時（オプショナル）
  createdAt: Date;           // 登録日時
}

// セッションサマリー（事前計算データ）
export interface SessionSummary {
  sessionId: string;
  date: string;
  mode: GameMode;
  hanchanCount: number;      // 入力済み半荘数
  totalPayout: number;       // 最終収支合計
  totalChips: number;        // チップ合計
  totalParlorFee: number;    // 場代合計
  averageRank: number;       // 平均着順
  rankCounts: {
    first: number;
    second: number;
    third: number;
    fourth?: number;         // 3人打ちの場合はundefined
  };
  overallRank: number;       // セッション内総合順位（総収支ベース）
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
  summary?: SessionSummary;  // 事前計算されたサマリー（パフォーマンス最適化）
  memo?: string;             // メモ（最大200文字、オプショナル）
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
  parlorFee: number;         // 場代（プレイヤー個別）
  position: number;          // 列番号（0, 1, 2, 3） - InputTabでの列順を保持
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

// Version 1: Initial schema
db.version(1).stores({
  users: 'id, name, createdAt',
  sessions: 'id, date, mode, createdAt, updatedAt',
  hanchans: 'id, sessionId, hanchanNumber, createdAt',
  playerResults: 'id, hanchanId, userId, playerName, createdAt'
});

// Version 2: Added Session.summary for performance optimization
db.version(2).stores({
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
    isArchived: false,
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
