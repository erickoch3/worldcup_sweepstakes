import { MatchStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { parseApiFootballFixtures } from './api-football';

describe('parseApiFootballFixtures', () => {
  it('normalizes finished World Cup fixtures into local match updates', () => {
    const matches = parseApiFootballFixtures({
      response: [
        {
          fixture: {
            id: 1001,
            date: '2026-06-11T19:00:00+00:00',
            status: { short: 'FT' },
          },
          league: { round: 'Group A - 1' },
          teams: {
            home: { name: 'Mexico', code: 'MEX', winner: true },
            away: { name: 'South Africa', code: 'RSA', winner: false },
          },
          goals: { home: 2, away: 1 },
        },
      ],
    });

    expect(matches).toEqual([
      {
        provider: 'api-football',
        providerFixtureId: '1001',
        matchNumber: null,
        stage: 'Group A - 1',
        status: MatchStatus.FINAL,
        teamACode: 'MEX',
        teamBCode: 'RSA',
        teamAScore: 2,
        teamBScore: 1,
        winnerTeamCode: 'MEX',
        kickoffAt: new Date('2026-06-11T19:00:00.000Z'),
      },
    ]);
  });

  it('uses team-name aliases when provider codes differ from FIFA country codes', () => {
    const matches = parseApiFootballFixtures({
      response: [
        {
          fixture: {
            id: 1002,
            date: '2026-06-14T23:00:00+00:00',
            status: { short: '1H' },
          },
          league: { round: 'Group E - 1' },
          teams: {
            home: { name: 'Ivory Coast', code: null, winner: null },
            away: { name: 'Ecuador', code: 'ECU', winner: null },
          },
          goals: { home: 1, away: 0 },
        },
      ],
    });

    expect(matches[0]).toMatchObject({
      status: MatchStatus.LIVE,
      teamACode: 'CIV',
      teamBCode: 'ECU',
      teamAScore: 1,
      teamBScore: 0,
      winnerTeamCode: null,
    });
  });
});
