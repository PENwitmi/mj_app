import { describe, it, expect } from 'vitest';
import { calculateRanks, calculatePayout } from '@/lib/session-utils';
import type { PlayerResult, UmaMark } from '@/lib/db';

/**
 * ユニットテスト: session-utils.ts
 * 着順計算・収支計算のロジックテスト
 */

// ========================================
// Test Helper Functions
// ========================================

function createPlayerResult(
  id: string,
  playerName: string,
  score: number,
  isSpectator = false
): PlayerResult {
  return {
    id,
    hanchanId: 'test-hanchan-id',
    userId: null,
    playerName,
    score,
    umaMark: '',
    isSpectator,
    chips: 0,
    parlorFee: 0,
    position: 0,
    createdAt: new Date(),
  };
}

// ========================================
// calculateRanks() Tests
// ========================================

describe('calculateRanks', () => {
  it('TC-RANK-001: 4人打ち通常 (+40, +10, -20, -30)', () => {
    const players: PlayerResult[] = [
      createPlayerResult('p1', 'Player 1', 40),
      createPlayerResult('p2', 'Player 2', 10),
      createPlayerResult('p3', 'Player 3', -20),
      createPlayerResult('p4', 'Player 4', -30),
    ];

    const rankMap = calculateRanks(players);

    expect(rankMap.get('p1')).toBe(1); // 40点 → 1位
    expect(rankMap.get('p2')).toBe(2); // 10点 → 2位
    expect(rankMap.get('p3')).toBe(3); // -20点 → 3位
    expect(rankMap.get('p4')).toBe(4); // -30点 → 4位
  });

  it('TC-RANK-002: 同点処理 (+30, +30, -30, -30)', () => {
    const players: PlayerResult[] = [
      createPlayerResult('p1', 'Player 1', 30),
      createPlayerResult('p2', 'Player 2', 30),
      createPlayerResult('p3', 'Player 3', -30),
      createPlayerResult('p4', 'Player 4', -30),
    ];

    const rankMap = calculateRanks(players);

    // 同点の場合、配列順で前者が優先される
    expect(rankMap.get('p1')).toBe(1); // 30点（前）→ 1位
    expect(rankMap.get('p2')).toBe(1); // 30点（後）→ 同1位
    expect(rankMap.get('p3')).toBe(3); // -30点（前）→ 3位
    expect(rankMap.get('p4')).toBe(3); // -30点（後）→ 同3位
  });

  it('TC-RANK-003: 見学者除外 (+30, +10, 見学, -40)', () => {
    const players: PlayerResult[] = [
      createPlayerResult('p1', 'Player 1', 30),
      createPlayerResult('p2', 'Player 2', 10),
      createPlayerResult('p3', 'Player 3', 0, true), // 見学者
      createPlayerResult('p4', 'Player 4', -40),
    ];

    const rankMap = calculateRanks(players);

    expect(rankMap.get('p1')).toBe(1); // 30点 → 1位
    expect(rankMap.get('p2')).toBe(2); // 10点 → 2位
    expect(rankMap.get('p3')).toBeUndefined(); // 見学者は着順なし
    expect(rankMap.get('p4')).toBe(3); // -40点 → 3位（3人中）
  });

  it('TC-RANK-004: 3人打ち (+40, 0, -40)', () => {
    const players: PlayerResult[] = [
      createPlayerResult('p1', 'Player 1', 40),
      createPlayerResult('p2', 'Player 2', 0),
      createPlayerResult('p3', 'Player 3', -40),
    ];

    const rankMap = calculateRanks(players);

    expect(rankMap.get('p1')).toBe(1); // 40点 → 1位
    expect(rankMap.get('p2')).toBe(2); // 0点 → 2位
    expect(rankMap.get('p3')).toBe(3); // -40点 → 3位
  });

  it('TC-RANK-005: 点数null含む（nullは除外）', () => {
    const players: PlayerResult[] = [
      createPlayerResult('p1', 'Player 1', 30),
      { ...createPlayerResult('p2', 'Player 2', 0), score: null as any }, // null
      createPlayerResult('p3', 'Player 3', -10),
      createPlayerResult('p4', 'Player 4', -20),
    ];

    const rankMap = calculateRanks(players);

    expect(rankMap.get('p1')).toBe(1); // 30点 → 1位
    expect(rankMap.get('p2')).toBeUndefined(); // null → 着順なし
    expect(rankMap.get('p3')).toBe(2); // -10点 → 2位
    expect(rankMap.get('p4')).toBe(3); // -20点 → 3位
  });
});

