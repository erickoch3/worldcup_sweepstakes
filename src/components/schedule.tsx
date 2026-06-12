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
  teamA?: ScheduleTeam;
  teamB?: ScheduleTeam;
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
  const { previousMatches, upcomingMatches } = partitionScheduleMatches(matches, now);
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
    <li className={isNext ? 'schedule-row next-match' : 'schedule-row'}>
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
      </div>
      <div className="schedule-status">
        {isNext ? <span className="status-pill next-pill">Next</span> : null}
        <span className="status-pill">{formatStatus(match.status)}</span>
      </div>
    </li>
  );
}

export function partitionScheduleMatches(matches: ScheduleMatch[], now: Date | string = new Date()) {
  const referenceTime = parseScheduleDate(now).getTime();
  const previousMatches: ScheduleMatch[] = [];
  const upcomingMatches: ScheduleMatch[] = [];

  for (const match of matches) {
    const kickoffTime = parseScheduleDate(match.kickoff).getTime();

    if (match.status !== 'LIVE' && kickoffTime < referenceTime) {
      previousMatches.push(match);
    } else {
      upcomingMatches.push(match);
    }
  }

  return { previousMatches, upcomingMatches };
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

function formatMatchCount(count: number): string {
  return count === 1 ? '1 match' : `${count} matches`;
}

function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
