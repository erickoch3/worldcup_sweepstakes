import { describe, expect, it } from 'vitest';
import { computePrizeSummary } from './prizes';

describe('computePrizeSummary', () => {
  it('charges the standard buy-in once per assigned player', () => {
    expect(
      computePrizeSummary([
        { userId: 'u1', buyInPence: 1000 },
        { userId: 'u2', buyInPence: 250 },
        { userId: 'u2', buyInPence: 250 },
      ]),
    ).toEqual({
      totalPrizePoolPence: 1000,
      payouts: [{ place: 1, label: 'Winner', amountPence: 1000 }],
    });
  });

  it('does not charge users with no positive buy-in rows', () => {
    expect(computePrizeSummary([{ userId: 'u1', buyInPence: 0 }])).toEqual({
      totalPrizePoolPence: 0,
      payouts: [{ place: 1, label: 'Winner', amountPence: 0 }],
    });
  });
});
