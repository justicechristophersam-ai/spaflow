import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AdminLogin() {
  const [mode, setMode] = useState<'magic' | 'password'>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage(null); setError(null);

    try {
      // IMPORTANT: set your Site URL in Supabase Auth → URL Configuration
      // so this link returns to /admin after confirmation.
      const redirectTo = `${window.location.origin}/admin`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo }
      });
      if (error) throw error;
      setMessage('Magic link sent! Check your inbox and click the link to finish signing in.');
    } catch (err: any) {
      setError(err?.message ?? 'Could not send magic link.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage(null); setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // page will re-render via AdminApp after session is set
    } catch (err: any) {
      setError(err?.message ?? 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e: React.MouseEvent) {
    e.preventDefault();
    setBusy(true); setMessage(null); setError(null);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setMessage('Signup successful. Check your email to confirm, then come back to /admin.');
    } catch (err: any) {
      setError(err?.message ?? 'Sign-up failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">LunaBloom Admin</h1>
        <p className="text-sm text-gray-600 mb-6">Sign in to manage bookings.</p>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('magic')}
            className={`px-3 py-1.5 rounded-lg border text-sm ${mode==='magic' ? 'bg-gray-900 text-white' : 'bg-white text-gray-800'}`}
          >
            Magic Link
          </button>
          <button
            onClick={() => setMode('password')}
            className={`px-3 py-1.5 rounded-lg border text-sm ${mode==='password' ? 'bg-gray-900 text-white' : 'bg-white text-gray-800'}`}
          >
            Email & Password
          </button>
        </div>

        {mode === 'magic' ? (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none"
                placeholder="you@company.com"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full px-3 py-2 rounded-lg bg-gray-900 text-white disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send Magic Link'}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full px-3 py-2 rounded-lg bg-gray-900 text-white disabled:opacity-50"
            >
              {busy ? 'Signing in…' : 'Sign In'}
            </button>

            <button
              onClick={handleSignUp}
              disabled={busy}
              className="w-full px-3 py-2 rounded-lg border mt-2 text-sm disabled:opacity-50"
            >
              Create account (admin must approve)
            </button>
          </form>
        )}

        {message && <p className="mt-4 text-sm text-emerald-700 bg-emerald-50 rounded-lg p-2">{message}</p>}
        {error && <p className="mt-4 text-sm text-rose-700 bg-rose-50 rounded-lg p-2">{error}</p>}
      </div>
    </div>
  );
}