// ========================================
// calculatePayout() Tests
// ========================================

describe('calculatePayout', () => {
  it('TC-PAY-001: 基本計算', () => {
    // score=30, uma=○○, chip=2, rate=100, umaValue=10, chipRate=500, parlorFee=300
    // 計算: (30 + 2*10) * 100 + 2*500 - 300 = 50*100 + 1000 - 300 = 5700
    const result = calculatePayout(30, '○○', 2, 100, 10, 500, 300);

    expect(result).toBe(5700);
  });

  it('TC-PAY-002: マイナス点数 (score=-40, uma=✗✗)', () => {
    // score=-40, uma=✗✗(-2), chip=0, rate=100, umaValue=10, chipRate=500, parlorFee=300
    // 計算: (-40 + (-2)*10) * 100 + 0*500 - 300 = -60*100 - 300 = -6300
    const result = calculatePayout(-40, '✗✗', 0, 100, 10, 500, 300);

    expect(result).toBe(-6300);
  });

  it('TC-PAY-003: ゼロ点 (score=0, uma=無印)', () => {
    // score=0, uma=''(0), chip=0, rate=100, umaValue=10, chipRate=500, parlorFee=300
    // 計算: (0 + 0*10) * 100 + 0*500 - 300 = -300
    const result = calculatePayout(0, '', 0, 100, 10, 500, 300);

    expect(result).toBe(-300);
  });

  it('TC-PAY-004: チップなし (chip=0)', () => {
    // score=30, uma=○○, chip=0, rate=100, umaValue=10, chipRate=500, parlorFee=300
    // 計算: (30 + 2*10) * 100 + 0*500 - 300 = 50*100 - 300 = 4700
    const result = calculatePayout(30, '○○', 0, 100, 10, 500, 300);

    expect(result).toBe(4700);
  });

  it('TC-PAY-005: 場代なし (parlorFee=0)', () => {
    // score=30, uma=○○, chip=2, rate=100, umaValue=10, chipRate=500, parlorFee=0
    // 計算: (30 + 2*10) * 100 + 2*500 - 0 = 50*100 + 1000 = 6000
    const result = calculatePayout(30, '○○', 2, 100, 10, 500, 0);

    expect(result).toBe(6000);
  });

  it('TC-PAY-006: プレイヤー個別場代 (parlorFee=500)', () => {
    // score=30, uma=○○, chip=0, rate=100, umaValue=10, chipRate=500, parlorFee=500
    // 計算: (30 + 2*10) * 100 + 0*500 - 500 = 50*100 - 500 = 4500
    const result = calculatePayout(30, '○○', 0, 100, 10, 500, 500);

    expect(result).toBe(4500);
  });

  it('TC-PAY-007: 3人打ち2位マイナス (uma=○○○)', () => {
    // score=50, uma=○○○(+3), chip=1, rate=100, umaValue=10, chipRate=500, parlorFee=300
    // 計算: (50 + 3*10) * 100 + 1*500 - 300 = 80*100 + 500 - 300 = 8200
    const result = calculatePayout(50, '○○○', 1, 100, 10, 500, 300);

    expect(result).toBe(8200);
  });

  it('TC-PAY-008: 極端な値 (score=100, chip=10, parlorFee=1000)', () => {
    // score=100, uma=○○○(+3), chip=10, rate=100, umaValue=10, chipRate=500, parlorFee=1000
    // 計算: (100 + 3*10) * 100 + 10*500 - 1000 = 130*100 + 5000 - 1000 = 17000
    const result = calculatePayout(100, '○○○', 10, 100, 10, 500, 1000);

    expect(result).toBe(17000);

    // マイナス極端値
    // score=-100, uma=✗✗✗(-3), chip=-5, rate=100, umaValue=10, chipRate=500, parlorFee=1000
    // 計算: (-100 + (-3)*10) * 100 + (-5)*500 - 1000 = -130*100 - 2500 - 1000 = -16500
    const result2 = calculatePayout(-100, '✗✗✗', -5, 100, 10, 500, 1000);

    expect(result2).toBe(-16500);
  });
});
