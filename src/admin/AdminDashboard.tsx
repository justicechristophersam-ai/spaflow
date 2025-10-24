// src/admin/AdminDashboard.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  CalendarRange, CheckCircle2, Clock, Database, Download, Filter,
  Loader2, Search, Users, XCircle, RefreshCw, Phone, MessageCircle, Copy, Plus
} from 'lucide-react';

type BookingRow = {
  id: string;
  name: string;
  whatsapp: string;
  email: string;
  service_type: string;
  preferred_date: string;
  preferred_time: string;
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
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * 86400000); }
function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday=0
  date.setDate(date.getDate() - day);
  date.setHours(0,0,0,0);
  return date;
}

type ChipKey = 'upcoming' | 'today' | 'week' | 'last30' | 'all' | 'custom';

function rangeForChip(c: ChipKey) {
  const today = new Date();
  switch (c) {
    case 'upcoming':
      return { from: toISO(today), to: toISO(addDays(today, 90)) };
    case 'today':
      return { from: toISO(today), to: toISO(today) };
    case 'week': {
      const ws = startOfWeek(today);
      return { from: toISO(ws), to: toISO(addDays(ws, 6)) };
    }
    case 'last30':
      return { from: toISO(addDays(today, -30)), to: toISO(today) };
    case 'all':
      return { from: null as string | null, to: null as string | null };
    case 'custom':
      return { from: null as string | null, to: null as string | null };
  }
}

