// src/admin/AdminDashboard.tsx (merged rewrite)
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  CalendarRange, CheckCircle2, Clock, Database, Download, Filter,
  RefreshCw, Search, Users, XCircle, Phone, MessageCircle, Copy, Plus,
  Home as HomeIcon, CalendarDays, BarChart2, Settings as SettingsIcon, LogOut, Flower2
} from 'lucide-react';

// ✅ ADDED: History page import
import HistoryPage from './HistoryPage';

// ✅ ADDED: import WhatsApp helpers (from the helper file you created)
import { buildWhatsAppLink, bookingMessageTemplate, formatDateTime } from '../utils/whatsapp';

// ✅ ADDED: import Change Password form
import ChangePasswordForm from './ChangePasswordForm';

// ---------- Types ----------
type BookingRow = {
  id: string;
  name: string;
  whatsapp: string;
  email: string;
  service_type: string;
  preferred_date: string; // YYYY-MM-DD
  preferred_time: string; // HH:mm
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
  notes: string;
};

type ChipKey = 'upcoming' | 'today' | 'week' | 'last30' | 'all' | 'custom';
type TabKey  = 'home' | 'calendar' | 'stats' | 'settings' | 'history';

const SERVICES = [
  'Full Body Massage',
  'Deep Cleansing Facial',
  'Aromatherapy',
  'Body Scrub & Glow',
  "Couple's Package"
];

// ---------- Date helpers ----------
function toISO(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * 86400000); }
function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday=0
  date.setDate(date.getDate() - day);
  date.setHours(0,0,0,0);
  return date;
}

