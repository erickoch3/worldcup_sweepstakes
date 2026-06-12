import { MatchStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyMatchSync, applyTeamOddsSync, hourlySampleTime } from './world-cup-sync';

describe('hourlySampleTime', () => {
  it('rounds timestamps down to the hour for deterministic snapshots', () => {
    expect(hourlySampleTime(new Date('2026-06-11T23:42:19.000Z'))).toEqual(
      new Date('2026-06-11T23:00:00.000Z'),
    );
  });
});

describe('applyTeamOddsSync', () => {
  const teamFindMany = vi.fn();
  const teamUpdate = vi.fn();
  const snapshotUpsert = vi.fn();

  beforeEach(() => {
    teamFindMany.mockReset();
    teamUpdate.mockReset();
    snapshotUpsert.mockReset();
    teamFindMany.mockResolvedValue([
      { id: 'team-spain', countryCode: 'ESP' },
      { id: 'team-france', countryCode: 'FRA' },
    ]);
  });

  it('upserts hourly odds snapshots and updates each team with its best current price', async () => {
    const sampledAt = new Date('2026-06-11T23:00:00.000Z');

    const result = await applyTeamOddsSync(
      {
        team: { findMany: teamFindMany, update: teamUpdate },
        teamOddsSnapshot: { upsert: snapshotUpsert },
      },
      [
        {
          provider: 'the-odds-api',
          sourceEventId: 'event-1',
          sourceSportKey: 'soccer_fifa_world_cup_winner',
          sourceLastUpdate: new Date('2026-06-11T22:55:00.000Z'),
          sampledAt,
          bookmakerKey: 'a',
          bookmakerTitle: 'A',
          marketKey: 'outrights',
          outcomeName: 'Spain',
          countryCode: 'ESP',
          decimalOdds: 5,
          impliedProbability: 0.2,
        },
        {
          provider: 'the-odds-api',
          sourceEventId: 'event-1',
          sourceSportKey: 'soccer_fifa_world_cup_winner',
          sourceLastUpdate: new Date('2026-06-11T22:56:00.000Z'),
          sampledAt,
          bookmakerKey: 'b',
          bookmakerTitle: 'B',
          marketKey: 'outrights',
          outcomeName: 'Spain',
          countryCode: 'ESP',
          decimalOdds: 6,
          impliedProbability: 1 / 6,
        },
        {
          provider: 'the-odds-api',
          sourceEventId: 'event-1',
          sourceSportKey: 'soccer_fifa_world_cup_winner',
          sourceLastUpdate: null,
          sampledAt,
          bookmakerKey: 'a',
          bookmakerTitle: 'A',
          marketKey: 'outrights',
          outcomeName: 'France',
          countryCode: 'FRA',
          decimalOdds: 4,
          impliedProbability: 0.25,
        },
      ],
      sampledAt,
    );

    expect(result).toEqual({ appliedSnapshots: 3, updatedTeams: 2 });
    expect(snapshotUpsert).toHaveBeenCalledTimes(3);
    expect(snapshotUpsert).toHaveBeenCalledWith({
      where: {
        provider_sourceEventId_bookmakerKey_marketKey_teamId_sampledAt: {
          provider: 'the-odds-api',
          sourceEventId: 'event-1',
          bookmakerKey: 'a',
          marketKey: 'outrights',
          teamId: 'team-spain',
          sampledAt,
        },
      },
      update: expect.objectContaining({
        decimalOdds: 5,
        impliedProbability: 0.2,
      }),
      create: expect.objectContaining({
        teamId: 'team-spain',
        bookmakerKey: 'a',
        decimalOdds: 5,
      }),
    });
    expect(teamUpdate).toHaveBeenCalledWith({
      where: { id: 'team-spain' },
      data: {
        decimalOdds: 6,
        oddsUpdatedAt: sampledAt,
      },
    });
    expect(teamUpdate).toHaveBeenCalledWith({
      where: { id: 'team-france' },
      data: {
        decimalOdds: 4,
        oddsUpdatedAt: sampledAt,
      },
    });
  });
});

