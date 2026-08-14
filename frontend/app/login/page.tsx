'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2, MailCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import * as api from '@/lib/api';

// Sign-ups are closed during the pilot; accounts come from an admin.
const SIGNUP_OPEN = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === 'true';

export default function LoginPage() {
  const { user, loading, login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'forgot') {
        const res = await api.forgotPassword(email);
        setSent(res.message);
      } else if (mode === 'login') {
        await login(email, password);
        router.replace('/dashboard');
      } else {
        await register(name, email, password);
        router.replace('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next: 'login' | 'register' | 'forgot') {
    setMode(next);
    setError(null);
    setSent(null);
  }

  const heading =
    mode === 'login'
      ? 'Welcome back'
      : mode === 'register'
        ? 'Create your account'
        : 'Reset your password';
  const sub =
    mode === 'login'
      ? 'Sign in to continue to your dashboard.'
      : mode === 'register'
        ? 'Get started in a few seconds.'
        : 'We’ll email you a link to set a new password.';

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <span className="text-lg font-semibold tracking-tight">CS Dashboard</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight">
            One workspace for Company Secretaries.
          </h1>
          <p className="mt-4 text-brand-100">
            Track corporate filings, research laws and manage compliance — all in
            one place. Starting with live BSE corporate announcements across the
            indices you follow.
          </p>
        </div>
        <p className="text-sm text-brand-200">
          Built for CS professionals in India · POC
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex w-full items-center justify-center bg-slate-50 p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2 text-brand-700">
              <ShieldCheck className="h-6 w-6" />
              <span className="text-lg font-semibold">CS Dashboard</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">{heading}</h2>
          <p className="mt-1 text-sm text-slate-500">{sub}</p>

          {sent ? (
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{sent}</p>
              </div>
              <button
                onClick={() => switchMode('login')}
                className="btn-secondary w-full"
              >
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </button>
            </div>
          ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">Full name</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Asha Menon"
                  required
                />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="label">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="mb-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'login'
                ? 'Sign in'
                : mode === 'register'
                  ? 'Create account'
                  : 'Send reset link'}
            </button>

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="flex w-full items-center justify-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </button>
            )}
          </form>
          )}

          {SIGNUP_OPEN && mode !== 'forgot' ? (
            <p className="mt-6 text-center text-sm text-slate-500">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                className="font-semibold text-brand-600 hover:text-brand-700"
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          ) : mode !== 'forgot' && !sent ? (
            <p className="mt-6 text-center text-xs text-slate-400">
              Accounts are provisioned by your administrator during the pilot.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
