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
  const matches = data.matches.map((match) => {
    const hasTeams = match.teamA !== null && match.teamB !== null && match.teamAId !== null && match.teamBId !== null;
    const teamASlot = 'teamASlot' in match ? match.teamASlot : 'TBD';
    const teamBSlot = 'teamBSlot' in match ? match.teamBSlot : 'TBD';

    return {
      id: match.id,
      label: hasTeams ? `${match.teamA.displayName} vs ${match.teamB.displayName}` : `${teamASlot} vs ${teamBSlot}`,
      kickoff: match.kickoffAt,
      stage: match.stage,
      status: match.status,
      teamAScore: match.teamAScore,
      teamBScore: match.teamBScore,
      penaltySummary: match.penaltySummary,
      winnerName: match.winnerTeam?.displayName,
      players: hasTeams
        ? `${formatPlayerLabelForTeam(match.teamAId, data.teamPlayerMap)} vs ${formatPlayerLabelForTeam(
            match.teamBId,
            data.teamPlayerMap,
          )}`
        : `${teamASlot} vs ${teamBSlot}`,
      teamA: hasTeams
        ? {
            countryCode: match.teamA.countryCode,
            name: match.teamA.displayName,
          }
        : undefined,
      teamB: hasTeams
        ? {
            countryCode: match.teamB.countryCode,
            name: match.teamB.displayName,
          }
        : undefined,
    };
  });

  return (
    <main className="page-shell page-stack">
      <ScheduleList matches={matches} nextMatchId={data.nextMatchId} />
    </main>
  );
}
