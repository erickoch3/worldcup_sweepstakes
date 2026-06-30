import { TeamNameWithFlag } from './country-flag';

export type LeaderboardRow = {
  rank: number;
  player: string;
  teams: Array<{
    countryCode?: string | null;
    isEliminated: boolean;
    label: string;
  }>;
  points: number;
  normalizedWinProbability: number;
  isEliminated: boolean;
};

type LeaderboardProps = {
  rows: LeaderboardRow[];
};

export function Leaderboard({ rows }: LeaderboardProps) {
  if (rows.length === 0) {
    return (
      <section className="panel" aria-labelledby="leaderboard-heading">
        <div className="panel-heading">
          <h2 id="leaderboard-heading">Leaderboard</h2>
        </div>
        <p className="empty-state">No teams have been assigned yet.</p>
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="leaderboard-heading">
      <div className="panel-heading">
        <h2 id="leaderboard-heading">Leaderboard</h2>
      </div>
      <div className="table-scroll">
        <table className="data-table leaderboard-table">
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Player</th>
              <th scope="col">Teams</th>
              <th scope="col" className="numeric-cell">
                Points
              </th>
              <th scope="col" className="numeric-cell">
                Total win probability
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className={row.isEliminated ? 'leaderboard-row-eliminated' : undefined} key={`${row.rank}-${row.player}`}>
                <td className="rank-cell">{row.rank}</td>
                <td>
                  <span className="leaderboard-player-name">{row.player}</span>
                </td>
                <td>
                  {row.teams.map((team, index) => (
                    <span key={`${team.countryCode ?? 'team'}-${team.label}`}>
                      {index > 0 ? <span className="leaderboard-team-separator">, </span> : null}
                      <span
                        className={team.isEliminated ? 'leaderboard-team leaderboard-team-eliminated' : 'leaderboard-team'}
                      >
                        <TeamNameWithFlag countryCode={team.countryCode} name={team.label} />
                      </span>
                    </span>
                  ))}
                </td>
                <td className="numeric-cell">{formatPoints(row.points)}</td>
                <td className="numeric-cell">{formatPercent(row.normalizedWinProbability)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: 'percent',
  }).format(value);
}
