// src/utils/whatsapp.ts

// ✅ Converts local Ghana numbers (0XXXXXXXXX) into international format (233XXXXXXXXX)
export function toE164(rawPhone: string, defaultCountry: 'GH' | 'INTL' = 'GH') {
  let p = (rawPhone || '').replace(/[^\d]/g, '');
  if (!p) return '';

  if (defaultCountry === 'GH') {
    if (p.startsWith('0') && p.length === 10) p = '233' + p.slice(1);
  }
  return p;
}

// ✅ Builds a WhatsApp deeplink with prefilled text
export function buildWhatsAppLink(phoneRaw: string, message: string) {
  const phone = toE164(phoneRaw, 'GH');
  if (!phone) return '';
  const text = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${text}`;
}

// ✅ Formats a combined date/time for human-readable message
export function formatDateTime(dateISO: string, timeHHMM: string, tz = 'Africa/Accra') {
  const dt = new Date(`${dateISO}T${timeHHMM}:00`);
  const dateStr = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: tz,
  }).format(dt);
  const timeStr = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
  }).format(dt);
  return { dateStr, timeStr };
}

// ✅ Creates the confirmation message content
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
