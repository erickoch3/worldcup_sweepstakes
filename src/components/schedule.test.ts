// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ScheduleList, ScoresList, groupScheduleMatchesByDay, partitionScheduleMatches } from './schedule';

afterEach(() => {
  cleanup();
});

describe('groupScheduleMatchesByDay', () => {
  it('groups matches by London calendar day while preserving match order', () => {
    const groups = groupScheduleMatchesByDay([
      {
        id: 'match-1',
        kickoff: '2026-06-11T19:00:00.000Z',
        label: 'Mexico vs South Africa',
        players: 'James vs Eric',
        stage: 'Group A',
        status: 'SCHEDULED',
      },
      {
        id: 'match-2',
        kickoff: '2026-06-12T02:00:00.000Z',
        label: 'Korea Republic vs Czechia',
        players: 'Sarah vs Jamie',
        stage: 'Group A',
        status: 'SCHEDULED',
      },
      {
        id: 'match-3',
        kickoff: '2026-06-12T19:00:00.000Z',
        label: 'Canada vs Bosnia and Herzegovina',
        players: 'Alex vs Sam',
        stage: 'Group B',
        status: 'SCHEDULED',
      },
    ]);

    expect(groups).toEqual([
      {
        key: 'Thursday, 11 Jun 2026',
        label: 'Thursday, 11 Jun 2026',
        matches: [expect.objectContaining({ id: 'match-1' })],
      },
      {
        key: 'Friday, 12 Jun 2026',
        label: 'Friday, 12 Jun 2026',
        matches: [
          expect.objectContaining({ id: 'match-2' }),
          expect.objectContaining({ id: 'match-3' }),
        ],
      },
    ]);
  });
});

describe('partitionScheduleMatches', () => {
  it('splits previous matches from upcoming matches while preserving order', () => {
    const { previousMatches, upcomingMatches } = partitionScheduleMatches(
      [
        {
          id: 'past-1',
          kickoff: '2026-06-11T19:00:00.000Z',
          label: 'Mexico vs South Africa',
          players: 'James vs Eric',
          stage: 'Group A',
          status: 'FINAL',
        },
        {
          id: 'next-1',
          kickoff: '2026-06-12T19:00:00.000Z',
          label: 'Canada vs Bosnia and Herzegovina',
          players: 'Alex vs Sam',
          stage: 'Group B',
          status: 'SCHEDULED',
        },
        {
          id: 'next-2',
          kickoff: '2026-06-13T02:00:00.000Z',
          label: 'Korea Republic vs Czechia',
          players: 'Sarah vs Jamie',
          stage: 'Group A',
          status: 'SCHEDULED',
        },
      ],
      '2026-06-12T12:00:00.000Z',
    );

    expect(previousMatches.map((match) => match.id)).toEqual(['past-1']);
    expect(upcomingMatches.map((match) => match.id)).toEqual(['next-1', 'next-2']);
  });

  it('keeps live matches visible even after kickoff', () => {
    const { liveMatches, previousMatches, upcomingMatches } = partitionScheduleMatches(
      [
        {
          id: 'live-1',
          kickoff: '2026-06-12T11:00:00.000Z',
          label: 'Live Match',
          players: 'James vs Eric',
          stage: 'Group A',
          status: 'LIVE',
        },
      ],
      '2026-06-12T12:00:00.000Z',
    );

    expect(liveMatches.map((match) => match.id)).toEqual(['live-1']);
    expect(previousMatches).toEqual([]);
    expect(upcomingMatches).toEqual([]);
  });

  it('separates live matches from upcoming matches regardless of kickoff ordering', () => {
    const { liveMatches, previousMatches, upcomingMatches } = partitionScheduleMatches(
      [
        {
          id: 'next-1',
          kickoff: '2026-06-12T19:00:00.000Z',
          label: 'Upcoming Match',
          players: 'Alex vs Sam',
          stage: 'Group B',
          status: 'SCHEDULED',
        },
        {
          id: 'live-1',
          kickoff: '2026-06-12T11:00:00.000Z',
          label: 'Live Match',
          players: 'James vs Eric',
          stage: 'Group A',
          status: 'LIVE',
        },
      ],
      '2026-06-12T12:00:00.000Z',
    );

    expect(liveMatches.map((match) => match.id)).toEqual(['live-1']);
    expect(previousMatches).toEqual([]);
    expect(upcomingMatches.map((match) => match.id)).toEqual(['next-1']);
  });
});

