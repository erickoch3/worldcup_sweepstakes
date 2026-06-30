import { describe, expect, it } from 'vitest';

import { selectDashboardMatches } from './dashboard-matches';

describe('selectDashboardMatches', () => {
  it('shows live matches with scores before future scheduled matches', () => {
    const matches = selectDashboardMatches(
      [
        {
          id: 'scheduled-1',
          kickoffAt: new Date('2026-06-15T19:00:00.000Z'),
          stage: 'Group B',
          status: 'SCHEDULED',
          teamAScore: null,
          teamBScore: null,
          teamAId: 'team-a',
          teamBId: 'team-b',
          teamA: { countryCode: 'BRA', displayName: 'Brazil' },
          teamB: { countryCode: 'GER', displayName: 'Germany' },
        },
        {
          id: 'live-1',
          kickoffAt: new Date('2026-06-15T17:00:00.000Z'),
          stage: 'Group A',
          status: 'LIVE',
          teamAScore: 1,
          teamBScore: 0,
          teamAId: 'team-c',
          teamBId: 'team-d',
          teamA: { countryCode: 'CAN', displayName: 'Canada' },
          teamB: { countryCode: 'MEX', displayName: 'Mexico' },
        },
      ],
      {},
      new Date('2026-06-15T18:00:00.000Z'),
    );

    expect(matches.map((match) => match.id)).toEqual(['live-1', 'scheduled-1']);
    expect(matches[0]).toMatchObject({
      score: '1-0',
      statusLabel: 'Live',
    });
  });

  it('excludes past scheduled matches that have no live status', () => {
    const matches = selectDashboardMatches(
      [
        {
          id: 'stale-scheduled',
          kickoffAt: new Date('2026-06-15T15:00:00.000Z'),
          stage: 'Group A',
          status: 'SCHEDULED',
          teamAScore: null,
          teamBScore: null,
          teamAId: 'team-a',
          teamBId: 'team-b',
          teamA: { countryCode: 'BRA', displayName: 'Brazil' },
          teamB: { countryCode: 'GER', displayName: 'Germany' },
        },
      ],
      {},
      new Date('2026-06-15T18:00:00.000Z'),
    );

    expect(matches).toEqual([]);
  });

  it('shows future knockout slot placeholders when teams are not known yet', () => {
    const matches = selectDashboardMatches(
      [
        {
          id: 'match-77',
          kickoffAt: new Date('2026-06-30T21:00:00.000Z'),
          stage: 'Round of 32',
          status: 'SCHEDULED',
          teamAScore: null,
          teamBScore: null,
          teamAId: null,
          teamBId: null,
          teamASlot: 'Group I winners',
          teamBSlot: 'Group C/D/F/G/H third place',
          teamA: null,
          teamB: null,
        },
      ],
      {},
      new Date('2026-06-30T12:00:00.000Z'),
    );

    expect(matches).toEqual([
      expect.objectContaining({
        id: 'match-77',
        players: 'Group I winners vs Group C/D/F/G/H third place',
        teamA: { countryCode: null, name: 'TBD' },
        teamB: { countryCode: null, name: 'TBD' },
      }),
    ]);
  });
});
