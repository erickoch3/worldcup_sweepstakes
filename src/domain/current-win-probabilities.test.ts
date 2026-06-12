import { describe, expect, it } from 'vitest';

import { buildCurrentTeamWinProbabilityMap, currentAssignmentWinProbability } from './current-win-probabilities';

describe('current win probabilities', () => {
  it('normalizes current team odds and divides shared teams by share count', () => {
    const probabilitiesByTeamId = buildCurrentTeamWinProbabilityMap([
      { id: 'favorite', decimalOdds: 2 },
      { id: 'outsider', decimalOdds: 6 },
    ]);

    expect(probabilitiesByTeamId.get('favorite')).toBe(0.75);
    expect(probabilitiesByTeamId.get('outsider')).toBe(0.25);
    expect(
      currentAssignmentWinProbability(
        {
          normalizedWinProbability: 0.1,
          teamId: 'favorite',
          teamShareCount: 2,
        },
        probabilitiesByTeamId,
      ),
    ).toBe(0.375);
  });

  it('falls back to the stored draft probability when current odds are unavailable', () => {
    expect(
      currentAssignmentWinProbability(
        {
          normalizedWinProbability: 0.2,
          teamId: 'missing',
          teamShareCount: 2,
        },
        new Map(),
      ),
    ).toBe(0.2);
  });
});
