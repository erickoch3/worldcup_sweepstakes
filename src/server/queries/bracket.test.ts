import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getBracketData } from './bracket';

const { assignmentFindMany, draftFindFirst, matchFindMany } = vi.hoisted(() => ({
  matchFindMany: vi.fn(),
  draftFindFirst: vi.fn(),
  assignmentFindMany: vi.fn(),
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

describe('getBracketData', () => {
  beforeEach(() => {
    matchFindMany.mockReset();
    draftFindFirst.mockReset();
    assignmentFindMany.mockReset();
  });

  it('returns the full knockout bracket structure before teams are known', async () => {
    draftFindFirst.mockResolvedValue(null);
    matchFindMany.mockResolvedValue([]);

    const groups = await getBracketData();

    expect(groups.map((group) => [group.stage, group.matches.length])).toEqual([
      ['Round of 32', 16],
      ['Round of 16', 8],
      ['Quarter-finals', 4],
      ['Semi-finals', 2],
      ['Third-place play-off', 1],
      ['Final', 1],
    ]);
    expect(groups[0].matches[0]).toMatchObject({
      id: 'match-73',
      label: 'Match 73',
      kickoff: '2026-06-28T19:00:00.000Z',
      venue: 'Los Angeles Stadium',
      teamA: { name: 'TBD', description: 'Group A runners-up' },
      teamB: { name: 'TBD', description: 'Group B runners-up' },
      status: 'SCHEDULED',
    });
  });

  it('replaces placeholder slots with persisted knockout match data', async () => {
    draftFindFirst.mockResolvedValue(null);
    assignmentFindMany.mockResolvedValue([]);
    matchFindMany.mockResolvedValue([
      {
        id: 'db-match-104',
        matchNumber: 104,
        stage: 'Final',
        status: 'FINAL',
        teamAScore: 2,
        teamBScore: 1,
        kickoffAt: new Date('2026-12-19T18:00:00.000Z'),
        teamAId: 'team-brazil',
        teamBId: 'team-france',
        teamA: { displayName: 'Brazil' },
        teamB: { displayName: 'France' },
        winnerTeam: { displayName: 'Brazil' },
      },
    ]);

    const groups = await getBracketData();
    const final = groups.find((group) => group.stage === 'Final')?.matches[0];

    expect(final).toMatchObject({
      id: 'db-match-104',
      label: 'Match 104: Brazil vs France',
      venue: 'New York New Jersey Stadium',
      status: 'FINAL',
      winner: 'Brazil',
    });
    expect(final?.teamA).toMatchObject({ name: 'Brazil', score: 2 });
    expect(final?.teamB).toMatchObject({ name: 'France', score: 1 });
  });
});
