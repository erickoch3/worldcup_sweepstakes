import { MatchStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getScheduleData, getScoresData } from './schedule';

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

describe('getScoresData', () => {
  beforeEach(() => {
    assignmentFindMany.mockReset();
    matchFindMany.mockReset();
    draftFindFirst.mockReset();
  });

  it('returns live and final matches with live games first', async () => {
    draftFindFirst.mockResolvedValue(null);
    matchFindMany.mockResolvedValue([
      {
        id: 'older-final',
        status: MatchStatus.FINAL,
        kickoffAt: new Date('2026-06-11T20:00:00.000Z'),
      },
      {
        id: 'live-match',
        status: MatchStatus.LIVE,
        kickoffAt: new Date('2026-06-12T20:00:00.000Z'),
      },
    ]);

    const data = await getScoresData();

    expect(matchFindMany).toHaveBeenCalledWith({
      where: { status: { in: [MatchStatus.LIVE, MatchStatus.FINAL] } },
      orderBy: { kickoffAt: 'desc' },
      include: {
        teamA: true,
        teamB: true,
        winnerTeam: true,
      },
    });
    expect(data.matches.map((match) => match.id)).toEqual(['live-match', 'older-final']);
  });
});
