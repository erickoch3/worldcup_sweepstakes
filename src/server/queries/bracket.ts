import type { BracketMatch, BracketStageGroup } from '../../components/bracket';
import { BRACKET_STAGE_ORDER, WORLD_CUP_KNOCKOUT_SLOTS, type KnockoutSlot } from '../../data/world-cup-knockout';
import { prisma } from '../../lib/prisma';
import { formatPlayerLabelForTeam, getLatestDraftTeamPlayerMap } from './team-owners';

const KNOCKOUT_STAGES = [...BRACKET_STAGE_ORDER];
const KNOCKOUT_SLOTS_BY_MATCH_NUMBER = new Map(
  WORLD_CUP_KNOCKOUT_SLOTS.map((slot) => [slot.matchNumber, slot]),
);

type KnockoutMatchRecord = {
  id: string;
  matchNumber: number | null;
  stage: string;
  status: string;
  teamAScore: number | null;
  teamBScore: number | null;
  teamA: { countryCode: string; displayName: string };
  teamB: { countryCode: string; displayName: string };
  winnerTeam: { countryCode?: string; displayName: string } | null;
  kickoffAt: Date;
  teamAId: string;
  teamBId: string;
};

export async function getBracketData(): Promise<BracketStageGroup[]> {
  const [matches, teamPlayerMap] = await Promise.all([
    prisma.match.findMany({
      where: {
        OR: [
          {
            matchNumber: {
              gte: 73,
              lte: 104,
            },
          },
          {
            stage: {
              in: KNOCKOUT_STAGES,
            },
          },
        ],
      },
      orderBy: [{ matchNumber: 'asc' }, { kickoffAt: 'asc' }],
      include: {
        teamA: true,
        teamB: true,
        winnerTeam: true,
      },
    }),
    getLatestDraftTeamPlayerMap(),
  ]);
  const matchesByNumber = new Map(
    matches
      .filter((match) => match.matchNumber !== null)
      .map((match) => [
        match.matchNumber as number,
        toBracketMatch(match, teamPlayerMap, KNOCKOUT_SLOTS_BY_MATCH_NUMBER.get(match.matchNumber as number)),
      ]),
  );
  const groupsByStage = new Map<BracketStageGroup['stage'], BracketMatch[]>(
    BRACKET_STAGE_ORDER.map((stage) => [stage, []]),
  );

  for (const slot of WORLD_CUP_KNOCKOUT_SLOTS) {
    const matchesForStage = groupsByStage.get(slot.stage);

    if (matchesForStage === undefined) {
      continue;
    }

    matchesForStage.push(
      matchesByNumber.get(slot.matchNumber) ?? {
        id: `match-${slot.matchNumber}`,
        label: `Match ${slot.matchNumber}`,
        kickoff: slot.kickoffAt,
        venue: slot.venue,
        teamA: toSlotBracketTeam(slot.teamASlot, matches, teamPlayerMap),
        teamB: toSlotBracketTeam(slot.teamBSlot, matches, teamPlayerMap),
        winner: null,
        status: 'SCHEDULED',
      },
    );
  }

  for (const match of matches) {
    if (match.matchNumber !== null) {
      continue;
    }

    const matchesForStage = groupsByStage.get(match.stage);

    if (matchesForStage !== undefined) {
      matchesForStage.push(toBracketMatch(match, teamPlayerMap, KNOCKOUT_SLOTS_BY_MATCH_NUMBER.get(match.matchNumber ?? -1)));
    }
  }

  return BRACKET_STAGE_ORDER.map((stage) => ({
    stage,
    matches: groupsByStage.get(stage) ?? [],
  }));
}

function toBracketMatch(match: KnockoutMatchRecord, teamPlayerMap: Record<string, string[]>, slot?: KnockoutSlot): BracketMatch {
  const teamAName = match.teamA.displayName;
  const teamBName = match.teamB.displayName;
  const prefix = match.matchNumber === null ? match.stage : `Match ${match.matchNumber}`;
  const teamAPlayers = formatPlayerLabelForTeam(match.teamAId, teamPlayerMap);
  const teamBPlayers = formatPlayerLabelForTeam(match.teamBId, teamPlayerMap);

  return {
    id: match.id,
    label: `${prefix}: ${teamAName} vs ${teamBName}`,
    kickoff: match.kickoffAt,
    venue: slot?.venue ?? null,
    teamA: {
      name: teamAName,
      countryCode: match.teamA.countryCode,
      score: match.teamAScore,
      players: teamAPlayers,
    },
    teamB: {
      name: teamBName,
      countryCode: match.teamB.countryCode,
      score: match.teamBScore,
      players: teamBPlayers,
    },
    winner: match.winnerTeam?.displayName ?? null,
    status: match.status,
  };
}

function toPlaceholderBracketTeam(slotLabel: string) {
  return {
    name: 'TBD',
    description: getSlotDescription(slotLabel),
    score: null,
  };
}

function toSlotBracketTeam(
  slotLabel: string,
  matches: KnockoutMatchRecord[],
  teamPlayerMap: Record<string, string[]>,
) {
  const resolvedTeam = resolveSlotTeam(slotLabel, matches);

  if (resolvedTeam === null) {
    return toPlaceholderBracketTeam(slotLabel);
  }

  return {
    name: resolvedTeam.displayName,
    countryCode: resolvedTeam.countryCode,
    score: null,
    players: formatPlayerLabelForTeam(resolvedTeam.id, teamPlayerMap),
  };
}

function resolveSlotTeam(
  slotLabel: string,
  matches: KnockoutMatchRecord[],
): { id: string; countryCode: string; displayName: string } | null {
  const winnerMatchNumber = matchSlotReference(slotLabel, 'Winner');

  if (winnerMatchNumber !== null) {
    const match = matches.find((candidate) => candidate.matchNumber === winnerMatchNumber);

    return match === undefined ? null : winningTeam(match);
  }

  const runnerUpMatchNumber = matchSlotReference(slotLabel, 'Runner-up');

  if (runnerUpMatchNumber !== null) {
    const match = matches.find((candidate) => candidate.matchNumber === runnerUpMatchNumber);
    const winner = match === undefined ? null : winningTeam(match);

    if (match === undefined || winner === null) {
      return null;
    }

    if (winner.id === match.teamAId) {
      return {
        id: match.teamBId,
        countryCode: match.teamB.countryCode,
        displayName: match.teamB.displayName,
      };
    }

    if (winner.id === match.teamBId) {
      return {
        id: match.teamAId,
        countryCode: match.teamA.countryCode,
        displayName: match.teamA.displayName,
      };
    }
  }

  return null;
}

function winningTeam(match: KnockoutMatchRecord): { id: string; countryCode: string; displayName: string } | null {
  if (match.winnerTeam === null) {
    return null;
  }

  if (match.winnerTeam.displayName === match.teamA.displayName) {
    return {
      id: match.teamAId,
      countryCode: match.teamA.countryCode,
      displayName: match.teamA.displayName,
    };
  }

  if (match.winnerTeam.displayName === match.teamB.displayName) {
    return {
      id: match.teamBId,
      countryCode: match.teamB.countryCode,
      displayName: match.teamB.displayName,
    };
  }

  return null;
}

function matchSlotReference(slotLabel: string, prefix: 'Winner' | 'Runner-up'): number | null {
  const match = new RegExp(`^${prefix} match (\\d+)$`, 'i').exec(slotLabel);

  return match === null ? null : Number(match[1]);
}

function getSlotDescription(slotLabel: string): string | null {
  return slotLabel;
}
