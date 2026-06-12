import { MatchStatus } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { fetchApiFootballFixtures } from './api-football';
import { fetchOddsApiOutrights, summarizeBestTeamOdds, type TeamOddsSnapshotInput } from './odds-api';
import type { SyncedMatch } from './synced-match';
import { fetchWorldCup26Games } from './worldcup26';

type TeamRecord = {
  id: string;
  countryCode: string;
};

type MatchRecord = {
  id: string;
  resultProvider: string | null;
  resultProviderFixtureId: string | null;
  matchNumber: number | null;
  teamAId: string;
  teamBId: string;
  kickoffAt: Date;
};

type TeamOddsSyncClient = {
  team: {
    findMany(args: unknown): Promise<TeamRecord[]>;
    update(args: unknown): Promise<unknown>;
  };
  teamOddsSnapshot: {
    upsert(args: unknown): Promise<unknown>;
  };
};

type MatchSyncClient = {
  team: {
    findMany(args: unknown): Promise<TeamRecord[]>;
  };
  match: {
    create(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<MatchRecord[]>;
    update(args: unknown): Promise<unknown>;
  };
};

type DataSyncRunClient = {
  dataSyncRun?: {
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<unknown>;
  };
};

export type WorldCupSyncResult = {
  fixtures: {
    fetched: number;
    createdMatches: number;
    updatedMatches: number;
    skippedMatches: number;
    skipped: boolean;
  };
  odds: {
    fetched: number;
    appliedSnapshots: number;
    updatedTeams: number;
    skipped: boolean;
  };
};

export function hourlySampleTime(now = new Date()): Date {
  const sampledAt = new Date(now);
  sampledAt.setUTCMinutes(0, 0, 0);
  return sampledAt;
}

export async function applyTeamOddsSync(
  client: TeamOddsSyncClient,
  snapshots: TeamOddsSnapshotInput[],
  sampledAt: Date,
): Promise<{ appliedSnapshots: number; updatedTeams: number }> {
  const countryCodes = [...new Set(snapshots.map((snapshot) => snapshot.countryCode))];
  const teams = await client.team.findMany({
    where: { countryCode: { in: countryCodes } },
    select: { id: true, countryCode: true },
  });
  const teamsByCountryCode = new Map(teams.map((team) => [team.countryCode, team]));
  let appliedSnapshots = 0;

  for (const snapshot of snapshots) {
    const team = teamsByCountryCode.get(snapshot.countryCode);

    if (team === undefined) {
      continue;
    }

    await client.teamOddsSnapshot.upsert({
      where: {
        provider_sourceEventId_bookmakerKey_marketKey_teamId_sampledAt: {
          provider: snapshot.provider,
          sourceEventId: snapshot.sourceEventId,
          bookmakerKey: snapshot.bookmakerKey,
          marketKey: snapshot.marketKey,
          teamId: team.id,
          sampledAt,
        },
      },
      update: {
        sourceSportKey: snapshot.sourceSportKey,
        sourceLastUpdate: snapshot.sourceLastUpdate,
        bookmakerTitle: snapshot.bookmakerTitle,
        outcomeName: snapshot.outcomeName,
        decimalOdds: snapshot.decimalOdds,
        impliedProbability: snapshot.impliedProbability,
      },
      create: {
        provider: snapshot.provider,
        sourceEventId: snapshot.sourceEventId,
        sourceSportKey: snapshot.sourceSportKey,
        sourceLastUpdate: snapshot.sourceLastUpdate,
        sampledAt,
        bookmakerKey: snapshot.bookmakerKey,
        bookmakerTitle: snapshot.bookmakerTitle,
        marketKey: snapshot.marketKey,
        outcomeName: snapshot.outcomeName,
        decimalOdds: snapshot.decimalOdds,
        impliedProbability: snapshot.impliedProbability,
        teamId: team.id,
      },
    });
    appliedSnapshots += 1;
  }

  let updatedTeams = 0;
  for (const summary of summarizeBestTeamOdds(snapshots)) {
    const team = teamsByCountryCode.get(summary.countryCode);

    if (team === undefined) {
      continue;
    }

    await client.team.update({
      where: { id: team.id },
      data: {
        decimalOdds: summary.decimalOdds,
        oddsUpdatedAt: sampledAt,
      },
    });
    updatedTeams += 1;
  }

  return { appliedSnapshots, updatedTeams };
}

export async function applyMatchSync(
  client: MatchSyncClient,
  matches: SyncedMatch[],
  syncedAt: Date,
): Promise<{ createdMatches: number; updatedMatches: number; skippedMatches: number }> {
  const countryCodes = [
    ...new Set(matches.flatMap((match) => [match.teamACode, match.teamBCode, match.winnerTeamCode]).filter(isString)),
  ];
  const teams = await client.team.findMany({
    where: { countryCode: { in: countryCodes } },
    select: { id: true, countryCode: true },
  });
  const teamsByCountryCode = new Map(teams.map((team) => [team.countryCode, team]));
  const teamIds = teams.map((team) => team.id);
  const providerPairs = matches.map((match) => ({ resultProvider: match.provider, resultProviderFixtureId: match.providerFixtureId }));
  const matchNumbers = [...new Set(matches.map((match) => match.matchNumber).filter(isNumber))];
  const existingMatches = await client.match.findMany({
    where: {
      OR: [
        ...providerPairs,
        { matchNumber: { in: matchNumbers } },
        {
          teamAId: { in: teamIds },
          teamBId: { in: teamIds },
        },
      ],
    },
    select: {
      id: true,
      resultProvider: true,
      resultProviderFixtureId: true,
      matchNumber: true,
      teamAId: true,
      teamBId: true,
      kickoffAt: true,
    },
  });
  let createdMatches = 0;
  let updatedMatches = 0;
  let skippedMatches = 0;

  for (const match of matches) {
    const teamA = teamsByCountryCode.get(match.teamACode);
    const teamB = teamsByCountryCode.get(match.teamBCode);

    if (teamA === undefined || teamB === undefined) {
      skippedMatches += 1;
      continue;
    }

    const winnerTeamId = match.winnerTeamCode === null ? null : teamsByCountryCode.get(match.winnerTeamCode)?.id ?? null;
    const existingMatch = findExistingMatch(existingMatches, match, teamA.id, teamB.id);
    const kickoffAt = match.kickoffAt ?? existingMatch?.kickoffAt;

    if (kickoffAt === undefined) {
      skippedMatches += 1;
      continue;
    }

    if (existingMatch === undefined) {
      await client.match.create({
        data: {
          resultProvider: match.provider,
          resultProviderFixtureId: match.providerFixtureId,
          teamAId: teamA.id,
          teamBId: teamB.id,
          kickoffAt,
          stage: match.stage,
          status: match.status,
          teamAScore: match.teamAScore,
          teamBScore: match.teamBScore,
          winnerTeamId,
          resultSyncedAt: syncedAt,
        },
      });
      createdMatches += 1;
      continue;
    }

    const isReversed = existingMatch.teamAId === teamB.id && existingMatch.teamBId === teamA.id;
    await client.match.update({
      where: { id: existingMatch.id },
      data: {
        resultProvider: match.provider,
        resultProviderFixtureId: match.providerFixtureId,
        kickoffAt,
        stage: match.stage,
        status: match.status,
        teamAScore: isReversed ? match.teamBScore : match.teamAScore,
        teamBScore: isReversed ? match.teamAScore : match.teamBScore,
        winnerTeamId,
        resultSyncedAt: syncedAt,
      },
    });
    updatedMatches += 1;
  }

  return { createdMatches, updatedMatches, skippedMatches };
}

export async function runWorldCupDataSync({
  allowMissingKeys = false,
  client = prisma,
  dryRun = false,
  env = process.env,
  now = new Date(),
}: {
  allowMissingKeys?: boolean;
  client?: typeof prisma;
  dryRun?: boolean;
  env?: NodeJS.ProcessEnv;
  now?: Date;
} = {}): Promise<WorldCupSyncResult> {
  const sampledAt = hourlySampleTime(now);
  const apiFootballKey = env.API_FOOTBALL_API_KEY?.trim();
  const oddsApiKey = env.THE_ODDS_API_KEY?.trim();
  const matchSource = env.WORLD_CUP_SYNC_MATCH_SOURCE?.trim() || 'worldcup26';

  if (matchSource !== 'worldcup26' && !apiFootballKey && !oddsApiKey && !allowMissingKeys) {
    throw new Error('Set API_FOOTBALL_API_KEY or THE_ODDS_API_KEY before running the World Cup sync.');
  }

  const result: WorldCupSyncResult = {
    fixtures: { fetched: 0, createdMatches: 0, updatedMatches: 0, skippedMatches: 0, skipped: true },
    odds: { fetched: 0, appliedSnapshots: 0, updatedTeams: 0, skipped: true },
  };

  if (matchSource === 'worldcup26' || apiFootballKey) {
    const matches =
      matchSource === 'api-football'
        ? await fetchApiFootballFixtures({
            apiKey: requiredApiKey(apiFootballKey, 'API_FOOTBALL_API_KEY'),
            league: env.WORLD_CUP_SYNC_API_FOOTBALL_LEAGUE ?? '1',
            season: env.WORLD_CUP_SYNC_API_FOOTBALL_SEASON ?? '2026',
          })
        : await fetchWorldCup26Games();
    result.fixtures = {
      fetched: matches.length,
      createdMatches: 0,
      updatedMatches: 0,
      skippedMatches: 0,
      skipped: false,
    };
    if (!dryRun) {
      const applied = await withSyncRun(client, {
        provider: matchSource === 'api-football' ? 'api-football' : 'worldcup26',
        kind: 'fixtures',
        startedAt: now,
      }, () => applyMatchSync(client, matches, sampledAt));
      result.fixtures = { fetched: matches.length, skipped: false, ...applied };
    }
  }

  if (oddsApiKey) {
    const snapshots = await fetchOddsApiOutrights({
      apiKey: oddsApiKey,
      bookmakers: env.THE_ODDS_API_BOOKMAKERS,
      regions: env.THE_ODDS_API_REGIONS ?? 'uk',
      sampledAt,
      sport: env.THE_ODDS_API_SPORT ?? 'soccer_fifa_world_cup_winner',
    });
    result.odds = {
      fetched: snapshots.length,
      appliedSnapshots: 0,
      updatedTeams: 0,
      skipped: false,
    };
    if (!dryRun) {
      const applied = await withSyncRun(client, {
        provider: 'the-odds-api',
        kind: 'outright-odds',
        startedAt: now,
      }, () => applyTeamOddsSync(client, snapshots, sampledAt));
      result.odds = { fetched: snapshots.length, skipped: false, ...applied };
    }
  }

  return result;
}

async function withSyncRun<Result>(
  client: DataSyncRunClient,
  {
    kind,
    provider,
    startedAt,
  }: {
    kind: string;
    provider: string;
    startedAt: Date;
  },
  operation: () => Promise<Result>,
): Promise<Result> {
  if (client.dataSyncRun === undefined) {
    return operation();
  }

  const run = await client.dataSyncRun.create({
    data: {
      provider,
      kind,
      status: 'RUNNING',
      startedAt,
    },
  });

  try {
    const result = await operation();
    await client.dataSyncRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        fetchedCount: countFetched(result),
        appliedCount: countApplied(result),
      },
    });
    return result;
  } catch (error) {
    await client.dataSyncRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        message: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

function findExistingMatch(
  matches: MatchRecord[],
  syncedMatch: SyncedMatch,
  teamAId: string,
  teamBId: string,
): MatchRecord | undefined {
  return (
    matches.find(
      (match) =>
        match.resultProvider === syncedMatch.provider &&
        match.resultProviderFixtureId === syncedMatch.providerFixtureId,
    ) ??
    matches.find((match) => match.matchNumber !== null && match.matchNumber === syncedMatch.matchNumber) ??
    matches.find(
      (match) =>
        syncedMatch.kickoffAt !== null &&
        match.kickoffAt.getTime() === syncedMatch.kickoffAt.getTime() &&
        ((match.teamAId === teamAId && match.teamBId === teamBId) ||
          (match.teamAId === teamBId && match.teamBId === teamAId)),
    )
  );
}

function countFetched(result: unknown): number {
  if (isRecord(result)) {
    if (typeof result.appliedSnapshots === 'number') {
      return result.appliedSnapshots;
    }
    if (typeof result.createdMatches === 'number' && typeof result.updatedMatches === 'number') {
      return result.createdMatches + result.updatedMatches + (typeof result.skippedMatches === 'number' ? result.skippedMatches : 0);
    }
  }

  return 0;
}

function countApplied(result: unknown): number {
  if (isRecord(result)) {
    if (typeof result.updatedTeams === 'number') {
      return result.updatedTeams;
    }
    if (typeof result.createdMatches === 'number' && typeof result.updatedMatches === 'number') {
      return result.createdMatches + result.updatedMatches;
    }
  }

  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function requiredApiKey(value: string | undefined, envName: string): string {
  if (value === undefined || value === '') {
    throw new Error(`Set ${envName} before using API-Football sync.`);
  }

  return value;
}
