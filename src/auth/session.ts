import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from './options';

export function getCurrentSession() {
  return getServerSession(authOptions);
}

export async function requireUser(callbackUrl = '/') {
  const session = await getCurrentSession();

  if (!session?.user.email) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return session;
}

export async function requireAdmin(callbackUrl = '/admin') {
  const session = await requireUser(callbackUrl);

  if (!session.user.isAdmin) {
    redirect('/');
  }

  return session;
}
