// src/utils/history.ts
export type HistoryAction =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_pending'
  | 'booking_cancelled'
  | 'whatsapp_opened'
  | 'note_added';

export type HistoryItem = {
  id: string;
  booking_id: string;
  action: HistoryAction;
  meta: any;
  created_at: string; // ISO
};

export const actionIcon: Record<HistoryAction, string> = {
  booking_created: '🆕',
  booking_confirmed: '✅',
  booking_pending: '⏳',
  booking_cancelled: '❌',
  whatsapp_opened: '📱',
  note_added: '📝',
};

export function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
