import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useIsAdmin } from '../hooks/useIsAdmin';
import {
  CalendarRange, CheckCircle2, Clock, Database, Download, Filter,
  Loader2, Search, Users, XCircle
} from 'lucide-react';

type BookingRow = {
  id: string;
  name: string;
  whatsapp: string;
  email: string;
  service_type: string;
  preferred_date: string; // ISO date
  preferred_time: string; // 'HH:MM'
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
  notes: string;
};

const SERVICES = [
  'Full Body Massage',
  'Deep Cleansing Facial',
  'Aromatherapy',
  'Body Scrub & Glow',
  "Couple's Package"
];

function toISO(d: Date) { return d.toISOString().slice(0, 10); }
function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday=0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function AdminDashboard() {
  const { loading: gateLoading, isAdmin, userEmail } = useIsAdmin();

  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [service, setService] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [from, setFrom] = useState<string>(() => toISO(startOfWeek(new Date())));
  const [to, setTo] = useState<string>(() => toISO(new Date()));

  const [rows, setRows] = useState<BookingRow[]>([]);
  const [counts, setCounts] = useState({
    total: 0, pending: 0, confirmed: 0, cancelled: 0, today: 0, this_week: 0,
  });

  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    if (gateLoading || !isAdmin) return;

    let cancelled = false;

    async function fetchAll() {
      setLoading(true);

      const query = supabase
        .from('bookings')
        .select('*')
        .gte('preferred_date', from)
        .lte('preferred_date', to)
        .order('preferred_date', { ascending: true })
        .order('preferred_time', { ascending: true });

      if (service) query.eq('service_type', service);
      if (status)  query.eq('status', status);

      const [{ data, error }, { data: stats, error: statsErr }] = await Promise.all([
        query,
        supabase.rpc('get_booking_counts', { d_from: from, d_to: to })
      ]);

      if (!cancelled) {
        if (error) console.error('List error:', error);
        if (statsErr) console.error('Stats error:', statsErr);

        const safeRows = (data ?? []).map((r: any) => ({
          id: r.id,
          name: r.name,
          whatsapp: r.whatsapp,
          email: r.email,
          service_type: r.service_type,
          preferred_date: r.preferred_date,
          preferred_time: String(r.preferred_time).slice(0, 5),
          status: r.status,
          created_at: r.created_at,
          notes: r.notes ?? ''
        })) as BookingRow[];

        const needle = q.trim().toLowerCase();
        const filtered = needle
          ? safeRows.filter(r =>
              r.name.toLowerCase().includes(needle) ||
              r.whatsapp.toLowerCase().includes(needle) ||
              r.email.toLowerCase().includes(needle) ||
              r.notes?.toLowerCase().includes(needle)
            )
          : safeRows;

        setRows(filtered);

        if (stats && stats.length > 0) {
          const s = stats[0] as any;
          setCounts({
            total: Number(s.total ?? 0),
            pending: Number(s.pending ?? 0),
            confirmed: Number(s.confirmed ?? 0),
            cancelled: Number(s.cancelled ?? 0),
            today: Number(s.today ?? 0),
            this_week: Number(s.this_week ?? 0),
          });
        }

        setLoading(false);
      }
    }

    fetchAll();

    const channel = supabase
      .channel('bookings-admin')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [gateLoading, isAdmin, q, service, status, from, to]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(rows.length / pageSize)), [rows.length]);
  const pageRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page]);

  async function updateStatus(id: string, newStatus: BookingRow['status']) {
    const prev = rows.slice();
    setRows(rs => rs.map(r => (r.id === id ? { ...r, status: newStatus } : r)));

    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error('Update status failed:', error);
      setRows(prev);
      alert('Could not update status. Are you an admin?');
    }
  }

  function downloadCSV() {
    const headers = [
      'id','name','whatsapp','email','service_type',
      'preferred_date','preferred_time','status','created_at','notes'
    ];
    const lines = [headers.join(',')];
    rows.forEach(r => {
      const vals = [
        r.id, r.name, r.whatsapp, r.email, r.service_type,
        r.preferred_date, r.preferred_time, r.status, r.created_at,
        (r.notes || '').replace(/\n/g,' ').replace(/,/g,';')
      ];
      lines.push(vals.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `bookings_${from}_to_${to}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (gateLoading) {
    return (
      <div className="p-8 flex items-center gap-3 text-gray-600">
        <Loader2 className="w-5 h-5 animate-spin" />
        Checking admin access…
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="p-8 text-gray-700">
        <p className="text-lg font-semibold mb-2">Unauthorized</p>
        <p>This page is for admins only. Please sign in with an admin account.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="px-6 py-6 border-b bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">LunaBloom — Admin Dashboard</h1>
            <p className="text-sm text-neutral-500">Signed in as {userEmail}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCSV}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <input
                value={q}
                onChange={(e) => { setPage(1); setQ(e.target.value); }}
                placeholder="Search name, phone, email, notes…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
          </div>

          <div>
            <select
              value={service}
              onChange={(e) => { setPage(1); setService(e.target.value); }}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300"
            >
              <option value="">All services</option>
              {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <select
              value={status}
              onChange={(e) => { setPage(1); setStatus(e.target.value); }}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => { setPage(1); setFrom(e.target.value); }}
              className="w-1/2 px-3 py-2 rounded-lg border border-neutral-300"
              aria-label="From"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => { setPage(1); setTo(e.target.value); }}
              className="w-1/2 px-3 py-2 rounded-lg border border-neutral-300"
              aria-label="To"
            />
          </div>

          <div className="hidden md:flex items-center gap-2 text-neutral-500">
            <Filter className="w-4 h-4" />
            Filters
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="px-6 py-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <StatCard icon={<Database className="w-4 h-4" />} label="Total" value={counts.total} />
          <StatCard icon={<Clock className="w-4 h-4" />} label="Pending" value={counts.pending} />
          <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Confirmed" value={counts.confirmed} />
          <StatCard icon={<XCircle className="w-4 h-4" />} label="Cancelled" value={counts.cancelled} />
          <StatCard icon={<CalendarRange className="w-4 h-4" />} label="Today" value={counts.today} />
          <StatCard icon={<Users className="w-4 h-4" />} label="This week" value={counts.this_week} />
        </div>
      </div>

      {/* Table */}
      <div className="px-6 pb-10">
        <div className="max-w-7xl mx-auto bg-white border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b">
                <tr className="[&>th]:text-left [&>th]:px-4 [&>th]:py-3 text-neutral-600">
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Service</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th className="text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-neutral-500">
                    <Loader2 className="inline w-4 h-4 animate-spin mr-2" />
                    Loading…
                  </td></tr>
                ) : pageRows.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-neutral-500">No bookings found.</td></tr>
                ) : (
                  pageRows.map(row => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-neutral-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900">{row.name}</div>
                        <div className="text-neutral-500">{row.email}</div>
                      </td>
                      <td className="px-4 py-3">{row.whatsapp}</td>
                      <td className="px-4 py-3">{row.service_type}</td>
                      <td className="px-4 py-3">{row.preferred_date}</td>
                      <td className="px-4 py-3">{row.preferred_time}</td>
                      <td className="px-4 py-3">
                        <span className={
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ' +
                          (row.status === 'confirmed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : row.status === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200')
                        }>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <div className="truncate" title={row.notes}>{row.notes}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          {row.status !== 'confirmed' && (
                            <button
                              onClick={() => updateStatus(row.id, 'confirmed')}
                              className="px-3 py-1.5 rounded-lg border text-xs hover:bg-neutral-50"
                              title="Mark as confirmed"
                            >
                              Confirm
                            </button>
                          )}
                          {row.status !== 'pending' && (
                            <button
                              onClick={() => updateStatus(row.id, 'pending')}
                              className="px-3 py-1.5 rounded-lg border text-xs hover:bg-neutral-50"
                              title="Mark as pending"
                            >
                              Pending
                            </button>
                          )}
                          {row.status !== 'cancelled' && (
                            <button
                              onClick={() => updateStatus(row.id, 'cancelled')}
                              className="px-3 py-1.5 rounded-lg border text-xs hover:bg-neutral-50"
                              title="Mark as cancelled"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t bg-neutral-50">
            <div className="text-xs text-neutral-500">
              Page {page} of {totalPages} • {rows.length} row{rows.length === 1 ? '' : 's'}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border text-xs disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }:{
  icon: React.ReactNode; label: string; value: number | string;
}) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-neutral-500 text-xs">{label}</div>
        <div className="text-neutral-400">{icon}</div>
      </div>
      <div className="mt-2 text-2xl font-semibold text-neutral-900">{value}</div>
    </div>
  );
}