describe('ScheduleList', () => {
  it('shows upcoming matches by default and keeps previous matches collapsed', () => {
    const { container } = render(
      createElement(ScheduleList, {
        now: '2026-06-12T12:00:00.000Z',
        matches: [
          {
            id: 'past-1',
            kickoff: '2026-06-11T19:00:00.000Z',
            label: 'Mexico vs South Africa',
            players: 'James vs Eric',
            stage: 'Group A',
            status: 'FINAL',
          },
          {
            id: 'next-1',
            kickoff: '2026-06-12T19:00:00.000Z',
            label: 'Canada vs Bosnia and Herzegovina',
            players: 'Alex vs Sam',
            stage: 'Group B',
            status: 'SCHEDULED',
          },
        ],
      }),
    );

    expect(screen.getByRole('heading', { name: 'Upcoming matches' })).toBeTruthy();
    expect(screen.getByText('Canada vs Bosnia and Herzegovina')).toBeTruthy();

    const previousMatches = container.querySelector('details.previous-matches');
    expect(previousMatches).toBeTruthy();
    expect(previousMatches?.hasAttribute('open')).toBe(false);
    expect(screen.getByText('Previous matches (1)')).toBeTruthy();
  });

  it('shows scores for live and final matches', () => {
    render(
      createElement(ScheduleList, {
        now: '2026-06-12T12:00:00.000Z',
        matches: [
          {
            id: 'live-1',
            kickoff: '2026-06-12T11:00:00.000Z',
            label: 'Canada vs Mexico',
            players: 'Alex vs James',
            stage: 'Group A',
            status: 'LIVE',
            teamAScore: 1,
            teamBScore: 0,
          },
          {
            id: 'final-1',
            kickoff: '2026-06-11T19:00:00.000Z',
            label: 'Brazil vs France',
            players: 'Sam vs Jamie',
            stage: 'Group B',
            status: 'FINAL',
            teamAScore: 2,
            teamBScore: 2,
            penaltySummary: 'Brazil win 5-4 on penalties',
          },
        ],
      }),
    );

    expect(screen.getByText('1-0')).toBeTruthy();
    expect(screen.getByText('2-2')).toBeTruthy();
    expect(screen.getByText('Brazil win 5-4 on penalties')).toBeTruthy();
  });

  it('shows ongoing matches with live scores before upcoming matches', () => {
    const { container } = render(
      createElement(ScheduleList, {
        now: '2026-06-12T12:00:00.000Z',
        matches: [
          {
            id: 'next-1',
            kickoff: '2026-06-12T19:00:00.000Z',
            label: 'Brazil vs Germany',
            players: 'Sam vs Jamie',
            stage: 'Group B',
            status: 'SCHEDULED',
          },
          {
            id: 'live-1',
            kickoff: '2026-06-12T11:00:00.000Z',
            label: 'Canada vs Mexico',
            players: 'Alex vs James',
            stage: 'Group A',
            status: 'LIVE',
            teamAScore: 1,
            teamBScore: 0,
          },
        ],
      }),
    );

    const pageText = container.textContent ?? '';

    expect(screen.getByRole('heading', { name: 'Ongoing matches' })).toBeTruthy();
    expect(screen.getByText('1-0')).toBeTruthy();
    expect(pageText.indexOf('Canada vs Mexico')).toBeLessThan(pageText.indexOf('Brazil vs Germany'));
  });
});

describe('ScoresList', () => {
  it('lists completed matches with winner and score details', () => {
    render(
      createElement(ScoresList, {
        matches: [
          {
            id: 'final-1',
            kickoff: '2026-06-11T19:00:00.000Z',
            label: 'Brazil vs France',
            players: 'Sam vs Jamie',
            stage: 'Final',
            status: 'FINAL',
            teamAScore: 2,
            teamBScore: 1,
            winnerName: 'Brazil',
          },
          {
            id: 'final-2',
            kickoff: '2026-06-10T19:00:00.000Z',
            label: 'Canada vs Mexico',
            players: 'Alex vs James',
            stage: 'Group A',
            status: 'FINAL',
            teamAScore: 1,
            teamBScore: 1,
            penaltySummary: 'Canada win 4-3 on penalties',
            winnerName: 'Canada',
          },
        ],
      }),
    );

    expect(screen.getByRole('heading', { name: 'Scores' })).toBeTruthy();
    expect(screen.getByText('Brazil vs France')).toBeTruthy();
    expect(screen.getByText('Brazil won')).toBeTruthy();
    expect(screen.getByText('2-1')).toBeTruthy();
    expect(screen.getByText('Canada win 4-3 on penalties')).toBeTruthy();
  });

  it('shows live matches as live results before completed matches', () => {
    const { container } = render(
      createElement(ScoresList, {
        matches: [
          {
            id: 'live-1',
            kickoff: '2026-06-12T19:00:00.000Z',
            label: 'Canada vs Mexico',
            players: 'Alex vs James',
            stage: 'Group A',
            status: 'LIVE',
            teamAScore: 1,
            teamBScore: 0,
          },
          {
            id: 'final-1',
            kickoff: '2026-06-11T19:00:00.000Z',
            label: 'Brazil vs France',
            players: 'Sam vs Jamie',
            stage: 'Final',
            status: 'FINAL',
            teamAScore: 2,
            teamBScore: 1,
            winnerName: 'Brazil',
          },
        ],
      }),
    );

    const pageText = container.textContent ?? '';

    expect(screen.getByText('1-0')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
    expect(pageText.indexOf('Canada vs Mexico')).toBeLessThan(pageText.indexOf('Brazil vs France'));
  });

  it('shows an empty state when no completed games exist', () => {
    render(createElement(ScoresList, { matches: [] }));

    expect(screen.getByText('No completed games yet.')).toBeTruthy();
  });
});
