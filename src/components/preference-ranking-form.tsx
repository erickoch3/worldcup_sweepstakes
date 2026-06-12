'use client';

import { useMemo, useState, type DragEvent } from 'react';

import { Button } from './forms';

type Team = {
  id: string;
  displayName: string;
};

type PreferenceRankingFormProps = {
  action: (formData: FormData) => Promise<void>;
  initialTeamIds: string[];
  submitLabel?: string;
  teams: Team[];
  title: string;
};

export function PreferenceRankingForm({
  action,
  initialTeamIds,
  submitLabel = 'Submit preferences',
  teams,
  title,
}: PreferenceRankingFormProps) {
  const teamNamesById = useMemo(
    () => new Map(teams.map((team) => [team.id, team.displayName])),
    [teams],
  );
  const normalizedInitialTeamIds = useMemo(() => {
    const teamOrder = initialTeamIds.filter((teamId) => teamNamesById.has(teamId));
    const uniqueTeamIds = [...new Set(teamOrder)];
    const missingTeams = teams.filter((team) => !teamOrder.includes(team.id)).map((team) => team.id);

    return [...uniqueTeamIds, ...missingTeams];
  }, [initialTeamIds, teams, teamNamesById]);
  const [orderedTeamIds, setOrderedTeamIds] = useState(normalizedInitialTeamIds);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      return;
    }

    const nextOrder = [...orderedTeamIds];
    const [movedTeamId] = nextOrder.splice(dragIndex, 1);
    nextOrder.splice(index, 0, movedTeamId);
    setOrderedTeamIds(nextOrder);
    setDragIndex(null);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    scrollWindowNearViewportEdge(event.clientY);
  }

  function moveToRank(teamId: string, rank: number) {
    setOrderedTeamIds((currentTeamIds) => moveTeamIdToRank(currentTeamIds, teamId, rank));
  }

  function moveUp(index: number) {
    if (index <= 0) {
      return;
    }

    const nextOrder = [...orderedTeamIds];
    [nextOrder[index - 1], nextOrder[index]] = [nextOrder[index], nextOrder[index - 1]];
    setOrderedTeamIds(nextOrder);
  }

  function moveDown(index: number) {
    if (index >= orderedTeamIds.length - 1) {
      return;
    }

    const nextOrder = [...orderedTeamIds];
    [nextOrder[index + 1], nextOrder[index]] = [nextOrder[index], nextOrder[index + 1]];
    setOrderedTeamIds(nextOrder);
  }

  return (
    <form action={action} className="empty-state page-stack preference-form">
      <p>{title}</p>
      <div className="preference-list" onDragOver={handleDragOver}>
        {orderedTeamIds.map((teamId, index) => {
          const name = teamNamesById.get(teamId);

          return (
            <div
              className="preference-list-item"
              draggable
              key={teamId}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={handleDragOver}
              onDragStart={() => handleDragStart(index)}
              onDrop={() => handleDrop(index)}
              role="listitem"
              tabIndex={0}
              aria-label={`Move ${name ?? teamId} to a different position`}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  moveUp(index);
                  return;
                }

                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  moveDown(index);
                }
              }}
            >
              <label className="preference-rank" aria-label={`Rank for ${name ?? teamId}`}>
                <span>{index + 1}</span>
                <select
                  value={index + 1}
                  onChange={(event) => moveToRank(teamId, Number(event.target.value))}
                  onClick={(event) => event.stopPropagation()}
                >
                  {orderedTeamIds.map((rankedTeamId, rankIndex) => (
                    <option key={rankedTeamId} value={rankIndex + 1}>
                      {rankIndex + 1}
                    </option>
                  ))}
                </select>
              </label>
              <span className="preference-team">{name ?? teamId}</span>
              <span className="preference-drag-handle" aria-hidden="true">
                ⋮⋮
              </span>
            </div>
          );
        })}
      </div>

      {orderedTeamIds.map((teamId, index) => (
        <input key={`team-${index + 1}`} name={`team-${index + 1}`} type="hidden" value={teamId} />
      ))}

      <div>
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function moveTeamIdToRank(teamIds: string[], teamId: string, rank: number): string[] {
  const currentIndex = teamIds.indexOf(teamId);
  const nextIndex = rank - 1;

  if (currentIndex === -1 || nextIndex < 0 || nextIndex >= teamIds.length) {
    return teamIds;
  }

  const nextTeamIds = [...teamIds];
  const [movedTeamId] = nextTeamIds.splice(currentIndex, 1);
  nextTeamIds.splice(nextIndex, 0, movedTeamId);

  return nextTeamIds;
}

function scrollWindowNearViewportEdge(clientY: number) {
  const edgeDistance = 96;
  const scrollStep = 22;

  if (clientY < edgeDistance) {
    window.scrollBy({ top: -scrollStep, behavior: 'auto' });
    return;
  }

  if (clientY > window.innerHeight - edgeDistance) {
    window.scrollBy({ top: scrollStep, behavior: 'auto' });
  }
}
