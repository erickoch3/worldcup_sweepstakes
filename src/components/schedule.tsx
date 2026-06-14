import { TeamNameWithFlag } from './country-flag';

export type ScheduleTeam = {
  countryCode?: string | null;
  name: string;
};

export type ScheduleMatch = {
  id: string;
  label: string;
  kickoff: Date | string;
  stage: string;
  status: string;
  players: string;
  penaltySummary?: string | null;
  teamAScore?: number | null;
  teamBScore?: number | null;
  teamA?: ScheduleTeam;
  teamB?: ScheduleTeam;
  winnerName?: string | null;
};

export type ScheduleDayGroup = {
  key: string;
  label: string;
  matches: ScheduleMatch[];
};

type ScheduleListProps = {
  matches: ScheduleMatch[];
  nextMatchId?: string | null;
  now?: Date | string;
};

const kickoffTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeStyle: 'short',
  timeZone: 'Europe/London',
});

export function ScheduleList({ matches, nextMatchId = null, now = new Date() }: ScheduleListProps) {
  const { liveMatches, previousMatches, upcomingMatches } = partitionScheduleMatches(matches, now);
  const liveDayGroups = groupScheduleMatchesByDay(liveMatches);
  const upcomingDayGroups = groupScheduleMatchesByDay(upcomingMatches);
  const previousDayGroups = groupScheduleMatchesByDay(previousMatches);

  if (matches.length === 0) {
    return (
      <section className="panel" aria-labelledby="schedule-heading">
        <div className="panel-heading">
          <h2 id="schedule-heading">Schedule</h2>
        </div>
        <p className="empty-state">No matches are scheduled yet.</p>
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="schedule-heading">
      <div className="panel-heading">
        <h2 id="schedule-heading">Schedule</h2>
      </div>
      <div className="schedule-days">
        {liveDayGroups.length > 0 ? (
          <section className="schedule-section" aria-label="Ongoing matches">
            <div className="schedule-section-heading">
              <h3>Ongoing matches</h3>
              <span>{formatMatchCount(liveMatches.length)}</span>
            </div>
            <ScheduleDayGroups dayGroups={liveDayGroups} nextMatchId={nextMatchId} />
          </section>
        ) : null}

        <section className="schedule-section" aria-label="Upcoming matches">
          <div className="schedule-section-heading">
            <h3>Upcoming matches</h3>
            <span>{formatMatchCount(upcomingMatches.length)}</span>
          </div>
          {upcomingDayGroups.length > 0 ? (
            <ScheduleDayGroups dayGroups={upcomingDayGroups} nextMatchId={nextMatchId} />
          ) : (
            <p className="empty-state schedule-empty">No upcoming matches are scheduled.</p>
          )}
        </section>

        {previousDayGroups.length > 0 ? (
          <details className="previous-matches">
            <summary>
              <span>Previous matches ({previousMatches.length})</span>
            </summary>
            <div className="previous-matches-body">
              <ScheduleDayGroups dayGroups={previousDayGroups} nextMatchId={nextMatchId} />
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}

type ScheduleDayGroupsProps = {
  dayGroups: ScheduleDayGroup[];
  nextMatchId?: string | null;
};

function ScheduleDayGroups({ dayGroups, nextMatchId = null }: ScheduleDayGroupsProps) {
  return (
    <>
      {dayGroups.map((group) => (
        <section className="schedule-day" key={group.key} aria-label={group.label}>
          <div className="schedule-day-heading">
            <h4>{group.label}</h4>
            <span>{formatMatchCount(group.matches.length)}</span>
          </div>
          <ol className="schedule-list">
            {group.matches.map((match) => (
              <ScheduleRow isNext={match.id === nextMatchId} key={match.id} match={match} />
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}

type ScheduleRowProps = {
  isNext: boolean;
  match: ScheduleMatch;
};

function ScheduleRow({ isNext, match }: ScheduleRowProps) {
  return (
    <li className={scheduleRowClassName(match, isNext)}>
      <div className="schedule-main">
        <span className="match-label">
          {match.teamA && match.teamB ? (
            <>
              <TeamNameWithFlag countryCode={match.teamA.countryCode} name={match.teamA.name} /> vs{' '}
              <TeamNameWithFlag countryCode={match.teamB.countryCode} name={match.teamB.name} />
            </>
          ) : (
            match.label
          )}
        </span>
        <span className="match-meta">
          {formatKickoffTime(match.kickoff)} / {match.stage}
        </span>
        <span className="match-players">{match.players}</span>
        {match.penaltySummary ? <span className="match-result-note">{match.penaltySummary}</span> : null}
      </div>
      <div className="schedule-status">
        {isNext ? <span className="status-pill next-pill">Next</span> : null}
        {hasScore(match) ? <span className="score-pill">{formatScore(match)}</span> : null}
        <span className={isLiveMatch(match) ? 'status-pill live-pill' : 'status-pill'}>{formatStatus(match.status)}</span>
      </div>
    </li>
  );
}

type ScoresListProps = {
  matches: ScheduleMatch[];
};

export function ScoresList({ matches }: ScoresListProps) {
  return (
    <section className="panel" aria-labelledby="scores-heading">
      <div className="panel-heading">
        <h2 id="scores-heading">Scores</h2>
        <span className="panel-note">{formatCompletedCount(matches.length)}</span>
      </div>
      {matches.length > 0 ? (
        <ol className="scores-list">
          {matches.map((match) => (
            <li className={isLiveMatch(match) ? 'score-row live-score-row' : 'score-row'} key={match.id}>
              <div className="score-main">
                <span className="match-label">
                  {match.teamA && match.teamB ? (
                    <>
                      <TeamNameWithFlag countryCode={match.teamA.countryCode} name={match.teamA.name} /> vs{' '}
                      <TeamNameWithFlag countryCode={match.teamB.countryCode} name={match.teamB.name} />
                    </>
                  ) : (
                    match.label
                  )}
                </span>
                <span className="match-meta">
                  {formatScoreKickoff(match.kickoff)} / {match.stage}
                </span>
                <span className="match-players">{match.players}</span>
                {match.penaltySummary ? <span className="match-result-note">{match.penaltySummary}</span> : null}
              </div>
              <div className="score-result">
                <strong>{formatScore(match)}</strong>
                <span>{formatWinner(match)}</span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty-state">No completed games yet.</p>
      )}
    </section>
  );
}

export function partitionScheduleMatches(matches: ScheduleMatch[], now: Date | string = new Date()) {
  const referenceTime = parseScheduleDate(now).getTime();
  const liveMatches: ScheduleMatch[] = [];
  const previousMatches: ScheduleMatch[] = [];
  const upcomingMatches: ScheduleMatch[] = [];

  for (const match of matches) {
    const kickoffTime = parseScheduleDate(match.kickoff).getTime();

    if (isLiveMatch(match)) {
      liveMatches.push(match);
    } else if (kickoffTime < referenceTime) {
      previousMatches.push(match);
    } else {
      upcomingMatches.push(match);
    }
  }

  return { liveMatches, previousMatches, upcomingMatches };
}

export function groupScheduleMatchesByDay(matches: ScheduleMatch[]): ScheduleDayGroup[] {
  const groups: ScheduleDayGroup[] = [];
  const groupsByKey = new Map<string, ScheduleDayGroup>();

  for (const match of matches) {
    const key = formatScheduleDay(match.kickoff);
    const existingGroup = groupsByKey.get(key);

    if (existingGroup) {
      existingGroup.matches.push(match);
      continue;
    }

    const group = {
      key,
      label: key,
      matches: [match],
    };
    groupsByKey.set(key, group);
    groups.push(group);
  }

  return groups;
}

function parseScheduleDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

function formatScheduleDay(kickoff: Date | string): string {
  const date = parseScheduleDate(kickoff);

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    weekday: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  }).format(date);
}

function formatKickoffTime(kickoff: Date | string): string {
  const date = parseScheduleDate(kickoff);

  return kickoffTimeFormatter.format(date);
}

function formatScoreKickoff(kickoff: Date | string): string {
  const date = parseScheduleDate(kickoff);

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(date);
}

function formatMatchCount(count: number): string {
  return count === 1 ? '1 match' : `${count} matches`;
}

function formatCompletedCount(count: number): string {
  return count === 1 ? '1 match' : `${count} matches`;
}

function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function hasScore(match: ScheduleMatch): boolean {
  return match.teamAScore != null && match.teamBScore != null;
}

function isLiveMatch(match: ScheduleMatch): boolean {
  return match.status === 'LIVE';
}

function scheduleRowClassName(match: ScheduleMatch, isNext: boolean): string {
  const classNames = ['schedule-row'];

  if (isNext) {
    classNames.push('next-match');
  }

  if (isLiveMatch(match)) {
    classNames.push('live-match');
  }

  return classNames.join(' ');
}

function formatScore(match: ScheduleMatch): string {
  if (!hasScore(match)) {
    return '-';
  }

  return `${match.teamAScore}-${match.teamBScore}`;
}

function formatWinner(match: ScheduleMatch): string {
  if (isLiveMatch(match)) {
    return 'Live';
  }

  if (match.winnerName) {
    return `${match.winnerName} won`;
  }

  if (hasScore(match) && match.teamAScore === match.teamBScore) {
    return 'Draw';
  }

  return 'Result pending';
}
