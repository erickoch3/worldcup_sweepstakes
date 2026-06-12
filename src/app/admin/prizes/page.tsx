import { requireAdmin } from '@/auth/session';
import { buildCurrentTeamWinProbabilityMap, currentAssignmentWinProbability } from '@/domain/current-win-probabilities';
import { computePrizeSummary } from '@/domain/prizes';
import { prisma } from '@/lib/prisma';
import { formatPounds } from '@/server/format';

export default async function AdminPrizesPage() {
  await requireAdmin('/admin/prizes');

  const [assignments, activeTeams] = await Promise.all([
    prisma.assignment.findMany({
      orderBy: [{ pickNumber: 'asc' }, { createdAt: 'asc' }],
      include: {
        user: true,
        team: true,
      },
    }),
    prisma.team.findMany({
      where: { active: true },
      select: { id: true, decimalOdds: true },
    }),
  ]);
  const currentTeamWinProbabilityById = buildCurrentTeamWinProbabilityMap(activeTeams);
  const prizeSummary = computePrizeSummary(
    assignments.map((assignment) => ({
      userId: assignment.userId,
      buyInPence: assignment.buyInPence,
    })),
  );
  const winnerPayout = prizeSummary.payouts.find((payout) => payout.place === 1);

  return (
    <main className="page-shell page-stack">
      <section className="panel" aria-labelledby="prizes-heading">
        <div className="panel-heading">
          <h2 id="prizes-heading">Prize Pool</h2>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <tbody>
              <tr>
                <th scope="row">Total prize pool</th>
                <td className="numeric-cell">{formatPounds(prizeSummary.totalPrizePoolPence)}</td>
              </tr>
              <tr>
                <th scope="row">Winner-takes-all payout</th>
                <td className="numeric-cell">{formatPounds(winnerPayout?.amountPence ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="assignments-heading">
        <div className="panel-heading">
          <h2 id="assignments-heading">Assignments</h2>
        </div>
        {assignments.length === 0 ? (
          <p className="empty-state">No assignments yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Pick</th>
                  <th scope="col">Player</th>
                  <th scope="col">Team</th>
                  <th scope="col">Share</th>
                  <th scope="col" className="numeric-cell">
                    Win probability
                  </th>
                  <th scope="col" className="numeric-cell">
                    Buy-in
                  </th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td className="rank-cell">{assignment.pickNumber ?? '-'}</td>
                    <td>{assignment.user.name ?? assignment.user.email ?? 'Unknown participant'}</td>
                    <td>{assignment.team.displayName}</td>
                    <td>{formatShare(assignment.teamShareIndex, assignment.teamShareCount)}</td>
                    <td className="numeric-cell">
                      {formatPercent(currentAssignmentWinProbability(assignment, currentTeamWinProbabilityById))}
                    </td>
                    <td className="numeric-cell">{formatPounds(assignment.buyInPence)}</td>
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

function formatShare(shareIndex: number, shareCount: number): string {
  return shareCount > 1 ? `${shareIndex}/${shareCount}` : 'Whole team';
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: 'percent',
  }).format(value);
}
