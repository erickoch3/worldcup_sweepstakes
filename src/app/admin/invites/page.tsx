import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { requireAdmin } from '@/auth/session';
import { Button, TextField } from '@/components/forms';
import { prisma } from '@/lib/prisma';
import { createInviteAction } from '@/server/actions/invites';
import { createTestUserSessionAction } from '@/server/actions/test-users';

const NEW_INVITE_TOKEN_COOKIE = 'newInviteToken';

export default async function InvitesPage() {
  await requireAdmin('/admin/invites');

  const [cookieStore, invites] = await Promise.all([
    cookies(),
    prisma.invite.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        usedBy: true,
      },
    }),
  ]);
  const createdToken = cookieStore.get(NEW_INVITE_TOKEN_COOKIE)?.value ?? null;
  const createdInvitePath = createdToken ? `/register/${encodeURIComponent(createdToken)}` : null;
  const testUserActionEnabled = process.env.ENABLE_TEST_USER_ACTION === 'true';

  async function createInvite(formData: FormData) {
    'use server';

    const { token } = await createInviteAction(formData);
    const serverCookies = await cookies();

    serverCookies.set(NEW_INVITE_TOKEN_COOKIE, token, {
      httpOnly: true,
      maxAge: 300,
      path: '/admin/invites',
      sameSite: 'lax',
    });

    redirect('/admin/invites');
  }

  return (
    <main className="page-shell page-stack">
      <section className="panel" aria-labelledby="create-invite-heading">
        <div className="panel-heading">
          <h2 id="create-invite-heading">Create Invite</h2>
        </div>
        <form action={createInvite} className="empty-state page-stack">
          {createdInvitePath ? (
            <p>
              New invite link:{' '}
              <a href={createdInvitePath}>
                <strong>{createdInvitePath}</strong>
              </a>
            </p>
          ) : null}

          <TextField label="Label" name="label" placeholder="e.g. Alex" />
          <TextField
            hint="Leave blank for a reusable self-serve invite."
            label="Intended email"
            name="intendedEmail"
            placeholder="person@example.com"
            type="email"
          />
          <TextField
            hint="Blank self-serve invites expire in 24 hours if this is empty."
            label="Expires at"
            name="expiresAt"
            type="datetime-local"
          />

          <div>
            <Button type="submit" variant="primary">
              Create invite
            </Button>
          </div>
        </form>
      </section>

      {testUserActionEnabled ? (
        <section className="panel" aria-labelledby="test-user-heading">
          <div className="panel-heading">
            <h2 id="test-user-heading">Create Test User</h2>
          </div>
          <form action={createTestUserSessionAction} className="empty-state page-stack">
            <TextField label="Name" name="name" placeholder="Test Player 1" />
            <TextField
              hint="Use a unique alias such as you+wc-test-1@example.com."
              label="Email"
              name="email"
              placeholder="you+wc-test-1@example.com"
              required
              type="email"
            />
            <div>
              <Button type="submit" variant="secondary">
                Create and switch
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="panel" aria-labelledby="invites-heading">
        <div className="panel-heading">
          <h2 id="invites-heading">Existing Invites</h2>
        </div>
        {invites.length === 0 ? (
          <p className="empty-state">No invites created.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Label</th>
                  <th scope="col">Intended email</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Status</th>
                  <th scope="col">Uses</th>
                  <th scope="col">Used by</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => {
                  const status = getInviteStatus(invite);

                  return (
                    <tr key={invite.id}>
                      <td>{invite.label ?? 'Unlabelled'}</td>
                      <td>{invite.intendedEmail ?? '-'}</td>
                      <td>{formatDateTime(invite.expiresAt)}</td>
                      <td>{status}</td>
                      <td>
                        {invite.maxUses === null ? `${invite.useCount} / unlimited` : `${invite.useCount} / ${invite.maxUses}`}
                      </td>
                      <td>{invite.usedBy?.name ?? invite.usedBy?.email ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function getInviteStatus(
  invite: {
    expiresAt: Date | null;
    maxUses: number | null;
    useCount: number;
    usedAt: Date | null;
  },
): string {
  if (invite.expiresAt !== null && invite.expiresAt < new Date()) {
    return 'Expired';
  }

  if (invite.maxUses !== null && invite.useCount >= invite.maxUses && invite.usedAt !== null) {
    return `Used ${formatDateTime(invite.usedAt)}`;
  }

  return 'Active';
}

function formatDateTime(value: Date | null): string {
  if (value === null) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}
