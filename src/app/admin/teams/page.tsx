import { requireAdmin } from '@/auth/session';
import { buildCurrentTeamWinProbabilityMap } from '@/domain/current-win-probabilities';
import { prisma } from '@/lib/prisma';

export default async function AdminTeamsPage() {
  await requireAdmin('/admin/teams');

  const teams = await prisma.team.findMany({
    where: { active: true },
    orderBy: [{ groupName: 'asc' }, { displayName: 'asc' }],
  });
  const currentTeamWinProbabilityById = buildCurrentTeamWinProbabilityMap(teams);

  return (
    <main className="page-shell page-stack">
      <section className="panel" aria-labelledby="teams-heading">
        <div className="panel-heading">
          <h2 id="teams-heading">Teams and Win Probability</h2>
        </div>
        {teams.length === 0 || currentTeamWinProbabilityById.size === 0 ? (
          <p className="empty-state">No active teams seeded.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Team</th>
                  <th scope="col">Group</th>
                  <th scope="col" className="numeric-cell">
                    Win probability
                  </th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.id}>
                    <td>{team.displayName}</td>
                    <td>{team.groupName ?? '-'}</td>
                    <td className="numeric-cell">{formatPercent(currentTeamWinProbabilityById.get(team.id) ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: 'percent',
  }).format(value);
}
