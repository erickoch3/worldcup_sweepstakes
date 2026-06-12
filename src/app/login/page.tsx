import { redirect } from 'next/navigation';

import { getLoginErrorMessage, normalizeCallbackUrl } from '@/auth/login';
import { getCurrentSession } from '@/auth/session';
import { AuthGate } from '@/components/auth-gate';

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string | string[];
    error?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [session, params] = await Promise.all([getCurrentSession(), searchParams]);
  const callbackUrl = normalizeCallbackUrl(params.callbackUrl);

  if (session?.user.email) {
    redirect(callbackUrl);
  }

  return <AuthGate callbackUrl={callbackUrl} errorMessage={getLoginErrorMessage(params.error)} />;
}
