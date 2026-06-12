import { prisma } from '../../lib/prisma';

export type TeamPlayerMap = Record<string, string[]>;

export async function getLatestDraftTeamPlayerMap(): Promise<TeamPlayerMap> {
  const draft = await prisma.draft.findFirst({
    orderBy: { processedAt: 'desc' },
    select: { id: true },
  });

  if (draft === null) {
    return {};
  }

  const assignments = await prisma.assignment.findMany({
    where: { draftId: draft.id },
    select: {
      teamId: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  const map: TeamPlayerMap = {};

  for (const assignment of assignments) {
    const playerName = formatPlayerName(assignment.user);
    const existingPlayers = map[assignment.teamId] ?? [];

    if (!existingPlayers.includes(playerName)) {
      existingPlayers.push(playerName);
      map[assignment.teamId] = existingPlayers;
    }
  }

  return map;
}

export function formatPlayerLabelForTeam(teamId: string, map: TeamPlayerMap): string {
  const players = map[teamId];

  if (!players || players.length === 0) {
    return 'Unassigned';
  }

  return players.join(' / ');
}

function formatPlayerName(user: { name: string | null; email: string | null }) {
  const name = user.name?.trim();

  if (name) {
    return name;
  }

  const email = user.email?.trim();

  if (!email) {
    return 'Unknown player';
  }

  return formatEmailPlayerName(email);
}

function formatEmailPlayerName(email: string) {
  const localPart = email.split('@')[0] ?? '';
  const formattedName = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return formattedName || email;
}
