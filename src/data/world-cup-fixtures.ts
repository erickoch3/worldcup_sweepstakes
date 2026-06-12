export type SeedFixture = {
  matchNumber: number;
  teamACode: string;
  teamBCode: string;
  kickoffAt: string;
  stage: string;
};

// Sources checked during implementation on 2026-06-04:
// - FIFA official scores and fixtures page: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures
// - FIFA official match-schedule PDF, published as "FWC26 Match Schedule_v17_10042026.ai":
//   https://digitalhub.fifa.com/asset/4b5d4417-3343-4732-9cdf-14b6662af407/FWC26-Match-Schedule_English.pdf
// - Inside FIFA article linking the updated official schedule:
//   https://inside.fifa.com/organisation/news/updated-world-cup-2026-match-schedule-now-available
//
// FIFA lists the schedule times in Eastern Time. kickoffAt stores the equivalent UTC instant.
// Only group-stage fixtures are seeded because knockout team identities are not known before results.
export const WORLD_CUP_FIXTURES: SeedFixture[] = [
  { matchNumber: 1, teamACode: 'MEX', teamBCode: 'RSA', kickoffAt: '2026-06-11T19:00:00.000Z', stage: 'Group A' },
  { matchNumber: 2, teamACode: 'KOR', teamBCode: 'CZE', kickoffAt: '2026-06-12T02:00:00.000Z', stage: 'Group A' },
  { matchNumber: 3, teamACode: 'CAN', teamBCode: 'BIH', kickoffAt: '2026-06-12T19:00:00.000Z', stage: 'Group B' },
  { matchNumber: 4, teamACode: 'USA', teamBCode: 'PAR', kickoffAt: '2026-06-13T01:00:00.000Z', stage: 'Group D' },
  { matchNumber: 8, teamACode: 'QAT', teamBCode: 'SUI', kickoffAt: '2026-06-13T19:00:00.000Z', stage: 'Group B' },
  { matchNumber: 7, teamACode: 'BRA', teamBCode: 'MAR', kickoffAt: '2026-06-13T22:00:00.000Z', stage: 'Group C' },
  { matchNumber: 5, teamACode: 'HAI', teamBCode: 'SCO', kickoffAt: '2026-06-14T01:00:00.000Z', stage: 'Group C' },
  { matchNumber: 6, teamACode: 'AUS', teamBCode: 'TUR', kickoffAt: '2026-06-14T04:00:00.000Z', stage: 'Group D' },
  { matchNumber: 10, teamACode: 'GER', teamBCode: 'CUW', kickoffAt: '2026-06-14T17:00:00.000Z', stage: 'Group E' },
  { matchNumber: 11, teamACode: 'NED', teamBCode: 'JPN', kickoffAt: '2026-06-14T20:00:00.000Z', stage: 'Group F' },
  { matchNumber: 9, teamACode: 'CIV', teamBCode: 'ECU', kickoffAt: '2026-06-14T23:00:00.000Z', stage: 'Group E' },
  { matchNumber: 12, teamACode: 'SWE', teamBCode: 'TUN', kickoffAt: '2026-06-15T02:00:00.000Z', stage: 'Group F' },
  { matchNumber: 14, teamACode: 'ESP', teamBCode: 'CPV', kickoffAt: '2026-06-15T16:00:00.000Z', stage: 'Group H' },
  { matchNumber: 16, teamACode: 'BEL', teamBCode: 'EGY', kickoffAt: '2026-06-15T19:00:00.000Z', stage: 'Group G' },
  { matchNumber: 13, teamACode: 'KSA', teamBCode: 'URU', kickoffAt: '2026-06-15T22:00:00.000Z', stage: 'Group H' },
  { matchNumber: 15, teamACode: 'IRN', teamBCode: 'NZL', kickoffAt: '2026-06-16T01:00:00.000Z', stage: 'Group G' },
  { matchNumber: 17, teamACode: 'FRA', teamBCode: 'SEN', kickoffAt: '2026-06-16T19:00:00.000Z', stage: 'Group I' },
  { matchNumber: 18, teamACode: 'IRQ', teamBCode: 'NOR', kickoffAt: '2026-06-16T22:00:00.000Z', stage: 'Group I' },
  { matchNumber: 19, teamACode: 'ARG', teamBCode: 'ALG', kickoffAt: '2026-06-17T01:00:00.000Z', stage: 'Group J' },
  { matchNumber: 20, teamACode: 'AUT', teamBCode: 'JOR', kickoffAt: '2026-06-17T04:00:00.000Z', stage: 'Group J' },
  { matchNumber: 23, teamACode: 'POR', teamBCode: 'COD', kickoffAt: '2026-06-17T17:00:00.000Z', stage: 'Group K' },
  { matchNumber: 22, teamACode: 'ENG', teamBCode: 'CRO', kickoffAt: '2026-06-17T20:00:00.000Z', stage: 'Group L' },
  { matchNumber: 21, teamACode: 'GHA', teamBCode: 'PAN', kickoffAt: '2026-06-17T23:00:00.000Z', stage: 'Group L' },
  { matchNumber: 24, teamACode: 'UZB', teamBCode: 'COL', kickoffAt: '2026-06-18T02:00:00.000Z', stage: 'Group K' },
  { matchNumber: 25, teamACode: 'CZE', teamBCode: 'RSA', kickoffAt: '2026-06-18T16:00:00.000Z', stage: 'Group A' },
  { matchNumber: 26, teamACode: 'SUI', teamBCode: 'BIH', kickoffAt: '2026-06-18T19:00:00.000Z', stage: 'Group B' },
  { matchNumber: 27, teamACode: 'CAN', teamBCode: 'QAT', kickoffAt: '2026-06-18T22:00:00.000Z', stage: 'Group B' },
  { matchNumber: 28, teamACode: 'MEX', teamBCode: 'KOR', kickoffAt: '2026-06-19T01:00:00.000Z', stage: 'Group A' },
  { matchNumber: 32, teamACode: 'USA', teamBCode: 'AUS', kickoffAt: '2026-06-19T19:00:00.000Z', stage: 'Group D' },
  { matchNumber: 30, teamACode: 'SCO', teamBCode: 'MAR', kickoffAt: '2026-06-19T22:00:00.000Z', stage: 'Group C' },
  { matchNumber: 29, teamACode: 'BRA', teamBCode: 'HAI', kickoffAt: '2026-06-20T00:30:00.000Z', stage: 'Group C' },
  { matchNumber: 31, teamACode: 'TUR', teamBCode: 'PAR', kickoffAt: '2026-06-20T03:00:00.000Z', stage: 'Group D' },
  { matchNumber: 35, teamACode: 'NED', teamBCode: 'SWE', kickoffAt: '2026-06-20T17:00:00.000Z', stage: 'Group F' },
  { matchNumber: 33, teamACode: 'GER', teamBCode: 'CIV', kickoffAt: '2026-06-20T20:00:00.000Z', stage: 'Group E' },
  { matchNumber: 34, teamACode: 'ECU', teamBCode: 'CUW', kickoffAt: '2026-06-21T00:00:00.000Z', stage: 'Group E' },
  { matchNumber: 36, teamACode: 'TUN', teamBCode: 'JPN', kickoffAt: '2026-06-21T04:00:00.000Z', stage: 'Group F' },
  { matchNumber: 38, teamACode: 'ESP', teamBCode: 'KSA', kickoffAt: '2026-06-21T16:00:00.000Z', stage: 'Group H' },
  { matchNumber: 39, teamACode: 'BEL', teamBCode: 'IRN', kickoffAt: '2026-06-21T19:00:00.000Z', stage: 'Group G' },
  { matchNumber: 37, teamACode: 'URU', teamBCode: 'CPV', kickoffAt: '2026-06-21T22:00:00.000Z', stage: 'Group H' },
  { matchNumber: 40, teamACode: 'NZL', teamBCode: 'EGY', kickoffAt: '2026-06-22T01:00:00.000Z', stage: 'Group G' },
  { matchNumber: 43, teamACode: 'ARG', teamBCode: 'AUT', kickoffAt: '2026-06-22T17:00:00.000Z', stage: 'Group J' },
  { matchNumber: 42, teamACode: 'FRA', teamBCode: 'IRQ', kickoffAt: '2026-06-22T21:00:00.000Z', stage: 'Group I' },
  { matchNumber: 41, teamACode: 'NOR', teamBCode: 'SEN', kickoffAt: '2026-06-23T00:00:00.000Z', stage: 'Group I' },
  { matchNumber: 44, teamACode: 'JOR', teamBCode: 'ALG', kickoffAt: '2026-06-23T03:00:00.000Z', stage: 'Group J' },
  { matchNumber: 47, teamACode: 'POR', teamBCode: 'UZB', kickoffAt: '2026-06-23T17:00:00.000Z', stage: 'Group K' },
  { matchNumber: 45, teamACode: 'ENG', teamBCode: 'GHA', kickoffAt: '2026-06-23T20:00:00.000Z', stage: 'Group L' },
  { matchNumber: 46, teamACode: 'PAN', teamBCode: 'CRO', kickoffAt: '2026-06-23T23:00:00.000Z', stage: 'Group L' },
  { matchNumber: 48, teamACode: 'COL', teamBCode: 'COD', kickoffAt: '2026-06-24T02:00:00.000Z', stage: 'Group K' },
  { matchNumber: 51, teamACode: 'SUI', teamBCode: 'CAN', kickoffAt: '2026-06-24T19:00:00.000Z', stage: 'Group B' },
  { matchNumber: 52, teamACode: 'BIH', teamBCode: 'QAT', kickoffAt: '2026-06-24T19:00:00.000Z', stage: 'Group B' },
  { matchNumber: 50, teamACode: 'MAR', teamBCode: 'HAI', kickoffAt: '2026-06-24T22:00:00.000Z', stage: 'Group C' },
  { matchNumber: 49, teamACode: 'SCO', teamBCode: 'BRA', kickoffAt: '2026-06-24T22:00:00.000Z', stage: 'Group C' },
  { matchNumber: 54, teamACode: 'RSA', teamBCode: 'KOR', kickoffAt: '2026-06-25T01:00:00.000Z', stage: 'Group A' },
  { matchNumber: 53, teamACode: 'CZE', teamBCode: 'MEX', kickoffAt: '2026-06-25T01:00:00.000Z', stage: 'Group A' },
  { matchNumber: 55, teamACode: 'CUW', teamBCode: 'CIV', kickoffAt: '2026-06-25T20:00:00.000Z', stage: 'Group E' },
  { matchNumber: 56, teamACode: 'ECU', teamBCode: 'GER', kickoffAt: '2026-06-25T20:00:00.000Z', stage: 'Group E' },
  { matchNumber: 57, teamACode: 'JPN', teamBCode: 'SWE', kickoffAt: '2026-06-25T23:00:00.000Z', stage: 'Group F' },
  { matchNumber: 58, teamACode: 'TUN', teamBCode: 'NED', kickoffAt: '2026-06-25T23:00:00.000Z', stage: 'Group F' },
  { matchNumber: 60, teamACode: 'PAR', teamBCode: 'AUS', kickoffAt: '2026-06-26T02:00:00.000Z', stage: 'Group D' },
  { matchNumber: 59, teamACode: 'TUR', teamBCode: 'USA', kickoffAt: '2026-06-26T02:00:00.000Z', stage: 'Group D' },
  { matchNumber: 61, teamACode: 'NOR', teamBCode: 'FRA', kickoffAt: '2026-06-26T19:00:00.000Z', stage: 'Group I' },
  { matchNumber: 62, teamACode: 'SEN', teamBCode: 'IRQ', kickoffAt: '2026-06-26T19:00:00.000Z', stage: 'Group I' },
  { matchNumber: 65, teamACode: 'CPV', teamBCode: 'KSA', kickoffAt: '2026-06-27T00:00:00.000Z', stage: 'Group H' },
  { matchNumber: 66, teamACode: 'URU', teamBCode: 'ESP', kickoffAt: '2026-06-27T00:00:00.000Z', stage: 'Group H' },
  { matchNumber: 63, teamACode: 'EGY', teamBCode: 'IRN', kickoffAt: '2026-06-27T03:00:00.000Z', stage: 'Group G' },
  { matchNumber: 64, teamACode: 'NZL', teamBCode: 'BEL', kickoffAt: '2026-06-27T03:00:00.000Z', stage: 'Group G' },
  { matchNumber: 68, teamACode: 'CRO', teamBCode: 'GHA', kickoffAt: '2026-06-27T21:00:00.000Z', stage: 'Group L' },
  { matchNumber: 67, teamACode: 'PAN', teamBCode: 'ENG', kickoffAt: '2026-06-27T21:00:00.000Z', stage: 'Group L' },
  { matchNumber: 71, teamACode: 'COL', teamBCode: 'POR', kickoffAt: '2026-06-27T23:30:00.000Z', stage: 'Group K' },
  { matchNumber: 72, teamACode: 'COD', teamBCode: 'UZB', kickoffAt: '2026-06-27T23:30:00.000Z', stage: 'Group K' },
  { matchNumber: 69, teamACode: 'ALG', teamBCode: 'AUT', kickoffAt: '2026-06-28T02:00:00.000Z', stage: 'Group J' },
  { matchNumber: 70, teamACode: 'JOR', teamBCode: 'ARG', kickoffAt: '2026-06-28T02:00:00.000Z', stage: 'Group J' },
];