describe('applyMatchSync', () => {
  const matchCreate = vi.fn();
  const matchFindMany = vi.fn();
  const matchUpdate = vi.fn();
  const teamFindMany = vi.fn();

  beforeEach(() => {
    matchCreate.mockReset();
    matchFindMany.mockReset();
    matchUpdate.mockReset();
    teamFindMany.mockReset();
    teamFindMany.mockResolvedValue([
      { id: 'team-mexico', countryCode: 'MEX' },
      { id: 'team-rsa', countryCode: 'RSA' },
    ]);
  });

  it('updates an existing local fixture and preserves score orientation', async () => {
    const syncedAt = new Date('2026-06-11T23:00:00.000Z');
    const kickoffAt = new Date('2026-06-11T19:00:00.000Z');
    matchFindMany.mockResolvedValue([
      {
        id: 'match-1',
        resultProvider: null,
        resultProviderFixtureId: null,
        matchNumber: null,
        teamAId: 'team-mexico',
        teamBId: 'team-rsa',
        kickoffAt,
      },
    ]);

    const result = await applyMatchSync(
      {
        team: { findMany: teamFindMany },
        match: { create: matchCreate, findMany: matchFindMany, update: matchUpdate },
      },
      [
        {
          provider: 'api-football',
          providerFixtureId: '1001',
          matchNumber: null,
          teamACode: 'MEX',
          teamBCode: 'RSA',
          kickoffAt,
          stage: 'Group A - 1',
          status: MatchStatus.FINAL,
          teamAScore: 2,
          teamBScore: 1,
          winnerTeamCode: 'MEX',
        },
      ],
      syncedAt,
    );

    expect(result).toEqual({ createdMatches: 0, updatedMatches: 1, skippedMatches: 0 });
    expect(matchUpdate).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: {
        resultProvider: 'api-football',
        resultProviderFixtureId: '1001',
        kickoffAt,
        stage: 'Group A - 1',
        status: MatchStatus.FINAL,
        teamAScore: 2,
        teamBScore: 1,
        winnerTeamId: 'team-mexico',
        resultSyncedAt: syncedAt,
      },
    });
    expect(matchCreate).not.toHaveBeenCalled();
  });

  it('finds seeded fixtures by official match number when provider kickoff is absent', async () => {
    const syncedAt = new Date('2026-06-11T23:00:00.000Z');
    const kickoffAt = new Date('2026-06-11T19:00:00.000Z');
    matchFindMany.mockResolvedValue([
      {
        id: 'match-1',
        resultProvider: null,
        resultProviderFixtureId: null,
        matchNumber: 1,
        teamAId: 'team-mexico',
        teamBId: 'team-rsa',
        kickoffAt,
      },
    ]);

    await applyMatchSync(
      {
        team: { findMany: teamFindMany },
        match: { create: matchCreate, findMany: matchFindMany, update: matchUpdate },
      },
      [
        {
          provider: 'worldcup26',
          providerFixtureId: '1',
          matchNumber: 1,
          teamACode: 'MEX',
          teamBCode: 'RSA',
          kickoffAt: null,
          stage: 'Group A',
          status: MatchStatus.FINAL,
          teamAScore: 2,
          teamBScore: 0,
          winnerTeamCode: 'MEX',
        },
      ],
      syncedAt,
    );

    expect(matchUpdate).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: expect.objectContaining({
        resultProvider: 'worldcup26',
        resultProviderFixtureId: '1',
        kickoffAt,
        teamAScore: 2,
        teamBScore: 0,
      }),
    });
  });

  it('creates newly discovered knockout fixtures once both teams are represented', async () => {
    const syncedAt = new Date('2026-07-01T23:00:00.000Z');
    const kickoffAt = new Date('2026-07-01T19:00:00.000Z');
    matchFindMany.mockResolvedValue([]);

    const result = await applyMatchSync(
      {
        team: { findMany: teamFindMany },
        match: { create: matchCreate, findMany: matchFindMany, update: matchUpdate },
      },
      [
        {
          provider: 'api-football',
          providerFixtureId: '2001',
          matchNumber: null,
          teamACode: 'RSA',
          teamBCode: 'MEX',
          kickoffAt,
          stage: 'Round of 32',
          status: MatchStatus.SCHEDULED,
          teamAScore: null,
          teamBScore: null,
          winnerTeamCode: null,
        },
      ],
      syncedAt,
    );

    expect(result).toEqual({ createdMatches: 1, updatedMatches: 0, skippedMatches: 0 });
    expect(matchCreate).toHaveBeenCalledWith({
      data: {
        resultProvider: 'api-football',
        resultProviderFixtureId: '2001',
        teamAId: 'team-rsa',
        teamBId: 'team-mexico',
        kickoffAt,
        stage: 'Round of 32',
        status: MatchStatus.SCHEDULED,
        teamAScore: null,
        teamBScore: null,
        winnerTeamId: null,
        resultSyncedAt: syncedAt,
      },
    });
  });
});
