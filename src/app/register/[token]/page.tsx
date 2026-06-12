import { getCurrentSession } from '@/auth/session';
import { PreferenceRankingForm } from '@/components/preference-ranking-form';
import { hashInviteToken, validateInvite } from '@/domain/invites';
import { prisma } from '@/lib/prisma';
import { submitPreferencesAction } from '@/server/actions/preferences';

type RegisterPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function RegisterPage({ params }: RegisterPageProps) {
  const { token } = await params;
  const [session, teams, invite] = await Promise.all([
    getCurrentSession(),
    prisma.team.findMany({
      where: { active: true },
      orderBy: { displayName: 'asc' },
    }),
    prisma.invite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      select: {
        intendedEmail: true,
        expiresAt: true,
        maxUses: true,
        useCount: true,
        usedAt: true,
        usedById: true,
      },
    }),
  ]);
  const isAdmin = session?.user.isAdmin ?? false;
  const existingSubmission = session?.user.id
    ? await prisma.preferenceSubmission.findUnique({
        where: { userId: session.user.id },
        select: {
          choices: {
            orderBy: { rank: 'asc' },
            select: { teamId: true },
          },
        },
      })
    : null;
  const inviteLinkError = getInviteLinkError(invite);

  if (inviteLinkError !== null && session?.user.email == null) {
    return (
      <main className="page-shell page-stack">
        <section className="panel" aria-labelledby="register-heading">
          <div className="panel-heading">
            <h2 id="register-heading">Register Preferences</h2>
          </div>
          <p className="empty-state">{inviteLinkError}</p>
        </section>
      </main>
    );
  }

  async function submitPreferences(formData: FormData) {
    'use server';

    await submitPreferencesAction(token, formData);
  }

  if (session?.user.email == null) {
    return (
      <main className="page-shell page-stack">
        <section className="panel" aria-labelledby="register-heading">
          <div className="panel-heading">
            <h2 id="register-heading">Register Preferences</h2>
          </div>
          <div className="empty-state page-stack">
            <p>Sign in with Google from this invite link to register your team preferences.</p>
            <p>
              <a className="button button-primary" href={`/register/${encodeURIComponent(token)}/start`}>
                Sign in with Google
              </a>
            </p>
          </div>
        </section>
      </main>
    );
  }

  const inviteValidation =
    invite === null
      ? { ok: false as const, reason: 'Invalid invite.' }
      : validateInvite({
          invite,
          email: session.user.email,
          now: new Date(),
          allowUsedById: session.user.id,
        });

  if (!isAdmin && !inviteValidation.ok) {
    return (
      <main className="page-shell page-stack">
        <section className="panel" aria-labelledby="register-heading">
          <div className="panel-heading">
            <h2 id="register-heading">Register Preferences</h2>
          </div>
          <p className="empty-state">{inviteValidation.reason}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell page-stack">
      <section className="panel" aria-labelledby="register-heading">
        <div className="panel-heading">
          <h2 id="register-heading">Register Preferences</h2>
        </div>
        <PreferenceRankingForm
          action={submitPreferences}
          initialTeamIds={existingSubmission?.choices.map((choice) => choice.teamId) ?? []}
          submitLabel={existingSubmission ? 'Save preferences' : 'Submit preferences'}
          teams={teams}
          title="Rank all active teams to enter the draft."
        />
      </section>
    </main>
  );
}

function getInviteLinkError(
  invite: {
    expiresAt: Date | null;
    maxUses: number | null;
    useCount: number;
    usedAt: Date | null;
  } | null,
): string | null {
  if (invite === null) {
    return 'Invalid invite.';
  }

  if (invite.maxUses !== null && invite.useCount >= invite.maxUses && invite.usedAt !== null) {
    return 'Invite has already been used.';
  }

  if (invite.expiresAt !== null && invite.expiresAt <= new Date()) {
    return 'Invite has expired.';
  }

  return null;
}
