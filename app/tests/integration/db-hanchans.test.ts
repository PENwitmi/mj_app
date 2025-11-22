import { describe, it, expect, beforeEach } from 'vitest';
import { db, initializeMainUser } from '@/lib/db';
import {
  createHanchan,
  getHanchansBySession,
  createPlayerResult,
  getPlayerResultsByHanchan,
  getUserStats,
} from '@/lib/db/hanchans';
import { saveSession } from '@/lib/db-utils';
import type { SessionSaveData } from '@/lib/db-utils';

/**
 * 統合テスト: db/hanchans.ts
 * 半荘とプレイヤー結果のデータベース操作テスト
 */

beforeEach(async () => {
  await db.users.clear();
  await db.sessions.clear();
  await db.hanchans.clear();
  await db.playerResults.clear();
  await initializeMainUser();
});

describe('Hanchan Management', () => {
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

  it('TC-DB-HAN-001: Hanchan作成', async () => {
    const sessionId = await saveSession(createTestSessionData());

    const hanchan = await createHanchan(sessionId, 2);

    expect(hanchan.id).toBeDefined();
    expect(hanchan.sessionId).toBe(sessionId);
    expect(hanchan.hanchanNumber).toBe(2);
    expect(hanchan.autoCalculated).toBe(false);
    expect(hanchan.createdAt).toBeInstanceOf(Date);

    // DB確認
    const dbHanchan = await db.hanchans.get(hanchan.id);
    expect(dbHanchan).toBeDefined();
    expect(dbHanchan?.hanchanNumber).toBe(2);
  });

  it('TC-DB-HAN-002: PlayerResult作成（position順）', async () => {
    const sessionId = await saveSession(createTestSessionData());

    // 新しい半荘を作成
    const newHanchan = await createHanchan(sessionId, 2);

    // position順で作成: 2, 0, 3, 1（意図的にバラバラの順序）
    await createPlayerResult(newHanchan.id, null, 'Player C', -20, '✗', 2);
    await createPlayerResult(newHanchan.id, 'main-user-fixed-id', '自分', 40, '○○', 0);
    await createPlayerResult(newHanchan.id, null, 'Player D', -30, '✗✗', 3);
    await createPlayerResult(newHanchan.id, null, 'Player B', 10, '○', 1);

    // position順に取得
    const results = await getPlayerResultsByHanchan(newHanchan.id);

    expect(results).toHaveLength(4);
    // position順にソートされていることを確認
    expect(results[0].position).toBe(0); // 自分
    expect(results[0].playerName).toBe('自分');
    expect(results[1].position).toBe(1); // Player B
    expect(results[1].playerName).toBe('Player B');
    expect(results[2].position).toBe(2); // Player C
    expect(results[2].playerName).toBe('Player C');
    expect(results[3].position).toBe(3); // Player D
    expect(results[3].playerName).toBe('Player D');
  });

  it('TC-DB-HAN-003: PlayerResult取得（position順ソート）', async () => {
    const sessionId = await saveSession(createTestSessionData());
    const hanchans = await getHanchansBySession(sessionId);
    const hanchanId = hanchans[0].id;

    const results = await getPlayerResultsByHanchan(hanchanId);

    // position順にソートされていることを確認
    expect(results).toHaveLength(4);
    expect(results[0].position).toBe(0); // 自分
    expect(results[1].position).toBe(1); // プレイヤー2
    expect(results[2].position).toBe(2); // プレイヤー3
    expect(results[3].position).toBe(3); // プレイヤー4
  });

  it('TC-DB-HAN-004: 見学者フラグ処理', async () => {
    const data: SessionSaveData = {
      ...createTestSessionData(),
      hanchans: [
        {
          hanchanNumber: 1,
          players: [
            { playerName: '自分', userId: 'main-user-fixed-id', score: 30, umaMark: '○○', chips: 0, parlorFee: 300, isSpectator: false, position: 0 },
            { playerName: 'プレイヤー2', userId: null, score: 10, umaMark: '○', chips: 0, parlorFee: 300, isSpectator: false, position: 1 },
            { playerName: '見学者', userId: null, score: 0, umaMark: '', chips: 0, parlorFee: 0, isSpectator: true, position: 2 },
            { playerName: 'プレイヤー4', userId: null, score: -40, umaMark: '✗', chips: 0, parlorFee: 300, isSpectator: false, position: 3 },
          ],
        },
      ],
    };

    const sessionId = await saveSession(data);
    const hanchans = await getHanchansBySession(sessionId);
    const results = await getPlayerResultsByHanchan(hanchans[0].id);

    // 見学者を確認
    const spectator = results.find(r => r.isSpectator);
    expect(spectator).toBeDefined();
    expect(spectator?.playerName).toBe('見学者');
    expect(spectator?.score).toBe(0);
    expect(spectator?.umaMark).toBe('');
    expect(spectator?.parlorFee).toBe(0);

    // 非見学者を確認
    const players = results.filter(r => !r.isSpectator);
    expect(players).toHaveLength(3);
  });

  it('TC-DB-HAN-005: プレイヤー個別場代保存', async () => {
    const data: SessionSaveData = {
      ...createTestSessionData(),
      hanchans: [
        {
          hanchanNumber: 1,
          players: [
            { playerName: '自分', userId: 'main-user-fixed-id', score: 30, umaMark: '○○', chips: 0, parlorFee: 500, isSpectator: false, position: 0 },
            { playerName: 'プレイヤー2', userId: null, score: 10, umaMark: '○', chips: 0, parlorFee: 300, isSpectator: false, position: 1 },
            { playerName: 'プレイヤー3', userId: null, score: -10, umaMark: '✗', chips: 0, parlorFee: 200, isSpectator: false, position: 2 },
            { playerName: 'プレイヤー4', userId: null, score: -30, umaMark: '✗✗', chips: 0, parlorFee: 0, isSpectator: false, position: 3 },
          ],
        },
      ],
    };

    const sessionId = await saveSession(data);
    const hanchans = await getHanchansBySession(sessionId);
    const results = await getPlayerResultsByHanchan(hanchans[0].id);

    // 各プレイヤーの個別場代を確認
    expect(results[0].parlorFee).toBe(500); // 自分
    expect(results[1].parlorFee).toBe(300); // プレイヤー2
    expect(results[2].parlorFee).toBe(200); // プレイヤー3
    expect(results[3].parlorFee).toBe(0);   // プレイヤー4（無料）
  });

  it('TC-DB-HAN-006: getUserStats（ユーザー統計）', async () => {
    // セッション1作成（main-user参加）
    const session1Id = await saveSession(createTestSessionData());

    // セッション2作成（main-user参加）
    const session2Id = await saveSession({
      ...createTestSessionData(),
      date: '2025-10-17',
    });

    const stats = await getUserStats('main-user-fixed-id');

    // PlayerResults: 2セッション × 1半荘 × 1回 = 2件
    expect(stats.playerResults).toHaveLength(2);
    expect(stats.playerResults.every(pr => pr.userId === 'main-user-fixed-id')).toBe(true);

    // Hanchans: 2件
    expect(stats.hanchans).toHaveLength(2);

    // Sessions: 2件
    expect(stats.sessions).toHaveLength(2);
    expect(stats.sessions.find(s => s.id === session1Id)).toBeDefined();
    expect(stats.sessions.find(s => s.id === session2Id)).toBeDefined();
  });
});
