import { useState } from 'react';
import AdminDashboard from './admin/AdminDashboard';
import AdminLogin from './admin/AdminLogin';

export default function AdminApp() {
  const [adminUser, setAdminUser] = useState<any>(null);

  if (!adminUser) {
    return <AdminLogin onLogin={(u) => setAdminUser(u)} />;
  }

  return <AdminDashboard />;
}
