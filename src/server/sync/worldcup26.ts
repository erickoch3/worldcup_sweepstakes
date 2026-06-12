import { MatchStatus } from '@prisma/client';

import type { SyncedMatch } from './synced-match';
import { countryCodeFromProviderName } from './team-codes';

const WORLDCUP26_GAMES_URL = 'https://worldcup26.ir/get/games';

type WorldCup26FetchOptions = {
  fetcher?: typeof fetch;
  url?: string;
};

export async function fetchWorldCup26Games({
  fetcher = fetch,
  url = WORLDCUP26_GAMES_URL,
}: WorldCup26FetchOptions = {}): Promise<SyncedMatch[]> {
  const response = await fetcher(url);

  if (!response.ok) {
    throw new Error(`WorldCup26 games request failed with HTTP ${response.status}.`);
  }

  return parseWorldCup26Games(await response.json());
}

export function parseWorldCup26Games(payload: unknown): SyncedMatch[] {
  assertWorldCup26GamesResponse(payload);

  return payload.games.flatMap((game) => {
    const providerFixtureId = optionalString(game.id);
    const matchNumber = optionalPositiveInteger(game.id);
    const teamACode = countryCodeFromProviderName(optionalString(game.home_team_name_en));
    const teamBCode = countryCodeFromProviderName(optionalString(game.away_team_name_en));

    if (providerFixtureId === null || teamACode === null || teamBCode === null) {
      return [];
    }

    const teamAScore = optionalScore(game.home_score);
    const teamBScore = optionalScore(game.away_score);
    const status = mapWorldCup26Status(game.finished, game.time_elapsed);

    return [
      {
        provider: 'worldcup26',
        providerFixtureId,
        matchNumber,
        stage: stageFromGame(game),
        status,
        teamACode,
        teamBCode,
        teamAScore,
        teamBScore,
        winnerTeamCode: winnerCode({ status, teamACode, teamBCode, teamAScore, teamBScore }),
        kickoffAt: null,
      },
    ];
  });
}

function assertWorldCup26GamesResponse(payload: unknown): asserts payload is {
  games: Array<{
    id?: unknown;
    home_score?: unknown;
    away_score?: unknown;
    group?: unknown;
    finished?: unknown;
    time_elapsed?: unknown;
    type?: unknown;
    home_team_name_en?: unknown;
    away_team_name_en?: unknown;
  }>;
} {
  if (!isObject(payload) || !Array.isArray(payload.games)) {
    throw new Error('WorldCup26 response must include a games array.');
  }
}

function stageFromGame(game: { group?: unknown; type?: unknown }): string {
  const typeRaw = optionalString(game.type);
  const group = optionalString(game.group);

  if (typeRaw === null) {
    return 'World Cup';
  }

  const type = typeRaw.toLowerCase();

  if (type === 'group' && group !== null) {
    return `Group ${group}`;
  }

  return titleCase(type);
}

function mapWorldCup26Status(finished: unknown, timeElapsed: unknown): MatchStatus {
  const finishedValue = optionalString(finished)?.toUpperCase();
  const elapsedValue = optionalString(timeElapsed)?.toLowerCase();

  if (finishedValue === 'TRUE' || elapsedValue === 'finished') {
    return MatchStatus.FINAL;
  }

  if (elapsedValue === null || elapsedValue === 'notstarted') {
    return MatchStatus.SCHEDULED;
  }

  return MatchStatus.LIVE;
}

function winnerCode({
  status,
  teamACode,
  teamBCode,
  teamAScore,
  teamBScore,
}: {
  status: MatchStatus;
  teamACode: string;
  teamBCode: string;
  teamAScore: number | null;
  teamBScore: number | null;
}): string | null {
  if (status !== MatchStatus.FINAL || teamAScore === null || teamBScore === null || teamAScore === teamBScore) {
    return null;
  }

  return teamAScore > teamBScore ? teamACode : teamBCode;
}

function optionalPositiveInteger(value: unknown): number | null {
  const raw = optionalString(value);

  if (raw === null || !/^\d+$/.test(raw)) {
    return null;
  }

  const parsed = Number(raw);

  return parsed > 0 ? parsed : null;
}

function optionalScore(value: unknown): number | null {
  const raw = optionalString(value);

  if (raw === null || !/^\d+$/.test(raw)) {
    return null;
  }

  return Number(raw);
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