function rangeForChip(c: ChipKey) {
  const today = new Date();
  switch (c) {
    case 'upcoming': return { from: toISO(today), to: toISO(addDays(today, 90)) };
    case 'today':    return { from: toISO(today), to: toISO(today) };
    case 'week':     { const ws = startOfWeek(today); return { from: toISO(ws), to: toISO(addDays(ws, 6)) }; }
    case 'last30':   return { from: toISO(addDays(today, -30)), to: toISO(today) };
    case 'all':      return { from: null as string | null, to: null as string | null };
    case 'custom':   return { from: null as string | null, to: null as string | null };
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
  // ---------- Tabs ----------
  const [tab, setTab] = useState<TabKey>('home'); // home|calendar|stats|settings|history

  // ---------- Filters ----------
  const [chip, setChip] = useState<ChipKey>('upcoming');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [service, setService] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  // custom date range (for chip === 'custom')
  const [customFrom, setCustomFrom] = useState<string>(toISO(startOfWeek(new Date())));
  const [customTo,   setCustomTo]   = useState<string>(toISO(new Date()));

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [q]);

  // Derived range depends on TAB or chips
  const derived = useMemo(() => {
    if (tab === 'home') {
      const today = toISO(new Date());
      return { from: today, to: today };
    }
    if (tab === 'calendar' || tab === 'stats' || tab === 'settings' || tab === 'history') {
      if (chip === 'custom') return { from: customFrom || null, to: customTo || null };
      return rangeForChip(chip);
    }
    return rangeForChip('upcoming');
  }, [tab, chip, customFrom, customTo]);

  // ---------- Data ----------
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
  const [bumpHome, setBumpHome] = useState(false);
  const [bumpCalendar, setBumpCalendar] = useState(false);

  // keep last fetched range to compare realtime entries
  const lastRangeRef = useRef<{from: string|null, to: string|null}>({ from: derived.from, to: derived.to });

  function pushToast(type: 'success'|'error'|'info', msg: string) {
    const id = Math.random().toString(36).slice(2);
    setToastList((ts) => [...ts, { id, type, msg }]);
    setTimeout(() => setToastList((ts) => ts.filter(t => t.id !== id)), 2500);
  }

  function inCurrentRange(dateStr: string) {
    const d = dateStr; // YYYY-MM-DD
    const { from, to } = lastRangeRef.current;
    if (!from && !to) return true; // all time
    if (from && d < from) return false;
    if (to && d > to) return false; // inclusive upper bound
    return true;
  }

  // ✅ NEW: tiny logger helper (non-blocking)
  async function logEvent(bookingId: string, action: 'booking_confirmed'|'booking_pending'|'booking_cancelled'|'whatsapp_opened'|'booking_created'|'note_added', meta: any = {}) {
    try {
      await supabase.rpc('log_booking_event', {
        p_token: token,
        p_booking_id: bookingId,
        p_action: action,
        p_meta: meta
      });
    } catch (e) {
      console.warn('logEvent failed', e);
    }
  }

  async function fetchAll(isRefresh = false) {
    if (!token) return;
    try {
      setError(null);
      isRefresh ? setRefreshing(true) : setLoading(true);

      const d_from = derived.from ?? null;
      const d_to   = derived.to   ?? null;

      // Only fetch rows for tabs that need them (Home/Calendar)
      const needRows = tab === 'home' || tab === 'calendar';
      const [listRes, statsRes] = await Promise.all([
        needRows
          ? supabase.rpc('list_bookings_admin', {
              p_token: token, d_from, d_to, p_service: service || null, p_status: status || null,
            })
          : Promise.resolve({ data: [] as any[], error: null } as any),
        supabase.rpc('get_booking_counts_admin', { p_token: token, d_from, d_to }),
      ]);

      if (listRes.error) throw listRes.error;
      if (statsRes.error) throw statsRes.error;

      if (needRows) {
        const safeRows = (listRes.data ?? []).map((r: any) => ({
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

        // Do NOT filter by q here — client-side search handles it reactively
        setRows(safeRows);
      }

      const stats = statsRes.data as any[];
      if (stats && stats.length > 0) {
        const s = stats[0];
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
      setBumpHome(false);
      setBumpCalendar(false);
      lastRangeRef.current = { from: d_from, to: d_to };
    } catch (e: any) {
      console.error('Admin fetch error:', e);
      setError(e.message || 'Failed to load data');
      pushToast('error', 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Fetch on tab/chip/filter/date change
  useEffect(() => {
    fetchAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tab, chip, service, status, customFrom, customTo]);

  // Realtime with tab-aware bumps
  useEffect(() => {
    const channel = supabase
      .channel('bookings-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload: any) => {
        const b = payload.new || payload.record;
        if (!b) return;

        if (b.preferred_date && inCurrentRange(b.preferred_date)) {
          if (tab === 'home' || tab === 'calendar') {
            fetchAll(true);
            pushToast('info', 'New booking received');
          }
        } else {
          const todayISO = toISO(new Date());
          if (b.preferred_date === todayISO) setBumpHome(true);
          else setBumpCalendar(true);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, chip, service, status]);

  // client-side search (applies where rows exist)
  const filteredRows = useMemo(() => {
    if (!qDebounced) return rows;
    const needle = qDebounced;
    return rows.filter((r) =>
      [r.name, r.email, r.whatsapp, r.notes, r.service_type]
        .some((x) => (x || '').toLowerCase().includes(needle))
    );
  }, [rows, qDebounced]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / pageSize)), [filteredRows.length]);
  const pageRows   = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page]);

  // ---------- Actions ----------
  async function updateStatus(id: string, newStatus: BookingRow['status']) {
    const prev = rows.slice();
    setRows(rs => rs.map(r => (r.id === id ? { ...r, status: newStatus } : r)));
    const { error } = await supabase.rpc('update_booking_status_admin', {
      p_token: token, p_id: id, p_new_status: newStatus,
    });
    if (error) {
      console.error('Update status failed:', error);
      setRows(prev);
      pushToast('error', 'Could not update status.');
    } else {
      pushToast('success', `Marked as ${newStatus}.`);
      // ✅ ADDED: log events per status
      if (newStatus === 'confirmed') await logEvent(id, 'booking_confirmed', { admin: adminName || 'admin' });
      if (newStatus === 'pending')   await logEvent(id, 'booking_pending',   { admin: adminName || 'admin' });
      if (newStatus === 'cancelled') await logEvent(id, 'booking_cancelled', { admin: adminName || 'admin' });
    }
  }

  // ✅ Confirm → update Supabase → open WhatsApp with prefilled message
  async function confirmAndWhatsApp(row: BookingRow) {
    try {
      // Update status to confirmed (no optimistic UI here to avoid mismatch if RPC fails)
      const { error } = await supabase.rpc('update_booking_status_admin', {
        p_token: token, p_id: row.id, p_new_status: 'confirmed',
      });
      if (error) {
        console.error('Confirm RPC failed:', error);
        pushToast('error', 'Could not confirm booking.');
        return;
      }

      // Refresh local row to show "confirmed"
      setRows(rs => rs.map(r => (r.id === row.id ? { ...r, status: 'confirmed' } : r)));
      pushToast('success', 'Marked as confirmed. Opening WhatsApp…');

      // Build prefilled WhatsApp message
      const { dateStr, timeStr } = formatDateTime(row.preferred_date, row.preferred_time, 'Africa/Accra');
      const msg = bookingMessageTemplate({
        firstName: row.name?.split(' ')[0],
        serviceName: row.service_type,
        dateStr,
        timeStr,
        businessName: 'LunaBloom Spa',      // ← change to your brand if needed
        location: 'Ridge, Accra',           // ← your address
        phoneForCalls: '+233 55 000 0000',  // ← your phone line
      });

      const wa = buildWhatsAppLink(normalizeGhana(row.whatsapp), msg);
      if (!wa) {
        pushToast('error', 'No valid WhatsApp number for this client.');
        return;
      }

      const win = window.open(wa, '_blank', 'noopener');
      if (!win) window.location.href = wa; // popup fallback

      // ✅ ADDED: log that WhatsApp was opened
      await logEvent(row.id, 'whatsapp_opened', {
        admin: adminName || 'admin',
        to: row.whatsapp
      });

      // ✅ ADDED: log confirmed (mirror updateStatus behavior)
      await logEvent(row.id, 'booking_confirmed', { admin: adminName || 'admin' });
    } catch (e) {
      console.error(e);
      pushToast('error', 'Something went wrong confirming booking.');
    }
  }

  async function handleLogout() {
    try { await supabase.rpc('admin_logout', { p_token: token }); }
    finally { onLogout(); }
  }

  // ---------- Helpers ----------
  function currentRangeLabel() {
    if (tab === 'home') return 'Today';
    if (tab === 'calendar' || tab === 'stats' || tab === 'settings' || tab === 'history') {
      if (chip === 'all') return 'All time';
      if (chip === 'custom') return `${customFrom || '—'} → ${customTo || '—'}`;
      const { from, to } = rangeForChip(chip);
      return `${from ?? '—'} → ${to ?? '—'}`;
    }
    if (chip === 'all') return 'All time';
    if (chip === 'custom') return `${customFrom || '—'} → ${customTo || '—'}`;
    const { from, to } = rangeForChip(chip);
    return `${from ?? '—'} → ${to ?? '—'}`;
  }

  function normalizeGhana(raw: string) {
    const digits = (raw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10 && digits.startsWith('0')) return `233${digits.slice(1)}`; // 0XXXXXXXXX -> 233XXXXXXXXX
    if (digits.startsWith('233')) return digits;
    return digits; // already international or unknown; best effort
  }

  function downloadCSV() {
    const headers = ['id','name','whatsapp','email','service_type','preferred_date','preferred_time','status','created_at','notes'];
    const lines = [headers.join(',')];
    filteredRows.forEach(r => {
      const vals = [
        r.id, r.name, normalizeGhana(r.whatsapp), r.email, r.service_type,
        r.preferred_date, r.preferred_time, r.status, r.created_at,
        (r.notes || '').replace(/\n/g,' ').replace(/,/g,';')
      ];
      lines.push(vals.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(','));
    });
    const labelRaw = tab === 'home' ? 'today'
      : chip === 'all' ? 'all_time'
      : chip === 'custom' ? `${customFrom || 'na'}_to_${customTo || 'na'}`
      : currentRangeLabel();
    const label = labelRaw.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-]/g,'');
    const csv = '\uFEFF' + lines.join('\n'); // BOM for Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `bookings_${label}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushToast('success', 'CSV exported');
  }

  function openWhatsApp(raw: string) {
    const cleaned = normalizeGhana(raw);
    if (!cleaned) { pushToast('error', 'No valid phone number'); return; }
    const wa = `https://wa.me/${cleaned}`;
    const win = window.open(wa, '_blank');
    if (!win) window.location.href = wa; // popup fallback
    // Log best-effort (no await to keep UI snappy)
    logEvent('N/A', 'whatsapp_opened', { admin: adminName || 'admin', to: raw });
  }
  function callNumber(raw: string) {
    const cleaned = normalizeGhana(raw);
    if (!cleaned) { pushToast('error', 'No valid phone number'); return; }
    window.location.href = `tel:${cleaned}`;
  }
  async function copyNumber(raw: string) {
    try { await navigator.clipboard.writeText(normalizeGhana(raw) || ''); pushToast('success', 'Number copied'); }
    catch { pushToast('error', 'Copy failed'); }
  }

  const chips: { key: ChipKey; label: string; bump?: boolean }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'today',    label: 'Today' },
    { key: 'week',     label: 'This Week' },
    { key: 'last30',   label: 'Last 30 days' },
    { key: 'all',      label: 'All time' },
    { key: 'custom',   label: 'Custom' },
  ];

  // ---------- Layout ----------
  return (
    <div className="min-h-screen bg-[#FFF8F0] flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 flex-col border-r border-[#C9A9A6]/20 bg-white/80 backdrop-blur-sm">
        <div className="px-4 py-5 border-b border-[#C9A9A6]/20">
          <div className="flex items-center gap-2">
            <Flower2 className="w-6 h-6 text-[#C9A9A6]" />
            <span className="font-semibold text-gray-800">LunaBloom Admin</span>
          </div>
        </div>
        <nav className="p-2 text-sm">
          <SidebarItem active={tab==='home'}     onClick={()=>{ setTab('home'); setPage(1); }} label="Home (Today)" icon="🏠" />
          <SidebarItem active={tab==='calendar'} onClick={()=>{ setTab('calendar'); setPage(1); }} label="Calendar" icon="📅" />
          <SidebarItem active={tab==='stats'}    onClick={()=>{ setTab('stats'); }} label="Stats" icon="📊" />
          <SidebarItem active={tab==='history'}  onClick={()=>{ setTab('history'); }} label="History" icon="🕓" />
          <SidebarItem active={tab==='settings'} onClick={()=>{ setTab('settings'); }} label="Settings" icon="⚙️" />
        </nav>
        <div className="mt-auto p-3 border-t border-[#C9A9A6]/20 text-xs text-gray-600">
          {adminName ? <>Signed in as <span className="font-medium">{adminName}</span></> : 'Admin'}
        </div>
      </aside>

      {/* Right main area (header + pages) */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="px-6 py-6 border-b border-[#C9A9A6]/20 bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-30">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 group transition-transform duration-200 hover:scale-105"
                title="Visit LunaBloom Spa"
              >
                <Flower2 className="w-8 h-8 text-[#C9A9A6] transition-transform duration-200 group-hover:rotate-12" />
                <span className="text-xl font-semibold text-gray-800 group-hover:text-[#C9A9A6] transition-colors"></span>
              </a>
              <div className="border-l border-gray-300 pl-4 ml-2">
                <h1 className="text-lg font-medium text-gray-700">Admin Dashboard</h1>
                {adminName ? <p className="text-xs text-gray-500">Signed in as {adminName}</p> : null}
                <p className="text-xs text-[#C9A9A6] mt-0.5">Range: {currentRangeLabel()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchAll(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#C9A9A6]/30 bg-white hover:bg-[#FFF8F0] transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 text-[#C9A9A6] ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline text-gray-700">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
              </button>
              <button
                onClick={downloadCSV}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] text-white hover:shadow-lg transition-all"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={handleLogout}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#C9A9A6]/30 hover:bg-[#FFF8F0] transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4 text-gray-700" />
                Log Out
              </button>
            </div>
          </div>
        </div>

        {/* DESKTOP filters (md+) */}
        <div className="px-6 py-4 border-b border-[#C9A9A6]/20 bg-white/90 hidden md:block">
          <div className="max-w-7xl mx-auto grid grid-cols-12 gap-3">
            {/* Chips (desktop) */}
            <div className="col-span-5">
              <div className="flex flex-wrap gap-2">
                {chips.map(c => (
                  <button
                    key={c.key}
                    onClick={() => { setPage(1); setChip(c.key); setTab('calendar'); }}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                      chip === c.key && tab==='calendar'
                        ? 'bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] text-white border-transparent'
                        : 'bg-white border-[#C9A9A6]/30 hover:bg-[#FFF8F0]'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Search */}
            <div className="col-span-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
                <input
                  value={q}
                  onChange={(e) => { setPage(1); setQ(e.target.value); }}
                  placeholder="Search name, phone, email, notes…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#C9A9A6]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A9A6]/40 focus:border-[#C9A9A6]"
                />
              </div>
            </div>
            {/* Status */}
            <div className="col-span-2">
              <select
                value={status}
                onChange={(e) => { setPage(1); setStatus(e.target.value); }}
                className="w-full px-3 py-2 rounded-lg border border-[#C9A9A6]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A9A6]/40 focus:border-[#C9A9A6]"
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            {/* Service */}
            <div className="col-span-2">
              <select
                value={service}
                onChange={(e) => { setPage(1); setService(e.target.value); }}
                className="w-full px-3 py-2 rounded-lg border border-[#C9A9A6]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A9A6]/40 focus:border-[#C9A9A6]"
              >
                <option value="">All services</option>
                {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Custom range when chip === custom */}
            {chip === 'custom' && tab==='calendar' && (
              <div className="col-span-12 mt-2 flex gap-2">
                <input type="date" value={customFrom} onChange={(e)=>{ setPage(1); setCustomFrom(e.target.value); }} className="px-3 py-2 rounded-lg border border-[#C9A9A6]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A9A6]/40" />
                <input type="date" value={customTo}   onChange={(e)=>{ setPage(1); setCustomTo(e.target.value); }}   className="px-3 py-2 rounded-lg border border-[#C9A9A6]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A9A6]/40" />
                <div className="flex items-center gap-2 text-[#C9A9A6]"><Filter className="w-4 h-4" /> Custom range</div>
              </div>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div className="px-6 pb-24 md:pb-10">
          <div className="max-w-7xl mx-auto">
            {/* Error banner */}
            {error && (
              <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* HISTORY tab (desktop & mobile via Settings link) */}
            {tab === 'history' && (
              <div className="px-0 md:px-0 py-4">
                <div className="bg-white border border-[#C9A9A6]/20 rounded-2xl shadow-sm">
                  <HistoryPage token={token} />
                </div>
              </div>
            )}

            {/* STATS tab */}
            {tab === 'stats' && (
              <div className="py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 animate-fade-in">
                <StatCard icon={<Database className="w-4 h-4" />} label="Total" value={counts.total} />
                <StatCard icon={<Clock className="w-4 h-4" />} label="Pending" value={counts.pending} />
                <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Confirmed" value={counts.confirmed} />
                <StatCard icon={<XCircle className="w-4 h-4" />} label="Cancelled" value={counts.cancelled} />
                <StatCard icon={<CalendarRange className="w-4 h-4" />} label="Today" value={counts.today} />
                <StatCard icon={<Users className="w-4 h-4" />} label="This week" value={counts.this_week} />
              </div>
            )}

            {/* SETTINGS tab */}
            {tab === 'settings' && (
              <div className="py-6 space-y-3">
                <div className="bg-white border border-[#C9A9A6]/20 rounded-2xl p-6 shadow-sm">
                  <div className="mb-4">
                    <div className="font-medium text-lg mb-1">Change Password</div>
                    <div className="text-sm text-neutral-500">Update your admin account password.</div>
                  </div>
                  <ChangePasswordForm
                    token={token}
                    onSuccess={() => {
                      pushToast('success', 'Password changed successfully. Please log in again.');
                      setTimeout(() => handleLogout(), 2000);
                    }}
                    onError={(message) => {
                      pushToast('error', message);
                    }}
                  />
                </div>

                <div className="bg-white border border-[#C9A9A6]/20 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Export CSV</div>
                      <div className="text-sm text-neutral-500">Download rows for the current range.</div>
                    </div>
                    <button onClick={downloadCSV} className="px-3 py-2 rounded-lg bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] text-white hover:shadow-lg transition-all inline-flex items-center gap-2">
                      <Download className="w-4 h-4" /> Export
                    </button>
                  </div>
                </div>

                {/* ✅ ADDED: Mobile Settings → History quick link */}
                <div className="bg-white border border-[#C9A9A6]/20 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Activity History</div>
                      <div className="text-sm text-neutral-500">View all confirmations, cancellations, messages.</div>
                    </div>
                    <button
                      onClick={()=>setTab('history')}
                      className="px-3 py-2 rounded-lg border border-[#C9A9A6]/30 hover:bg-[#FFF8F0] transition-colors"
                    >
                      Open
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-[#C9A9A6]/20 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Sign out</div>
                      <div className="text-sm text-neutral-500">End your admin session.</div>
                    </div>
                    <button onClick={handleLogout} className="px-3 py-2 rounded-lg border border-[#C9A9A6]/30 hover:bg-[#FFF8F0] transition-colors inline-flex items-center gap-2">
                      <LogOut className="w-4 h-4" /> Log Out
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* HOME & CALENDAR (card list + actions) */}
            {(tab === 'home' || tab === 'calendar') && (
              <div className="bg-white border border-[#C9A9A6]/20 rounded-2xl overflow-hidden shadow-sm">
                <div className="divide-y">
                  {loading && rows.length === 0 ? (
                    <>
                      <SkeletonCard />
                      <SkeletonCard />
                      <SkeletonCard />
                    </>
                  ) : filteredRows.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No bookings found.</div>
                  ) : (
                    pageRows.map(row => (
                      <div key={row.id} className="p-4 sm:p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-[#FFF8F0]/50 transition-colors">
                        <div className="space-y-1 min-w-0">
                          <div className="font-medium text-gray-800 truncate">{row.name || '—'}</div>
                          <div className="text-sm text-gray-600 truncate">
                            {row.service_type || 'Service'} • {row.preferred_date}{row.preferred_time ? ` • ${row.preferred_time}` : ''}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{row.email}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <StatusPill status={row.status} />
                            <button
                              onClick={() => setContactFor(row.id)}
                              className="text-xs px-2 py-1 rounded border border-[#C9A9A6]/30 hover:bg-[#C9A9A6]/10 text-[#C9A9A6] inline-flex items-center gap-1 transition-colors"
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
                            <button onClick={() => confirmAndWhatsApp(row)} className="px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs hover:bg-emerald-50 transition-colors">Confirm</button>
                          )}
                          {row.status !== 'pending' && (
                            <button onClick={() => updateStatus(row.id, 'pending')} className="px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 text-xs hover:bg-amber-50 transition-colors">Pending</button>
                          )}
                          {row.status !== 'cancelled' && (
                            <button onClick={() => updateStatus(row.id, 'cancelled')} className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs hover:bg-rose-50 transition-colors">Cancel</button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {filteredRows.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-[#C9A9A6]/20 bg-[#FFF8F0]">
                    <div className="text-xs text-gray-600">
                      Page {page} of {Math.max(1, Math.ceil(filteredRows.length / pageSize))} • {filteredRows.length} row{filteredRows.length === 1 ? '' : 's'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-[#C9A9A6]/30 text-xs disabled:opacity-40 hover:bg-white transition-colors">Prev</button>
                      <button onClick={() => setPage(p => Math.min(Math.max(1, Math.ceil(filteredRows.length / pageSize)), p + 1))} disabled={page >= Math.ceil(filteredRows.length / pageSize)} className="px-3 py-1.5 rounded-lg border border-[#C9A9A6]/30 text-xs disabled:opacity-40 hover:bg-white transition-colors">Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* FAB (Home/Calendar only) */}
        {(tab === 'home' || tab === 'calendar') && (
          <button
            onClick={() => window.open('/book', '_blank')}
            className="fixed bottom-20 right-6 md:hidden rounded-full shadow-lg bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] text-white p-4 hover:shadow-xl transition-all"
            title="Add booking"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}

        {/* Bottom Navigation (mobile only) */}
        <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white/90 backdrop-blur-sm border-t border-[#C9A9A6]/20 shadow-sm z-40">
          <div className="max-w-7xl mx-auto grid grid-cols-4 text-xs">
            <TabButton active={tab==='home'}     onClick={()=>{ setTab('home');     setPage(1); }} icon={<HomeIcon className="w-5 h-5" />}     label="Home"     bump={bumpHome} />
            <TabButton active={tab==='calendar'} onClick={()=>{ setTab('calendar'); setPage(1); }} icon={<CalendarDays className="w-5 h-5" />} label="Calendar" bump={bumpCalendar} />
            <TabButton active={tab==='stats'}    onClick={()=>{ setTab('stats'); }}                 icon={<BarChart2 className="w-5 h-5" />}   label="Stats" />
            <TabButton active={tab==='settings'} onClick={()=>{ setTab('settings'); }}              icon={<SettingsIcon className="w-5 h-5" />} label="Settings" />
          </div>
        </nav>

        {/* Toasts */}
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-4 z-50 space-y-2 w-[92%] max-w-sm">
          {toastList.map(t => (
            <div
              key={t.id}
              className={`px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
                t.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : t.type === 'error' ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-[#FFF8F0] border-[#C9A9A6]/40 text-gray-800'
              }`}
            >
              {t.msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Small components ---------- */

function TabButton({ active, onClick, icon, label, bump }:{
  active: boolean; onClick: ()=>void; icon: React.ReactNode; label: string; bump?: boolean;
}) {
  return (
    <button onClick={onClick} className={`relative flex flex-col items-center justify-center py-2 transition-colors ${
      active ? 'text-[#C9A9A6]' : 'text-gray-500 hover:text-[#C9A9A6]'
    }`}>
      {icon}
      <span className="mt-0.5 text-xs">{label}</span>
      {bump && <span className="absolute top-1 right-6 h-2 w-2 rounded-full bg-[#C9A9A6] animate-pulse" />}
    </button>
  );
}

function StatusPill({ status }: { status: 'pending'|'confirmed'|'cancelled' }) {
  const cls =
    status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' :
    status === 'cancelled' ? 'bg-rose-50 text-rose-700 border border-rose-300' :
    'bg-amber-50 text-amber-700 border border-amber-300';
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}

function SkeletonCard() {
  return (
    <div className="p-4 animate-pulse">
      <div className="h-4 w-1/3 bg-[#C9A9A6]/20 rounded mb-2" />
      <div className="h-3 w-1/2 bg-[#C9A9A6]/20 rounded mb-2" />
      <div className="h-3 w-1/4 bg-[#C9A9A6]/20 rounded mb-3" />
      <div className="flex gap-2">
        <div className="h-7 w-20 bg-[#C9A9A6]/20 rounded" />
        <div className="h-7 w-20 bg-[#C9A9A6]/20 rounded" />
        <div className="h-7 w-20 bg-[#C9A9A6]/20 rounded" />
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
      <div className="absolute z-20 mt-2 p-2 bg-white border border-[#C9A9A6]/20 rounded-xl shadow-lg">
        <div className="text-xs text-[#C9A9A6] font-medium px-2 pt-1 pb-2">Contact</div>
        <button onClick={() => { onWhatsApp(); onClose(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#FFF8F0] transition-colors text-gray-700">
          <MessageCircle className="w-4 h-4 text-[#C9A9A6]" /> WhatsApp
        </button>
        <button onClick={() => { onCall(); onClose(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#FFF8F0] transition-colors text-gray-700">
          <Phone className="w-4 h-4 text-[#C9A9A6]" /> Call
        </button>
        <button onClick={() => { onCopy(); onClose(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#FFF8F0] transition-colors text-gray-700">
          <Copy className="w-4 h-4 text-[#C9A9A6]" /> Copy number
        </button>
      </div>
      <div className="fixed inset-0 z-10" onClick={onClose} />
    </div>
  );
}

function StatCard({ icon, label, value }:{ icon: React.ReactNode; label: string; value: number | string; }) {
  return (
    <div className="bg-white border border-[#C9A9A6]/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <div className="text-gray-600 text-xs font-medium">{label}</div>
        <div className="text-[#C9A9A6]">{icon}</div>
      </div>
      <div className="mt-2 text-2xl font-semibold bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] bg-clip-text text-transparent">{value}</div>
    </div>
  );
}

// ✅ ADDED: Sidebar item component
function SidebarItem({ active, onClick, label, icon }: { active:boolean; onClick:()=>void; label:string; icon:string; }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg mb-1 text-left ${
        active ? 'bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] text-white' : 'hover:bg-[#FFF8F0]'
      }`}
    >
      <span className="text-base">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
