// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { ScheduleList, groupScheduleMatchesByDay, partitionScheduleMatches } from './schedule';

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
    const { previousMatches, upcomingMatches } = partitionScheduleMatches(
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

    expect(previousMatches).toEqual([]);
    expect(upcomingMatches.map((match) => match.id)).toEqual(['live-1']);
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
});
