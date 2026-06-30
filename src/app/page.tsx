import { AuthGate } from '@/components/auth-gate';
import { TeamNameWithFlag } from '@/components/country-flag';
import { Leaderboard } from '@/components/leaderboard';
import { getCurrentSession } from '@/auth/session';
import { formatPounds } from '@/server/format';
import { getDashboardData } from '@/server/queries/dashboard';
import { getScheduleData } from '@/server/queries/schedule';
import { selectDashboardMatches } from './dashboard-matches';

export default async function HomePage() {
  const session = await getCurrentSession();

  if (!session?.user.email) {
    return <AuthGate callbackUrl="/" />;
  }

  const [data, scheduleData] = await Promise.all([
    getDashboardData(),
    getScheduleData(),
  ]);
  const rows = data.leaderboard.map((row, index) => ({
    rank: index + 1,
    player: row.playerName ?? row.playerEmail ?? 'Unknown participant',
    teams: row.teams.map((team) => ({
      countryCode: team.countryCode,
      isEliminated: team.isEliminated,
      label: team.label,
    })),
    points: row.points,
    normalizedWinProbability: row.normalizedWinProbability,
    isEliminated: row.isEliminated,
  }));
  const dashboardMatches = selectDashboardMatches(scheduleData.matches, scheduleData.teamPlayerMap);
  const oddsGroups = groupTeamsByGroup(data.activeTeams);
  const favoriteTeams = [...data.activeTeams].sort(compareTeamOdds).slice(0, 6);

  return (
    <main className="page-shell dashboard-page">
      <section className="worldcup-hero" aria-labelledby="dashboard-heading">
        <div className="hero-copy">
          <p className="summary-kicker">Private draw / World Cup 2026</p>
          <h1 id="dashboard-heading">Sweepstakes Dashboard</h1>
          <p>
            Live draw status, tournament fixtures, win probabilities, team ownership, and prize pool in one place.
          </p>
        </div>
        <dl className="hero-metrics" aria-label="Sweepstakes summary">
          <div className="summary-metric">
            <dt>Players</dt>
            <dd>{data.leaderboard.length}</dd>
          </div>
          <div className="summary-metric">
            <dt>Teams</dt>
            <dd>{data.teams.length}</dd>
          </div>
          <div className="summary-metric">
            <dt>Prize pool</dt>
            <dd>{formatPounds(data.prizeSummary.totalPrizePoolPence)}</dd>
          </div>
          <div className="summary-metric">
            <dt>Draft</dt>
            <dd>{data.draft ? 'Drawn' : 'Open'}</dd>
          </div>
        </dl>
      </section>

      <section className="dashboard-grid" aria-label="World Cup dashboard">
        <section className="panel dashboard-panel next-panel" aria-labelledby="next-heading">
          <div className="panel-heading">
            <h2 id="next-heading">Current Matches</h2>
          </div>
          <div className="match-card-list">
            {dashboardMatches.map((match) => (
              <article className={match.isLive ? 'mini-match-card live-mini-match-card' : 'mini-match-card'} key={match.id}>
                <div>
                  <strong>
                    <TeamNameWithFlag countryCode={match.teamA.countryCode} name={match.teamA.name} /> vs{' '}
                    <TeamNameWithFlag countryCode={match.teamB.countryCode} name={match.teamB.name} />
                  </strong>
                  <span>{match.players}</span>
                </div>
                <time dateTime={match.kickoff.toISOString()}>{formatDashboardKickoff(match.kickoff)}</time>
                <span className="mini-match-result">
                  {match.score ? <b>{match.score}</b> : null}
                  <em>{match.statusLabel}</em>
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="panel dashboard-panel favorites-panel" aria-labelledby="favorites-heading">
          <div className="panel-heading">
            <h2 id="favorites-heading">Tournament Favourites</h2>
          </div>
          <ol className="favorite-list">
            {favoriteTeams.map((team, index) => (
              <li key={team.id}>
                <span className="favorite-rank">{index + 1}</span>
                <strong>
                  <TeamNameWithFlag countryCode={team.countryCode} name={team.displayName} />
                </strong>
                <em>{formatOwners(team.owners)}</em>
                <span>{formatPercent(team.normalizedWinProbability)} win</span>
                <b>{team.currentPoints} pts</b>
              </li>
            ))}
          </ol>
        </section>
      </section>

      <section className="panel odds-panel" aria-labelledby="odds-heading">
        <div className="panel-heading">
          <h2 id="odds-heading">Team Win Probability Board</h2>
          <span className="panel-note">{data.activeTeams.length} active teams</span>
        </div>
        <div className="odds-grid">
          {oddsGroups.map((group) => (
            <article className="odds-group" key={group.name}>
              <h3>{group.name}</h3>
              <ul>
                {group.teams.map((team) => (
                  <li key={team.id}>
                    <span>
                      <TeamNameWithFlag countryCode={team.countryCode} name={team.displayName} />
                    </span>
                    <strong>{formatPercent(team.normalizedWinProbability)}</strong>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <Leaderboard rows={rows} />
    </main>
  );
}

type DashboardTeam = {
  id: string;
  countryCode: string;
  displayName: string;
  groupName: string | null;
  decimalOdds: number;
  currentPoints: number;
  normalizedWinProbability: number;
  owners: string[];
};

function groupTeamsByGroup(teams: DashboardTeam[]) {
  const groupsByName = new Map<string, DashboardTeam[]>();

  for (const team of teams) {
    const groupName = team.groupName ?? 'Ungrouped';
    groupsByName.set(groupName, [...(groupsByName.get(groupName) ?? []), team]);
  }

  return [...groupsByName.entries()].map(([name, groupTeams]) => ({
    name,
    teams: groupTeams.sort(compareTeamOdds),
  }));
}

function compareTeamOdds(left: DashboardTeam, right: DashboardTeam) {
  const oddsDifference = right.normalizedWinProbability - left.normalizedWinProbability;

  if (oddsDifference !== 0) {
    return oddsDifference;
  }

  return left.displayName.localeCompare(right.displayName);
}

function formatOwners(owners: string[]): string {
  return owners.length > 0 ? owners.join(' / ') : 'Unassigned';
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: 'percent',
  }).format(value);
}

function formatDashboardKickoff(kickoff: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(kickoff);
}
