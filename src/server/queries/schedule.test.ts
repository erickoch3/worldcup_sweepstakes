import { MatchStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getScheduleData } from './schedule';

const { assignmentFindMany, matchFindMany, draftFindFirst } = vi.hoisted(() => ({
  draftFindFirst: vi.fn(),
  assignmentFindMany: vi.fn(),
  matchFindMany: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    draft: {
      findFirst: draftFindFirst,
    },
    assignment: {
      findMany: assignmentFindMany,
    },
    match: {
      findMany: matchFindMany,
    },
  },
}));

describe('getScheduleData', () => {
  beforeEach(() => {
    assignmentFindMany.mockReset();
    matchFindMany.mockReset();
    draftFindFirst.mockReset();
  });

  it('returns all matches and identifies the next scheduled future match', async () => {
    draftFindFirst.mockResolvedValue({ id: 'draft-1' });
    assignmentFindMany.mockResolvedValue([
      { teamId: 'team-a', user: { name: 'James', email: null } },
      { teamId: 'team-b', user: { name: null, email: 'eric@example.com' } },
    ]);
    matchFindMany.mockResolvedValue([
      {
        id: 'past-match',
        status: MatchStatus.SCHEDULED,
        kickoffAt: new Date('2026-06-01T20:00:00.000Z'),
      },
      {
        id: 'next-match',
        status: MatchStatus.SCHEDULED,
        kickoffAt: new Date('2026-06-11T20:00:00.000Z'),
      },
    ]);

    const data = await getScheduleData(new Date('2026-06-04T12:00:00.000Z'));

    expect(matchFindMany).toHaveBeenCalledWith({
      orderBy: { kickoffAt: 'asc' },
      include: {
        teamA: true,
        teamB: true,
        winnerTeam: true,
      },
    });
    expect(data.teamPlayerMap).toEqual({
      'team-a': ['James'],
      'team-b': ['Eric'],
    });
    expect(data.nextMatchId).toBe('next-match');
    expect(data.nextScheduledMatchId).toBe('next-match');
  });

  it('returns all matchups even when no draft has run yet', async () => {
    draftFindFirst.mockResolvedValue(null);
    matchFindMany.mockResolvedValue([]);

    const data = await getScheduleData(new Date('2026-06-04T12:00:00.000Z'));

    expect(matchFindMany).toHaveBeenCalled();
    expect(assignmentFindMany).not.toHaveBeenCalled();
    expect(data.teamPlayerMap).toEqual({});
  });
});
