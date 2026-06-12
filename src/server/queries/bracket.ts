import type { BracketMatch, BracketStageGroup } from '../../components/bracket';
import { BRACKET_STAGE_ORDER, WORLD_CUP_KNOCKOUT_SLOTS, type KnockoutSlot } from '../../data/world-cup-knockout';
import { prisma } from '../../lib/prisma';
import { formatPlayerLabelForTeam, getLatestDraftTeamPlayerMap } from './team-owners';

const KNOCKOUT_STAGES = [...BRACKET_STAGE_ORDER];
const KNOCKOUT_SLOTS_BY_MATCH_NUMBER = new Map(
  WORLD_CUP_KNOCKOUT_SLOTS.map((slot) => [slot.matchNumber, slot]),
);

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
        teamA: toPlaceholderBracketTeam(slot.teamASlot),
        teamB: toPlaceholderBracketTeam(slot.teamBSlot),
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

function toBracketMatch(match: {
  id: string;
  matchNumber: number | null;
  stage: string;
  status: string;
  teamAScore: number | null;
  teamBScore: number | null;
  teamA: { countryCode: string; displayName: string };
  teamB: { countryCode: string; displayName: string };
  winnerTeam: { displayName: string } | null;
  kickoffAt: Date;
  teamAId: string;
  teamBId: string;
}, teamPlayerMap: Record<string, string[]>, slot?: KnockoutSlot): BracketMatch {
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

function getSlotDescription(slotLabel: string): string | null {
  return slotLabel;
}
