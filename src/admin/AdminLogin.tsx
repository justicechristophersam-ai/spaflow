import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Flower2 } from 'lucide-react';

export default function AdminLogin({ onLogin }: { onLogin: (user: any) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
  e.preventDefault();
  setError(null);
  setLoading(true);

  try {
    const { data, error } = await supabase.rpc('admin_login', {
      p_username: username,
      p_password: password,
    });

    if (error) throw error;

    // admin_login returns a row: [{ token: uuid, admin_name: text }]
    const row = Array.isArray(data) ? data[0] : data;

    if (!row || !row.token) {
      setError('Invalid username or password');
      return;
    }

    const adminUser = { token: String(row.token), username, adminName: row.admin_name ?? 'Admin' };
    localStorage.setItem('adminUser', JSON.stringify(adminUser));

    onLogin(adminUser);
  } catch (err: any) {
    console.error('Login failed:', err);
    // Show DB hint if available; otherwise a friendly message
    setError(err?.message || 'Login failed. Try again.');
  } finally {
    setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFF8F0] via-[#EAC7C7]/20 to-[#FFF8F0] px-4">
      <form
        onSubmit={handleLogin}
        className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-2xl w-full max-w-sm border border-[#C9A9A6]/20"
      >
        <div className="flex items-center justify-center space-x-3 mb-6">
          <Flower2 className="w-10 h-10 text-[#C9A9A6]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">LunaBloom</h1>
            <p className="text-xs text-gray-500">Admin Portal</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 border-2 rounded-xl border-[#C9A9A6]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A9A6]/40 focus:border-[#C9A9A6] transition-colors"
            placeholder="admin"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border-2 rounded-xl border-[#C9A9A6]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A9A6]/40 focus:border-[#C9A9A6] transition-colors"
            placeholder="•••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] text-white py-3 rounded-xl font-semibold hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>

        {error && <p className="text-sm text-rose-600 mt-4 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#C9A9A6] hover:text-[#B89896] transition-colors"
          >
            ← Back to LunaBloom Spa
          </a>
        </div>
      </form>
    </div>
  );
}
