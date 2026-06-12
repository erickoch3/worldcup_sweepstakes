import { describe, expect, it } from 'vitest';

import { WORLD_CUP_FIXTURES } from './world-cup-fixtures';
import { WORLD_CUP_TEAMS } from './world-cup-teams';

describe('WORLD_CUP_FIXTURES', () => {
  it('contains one seeded group-stage match for each official fixture between represented teams', () => {
    const representedCodes = new Set(WORLD_CUP_TEAMS.map((team) => team.countryCode));
    const identities = new Set<string>();
    const matchNumbers = new Set<number>();

    expect(WORLD_CUP_FIXTURES).toHaveLength(72);

    for (const fixture of WORLD_CUP_FIXTURES) {
      expect(representedCodes.has(fixture.teamACode)).toBe(true);
      expect(representedCodes.has(fixture.teamBCode)).toBe(true);
      expect(fixture.matchNumber).toBeGreaterThanOrEqual(1);
      expect(fixture.matchNumber).toBeLessThanOrEqual(72);
      expect(fixture.stage).toMatch(/^Group [A-L]$/);
      expect(new Date(fixture.kickoffAt).toISOString()).toBe(fixture.kickoffAt);

      expect(matchNumbers.has(fixture.matchNumber)).toBe(false);
      matchNumbers.add(fixture.matchNumber);

      const identity = `${fixture.teamACode}:${fixture.teamBCode}:${fixture.kickoffAt}`;
      expect(identities.has(identity)).toBe(false);
      identities.add(identity);
    }

    expect(matchNumbers).toEqual(new Set(Array.from({ length: 72 }, (_, index) => index + 1)));
  });
});
