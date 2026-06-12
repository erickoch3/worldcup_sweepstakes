'use client';

import { useState } from 'react';

import { Button } from '@/components/forms';
import { allocateAssignmentBuyIns } from '@/domain/buy-ins';
import { computeDraftAssignments, DraftAssignment, DraftSubmission, DraftTeam } from '@/domain/draft';

type TestDraftChoice = {
  teamId: string;
  teamName: string;
  decimalOdds: number;
};

type TestDraftSubmission = {
  userId: string;
  userName: string;
  createdAt: string;
  choices: TestDraftChoice[];
};

type TestDraftPanelProps = {
  submissions: TestDraftSubmission[];
};

type SimulatedAssignment = DraftAssignment & {
  teamName: string;
  playerName: string;
  buyInPence: number;
};

type SimulatedRosterItem = {
  teamName: string;
  shareLabel: string;
  winProbability: number;
};

type TestDraftResult = {
  assignments: SimulatedAssignment[];
  userTotals: {
    userId: string;
    userName: string;
    roster: SimulatedRosterItem[];
    winProbability: number;
    buyInPence: number;
    shares: number;
    impliedDecimalOdds: number | null;
  }[];
  unassignedUserIds: string[];
  createdAt: string;
};

export function TestDraftPanel({ submissions }: TestDraftPanelProps) {
  const [result, setResult] = useState<TestDraftResult | null>(null);
  const [error, setError] = useState('');

  function runSimulation() {
    setError('');

    if (submissions.length === 0) {
      setError('No preference submissions exist.');
      setResult(null);
      return;
    }

    try {
      const submissionsByPlayer: DraftSubmission[] = submissions.map((submission) => ({
        userId: submission.userId,
        submittedAt: new Date(submission.createdAt),
        teamIdsByRank: submission.choices.map((choice) => choice.teamId),
      }));
      const teamsById = new Map<string, { teamName: string; decimalOdds: number }>();

      for (const submission of submissions) {
        for (const choice of submission.choices) {
          if (!teamsById.has(choice.teamId)) {
            teamsById.set(choice.teamId, {
              teamName: choice.teamName,
              decimalOdds: choice.decimalOdds,
            });
          }
        }
      }

      const teams: DraftTeam[] = [...teamsById.entries()].map(([id, { decimalOdds }]) => ({
        id,
        decimalOdds,
      }));

      const draftResult = computeDraftAssignments({
        rng: Math.random,
        teams,
        submissions: submissionsByPlayer,
      });

      const assignmentBuyIns = allocateAssignmentBuyIns({
        assignments: draftResult.assignments,
        targetWinProbability: draftResult.targetWinProbability,
        userTotals: draftResult.userTotals,
      });

      const userNameById = new Map(submissions.map((submission) => [submission.userId, submission.userName]));

      const assignments: SimulatedAssignment[] = draftResult.assignments.map((assignment, index) => ({
        ...assignment,
        teamName: teamsById.get(assignment.teamId)?.teamName ?? assignment.teamId,
        playerName: userNameById.get(assignment.userId) ?? 'Unknown participant',
        buyInPence: assignmentBuyIns[index] ?? 0,
      }));

      const userTotals = draftResult.userTotals
        .map((userTotal) => {
          const userAssignments = assignments.filter((assignment) => assignment.userId === userTotal.userId);
          const buyInPence = userAssignments.reduce((runningTotal, assignment) => runningTotal + assignment.buyInPence, 0);
          const shares = userAssignments.length;
          const winProbability = calculateTotalWinProbability(userAssignments);
          const roster = userAssignments.map((assignment) => ({
            teamName: assignment.teamName,
            shareLabel: formatShare(assignment.teamShareIndex, assignment.teamShareCount),
            winProbability: assignment.normalizedWinProbability,
          }));

          return {
            userId: userTotal.userId,
            userName: userNameById.get(userTotal.userId) ?? 'Unknown participant',
            roster,
            winProbability,
            buyInPence,
            shares,
            impliedDecimalOdds: winProbability > 0 ? 1 / winProbability : null,
          };
        })
        .sort((left, right) => right.winProbability - left.winProbability);

      const unassignedUserNames = draftResult.unassignedUserIds
        .map((userId) => userNameById.get(userId) ?? 'Unknown participant')
        .filter((name, index, all) => all.indexOf(name) === index)
        .filter((name) => name.trim().length > 0);

      setResult({
        assignments,
        userTotals,
        unassignedUserIds: unassignedUserNames,
        createdAt: new Date().toLocaleString(),
      });
    } catch (caughtError) {
      console.error(caughtError);
      setError('Unable to simulate draft with the current submissions.');
      setResult(null);
    }
  }

  if (submissions.length === 0) {
    return <p className="draft-test-note">No preference submissions to test draft.</p>;
  }

  return (
    <div className="test-draft-panel">
      <Button type="button" variant="secondary" onClick={runSimulation}>
        Test draft
      </Button>
      {error ? <p className="draft-test-note draft-test-note-error">{error}</p> : null}
      {result === null ? (
        <p className="draft-test-note">Run a draft test to preview a temporary simulation.</p>
      ) : (
        <div className="draft-simulation-results page-stack">
          <h3 style={{ margin: '0.5rem 0 0' }}>Projected draft standings (temporary)</h3>
          <div className="table-scroll">
            <table className="data-table">
              <caption style={{ textAlign: 'left' }}>
                Simulated at {result.createdAt} with {submissions.length} submissions.
              </caption>
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
                {result.assignments.map((assignment) => (
                  <tr key={`${assignment.userId}-${assignment.pickNumber}`}>
                    <td className="rank-cell">{assignment.pickNumber ?? '-'}</td>
                    <td>{assignment.playerName}</td>
                    <td>{assignment.teamName}</td>
                    <td>{formatShare(assignment.teamShareIndex, assignment.teamShareCount)}</td>
                    <td className="numeric-cell">{formatPercent(assignment.normalizedWinProbability)}</td>
                    <td className="numeric-cell">{assignment.preferenceRankWon ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ margin: '0.5rem 0 0' }}>Projected player standings</h3>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col">Roster</th>
                  <th scope="col" className="numeric-cell">
                    Total chance to win
                  </th>
                  <th scope="col" className="numeric-cell">
                    Total buy-in
                  </th>
                  <th scope="col">Shares</th>
                </tr>
              </thead>
              <tbody>
                {result.userTotals.map((userTotal) => (
                  <tr key={userTotal.userId}>
                    <td>{userTotal.userName}</td>
                    <td>
                      {userTotal.roster.length === 0 ? (
                        '-'
                      ) : (
                        <ul className="draft-roster-list">
                          {userTotal.roster.map((rosterItem) => (
                            <li key={`${userTotal.userId}-${rosterItem.teamName}-${rosterItem.shareLabel}`}>
                              <span className="draft-roster-team">{rosterItem.teamName}</span>
                              <span className="draft-roster-meta">
                                {rosterItem.shareLabel} · {formatPercent(rosterItem.winProbability)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="numeric-cell">{formatPercent(userTotal.winProbability)}</td>
                    <td className="numeric-cell">{formatPounds(userTotal.buyInPence)}</td>
                    <td>{userTotal.shares}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.unassignedUserIds.length > 0 ? (
            <p className="empty-state">Unassigned players: {result.unassignedUserIds.join(', ')}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function formatShare(shareIndex: number, shareCount: number): string {
  return shareCount > 1 ? `${shareIndex}/${shareCount}` : 'Whole team';
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'percent',
  }).format(value);
}

function formatPounds(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

function calculateTotalWinProbability(assignments: Array<Pick<DraftAssignment, 'normalizedWinProbability'>>): number {
  return assignments.reduce((runningTotal, assignment) => runningTotal + Math.max(0, assignment.normalizedWinProbability), 0);
}
