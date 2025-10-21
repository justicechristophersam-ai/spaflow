import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AdminApp from './AdminApp'; // ← new file you’ll add
import './index.css';

const path = window.location.pathname.replace(/\/+$/, ''); // strip trailing slash
const isAdminRoute = path === '/admin' || path.startsWith('/admin/');

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdminRoute ? <AdminApp /> : <App />}
  </React.StrictMode>
);
