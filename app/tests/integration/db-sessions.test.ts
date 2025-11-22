import { describe, it, expect, beforeEach } from 'vitest';
import { db, initializeMainUser } from '@/lib/db';
import { saveSession, deleteSession, getSessionWithDetails } from '@/lib/db-utils';
import type { SessionSaveData } from '@/lib/db-utils';

/**
 * 統合テスト: db/sessions.ts
 * セッション管理のデータベース操作テスト
 */

beforeEach(async () => {
  await db.users.clear();
  await db.sessions.clear();
  await db.hanchans.clear();
  await db.playerResults.clear();
  await initializeMainUser();
});

describe('Session Management', () => {
  const createTestSessionData = (): SessionSaveData => ({
    date: '2025-10-16',
    mode: 'four-player',
    rate: 100,
    umaValue: 10,
    chipRate: 500,
    umaRule: 'standard',
    hanchans: [
      {
        hanchanNumber: 1,
        players: [
          { playerName: '自分', userId: 'main-user-fixed-id', score: 40, umaMark: '○○', chips: 0, parlorFee: 300, isSpectator: false, position: 0 },
          { playerName: 'プレイヤー2', userId: null, score: 10, umaMark: '○', chips: 0, parlorFee: 300, isSpectator: false, position: 1 },
          { playerName: 'プレイヤー3', userId: null, score: -20, umaMark: '✗', chips: 0, parlorFee: 300, isSpectator: false, position: 2 },
          { playerName: 'プレイヤー4', userId: null, score: -30, umaMark: '✗✗', chips: 0, parlorFee: 300, isSpectator: false, position: 3 },
        ],
      },
    ],
  });

  it('TC-DB-SES-001: セッション保存（トランザクション）', async () => {
    const data = createTestSessionData();
    const sessionId = await saveSession(data);

    expect(sessionId).toBeDefined();

    // Session確認
    const session = await db.sessions.get(sessionId);
    expect(session).toBeDefined();
    expect(session?.date).toBe('2025-10-16');
    expect(session?.mode).toBe('4-player');

    // Hanchan確認
    const hanchans = await db.hanchans.where('sessionId').equals(sessionId).toArray();
    expect(hanchans).toHaveLength(1);

    // PlayerResult確認
    const playerResults = await db.playerResults.where('hanchanId').equals(hanchans[0].id).toArray();
    expect(playerResults).toHaveLength(4);
  });

  it('TC-DB-SES-002: 複数半荘セッション保存', async () => {
    const data: SessionSaveData = {
      ...createTestSessionData(),
      hanchans: [
        createTestSessionData().hanchans[0],
        { ...createTestSessionData().hanchans[0], hanchanNumber: 2 },
        { ...createTestSessionData().hanchans[0], hanchanNumber: 3 },
      ],
    };

    const sessionId = await saveSession(data);
    const hanchans = await db.hanchans
      .where('sessionId')
      .equals(sessionId)
      .sortBy('hanchanNumber');

    expect(hanchans).toHaveLength(3);
    expect(hanchans.map(h => h.hanchanNumber)).toEqual([1, 2, 3]);
  });

  it('TC-DB-SES-003: 空半荘フィルタリング', async () => {
    const data: SessionSaveData = {
      ...createTestSessionData(),
      hanchans: [
        createTestSessionData().hanchans[0],
        {
          hanchanNumber: 2,
          players: [
            { playerName: '自分', userId: 'main-user-fixed-id', score: 0, umaMark: '', chips: 0, parlorFee: 0, isSpectator: false, position: 0 },
            { playerName: 'プレイヤー2', userId: null, score: 0, umaMark: '', chips: 0, parlorFee: 0, isSpectator: false, position: 1 },
            { playerName: 'プレイヤー3', userId: null, score: 0, umaMark: '', chips: 0, parlorFee: 0, isSpectator: false, position: 2 },
            { playerName: 'プレイヤー4', userId: null, score: 0, umaMark: '', chips: 0, parlorFee: 0, isSpectator: false, position: 3 },
          ],
        },
      ],
    };

    const sessionId = await saveSession(data);
    const hanchans = await db.hanchans.where('sessionId').equals(sessionId).toArray();

    // 空半荘（全員0点）はフィルタリングされる
    expect(hanchans).toHaveLength(1);
  });

  it('TC-DB-SES-004: セッション詳細取得', async () => {
    const data = createTestSessionData();
    const sessionId = await saveSession(data);

    const details = await getSessionWithDetails(sessionId);

    expect(details).not.toBeNull();
    expect(details?.session.id).toBe(sessionId);
    expect(details?.hanchans).toHaveLength(1);
    expect(details?.hanchans[0].players).toHaveLength(4);
  });

  it('TC-DB-SES-005: セッション削除（カスケード削除）', async () => {
    const data = createTestSessionData();
    const sessionId = await saveSession(data);

    const hanchans = await db.hanchans.where('sessionId').equals(sessionId).toArray();
    const hanchanId = hanchans[0].id;

    await deleteSession(sessionId);

    // Session削除確認
    const session = await db.sessions.get(sessionId);
    expect(session).toBeUndefined();

    // Hanchan削除確認
    const deletedHanchans = await db.hanchans.where('sessionId').equals(sessionId).toArray();
    expect(deletedHanchans).toHaveLength(0);

    // PlayerResult削除確認
    const deletedPlayerResults = await db.playerResults.where('hanchanId').equals(hanchanId).toArray();
    expect(deletedPlayerResults).toHaveLength(0);
  });
});
