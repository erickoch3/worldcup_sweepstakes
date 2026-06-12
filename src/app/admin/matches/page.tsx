import { MatchStatus } from '@prisma/client';

import { requireAdmin } from '@/auth/session';
import { Button, SelectField, TextField } from '@/components/forms';
import { prisma } from '@/lib/prisma';
import { upsertMatchAction } from '@/server/actions/matches';

const matchStatuses = Object.values(MatchStatus);

export default async function AdminMatchesPage() {
  await requireAdmin('/admin/matches');

  const [teams, matches] = await Promise.all([
    prisma.team.findMany({
      where: { active: true },
      orderBy: { displayName: 'asc' },
    }),
    prisma.match.findMany({
      orderBy: { kickoffAt: 'asc' },
      include: {
        teamA: true,
        teamB: true,
        winnerTeam: true,
      },
    }),
  ]);

  return (
    <main className="page-shell page-stack">
      <section className="panel" aria-labelledby="create-match-heading">
        <div className="panel-heading">
          <h2 id="create-match-heading">Create Match</h2>
        </div>
        <form action={upsertMatchAction} className="empty-state page-stack">
          <TextField label="Match number" min={1} name="matchNumber" step={1} type="number" />

          <SelectField label="Team A" name="teamAId" required>
            <option value="">Select team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.displayName}
              </option>
            ))}
          </SelectField>

          <SelectField label="Team B" name="teamBId" required>
            <option value="">Select team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.displayName}
              </option>
            ))}
          </SelectField>

          <TextField label="Kickoff" name="kickoffAt" required type="datetime-local" />
          <TextField label="Stage" name="stage" placeholder="Group A" required />

          <SelectField label="Status" name="status" required>
            {matchStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </SelectField>

          <TextField label="Team A score" min={0} name="teamAScore" step={1} type="number" />
          <TextField label="Team B score" min={0} name="teamBScore" step={1} type="number" />

          <SelectField label="Winner" name="winnerTeamId">
            <option value="">No winner</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.displayName}
              </option>
            ))}
          </SelectField>

          <TextField label="Penalty summary" name="penaltySummary" placeholder="e.g. 5-4 pens" />

          <div>
            <Button type="submit" variant="primary">
              Create match
            </Button>
          </div>
        </form>
      </section>

      <section className="panel" aria-labelledby="matches-heading">
        <div className="panel-heading">
          <h2 id="matches-heading">Existing Matches</h2>
        </div>
        {matches.length === 0 ? (
          <p className="empty-state">No matches created.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">No.</th>
                  <th scope="col">Kickoff</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Teams</th>
                  <th scope="col">Status</th>
                  <th scope="col">Score</th>
                  <th scope="col">Winner</th>
                  <th scope="col">Penalties</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr key={match.id}>
                    <td>{match.matchNumber ?? '-'}</td>
                    <td>{formatDateTime(match.kickoffAt)}</td>
                    <td>{match.stage}</td>
                    <td>
                      {match.teamA.displayName} vs {match.teamB.displayName}
                    </td>
                    <td>{match.status}</td>
                    <td>{formatScore(match.teamAScore, match.teamBScore)}</td>
                    <td>{match.winnerTeam?.displayName ?? '-'}</td>
                    <td>{match.penaltySummary ?? '-'}</td>
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

function formatScore(teamAScore: number | null, teamBScore: number | null): string {
  if (teamAScore === null || teamBScore === null) {
    return '-';
  }

  return `${teamAScore}-${teamBScore}`;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}
