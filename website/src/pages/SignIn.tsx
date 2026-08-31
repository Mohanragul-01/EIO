/**
 * SignIn - email and password, against the same Supabase project as the phone.
 *
 * There is no separate web account: sign in with the credentials you already
 * use on your phone and you see the same rows, because Row Level Security
 * scopes everything to `auth.uid()` regardless of which client asked.
 */
import { useState, type FormEvent } from 'react';

import { isSupabaseConfigured } from '@app/core/supabase';
import { ErrorBanner, TextField } from '../components/ui';
import { useAuth } from '../lib/auth';

type Mode = 'signIn' | 'signUp';

export function SignIn() {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim()) return setError('Enter your email');
    // Matches the app's rule, which matches Supabase's own minimum.
    if (mode === 'signUp' && password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    setBusy(true);
    try {
      if (mode === 'signUp') {
        await signUp(email, password);
        // With email confirmation on, signUp returns no session and nothing
        // appears to happen. Saying so is better than a dead-looking form.
        setNotice('Account created. Check your email if confirmation is required, then sign in.');
        setMode('signIn');
      } else {
        await signIn(email, password);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card card-pad auth-card rise">
        <div className="row" style={{ marginBottom: 'var(--space-xl)' }}>
          <span className="brand-mark">EIO</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Everything in One</div>
            <div className="faint" style={{ fontSize: 12.5 }}>
              {mode === 'signIn' ? 'Sign in to your account' : 'Create an account'}
            </div>
          </div>
        </div>

        {!isSupabaseConfigured ? (
          <div className="banner" style={{ marginBottom: 'var(--space-lg)' }}>
            Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code> and fill
            in your project URL and anon key, then restart the dev server.
          </div>
        ) : null}

        <form onSubmit={submit} className="col" style={{ gap: 'var(--space-lg)' }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
          />

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            // Tells a password manager whether to offer a saved password or
            // to generate a new one.
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          />

          <ErrorBanner message={error} />
          {notice ? (
            <div
              className="banner"
              style={{
                borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)',
                background: 'color-mix(in srgb, var(--success) 12%, transparent)',
                color: 'var(--success)',
              }}
            >
              {notice}
            </div>
          ) : null}

          <button className="btn" type="submit" disabled={busy}>
            {busy ? <span className="spinner" /> : mode === 'signIn' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div style={{ marginTop: 'var(--space-lg)', textAlign: 'center' }}>
          <button
            className="btn-ghost"
            style={{ border: 0, background: 'none' }}
            onClick={() => {
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
              setError(null);
              setNotice(null);
            }}
          >
            {mode === 'signIn' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
