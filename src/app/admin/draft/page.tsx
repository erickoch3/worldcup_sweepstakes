import { requireAdmin } from '@/auth/session';
import { Button } from '@/components/forms';
import { DeleteSubmissionButton } from '@/components/delete-submission-button';
import { buildCurrentTeamWinProbabilityMap, currentAssignmentWinProbability } from '@/domain/current-win-probabilities';
import { prisma } from '@/lib/prisma';
import { deleteSubmissionAction, processDraftAction } from '@/server/actions/draft';
import { TestDraftPanel } from './_components/test-draft-panel';

export default async function AdminDraftPage() {
  await requireAdmin('/admin/draft');

  const [draft, submissions, activeTeams] = await Promise.all([
    prisma.draft.findFirst({
      orderBy: { processedAt: 'desc' },
      include: {
        processedBy: true,
        assignments: {
          orderBy: [{ pickNumber: 'asc' }, { createdAt: 'asc' }],
          include: {
            user: true,
            team: true,
          },
        },
      },
    }),
    prisma.preferenceSubmission.findMany({
      orderBy: [{ createdAt: 'asc' }],
      include: {
        user: true,
        choices: {
          orderBy: { rank: 'asc' },
          include: {
            team: true,
          },
        },
      },
    }),
    prisma.team.findMany({
      where: { active: true },
      select: { id: true, decimalOdds: true },
    }),
  ]);
  const currentTeamWinProbabilityById = buildCurrentTeamWinProbabilityMap(activeTeams);

  return (
    <main className="page-shell page-stack">
      <section className="panel" aria-labelledby="draft-heading">
        <div className="panel-heading">
          <h2 id="draft-heading">Draft</h2>
        </div>
        {draft ? (
          <div className="table-scroll">
            <table className="data-table">
              <tbody>
                <tr>
                  <th scope="row">Processed at</th>
                  <td>{formatDateTime(draft.processedAt)}</td>
                </tr>
                <tr>
                  <th scope="row">Processed by</th>
                  <td>{draft.processedBy?.name ?? draft.processedBy?.email ?? '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="draft-action-panel empty-state">
            <div className="draft-action-copy">
              <p>
                <strong>Draft has not been processed.</strong>
              </p>
              <p>Process the final draft when registration closes, or run a temporary simulation first.</p>
            </div>
            <div className="draft-action-controls" role="group" aria-label="Draft actions">
              <form action={processDraftAction} className="draft-process-form">
                <Button type="submit" variant="primary">
                  Process draft
                </Button>
              </form>
              <TestDraftPanel
                submissions={submissions.map((submission) => ({
                  userId: submission.userId,
                  userName: submission.user.name ?? submission.user.email ?? 'Unknown participant',
                  createdAt: submission.createdAt.toISOString(),
                  choices: submission.choices.map((choice) => ({
                    teamId: choice.teamId,
                    teamName: choice.team.displayName,
                    decimalOdds: choice.team.decimalOdds,
                  })),
                }))}
              />
            </div>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="submissions-heading">
        <div className="panel-heading">
          <h2 id="submissions-heading">Preference Submissions</h2>
        </div>
        {submissions.length === 0 ? (
          <p className="empty-state">No preference submissions.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col">Locked</th>
                  <th scope="col">Choices</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr key={submission.id}>
                    <td>{submission.user.name ?? submission.user.email ?? 'Unknown participant'}</td>
                    <td>{formatDateTime(submission.lockedAt)}</td>
                    <td>
                      {submission.choices
                        .map((choice) => `${choice.rank}. ${choice.team.displayName}`)
                        .join(', ')}
                    </td>
                    <td>
                      {draft ? (
                        <span>-</span>
                      ) : (
                        <DeleteSubmissionButton
                          action={deleteSubmissionAction}
                          playerName={submission.user.name ?? submission.user.email ?? 'participant'}
                          submissionId={submission.id}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {draft ? (
        <section className="panel" aria-labelledby="assignments-heading">
          <div className="panel-heading">
            <h2 id="assignments-heading">Assignments</h2>
          </div>
          {draft.assignments.length === 0 ? (
            <p className="empty-state">No assignments recorded.</p>
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
                      Preference rank won
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {draft.assignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td className="rank-cell">{assignment.pickNumber ?? '-'}</td>
                      <td>{assignment.user.name ?? assignment.user.email ?? 'Unknown participant'}</td>
                      <td>{assignment.team.displayName}</td>
                      <td>{formatShare(assignment.teamShareIndex, assignment.teamShareCount)}</td>
                      <td className="numeric-cell">
                        {formatPercent(currentAssignmentWinProbability(assignment, currentTeamWinProbabilityById))}
                      </td>
                      <td className="numeric-cell">{assignment.preferenceRankWon ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
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

function formatDateTime(value: Date | null): string {
  if (value === null) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}
