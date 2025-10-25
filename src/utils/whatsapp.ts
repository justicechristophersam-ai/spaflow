// src/utils/whatsapp.ts

// Normalize a Ghana phone number into E.164 (233XXXXXXXXX)
export function normalizeGhanaNumber(raw: string) {
  if (!raw) return '';

  let s = String(raw).trim();

  // Keep a leading + for now so we can strip it cleanly, then remove all other non-digits
  if (s.startsWith('+')) s = s.slice(1);
  // Handle "00" international prefix
  if (s.startsWith('00')) s = s.slice(2);

  // Remove any remaining non-digits
  s = s.replace(/\D/g, '');

  if (!s) return '';

  // CASES:
  // 1) Local format 0XXXXXXXXX (10 digits) -> 233XXXXXXXXX
  if (s.length === 10 && s.startsWith('0')) {
    s = '233' + s.slice(1);
  }

  // 2) Bare national number without 0 (9 digits) -> 233XXXXXXXXX
  if (s.length === 9 && !s.startsWith('233')) {
    s = '233' + s;
  }

  // 3) Already has country code but contains the local 0 -> 2330XXXXXXXX -> drop the 0
  //    Sometimes stored as 2330XXXXXXXXX (13 digits total)
  if (s.startsWith('2330') && s.length === 13) {
    s = '233' + s.slice(4);
  }

  // 4) Already in correct E.164: 233XXXXXXXXX (12 digits)
  // Validate final shape
  if (s.startsWith('233') && s.length === 12) {
    return s;
  }

  // Anything else is invalid for our purposes
  return '';
}

export function buildWhatsAppLink(phoneRaw: string, message: string) {
  const phone = normalizeGhanaNumber(phoneRaw);
  if (!phone) return '';
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${phone}${text}`;
}

export function formatDateTime(dateISO: string, timeHHMM: string, tz = 'Africa/Accra') {
  const dt = new Date(`${dateISO}T${timeHHMM || '00:00'}:00`);
  const dateStr = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: tz,
  }).format(dt);
  const timeStr = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
  }).format(dt);
  return { dateStr, timeStr };
}

export function bookingMessageTemplate(b: {
  firstName?: string;
  serviceName: string;
  dateStr: string;
  timeStr: string;
  businessName?: string;
  location?: string;
  phoneForCalls?: string;
}) {
  const name = b.firstName ? ` ${b.firstName}` : '';
  const biz = b.businessName || 'Our Spa';
  const loc = b.location ? `\nLocation: ${b.location}` : '';
  const call = b.phoneForCalls ? `\nCall: ${b.phoneForCalls}` : '';

  return (
    `Hello${name}, your *${b.serviceName}* on *${b.dateStr}* at *${b.timeStr}* has been *confirmed* ✅ at ${biz}.${loc}` +
    `\n\nIf you need to reschedule, please reply here at least 4 hours before your time.${call}` +
    `\n\nWe look forward to seeing you!`
  );
}
