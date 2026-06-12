import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDashboardData } from './dashboard';

const { assignmentFindMany, draftFindFirst, matchFindMany, teamFindMany } = vi.hoisted(() => ({
  assignmentFindMany: vi.fn(),
  draftFindFirst: vi.fn(),
  matchFindMany: vi.fn(),
  teamFindMany: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    assignment: {
      findMany: assignmentFindMany,
    },
    draft: {
      findFirst: draftFindFirst,
    },
    match: {
      findMany: matchFindMany,
    },
    team: {
      findMany: teamFindMany,
    },
  },
}));

describe('getDashboardData', () => {
  beforeEach(() => {
    assignmentFindMany.mockReset();
    draftFindFirst.mockReset();
    matchFindMany.mockReset();
    teamFindMany.mockReset();
    matchFindMany.mockResolvedValue([]);
    teamFindMany.mockResolvedValue([]);
  });

  it('aggregates leaderboard rows by player with share-weighted standings', async () => {
    matchFindMany.mockResolvedValue([
      {
        teamAId: 'team-high',
        teamBId: 'team-low',
        status: 'FINAL',
        teamAScore: 3,
        teamBScore: 1,
      },
      {
        teamAId: 'team-split',
        teamBId: 'team-low',
        status: 'FINAL',
        teamAScore: 2,
        teamBScore: 2,
      },
    ]);
    draftFindFirst.mockResolvedValue({ id: 'draft-1' });
    assignmentFindMany.mockResolvedValue([
      assignmentFixture({
        userId: 'user-low',
        userName: 'Low User',
        teamId: 'team-low',
        teamName: 'Low',
        countryCode: 'LOW',
        buyInPence: 250,
      }),
      assignmentFixture({
        userId: 'user-high',
        userName: 'High User',
        teamId: 'team-high',
        teamName: 'High',
        countryCode: 'HGH',
        buyInPence: 250,
      }),
      assignmentFixture({
        userId: 'user-low',
        userName: 'Low User',
        teamId: 'team-split',
        teamName: 'Split',
        countryCode: 'SPL',
        buyInPence: 250,
        teamShareIndex: 1,
        teamShareCount: 2,
        normalizedWinProbability: 0.2,
      }),
      assignmentFixture({
        userId: 'user-high',
        userName: 'High User',
        teamId: 'team-split',
        teamName: 'Split',
        countryCode: 'SPL',
        buyInPence: 250,
        teamShareIndex: 2,
        teamShareCount: 2,
        normalizedWinProbability: 0.2,
      }),
    ]);

    const data = await getDashboardData();

    expect(matchFindMany).toHaveBeenCalledWith({
      where: {
        teamAId: { in: ['team-low', 'team-high', 'team-split'] },
        teamBId: { in: ['team-low', 'team-high', 'team-split'] },
      },
      orderBy: { kickoffAt: 'asc' },
      include: {
        teamA: true,
        teamB: true,
        winnerTeam: true,
      },
    });
    expect(
      data.leaderboard.map((row) => ({
        userId: row.userId,
        points: row.points,
        buyInPence: row.buyInPence,
        normalizedWinProbability: row.normalizedWinProbability,
        teams: row.teams.map((team) => ({
          countryCode: team.countryCode,
          label: team.label,
        })),
      })),
    ).toEqual([
      {
        userId: 'user-high',
        points: 3.5,
        buyInPence: 500,
        normalizedWinProbability: 0.6,
        teams: [
          { countryCode: 'HGH', label: 'High' },
          { countryCode: 'SPL', label: 'Split (share 2/2)' },
        ],
      },
      {
        userId: 'user-low',
        points: 1.5,
        buyInPence: 500,
        normalizedWinProbability: 0.6,
        teams: [
          { countryCode: 'LOW', label: 'Low' },
          { countryCode: 'SPL', label: 'Split (share 1/2)' },
        ],
      },
    ]);
    expect(data.prizeSummary.totalPrizePoolPence).toBe(1000);
  });

  it('returns active teams for the dashboard odds board', async () => {
    draftFindFirst.mockResolvedValue(null);
    assignmentFindMany.mockResolvedValue([]);
    teamFindMany.mockResolvedValue([
      { id: 'team-brazil', countryCode: 'BRA', displayName: 'Brazil', groupName: 'Group C', decimalOdds: 11.3 },
      { id: 'team-france', countryCode: 'FRA', displayName: 'France', groupName: 'Group I', decimalOdds: 12.5 },
    ]);

    const data = await getDashboardData();

    expect(teamFindMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: [{ groupName: 'asc' }, { decimalOdds: 'asc' }, { displayName: 'asc' }],
      select: {
        id: true,
        countryCode: true,
        displayName: true,
        groupName: true,
        decimalOdds: true,
      },
    });
    expect(data.activeTeams).toEqual([
      {
        id: 'team-brazil',
        countryCode: 'BRA',
        displayName: 'Brazil',
        groupName: 'Group C',
        decimalOdds: 11.3,
        currentPoints: 0,
        normalizedWinProbability: 0.525210084034,
        owners: [],
      },
      {
        id: 'team-france',
        countryCode: 'FRA',
        displayName: 'France',
        groupName: 'Group I',
        decimalOdds: 12.5,
        currentPoints: 0,
        normalizedWinProbability: 0.474789915966,
        owners: [],
      },
    ]);
  });

  it('adds win probability, owners, and current points to active teams', async () => {
    draftFindFirst.mockResolvedValue({ id: 'draft-1' });
    teamFindMany.mockResolvedValue([
      { id: 'team-brazil', countryCode: 'BRA', displayName: 'Brazil', groupName: 'Group C', decimalOdds: 2 },
      { id: 'team-france', countryCode: 'FRA', displayName: 'France', groupName: 'Group I', decimalOdds: 4 },
      { id: 'team-spain', countryCode: 'ESP', displayName: 'Spain', groupName: 'Group G', decimalOdds: 4 },
    ]);
    assignmentFindMany.mockResolvedValue([
      assignmentFixture({
        userId: 'user-low',
        userName: 'Low User',
        teamId: 'team-brazil',
        teamName: 'Brazil',
        countryCode: 'BRA',
        buyInPence: 500,
      }),
      assignmentFixture({
        userId: 'user-high',
        userName: 'High User',
        teamId: 'team-france',
        teamName: 'France',
        countryCode: 'FRA',
        buyInPence: 500,
      }),
    ]);
    matchFindMany
      .mockResolvedValueOnce([
        {
          teamAId: 'team-brazil',
          teamBId: 'team-france',
          status: 'FINAL',
          teamAScore: 2,
          teamBScore: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          teamAId: 'team-brazil',
          teamBId: 'team-france',
          status: 'FINAL',
          teamAScore: 2,
          teamBScore: 0,
        },
        {
          teamAId: 'team-spain',
          teamBId: 'team-france',
          status: 'FINAL',
          teamAScore: 1,
          teamBScore: 1,
        },
      ]);

    const data = await getDashboardData();

    expect(matchFindMany).toHaveBeenNthCalledWith(2, {
      where: {
        teamAId: { in: ['team-brazil', 'team-france', 'team-spain'] },
        teamBId: { in: ['team-brazil', 'team-france', 'team-spain'] },
      },
      orderBy: { kickoffAt: 'asc' },
      include: {
        teamA: true,
        teamB: true,
        winnerTeam: true,
      },
    });
    expect(
      data.activeTeams.map((team) => ({
        id: team.id,
        currentPoints: team.currentPoints,
        owners: team.owners,
        normalizedWinProbability: team.normalizedWinProbability,
      })),
    ).toEqual([
      {
        id: 'team-brazil',
        currentPoints: 3,
        owners: ['Low User'],
        normalizedWinProbability: 0.5,
      },
      {
        id: 'team-france',
        currentPoints: 1,
        owners: ['High User'],
        normalizedWinProbability: 0.25,
      },
      {
        id: 'team-spain',
        currentPoints: 1,
        owners: [],
        normalizedWinProbability: 0.25,
      },
    ]);
  });

  it('uses current team odds for player total win probability after odds syncs', async () => {
    draftFindFirst.mockResolvedValue({ id: 'draft-1' });
    teamFindMany.mockResolvedValue([
      { id: 'team-favorite', countryCode: 'FAV', displayName: 'Favorite', groupName: 'Group A', decimalOdds: 2 },
      { id: 'team-outsider', countryCode: 'OUT', displayName: 'Outsider', groupName: 'Group B', decimalOdds: 6 },
    ]);
    assignmentFindMany.mockResolvedValue([
      assignmentFixture({
        userId: 'user-favorite',
        userName: 'Favorite Owner',
        teamId: 'team-favorite',
        teamName: 'Favorite',
        countryCode: 'FAV',
        buyInPence: 500,
        normalizedWinProbability: 0.1,
      }),
      assignmentFixture({
        userId: 'user-outsider',
        userName: 'Alpha Outsider',
        teamId: 'team-outsider',
        teamName: 'Outsider',
        countryCode: 'OUT',
        buyInPence: 500,
        normalizedWinProbability: 0.9,
      }),
    ]);

    const data = await getDashboardData();

    expect(
      data.leaderboard.map((row) => ({
        userId: row.userId,
        normalizedWinProbability: row.normalizedWinProbability,
      })),
    ).toEqual([
      {
        userId: 'user-favorite',
        normalizedWinProbability: 0.75,
      },
      {
        userId: 'user-outsider',
        normalizedWinProbability: 0.25,
      },
    ]);
  });

  it('breaks leaderboard point ties by current total win probability', async () => {
    draftFindFirst.mockResolvedValue({ id: 'draft-1' });
    teamFindMany.mockResolvedValue([
      { id: 'team-favorite', countryCode: 'FAV', displayName: 'Favorite', groupName: 'Group A', decimalOdds: 2 },
      { id: 'team-outsider', countryCode: 'OUT', displayName: 'Outsider', groupName: 'Group B', decimalOdds: 6 },
    ]);
    assignmentFindMany.mockResolvedValue([
      assignmentFixture({
        userId: 'user-outsider',
        userName: 'Outsider Owner',
        teamId: 'team-outsider',
        teamName: 'Outsider',
        countryCode: 'OUT',
        buyInPence: 500,
      }),
      assignmentFixture({
        userId: 'user-favorite',
        userName: 'Zeta Favorite',
        teamId: 'team-favorite',
        teamName: 'Favorite',
        countryCode: 'FAV',
        buyInPence: 500,
      }),
    ]);

    const data = await getDashboardData();

    expect(data.leaderboard.map((row) => row.userId)).toEqual(['user-favorite', 'user-outsider']);
  });

  it('ignores matches against unrepresented countries when computing standings', async () => {
    matchFindMany.mockResolvedValue([
      {
        teamAId: 'team-high',
        teamBId: 'unrepresented-team',
        status: 'FINAL',
        teamAScore: 9,
        teamBScore: 0,
      },
      {
        teamAId: 'team-low',
        teamBId: 'team-high',
        status: 'FINAL',
        teamAScore: 1,
        teamBScore: 0,
      },
    ]);
    draftFindFirst.mockResolvedValue({ id: 'draft-1' });
    assignmentFindMany.mockResolvedValue([
      assignmentFixture({
        userId: 'user-low',
        userName: 'Low User',
        teamId: 'team-low',
        teamName: 'Low',
        countryCode: 'LOW',
        buyInPence: 500,
      }),
      assignmentFixture({
        userId: 'user-high',
        userName: 'High User',
        teamId: 'team-high',
        teamName: 'High',
        countryCode: 'HGH',
        buyInPence: 500,
      }),
    ]);

    const data = await getDashboardData();

    expect(data.leaderboard.map((row) => [row.userId, row.points])).toEqual([
      ['user-low', 3],
      ['user-high', 0],
    ]);
  });
});

function assignmentFixture({
  buyInPence,
  countryCode = 'TST',
  normalizedWinProbability = 0.4,
  teamId,
  teamName,
  teamShareCount = 1,
  teamShareIndex = 1,
  userId,
  userName,
}: {
  buyInPence: number;
  countryCode?: string;
  normalizedWinProbability?: number;
  teamId: string;
  teamName: string;
  teamShareCount?: number;
  teamShareIndex?: number;
  userId: string;
  userName: string;
}) {
  return {
    userId,
    teamId,
    preferenceRankWon: 1,
    pickNumber: 1,
    teamShareCount,
    teamShareIndex,
    normalizedWinProbability,
    buyInPence,
    user: { id: userId, name: userName, email: `${userId}@example.com` },
    team: { id: teamId, countryCode, displayName: teamName, decimalOdds: 2 },
  };
}
