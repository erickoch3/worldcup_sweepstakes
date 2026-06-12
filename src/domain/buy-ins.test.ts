import { describe, expect, it } from 'vitest';
import {
  allocateAssignmentBuyIns,
  computeBuyInPence,
  computeFavoriteDecimalOdds,
  computePlayerBuyInPence,
  STANDARD_BUY_IN_PENCE,
} from './buy-ins';

describe('computeFavoriteDecimalOdds', () => {
  it('uses the lowest decimal odds as the favorite', () => {
    expect(computeFavoriteDecimalOdds([4.5, 9, 2.75])).toBe(2.75);
  });
});

describe('computeBuyInPence', () => {
  it('uses the standard five pound buy-in regardless of odds', () => {
    expect(computeBuyInPence({ decimalOdds: 3.5, favoriteDecimalOdds: 3.5 })).toBe(STANDARD_BUY_IN_PENCE);
    expect(computeBuyInPence({ decimalOdds: 200, favoriteDecimalOdds: 3.5 })).toBe(STANDARD_BUY_IN_PENCE);
  });

  it('rejects invalid odds', () => {
    expect(() => computeBuyInPence({ decimalOdds: 0, favoriteDecimalOdds: 3.5 })).toThrow(
      'decimalOdds must be positive',
    );
    expect(() => computeBuyInPence({ decimalOdds: 4, favoriteDecimalOdds: 0 })).toThrow(
      'favoriteDecimalOdds must be positive',
    );
  });
});

describe('computePlayerBuyInPence', () => {
  it('uses the standard five pound buy-in for assigned players regardless of odds', () => {
    expect(computePlayerBuyInPence({ normalizedWinProbability: 0.25, targetWinProbability: 0.5 })).toBe(STANDARD_BUY_IN_PENCE);
    expect(computePlayerBuyInPence({ normalizedWinProbability: 0.6, targetWinProbability: 0.5 })).toBe(STANDARD_BUY_IN_PENCE);
  });

  it('does not charge unassigned players', () => {
    expect(computePlayerBuyInPence({ normalizedWinProbability: 0, targetWinProbability: 0.5 })).toBe(0);
  });
});

describe('allocateAssignmentBuyIns', () => {
  it('splits each standard player buy-in evenly across their assignment rows', () => {
    expect(
      allocateAssignmentBuyIns({
        targetWinProbability: 0.5,
        userTotals: [
          { userId: 'u1', normalizedWinProbability: 0.5 },
          { userId: 'u2', normalizedWinProbability: 0.5 },
        ],
        assignments: [
          { userId: 'u1', normalizedWinProbability: 1 / 3 },
          { userId: 'u1', normalizedWinProbability: 1 / 6 },
          { userId: 'u2', normalizedWinProbability: 0.5 },
        ],
      }),
    ).toEqual([250, 250, 500]);
  });
});
