import { TeamNameWithFlag } from './country-flag';

export type BracketTeam = {
  name: string;
  countryCode?: string | null;
  description?: string | null;
  score?: number | null;
  players?: string | null;
};

export type BracketMatch = {
  id: string;
  label: string;
  kickoff?: Date | string | null;
  venue?: string | null;
  teamA?: BracketTeam | null;
  teamB?: BracketTeam | null;
  winner?: string | null;
  status?: string;
};

export type BracketStageGroup = {
  stage: string;
  matches: BracketMatch[];
};

type BracketViewProps = {
  groups: BracketStageGroup[];
};

export function BracketView({ groups }: BracketViewProps) {
  if (groups.length === 0) {
    return (
      <section className="panel" aria-labelledby="bracket-heading">
        <div className="panel-heading">
          <h2 id="bracket-heading">Bracket</h2>
        </div>
        <p className="empty-state">Bracket matches will appear once the knockout schedule is available.</p>
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="bracket-heading">
      <div className="panel-heading">
        <h2 id="bracket-heading">Bracket</h2>
      </div>
      <div className="bracket-scroll">
        <div className="bracket-grid">
          {groups.map((group) => (
            <section className="bracket-stage" key={group.stage} aria-label={group.stage}>
              <h3>{group.stage}</h3>
              <div className="bracket-matches">
                {group.matches.map((match) => (
                  <article className="bracket-match" key={match.id}>
                    <div className="bracket-match-label">
                      <div className="bracket-match-heading">
                        <span className="bracket-match-title">{match.label}</span>
                        {match.status ? <span className="status-pill">{formatStatus(match.status)}</span> : null}
                      </div>
                      {formatMatchMeta(match) ? <span className="match-kickoff">{formatMatchMeta(match)}</span> : null}
                    </div>
                    <BracketTeamRow team={match.teamA} winner={match.winner} />
                    <BracketTeamRow team={match.teamB} winner={match.winner} />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatMatchMeta(match: BracketMatch): string | null {
  const parts = [match.kickoff ? formatMatchKickoff(match.kickoff) : null, match.venue].filter(Boolean);

  return parts.length > 0 ? parts.join(' / ') : null;
}

function BracketTeamRow({ team, winner }: { team?: BracketTeam | null; winner?: string | null }) {
  const teamName = team?.name ?? 'TBD';
  const players = team?.players;
  const secondaryLabel = players ?? team?.description;
  const isWinner = winner != null && teamName === winner;

  return (
    <div className={isWinner ? 'bracket-team winner' : 'bracket-team'}>
      <span>
        <strong>
          <TeamNameWithFlag countryCode={team?.countryCode} name={teamName} />
        </strong>
        {secondaryLabel ? <span className="bracket-team-players">{secondaryLabel}</span> : null}
      </span>
      <strong>{team?.score ?? '-'}</strong>
    </div>
  );
}

function formatMatchKickoff(kickoff: Date | string): string {
  const kickoffDate = typeof kickoff === 'string' ? new Date(kickoff) : kickoff;
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(kickoffDate);
}

function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