export default function AdminDashboard({
  token,
  onLogout,
  adminName,
}: {
  token: string;
  onLogout: () => void;
  adminName?: string | null;
}) {
  // chips & filters
  const [chip, setChip] = useState<ChipKey>('upcoming'); // DEFAULT = Upcoming (today → +90)
  const [q, setQ] = useState('');
  const [service, setService] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  // custom date range (only used when chip === 'custom')
  const [customFrom, setCustomFrom] = useState<string>(toISO(startOfWeek(new Date())));
  const [customTo,   setCustomTo]   = useState<string>(toISO(new Date()));

  // derived range to send to RPC
  const derived = useMemo(() => {
    if (chip === 'custom') {
      return { from: customFrom || null, to: customTo || null };
    }
    return rangeForChip(chip);
  }, [chip, customFrom, customTo]);

  // data
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, confirmed: 0, cancelled: 0, today: 0, this_week: 0 });
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // micro-interactions
  const [toastList, setToastList] = useState<Array<{ id: string; type: 'success'|'error'|'info'; msg: string }>>([]);
  const [contactFor, setContactFor] = useState<string | null>(null); // booking id for contact sheet
  const [bumpUpcoming, setBumpUpcoming] = useState(false);
  const [bumpAll, setBumpAll] = useState(false);

  // keep last fetched range to compare realtime entries
  const lastRangeRef = useRef<{from: string|null, to: string|null}>({ from: derived.from, to: derived.to });

  function pushToast(type: 'success'|'error'|'info', msg: string) {
    const id = Math.random().toString(36).slice(2);
    setToastList((ts) => [...ts, { id, type, msg }]);
    setTimeout(() => setToastList((ts) => ts.filter(t => t.id !== id)), 2500);
  }

  function inCurrentRange(dateStr: string) {
    const d = dateStr;
    const { from, to } = lastRangeRef.current;
    if (!from && !to) return true; // all time
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  async function fetchAll(isRefresh = false) {
    if (!token) return;
    try {
      setError(null);
      isRefresh ? setRefreshing(true) : setLoading(true);

      const d_from = derived.from ?? null;
      const d_to   = derived.to   ?? null;

      const [{ data, error }, { data: stats, error: statsErr }] = await Promise.all([
        supabase.rpc('list_bookings_admin', {
          p_token: token,
          d_from,
          d_to,
          p_service: service || null,
          p_status: status || null,
        }),
        supabase.rpc('get_booking_counts_admin', {
          p_token: token,
          d_from,
          d_to,
        }),
      ]);

      if (error) throw error;
      if (statsErr) throw statsErr;

      const safeRows = (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        whatsapp: r.whatsapp,
        email: r.email,
        service_type: r.service_type,
        preferred_date: r.preferred_date,
        preferred_time: String(r.preferred_time ?? '').slice(0,5),
        status: r.status,
        created_at: r.created_at,
        notes: r.notes ?? ''
      })) as BookingRow[];

      const needle = q.trim().toLowerCase();
      const filtered = needle
        ? safeRows.filter(r =>
            (r.name || '').toLowerCase().includes(needle) ||
            (r.whatsapp || '').toLowerCase().includes(needle) ||
            (r.email || '').toLowerCase().includes(needle) ||
            (r.notes || '').toLowerCase().includes(needle) ||
            (r.service_type || '').toLowerCase().includes(needle)
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

      // reset bump dots when we change range or refresh
      setBumpUpcoming(false);
      setBumpAll(false);
      lastRangeRef.current = { from: d_from, to: d_to };
    } catch (e: any) {
      console.error('Admin fetch error:', e);
      setError(e.message || 'Failed to load bookings');
      pushToast('error', 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, chip, service, status]); // q is client-side filter; dates are derived from chip

  // realtime + bump logic
  useEffect(() => {
    const channel = supabase
      .channel('bookings-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload: any) => {
        // new or updated booking
        const b = payload.new || payload.record;
        if (!b) return;

        // if the new/updated row falls in current range -> refresh list softly
        if (b.preferred_date && inCurrentRange(b.preferred_date)) {
          fetchAll(true);
          pushToast('info', 'New booking received');
        } else {
          // outside current view -> set bump dot
          const todayISO = toISO(new Date());
          if (b.preferred_date >= todayISO) setBumpUpcoming(true);
          else setBumpAll(true);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chip, service, status]);

  // client-side search filter
  const filteredRows = useMemo(() => {
    if (!q) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) =>
      [r.name, r.email, r.whatsapp, r.notes, r.service_type]
        .some((x) => (x || '').toLowerCase().includes(needle))
    );
  }, [rows, q]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / pageSize)), [filteredRows.length]);
  const pageRows   = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page]);

  async function updateStatus(id: string, newStatus: BookingRow['status']) {
    const prev = rows.slice();
    setRows(rs => rs.map(r => (r.id === id ? { ...r, status: newStatus } : r)));
    const { error } = await supabase.rpc('update_booking_status_admin', {
      p_token: token,
      p_id: id,
      p_new_status: newStatus,
    });
    if (error) {
      console.error('Update status RPC failed:', error);
      setRows(prev);
      pushToast('error', 'Could not update status.');
    } else {
      pushToast('success', `Marked as ${newStatus}.`);
    }
  }

  async function handleLogout() {
    try { await supabase.rpc('admin_logout', { p_token: token }); }
    finally { onLogout(); }
  }

  function currentRangeLabel() {
    if (chip === 'all') return 'All time';
    if (chip === 'custom') return `${customFrom || '—'} → ${customTo || '—'}`;
    const { from, to } = rangeForChip(chip);
    return `${from ?? '—'} → ${to ?? '—'}`;
  }

  function downloadCSV() {
    const headers = ['id','name','whatsapp','email','service_type','preferred_date','preferred_time','status','created_at','notes'];
    const lines = [headers.join(',')];
    filteredRows.forEach(r => {
      const vals = [
        r.id, r.name, r.whatsapp, r.email, r.service_type,
        r.preferred_date, r.preferred_time, r.status, r.created_at,
        (r.notes || '').replace(/\n/g,' ').replace(/,/g,';')
      ];
      lines.push(vals.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(','));
    });
    const label = chip === 'all' ? 'all_time'
      : chip === 'custom' ? `${customFrom || 'na'}_to_${customTo || 'na'}`
      : currentRangeLabel().replace(/\s|→/g,'');
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `bookings_${label}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushToast('success', 'CSV exported');
  }

  function openWhatsApp(raw: string) {
    const cleaned = (raw || '').replace(/\D/g, ''); // digits only
    if (!cleaned) { pushToast('error', 'No valid phone number'); return; }
    window.open(`https://wa.me/${cleaned}`, '_blank');
  }
  function callNumber(raw: string) {
    const cleaned = (raw || '').replace(/\D/g, '');
    if (!cleaned) { pushToast('error', 'No valid phone number'); return; }
    window.location.href = `tel:${cleaned}`;
  }
  async function copyNumber(raw: string) {
    try {
      await navigator.clipboard.writeText(raw || '');
      pushToast('success', 'Number copied');
    } catch {
      pushToast('error', 'Copy failed');
    }
  }

  const chips: { key: ChipKey; label: string; bump?: boolean }[] = [
    { key: 'upcoming', label: 'Upcoming', bump: bumpUpcoming },
    { key: 'today',    label: 'Today' },
    { key: 'week',     label: 'This Week' },
    { key: 'last30',   label: 'Last 30 days' },
    { key: 'all',      label: 'All time', bump: bumpAll },
    { key: 'custom',   label: 'Custom' },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 relative">
      {/* Header */}
      <div className="px-6 py-6 border-b bg-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">LunaBloom — Admin Dashboard</h1>
            {adminName ? <p className="text-sm text-neutral-500">Signed in as {adminName}</p> : null}
            <p className="text-xs text-neutral-400 mt-1">Range: {currentRangeLabel()}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              onClick={downloadCSV}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border"
              title="Sign out"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-6 gap-3">
          {/* Chips */}
          <div className="md:col-span-3">
            <div className="flex flex-wrap gap-2">
              {chips.map(c => (
                <button
                  key={c.key}
                  onClick={() => { setPage(1); setChip(c.key); }}
                  className={`relative px-3 py-1.5 rounded-full border text-sm ${chip === c.key ? 'bg-black text-white' : 'bg-white'}`}
                >
                  {c.label}
                  {c.bump && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
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

          {/* Status */}
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

          {/* Service */}
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
        </div>

        {/* Custom date range (only visible when chip === 'custom') */}
        {chip === 'custom' && (
          <div className="max-w-7xl mx-auto mt-3 grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2 flex gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => { setPage(1); setCustomFrom(e.target.value); }}
                className="w-1/2 px-3 py-2 rounded-lg border border-neutral-300"
                aria-label="From"
              />
              <input
                type="date"
                value={customTo}
                onChange={(e) => { setPage(1); setCustomTo(e.target.value); }}
                className="w-1/2 px-3 py-2 rounded-lg border border-neutral-300"
                aria-label="To"
              />
            </div>
            <div className="hidden md:flex items-center gap-2 text-neutral-500">
              <Filter className="w-4 h-4" />
              Custom range
            </div>
          </div>
        )}
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

      {/* Mobile-friendly list with skeletons */}
      <div className="px-6 pb-20">
        <div className="max-w-7xl mx-auto bg-white border rounded-xl overflow-hidden">
          <div className="divide-y">
            {loading && rows.length === 0 ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : filteredRows.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">No bookings found.</div>
            ) : (
              pageRows.map(row => (
                <div key={row.id} className="p-4 sm:p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="font-medium text-neutral-900 truncate">{row.name || '—'}</div>
                    <div className="text-sm text-neutral-600 truncate">
                      {row.service_type || 'Service'} • {row.preferred_date}{row.preferred_time ? ` • ${row.preferred_time}` : ''}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">{row.email}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusPill status={row.status} />
                      <button
                        onClick={() => setContactFor(row.id)}
                        className="text-xs px-2 py-1 rounded border hover:bg-neutral-50 inline-flex items-center gap-1"
                      >
                        Contact
                      </button>
                      {contactFor === row.id && (
                        <ContactSheet
                          phone={row.whatsapp}
                          onClose={() => setContactFor(null)}
                          onWhatsApp={() => openWhatsApp(row.whatsapp)}
                          onCall={() => callNumber(row.whatsapp)}
                          onCopy={() => copyNumber(row.whatsapp)}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:self-end">
                    {row.status !== 'confirmed' && (
                      <button onClick={() => updateStatus(row.id, 'confirmed')} className="px-3 py-1.5 rounded-lg border text-xs hover:bg-neutral-50">Confirm</button>
                    )}
                    {row.status !== 'pending' && (
                      <button onClick={() => updateStatus(row.id, 'pending')} className="px-3 py-1.5 rounded-lg border text-xs hover:bg-neutral-50">Pending</button>
                    )}
                    {row.status !== 'cancelled' && (
                      <button onClick={() => updateStatus(row.id, 'cancelled')} className="px-3 py-1.5 rounded-lg border text-xs hover:bg-neutral-50">Cancel</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {filteredRows.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-neutral-50">
              <div className="text-xs text-neutral-500">
                Page {page} of {Math.max(1, Math.ceil(filteredRows.length / pageSize))} • {filteredRows.length} row{filteredRows.length === 1 ? '' : 's'}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border text-xs disabled:opacity-40">Prev</button>
                <button onClick={() => setPage(p => Math.min(Math.max(1, Math.ceil(filteredRows.length / pageSize)), p + 1))} disabled={page >= Math.ceil(filteredRows.length / pageSize)} className="px-3 py-1.5 rounded-lg border text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FAB: Add booking (uses existing public booking flow) */}
      <button
        onClick={() => window.open('/book', '_blank')}
        className="fixed bottom-6 right-6 md:hidden rounded-full shadow-lg bg-neutral-900 text-white p-4"
        title="Add booking"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Toasts */}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-4 z-40 space-y-2 w-[92%] max-w-sm">
        {toastList.map(t => (
          <div
            key={t.id}
            className={`px-3 py-2 rounded-lg shadow border text-sm ${
              t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : t.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-neutral-50 border-neutral-200 text-neutral-800'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: 'pending'|'confirmed'|'cancelled' }) {
  const cls =
    status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
    status === 'cancelled' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
    'bg-amber-50 text-amber-700 border border-amber-200';
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${cls}`}>{status}</span>;
}

function SkeletonCard() {
  return (
    <div className="p-4 animate-pulse">
      <div className="h-4 w-1/3 bg-neutral-200 rounded mb-2" />
      <div className="h-3 w-1/2 bg-neutral-200 rounded mb-2" />
      <div className="h-3 w-1/4 bg-neutral-200 rounded mb-3" />
      <div className="flex gap-2">
        <div className="h-7 w-20 bg-neutral-200 rounded" />
        <div className="h-7 w-20 bg-neutral-200 rounded" />
        <div className="h-7 w-20 bg-neutral-200 rounded" />
      </div>
    </div>
  );
}

function ContactSheet({
  phone, onClose, onWhatsApp, onCall, onCopy
}: {
  phone: string;
  onClose: () => void;
  onWhatsApp: () => void;
  onCall: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="relative">
      <div className="absolute z-20 mt-2 p-2 bg-white border rounded-lg shadow-lg">
        <div className="text-xs text-neutral-500 px-2 pt-1 pb-2">Contact</div>
        <button onClick={() => { onWhatsApp(); onClose(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-neutral-50">
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </button>
        <button onClick={() => { onCall(); onClose(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-neutral-50">
          <Phone className="w-4 h-4" /> Call
        </button>
        <button onClick={() => { onCopy(); onClose(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-neutral-50">
          <Copy className="w-4 h-4" /> Copy number
        </button>
      </div>
      <div className="fixed inset-0 z-10" onClick={onClose} />
    </div>
  );
}

function StatCard({ icon, label, value }:{ icon: React.ReactNode; label: string; value: number | string; }) {
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
