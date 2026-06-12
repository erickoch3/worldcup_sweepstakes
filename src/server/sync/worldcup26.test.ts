import { MatchStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { parseWorldCup26Games } from './worldcup26';

describe('parseWorldCup26Games', () => {
  it('normalizes finished games from the free no-key WorldCup26 API', () => {
    const matches = parseWorldCup26Games({
      games: [
        {
          id: '1',
          home_score: '2',
          away_score: '0',
          group: 'A',
          finished: 'TRUE',
          time_elapsed: 'finished',
          type: 'group',
          home_team_name_en: 'Mexico',
          away_team_name_en: 'South Africa',
        },
      ],
    });

    expect(matches).toEqual([
      {
        provider: 'worldcup26',
        providerFixtureId: '1',
        matchNumber: 1,
        stage: 'Group A',
        status: MatchStatus.FINAL,
        teamACode: 'MEX',
        teamBCode: 'RSA',
        teamAScore: 2,
        teamBScore: 0,
        winnerTeamCode: 'MEX',
        kickoffAt: null,
      },
    ]);
  });

  it('maps in-progress games to live status using team-name aliases', () => {
    const matches = parseWorldCup26Games({
      games: [
        {
          id: '9',
          home_score: '1',
          away_score: '1',
          group: 'E',
          finished: 'FALSE',
          time_elapsed: '45',
          type: 'group',
          home_team_name_en: 'Ivory Coast',
          away_team_name_en: 'Ecuador',
        },
      ],
    });

    expect(matches[0]).toMatchObject({
      provider: 'worldcup26',
      providerFixtureId: '9',
      matchNumber: 9,
      stage: 'Group E',
      status: MatchStatus.LIVE,
      teamACode: 'CIV',
      teamBCode: 'ECU',
      teamAScore: 1,
      teamBScore: 1,
      winnerTeamCode: null,
    });
  });
});
