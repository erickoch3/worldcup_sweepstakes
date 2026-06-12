import { BracketView } from '@/components/bracket';
import { AuthGate } from '@/components/auth-gate';
import { getCurrentSession } from '@/auth/session';
import { getBracketData } from '@/server/queries/bracket';

export default async function BracketPage() {
  const session = await getCurrentSession();

  if (!session?.user.email) {
    return <AuthGate callbackUrl="/bracket" />;
  }

  const groups = await getBracketData();

  return (
    <main className="page-shell page-stack">
      <BracketView groups={groups} />
    </main>
  );
}
