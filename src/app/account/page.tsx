import { requireUser } from '@/auth/session';
import { PreferenceRankingForm } from '@/components/preference-ranking-form';
import { buildCurrentTeamWinProbabilityMap, currentAssignmentWinProbability } from '@/domain/current-win-probabilities';
import { getAccountData } from '@/server/queries/account';
import { prisma } from '@/lib/prisma';
import { submitPreferencesAction } from '@/server/actions/preferences';

export default async function AccountPage() {
  const session = await requireUser('/account');
  const [account, teams, draft] = await Promise.all([
    getAccountData(session.user.id),
    prisma.team.findMany({
      where: { active: true },
      orderBy: { displayName: 'asc' },
    }),
    prisma.draft.findFirst({
      select: { id: true },
    }),
  ]);
  const assignments = account?.assignments ?? [];
  const currentTeamWinProbabilityById = buildCurrentTeamWinProbabilityMap(teams);
  const assignmentRows = assignments.map((assignment) => ({
    ...assignment,
    currentWinProbability: currentAssignmentWinProbability(assignment, currentTeamWinProbabilityById),
  }));
  const totalWinProbability = assignmentRows.reduce((total, assignment) => total + assignment.currentWinProbability, 0);
  const isDraftProcessed = draft !== null;

  async function savePreferences(formData: FormData) {
    'use server';

    await submitPreferencesAction(null, formData);
  }

  return (
    <main className="page-shell page-stack">
      <section className="panel" aria-labelledby="account-heading">
        <div className="panel-heading">
          <h2 id="account-heading">Account</h2>
        </div>
        <div className="empty-state">
          <strong>Email</strong>
          <br />
          {account?.email ?? session.user.email}
        </div>
      </section>

      {assignments.length > 0 ? (
        <section className="panel" aria-labelledby="assignment-heading">
          <div className="panel-heading">
            <h2 id="assignment-heading">Assigned Teams</h2>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Pick</th>
                  <th scope="col">Team</th>
                  <th scope="col">Share</th>
                  <th scope="col" className="numeric-cell">
                    Win probability
                  </th>
                </tr>
              </thead>
              <tbody>
                {assignmentRows.map((assignment) => (
                  <tr key={assignment.id}>
                    <td className="rank-cell">{assignment.pickNumber ?? '-'}</td>
                    <td>{assignment.team.displayName}</td>
                    <td>{formatShare(assignment.teamShareIndex, assignment.teamShareCount)}</td>
                    <td className="numeric-cell">{formatPercent(assignment.currentWinProbability)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" colSpan={3}>
                    Total win probability
                  </th>
                  <td className="numeric-cell">{formatPercent(totalWinProbability)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel" aria-labelledby="preferences-heading">
        <div className="panel-heading">
          <h2 id="preferences-heading">Preference Submission</h2>
        </div>
        {!isDraftProcessed ? (
          <PreferenceRankingForm
            action={savePreferences}
            initialTeamIds={account?.preferenceSubmission?.choices.map((choice) => choice.teamId) ?? []}
            submitLabel={account?.preferenceSubmission ? 'Update preferences' : 'Submit preferences'}
            teams={teams}
            title={
              account?.preferenceSubmission
                ? 'Adjust your ranking and save before the draw.'
                : 'Rank all active teams to enter the draft.'
            }
          />
        ) : account?.preferenceSubmission ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Choice</th>
                  <th scope="col">Team</th>
                </tr>
              </thead>
              <tbody>
                {account.preferenceSubmission.choices.map((choice) => (
                  <tr key={choice.id}>
                    <td className="rank-cell">{choice.rank}</td>
                    <td>{choice.team.displayName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">
            No preferences were submitted before the draw.
          </p>
        )}
        {isDraftProcessed ? (
          <p className="empty-state">Your preferences are locked after the draw is processed.</p>
        ) : null}
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
