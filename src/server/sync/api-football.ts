import { MatchStatus } from '@prisma/client';

import type { SyncedMatch } from './synced-match';
import { countryCodeFromProviderTeam } from './team-codes';

const API_FOOTBALL_BASE_URL = 'https://v3.football.api-sports.io';

type ApiFootballFetchOptions = {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
  league?: string;
  season?: string;
};

export async function fetchApiFootballFixtures({
  apiKey,
  baseUrl = API_FOOTBALL_BASE_URL,
  fetcher = fetch,
  league = '1',
  season = '2026',
}: ApiFootballFetchOptions): Promise<SyncedMatch[]> {
  const url = new URL('/fixtures', baseUrl);
  url.searchParams.set('league', league);
  url.searchParams.set('season', season);

  const response = await fetcher(url, {
    headers: {
      'x-apisports-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`API-Football fixtures request failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  assertApiFootballResponse(payload);

  return parseApiFootballFixtures(payload);
}

export function parseApiFootballFixtures(payload: unknown): SyncedMatch[] {
  assertApiFootballResponse(payload);

  return payload.response.flatMap((fixture) => {
    const providerFixtureId = requiredNumber(fixture.fixture?.id, 'fixture.id');
    const kickoffAt = requiredDate(fixture.fixture?.date, 'fixture.date');
    const teamACode = countryCodeFromProviderTeam(fixture.teams?.home ?? {});
    const teamBCode = countryCodeFromProviderTeam(fixture.teams?.away ?? {});

    if (teamACode === null || teamBCode === null) {
      return [];
    }

    const homeWinner = fixture.teams?.home?.winner;
    const awayWinner = fixture.teams?.away?.winner;
    const winnerTeamCode = homeWinner === true ? teamACode : awayWinner === true ? teamBCode : null;

    return [
      {
        provider: 'api-football',
        providerFixtureId: String(providerFixtureId),
        matchNumber: null,
        teamACode,
        teamBCode,
        kickoffAt,
        stage: optionalString(fixture.league?.round) ?? 'World Cup',
        status: mapApiFootballStatus(optionalString(fixture.fixture?.status?.short)),
        teamAScore: optionalScore(fixture.goals?.home),
        teamBScore: optionalScore(fixture.goals?.away),
        winnerTeamCode,
      },
    ];
  });
}

function assertApiFootballResponse(payload: unknown): asserts payload is {
  response: Array<{
    fixture?: {
      id?: unknown;
      date?: unknown;
      status?: { short?: unknown };
    };
    league?: { round?: unknown };
    teams?: {
      home?: { name?: string | null; code?: string | null; winner?: boolean | null };
      away?: { name?: string | null; code?: string | null; winner?: boolean | null };
    };
    goals?: { home?: unknown; away?: unknown };
  }>;
  errors?: unknown;
} {
  if (!isObject(payload) || !Array.isArray(payload.response)) {
    throw new Error('API-Football response must include a response array.');
  }

  if (hasApiErrors(payload.errors)) {
    throw new Error(`API-Football returned errors: ${JSON.stringify(payload.errors)}`);
  }
}

function hasApiErrors(errors: unknown): boolean {
  if (errors == null) {
    return false;
  }

  if (Array.isArray(errors)) {
    return errors.length > 0;
  }

  if (isObject(errors)) {
    return Object.keys(errors).length > 0;
  }

  return Boolean(errors);
}

function mapApiFootballStatus(status: string | null): MatchStatus {
  switch (status) {
    case 'NS':
    case 'TBD':
      return MatchStatus.SCHEDULED;
    case '1H':
    case 'HT':
    case '2H':
    case 'ET':
    case 'BT':
    case 'P':
    case 'LIVE':
    case 'INT':
    case 'SUSP':
      return MatchStatus.LIVE;
    case 'FT':
    case 'AET':
    case 'PEN':
      return MatchStatus.FINAL;
    case 'PST':
      return MatchStatus.POSTPONED;
    case 'CANC':
    case 'ABD':
    case 'AWD':
    case 'WO':
      return MatchStatus.CANCELLED;
    default:
      return MatchStatus.SCHEDULED;
  }
}

function requiredNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  return value;
}

function requiredDate(value: unknown, fieldName: string): Date {
  const raw = optionalString(value);

  if (raw === null) {
    throw new Error(`${fieldName} is required.`);
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid timestamp.`);
  }

  return date;
}

function optionalScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
