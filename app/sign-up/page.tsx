'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { registerParent } from '@/app/actions/auth-register';
import { validateRegisterParentInput } from '@/lib/auth-register';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const clientCheck = validateRegisterParentInput({
      name,
      email,
      password,
      confirmPassword,
    });
    if (!clientCheck.ok) {
      setError(clientCheck.error);
      return;
    }

    setPending(true);
    try {
      const result = await registerParent({
        name,
        email,
        password,
        confirmPassword,
      });
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      setDone(true);
      setPending(false);
    } catch {
      setError('Could not create account. Please try again.');
      setPending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 pb-28">
      <div className="sp-card p-6 sm:p-8">
        <p className="text-[var(--sp-primary)] font-semibold text-sm mb-1">SchoolPulse</p>
        <h1 className="text-2xl font-bold text-[var(--sp-ink)] tracking-tight">Create account</h1>
        <p className="text-sm text-[var(--sp-muted)] mt-1">
          Register as a parent. Your school must link your child before you can
          acknowledge homework and notices.
        </p>

        {done ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-gray-700 leading-relaxed" role="status">
              Account created. Your school must approve/link your child before
              school data acknowledgements are available.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full min-h-11 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="name" className="block text-xs font-bold text-gray-600 mb-1">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-300"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-gray-600 mb-1">
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
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-300"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-gray-600 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-300"
              />
              <p className="text-xs text-gray-400 mt-1">At least 8 characters</p>
            </div>
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-bold text-gray-600 mb-1"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-300"
              />
            </div>

            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="w-full min-h-11 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              {pending ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}

        <p className="text-xs text-gray-400 mt-5 text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-orange-600 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
