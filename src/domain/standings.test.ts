import { describe, expect, it } from 'vitest';
import { computeStandings } from './standings';

describe('computeStandings', () => {
  it('counts final represented-team matches and ranks by football table tie-breakers', () => {
    expect(
      computeStandings({
        teams: [
          { id: 'arg', displayName: 'Argentina' },
          { id: 'bra', displayName: 'Brazil' },
          { id: 'can', displayName: 'Canada' },
          { id: 'den', displayName: 'Denmark' },
          { id: 'ecu', displayName: 'Ecuador' },
        ],
        matches: [
          {
            teamAId: 'arg',
            teamBId: 'bra',
            status: 'FINAL',
            teamAScore: 2,
            teamBScore: 1,
          },
          {
            teamAId: 'bra',
            teamBId: 'can',
            status: 'FINAL',
            teamAScore: 1,
            teamBScore: 1,
          },
          {
            teamAId: 'can',
            teamBId: 'arg',
            status: 'SCHEDULED',
            teamAScore: 5,
            teamBScore: 0,
          },
          {
            teamAId: 'arg',
            teamBId: 'unknown',
            status: 'FINAL',
            teamAScore: 0,
            teamBScore: 4,
          },
          {
            teamAId: 'den',
            teamBId: 'ecu',
            status: 'FINAL',
            teamAScore: null,
            teamBScore: null,
          },
        ],
      }),
    ).toEqual([
      {
        teamId: 'arg',
        displayName: 'Argentina',
        played: 1,
        won: 1,
        drawn: 0,
        lost: 0,
        goalsFor: 2,
        goalsAgainst: 1,
        goalDifference: 1,
        points: 3,
      },
      {
        teamId: 'can',
        displayName: 'Canada',
        played: 1,
        won: 0,
        drawn: 1,
        lost: 0,
        goalsFor: 1,
        goalsAgainst: 1,
        goalDifference: 0,
        points: 1,
      },
      {
        teamId: 'bra',
        displayName: 'Brazil',
        played: 2,
        won: 0,
        drawn: 1,
        lost: 1,
        goalsFor: 2,
        goalsAgainst: 3,
        goalDifference: -1,
        points: 1,
      },
      {
        teamId: 'den',
        displayName: 'Denmark',
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      },
      {
        teamId: 'ecu',
        displayName: 'Ecuador',
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      },
    ]);
  });
});
