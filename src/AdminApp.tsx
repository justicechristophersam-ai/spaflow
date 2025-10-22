import { useEffect, useState } from 'react';
import AdminDashboard from './admin/AdminDashboard';
import AdminLogin from './admin/AdminLogin';

export default function AdminApp() {
  const [adminUser, setAdminUser] = useState<any>(null);

  // ✅ Load stored session on first render
  useEffect(() => {
    const savedUser = localStorage.getItem('adminUser');
    if (savedUser) {
      try {
        setAdminUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('adminUser');
      }
    }
  }, []);

  // ✅ Save session whenever login succeeds
  const handleLogin = (user: any) => {
    setAdminUser(user);
    localStorage.setItem('adminUser', JSON.stringify(user));
  };

  // ✅ Logout clears storage
  const handleLogout = () => {
    localStorage.removeItem('adminUser');
    setAdminUser(null);
  };

  if (!adminUser) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <AdminDashboard
      token={adminUser.token}
      onLogout={handleLogout}
      adminName={adminUser.username}
    />
  );
}
