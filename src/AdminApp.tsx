import AdminDashboard from './admin/AdminDashboard';
import AdminLogin from './admin/AdminLogin';
import { useIsAdmin } from './hooks/useIsAdmin';
import { supabase } from './lib/supabase';
import { useEffect, useState } from 'react';

export default function AdminApp() {
  const { loading, isAdmin } = useIsAdmin();
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setAuthChecked(true);
    });
  }, []);

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">Checking session…</div>;
  }

  // Not signed in? Show login screen.
  if (!user) return <AdminLogin />;

  // Signed in but still checking admin flag
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-600">Checking admin access…</div>;

  // Signed in but not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center text-gray-700 px-6">
        <p className="text-lg font-semibold mb-2">Unauthorized</p>
        <p>This dashboard is restricted to admin users only.</p>
        <p className="text-sm mt-4 text-gray-500">Ask an existing admin to add your account to the admin list.</p>
      </div>
    );
  }

  // Good to go
  return <AdminDashboard />;
}
