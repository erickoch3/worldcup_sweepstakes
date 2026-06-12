'use client';

import type { FormEvent } from 'react';

type DeleteSubmissionButtonProps = {
  action: (formData: FormData) => Promise<void>;
  playerName: string;
  submissionId: string;
};

export function DeleteSubmissionButton({
  action,
  playerName,
  submissionId,
}: DeleteSubmissionButtonProps) {
  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(`Delete ${playerName}'s draft preference submission?`)) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} className="compact-form" onSubmit={confirmDelete}>
      <input name="submissionId" type="hidden" value={submissionId} />
      <button className="button button-danger" type="submit">
        Delete
      </button>
    </form>
  );
}
