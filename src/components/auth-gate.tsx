import { normalizeCallbackUrl } from '@/auth/login';
import { GoogleSignInButton } from '@/components/google-sign-in-button';

type AuthGateProps = {
  callbackUrl?: string;
  errorMessage?: string | null;
};

export function AuthGate({ callbackUrl = '/', errorMessage = null }: AuthGateProps) {
  const normalizedCallbackUrl = normalizeCallbackUrl(callbackUrl);

  return (
    <main className="page-shell page-stack">
      <section className="dashboard-summary auth-gate" aria-labelledby="auth-heading">
        <div className="summary-copy">
          <p className="summary-kicker">Private draw</p>
          <h1 id="auth-heading">World Cup Sweepstakes</h1>
        </div>
        <div className="auth-card" aria-label="Account access">
          {errorMessage ? <p className="auth-alert">{errorMessage}</p> : null}
          <div className="auth-block">
            <h2>Log in</h2>
            <p>Use the Google account attached to your sweepstakes account.</p>
            <GoogleSignInButton callbackUrl={normalizedCallbackUrl} />
          </div>
          <div className="auth-block">
            <h2>Create an account</h2>
            <p>Use your invite link to create an account.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
