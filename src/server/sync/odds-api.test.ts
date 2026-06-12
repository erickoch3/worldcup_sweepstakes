import { describe, expect, it } from 'vitest';

import { parseOddsApiOutrights, summarizeBestTeamOdds } from './odds-api';

describe('parseOddsApiOutrights', () => {
  it('stores every bookmaker outcome with normalized country codes', () => {
    const sampledAt = new Date('2026-06-11T23:00:00.000Z');
    const snapshots = parseOddsApiOutrights(
      [
        {
          id: 'world-cup-winner',
          sport_key: 'soccer_fifa_world_cup_winner',
          bookmakers: [
            {
              key: 'paddypower',
              title: 'Paddy Power',
              last_update: '2026-06-11T22:55:00Z',
              markets: [
                {
                  key: 'outrights',
                  last_update: '2026-06-11T22:55:00Z',
                  outcomes: [
                    { name: 'Spain', price: 6 },
                    { name: 'United States', price: 91 },
                    { name: 'Ivory Coast', price: 301 },
                    { name: 'Draw', price: 999 },
                  ],
                },
              ],
            },
            {
              key: 'betfair',
              title: 'Betfair',
              last_update: '2026-06-11T22:54:00Z',
              markets: [
                {
                  key: 'outrights',
                  outcomes: [
                    { name: 'Spain', price: 6.5 },
                    { name: 'USA', price: 88 },
                  ],
                },
              ],
            },
          ],
        },
      ],
      sampledAt,
    );

    expect(snapshots.map((snapshot) => ({
      bookmakerKey: snapshot.bookmakerKey,
      countryCode: snapshot.countryCode,
      decimalOdds: snapshot.decimalOdds,
      impliedProbability: snapshot.impliedProbability,
      sourceLastUpdate: snapshot.sourceLastUpdate,
    }))).toEqual([
      {
        bookmakerKey: 'paddypower',
        countryCode: 'ESP',
        decimalOdds: 6,
        impliedProbability: 1 / 6,
        sourceLastUpdate: new Date('2026-06-11T22:55:00.000Z'),
      },
      {
        bookmakerKey: 'paddypower',
        countryCode: 'USA',
        decimalOdds: 91,
        impliedProbability: 1 / 91,
        sourceLastUpdate: new Date('2026-06-11T22:55:00.000Z'),
      },
      {
        bookmakerKey: 'paddypower',
        countryCode: 'CIV',
        decimalOdds: 301,
        impliedProbability: 1 / 301,
        sourceLastUpdate: new Date('2026-06-11T22:55:00.000Z'),
      },
      {
        bookmakerKey: 'betfair',
        countryCode: 'ESP',
        decimalOdds: 6.5,
        impliedProbability: 1 / 6.5,
        sourceLastUpdate: new Date('2026-06-11T22:54:00.000Z'),
      },
      {
        bookmakerKey: 'betfair',
        countryCode: 'USA',
        decimalOdds: 88,
        impliedProbability: 1 / 88,
        sourceLastUpdate: new Date('2026-06-11T22:54:00.000Z'),
      },
    ]);
  });
});

describe('summarizeBestTeamOdds', () => {
  it('chooses the best decimal price per team and normalizes probabilities', () => {
    const sampledAt = new Date('2026-06-11T23:00:00.000Z');
    const snapshots = parseOddsApiOutrights(
      [
        {
          id: 'world-cup-winner',
          sport_key: 'soccer_fifa_world_cup_winner',
          bookmakers: [
            {
              key: 'a',
              title: 'A',
              markets: [{ key: 'outrights', outcomes: [{ name: 'Spain', price: 5 }, { name: 'France', price: 4 }] }],
            },
            {
              key: 'b',
              title: 'B',
              markets: [{ key: 'outrights', outcomes: [{ name: 'Spain', price: 10 }, { name: 'France', price: 5 }] }],
            },
          ],
        },
      ],
      sampledAt,
    );

    expect(summarizeBestTeamOdds(snapshots)).toEqual([
      {
        countryCode: 'FRA',
        decimalOdds: 5,
        impliedProbability: 0.2,
        normalizedWinProbability: 2 / 3,
      },
      {
        countryCode: 'ESP',
        decimalOdds: 10,
        impliedProbability: 0.1,
        normalizedWinProbability: 1 / 3,
      },
    ]);
  });
});
