import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AdminLogin({
  onLogin,
}: {
  onLogin: (user: { token: string; username: string }) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // ✅ Use RPC — param names MUST match function args
      const { data, error } = await supabase.rpc('admin_login', {
        p_username: username,
        p_password: password,
      });

      if (error) {
        console.error('admin_login RPC error:', error);
        setError('Login failed. Please try again.');
        return;
      }
      if (!data) {
        setError('Invalid username or password.');
        return;
      }

      // data is a UUID token
      onLogin({ token: String(data), username });
    } catch (err) {
      console.error(err);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0] px-4">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">Admin Login</h1>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#C9A9A6]"
            placeholder="bigsamcreates"
            autoComplete="username"
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
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] text-white py-2 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-60"
        >
          {loading ? 'Logging in…' : 'Login'}
        </button>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </form>
    </div>
  );
}
