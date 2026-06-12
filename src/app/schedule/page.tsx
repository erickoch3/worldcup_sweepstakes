import { ScheduleList } from '@/components/schedule';
import { AuthGate } from '@/components/auth-gate';
import { getCurrentSession } from '@/auth/session';
import { getScheduleData } from '@/server/queries/schedule';
import { formatPlayerLabelForTeam } from '@/server/queries/team-owners';

export default async function SchedulePage() {
  const session = await getCurrentSession();

  if (!session?.user.email) {
    return <AuthGate callbackUrl="/schedule" />;
  }

  const data = await getScheduleData();
  const matches = data.matches.map((match) => ({
    id: match.id,
    label: `${match.teamA.displayName} vs ${match.teamB.displayName}`,
    kickoff: match.kickoffAt,
    stage: match.stage,
    status: match.status,
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
      <ScheduleList matches={matches} nextMatchId={data.nextMatchId} />
    </main>
  );
}
