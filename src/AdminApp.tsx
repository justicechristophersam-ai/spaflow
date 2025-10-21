import AdminDashboard from './admin/AdminDashboard';
import { useIsAdmin } from './hooks/useIsAdmin';
import { supabase } from './lib/supabase';
import { useEffect, useState } from 'react';

export default function AdminApp() {
  const { loading, isAdmin, userEmail } = useIsAdmin();
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthChecked(true);
    });
  }, []);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Checking session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center text-gray-700">
        <p className="text-lg font-semibold mb-3">Please sign in</p>
        <p>You must be logged in to access the admin dashboard.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Checking admin access…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center text-gray-700">
        <p className="text-lg font-semibold mb-3">Unauthorized</p>
        <p>This dashboard is restricted to admin users only.</p>
      </div>
    );
  }

  return <AdminDashboard />;
}
