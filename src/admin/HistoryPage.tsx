// src/admin/HistoryPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { actionIcon, HistoryItem, HistoryAction, formatWhen } from '../utils/history';
import { Search } from 'lucide-react';

export default function HistoryPage({ token }: { token: string }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  // filters
  const [qAdmin, setQAdmin] = useState('');
  const [qType, setQType] = useState<HistoryAction | ''>('');
  const [range, setRange] = useState<'today'|'week'|'all'>('today');

  const rangeDates = useMemo(() => {
    const now = new Date();
    const toISO = (d: Date) => d.toISOString().slice(0,10);
    if (range === 'today') {
      const d = toISO(now);
      return { d_from: d, d_to: d };
    }
    if (range === 'week') {
      const start = new Date(now);
      const monday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - monday);
      return { d_from: toISO(start), d_to: toISO(now) };
    }
    return { d_from: null as any, d_to: null as any };
  }, [range]);

  async function fetchHistory() {
    try {
      setLoading(true); setErr(null);
      const { data, error } = await supabase.rpc('list_booking_events_admin', {
        p_token: token,
        d_from: rangeDates.d_from,
        d_to: rangeDates.d_to,
        p_action: qType || null,
        p_admin: qAdmin || null,
        p_limit: 100,
        p_offset: 0,
      });
      if (error) throw error;
      setItems((data || []) as HistoryItem[]);
    } catch (e:any) {
      console.error('history fetch error', e);
      setErr(e.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchHistory(); /* eslint-disable react-hooks/exhaustive-deps */ }, [range, qType]);

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          value={range}
          onChange={e=>setRange(e.target.value as any)}
          className="px-3 py-2 rounded-lg border border-[#C9A9A6]/30"
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="all">All time</option>
        </select>
        <select
          value={qType}
          onChange={e=>setQType(e.target.value as any)}
          className="px-3 py-2 rounded-lg border border-[#C9A9A6]/30"
        >
          <option value="">All actions</option>
          <option value="booking_created">New booking</option>
          <option value="booking_confirmed">Confirmed</option>
          <option value="booking_pending">Pending</option>
          <option value="booking_cancelled">Cancelled</option>
          <option value="whatsapp_opened">WhatsApp opened</option>
          <option value="note_added">Note added</option>
        </select>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
          <input
            value={qAdmin}
            onChange={(e)=>setQAdmin(e.target.value)}
            placeholder="Filter by admin name…"
            className="pl-9 pr-3 py-2 rounded-lg border border-[#C9A9A6]/30"
          />
        </div>
        <button
          onClick={fetchHistory}
          className="px-3 py-2 rounded-lg border border-[#C9A9A6]/30 hover:bg-[#FFF8F0]"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white border border-[#C9A9A6]/20 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading…</div>
        ) : err ? (
          <div className="p-6 text-center text-rose-600">{err}</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No activity in this range.</div>
        ) : (
          <ul className="divide-y">
            {items.map((it) => {
              const icon = actionIcon[it.action] || '•';
              const client = it.meta?.client || it.meta?.name || '';
              const service = it.meta?.service || '';
              const admin = it.meta?.admin ? ` • by ${it.meta.admin}` : '';
              const when = formatWhen(it.created_at);
              return (
                <li key={it.id} className="p-4 hover:bg-[#FFF8F0]/40">
                  <div className="text-sm">
                    <span className="mr-2">{icon}</span>
                    <span className="font-medium capitalize">{it.action.replace('_',' ')}</span>
                    {client ? <> — <span className="font-medium">{client}</span></> : null}
                    {service ? <> · <span className="text-gray-600">{service}</span></> : null}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{when}{admin}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
