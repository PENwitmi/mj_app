import { describe, it, expect } from 'vitest';
import {
  umaMarkToValue,
  assignUmaMarks,
  calculateAutoScore,
  type PlayerResult,
} from '@/lib/uma-utils';
import type { UmaMark, GameMode, UmaRule } from '@/lib/db';

/**
 * ユニットテスト: uma-utils.ts
 * ウママーク計算・点数自動計算のロジックテスト
 */

// ========================================
// Test Helper Functions
// ========================================

function createPlayerResult(
  score: number | null,
  isSpectator = false,
  umaMark: UmaMark = ''
): PlayerResult {
  return {
    playerName: 'Test Player',
    userId: null,
    score,
    umaMark,
    chips: 0,
    parlorFee: 0,
    isSpectator,
    umaMarkManual: false,
  };
}

// ========================================
// umaMarkToValue() Tests
// ========================================

describe('umaMarkToValue', () => {
  it('TC-UMA-001: ○○○ → 3', () => {
    expect(umaMarkToValue('○○○')).toBe(3);
  });

  it('TC-UMA-002: ○○ → 2', () => {
    expect(umaMarkToValue('○○')).toBe(2);
  });

  it('TC-UMA-003: ○ → 1', () => {
    expect(umaMarkToValue('○')).toBe(1);
  });

  it('TC-UMA-004: 空文字 → 0', () => {
    expect(umaMarkToValue('')).toBe(0);
  });

  it('TC-UMA-005: ✗ → -1', () => {
    expect(umaMarkToValue('✗')).toBe(-1);
  });

  it('TC-UMA-006: ✗✗ → -2', () => {
    expect(umaMarkToValue('✗✗')).toBe(-2);
  });

  it('TC-UMA-007: ✗✗✗ → -3', () => {
    expect(umaMarkToValue('✗✗✗')).toBe(-3);
  });

  it('TC-UMA-008: 不正値 → 0 (default)', () => {
    // @ts-expect-error - Testing invalid input
    expect(umaMarkToValue('invalid')).toBe(0);
  });
});

// ========================================
// assignUmaMarks() Tests
// ========================================

describe('assignUmaMarks', () => {
  it('TC-UMA-010: 4人打ち標準ルール (○○, ○, ✗, ✗✗)', () => {
    const players: PlayerResult[] = [
      createPlayerResult(40), // 1位
      createPlayerResult(10), // 2位
      createPlayerResult(-20), // 3位
      createPlayerResult(-30), // 4位
    ];

    const result = assignUmaMarks(players, '4-player', 'standard');

    expect(result).toEqual(['○○', '○', '✗', '✗✗']);
  });

  it('TC-UMA-011: 4人打ち2位マイナス (○○○, 無印, ✗, ✗✗)', () => {
    const players: PlayerResult[] = [
      createPlayerResult(40), // 1位
      createPlayerResult(-5), // 2位（マイナス）
      createPlayerResult(-10), // 3位
      createPlayerResult(-25), // 4位
    ];

    const result = assignUmaMarks(players, '4-player', 'second-minus');

    expect(result).toEqual(['○○○', '', '✗', '✗✗']);
  });

  it('TC-UMA-012: 3人打ち標準ルール (○○, ○, ✗✗✗)', () => {
    const players: PlayerResult[] = [
      createPlayerResult(40), // 1位
      createPlayerResult(0), // 2位
      createPlayerResult(-40), // 3位
    ];

    const result = assignUmaMarks(players, '3-player', 'standard');

    expect(result).toEqual(['○○', '○', '✗✗✗']);
  });

  it('TC-UMA-013: 3人打ち2位マイナス (○○○, ✗, ✗✗)', () => {
    const players: PlayerResult[] = [
      createPlayerResult(50), // 1位
      createPlayerResult(-10), // 2位（マイナス）
      createPlayerResult(-40), // 3位
    ];

    const result = assignUmaMarks(players, '3-player', 'second-minus');

    expect(result).toEqual(['○○○', '✗', '✗✗']);
  });

  it('TC-UMA-014: 見学者を除外（3人打ち+見学1人）', () => {
    const players: PlayerResult[] = [
      createPlayerResult(30), // 1位
      createPlayerResult(10), // 2位
      createPlayerResult(null, true), // 見学者
      createPlayerResult(-40), // 3位
    ];

    const result = assignUmaMarks(players, '4-player', 'standard');

    // 見学者を除く3人でウママーク割り当て
    expect(result[0]).toBe('○○'); // 1位
    expect(result[1]).toBe('○'); // 2位
    expect(result[2]).toBe(''); // 見学者（空）
    expect(result[3]).toBe('✗'); // 3位（4人中3位だが、実質3人打ち）
  });

  it('TC-UMA-015: 同点処理（点数同じ場合は前者優先）', () => {
    const players: PlayerResult[] = [
      createPlayerResult(30), // 1位
      createPlayerResult(30), // 同点（前者が1位）
      createPlayerResult(-30), // 3位
      createPlayerResult(-30), // 同点
    ];

    const result = assignUmaMarks(players, '4-player', 'standard');

    // ソート後、前者が優先されるため [30, 30, -30, -30] の順
    expect(result).toEqual(['○○', '○', '✗', '✗✗']);
  });
});

// ========================================
// calculateAutoScore() Tests
// ========================================

describe('calculateAutoScore', () => {
  it('TC-UMA-020: ゼロサム計算 (+30, +10, -40 → 0)', () => {
    const players: PlayerResult[] = [
      createPlayerResult(30),
      createPlayerResult(10),
      createPlayerResult(-40),
    ];

    const result = calculateAutoScore(players);

    // 浮動小数点の誤差を許容（-0 と 0 の区別を避ける）
    expect(result).toBeCloseTo(0, 5); // 30 + 10 - 40 = 0, 逆数は0
  });

  it('TC-UMA-021: 見学者除外 (+30, +10, 見学, -40 → 0)', () => {
    const players: PlayerResult[] = [
      createPlayerResult(30),
      createPlayerResult(10),
      createPlayerResult(null, true), // 見学者
      createPlayerResult(-40),
    ];

    const result = calculateAutoScore(players);

    // 浮動小数点の誤差を許容
    expect(result).toBeCloseTo(0, 5); // 30 + 10 - 40 = 0
  });

  it('TC-UMA-022: 全員未入力 → null', () => {
    const players: PlayerResult[] = [
      createPlayerResult(null),
      createPlayerResult(null),
      createPlayerResult(null),
      createPlayerResult(null),
    ];

    const result = calculateAutoScore(players);

    expect(result).toBeNull();
  });

  it('TC-UMA-023: 小数点含む計算 (+15.5, +10.5, -26.0 → 0)', () => {
    const players: PlayerResult[] = [
      createPlayerResult(15.5),
      createPlayerResult(10.5),
      createPlayerResult(-26.0),
    ];

    const result = calculateAutoScore(players);

    // 浮動小数点の誤差を許容
    expect(result).toBeCloseTo(0, 5); // 15.5 + 10.5 - 26.0 = 0
  });
});
