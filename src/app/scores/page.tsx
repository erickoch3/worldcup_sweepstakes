import { AuthGate } from '@/components/auth-gate';
import { ScoresList } from '@/components/schedule';
import { getCurrentSession } from '@/auth/session';
import { getScoresData } from '@/server/queries/schedule';
import { formatPlayerLabelForTeam } from '@/server/queries/team-owners';

export default async function ScoresPage() {
  const session = await getCurrentSession();

  if (!session?.user.email) {
    return <AuthGate callbackUrl="/scores" />;
  }

  const data = await getScoresData();
  const matches = data.matches.map((match) => ({
    id: match.id,
    label: `${match.teamA.displayName} vs ${match.teamB.displayName}`,
    kickoff: match.kickoffAt,
    stage: match.stage,
    status: match.status,
    teamAScore: match.teamAScore,
    teamBScore: match.teamBScore,
    penaltySummary: match.penaltySummary,
    winnerName: match.winnerTeam?.displayName,
    players: `${formatPlayerLabelForTeam(match.teamAId, data.teamPlayerMap)} vs ${formatPlayerLabelForTeam(
      match.teamBId,
      data.teamPlayerMap,
    )}`,
    teamA: {
      countryCode: match.teamA.countryCode,
      name: match.teamA.displayName,
    },
    teamB: {
      countryCode: match.teamB.countryCode,
      name: match.teamB.displayName,
    },
  }));

  return (
    <main className="page-shell page-stack">
      <ScoresList matches={matches} />
    </main>
  );
}
