import { useState } from 'react';
import { supabase } from '../lib/supabase';

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
    <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0] px-4">
      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm"
      >
        <h1 className="text-2xl font-bold mb-4 text-gray-800">Admin Login</h1>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#C9A9A6]"
            placeholder="admin"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#C9A9A6]"
            placeholder="•••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] text-white py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </form>
    </div>
  );
}
