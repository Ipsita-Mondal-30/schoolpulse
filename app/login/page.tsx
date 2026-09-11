'use client';

import { FormEvent, useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/homework';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (result?.error) {
        setError('Invalid email or password.');
        setPending(false);
        return;
      }
      router.push(nextPath.startsWith('/') ? nextPath : '/homework');
      router.refresh();
    } catch {
      setError('Could not sign in. Please try again.');
      setPending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 pb-28">
      <div className="sp-card p-6 sm:p-8">
        <p className="text-[var(--sp-primary)] font-semibold text-sm mb-1">SchoolPulse</p>
        <h1 className="text-2xl font-bold text-[var(--sp-ink)] tracking-tight">Welcome back</h1>
        <p className="text-sm text-[var(--sp-muted)] mt-1">
          Sign in to acknowledge homework and notices.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-[var(--sp-muted)] mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[var(--sp-border)] px-3 py-2.5 text-sm sp-focus"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-[var(--sp-muted)] mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--sp-border)] px-3 py-2.5 text-sm sp-focus"
            />
          </div>

          {error ? (
            <p className="text-sm text-[var(--sp-error)]" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full min-h-11 rounded-xl bg-[var(--sp-primary)] text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-60 sp-focus"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-[var(--sp-muted)] mt-5 text-center">
          Don&apos;t have an account?{' '}
          <Link href="/sign-up" className="text-[var(--sp-primary)] font-semibold hover:underline">
            Create account
          </Link>
        </p>
        <p className="text-xs text-[var(--sp-subtle)] mt-3 text-center">
          <Link href="/" className="text-[var(--sp-primary)] font-semibold hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto px-4 py-10 animate-pulse">
          <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
