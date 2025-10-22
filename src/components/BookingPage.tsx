// src/components/BookingPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, User, Phone, Mail, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

type FormData = {
  name: string;
  whatsapp: string;
  email: string;
  service_type: string;
  preferred_date: string; // yyyy-mm-dd
  preferred_time: string; // HH:mm
  notes: string;
};

const SERVICES = [
  'Full Body Massage',
  'Deep Cleansing Facial',
  'Aromatherapy',
  'Body Scrub & Glow',
  "Couple's Package"
];

const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/levm75ny7sndfg22njcofbsb2shnjiwo';

// Business hours by weekday (0=Sun)
const HOURS: Record<number, { open: string; close: string }> = {
  0: { open: '10:00', close: '21:00' }, // Sunday
  1: { open: '10:00', close: '21:00' }, // Monday
  2: { open: '10:00', close: '21:00' }, // Tuesday (same as Monday per your note)
  3: { open: '10:30', close: '22:00' }, // Wednesday
  4: { open: '10:30', close: '22:00' }, // Thursday
  5: { open: '10:30', close: '22:00' }, // Friday
  6: { open: '10:30', close: '22:00' }, // Saturday
};

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function pad(n: number) { return n.toString().padStart(2, '0'); }
function toHHMM(mins: number) { const h = Math.floor(mins/60), m = mins%60; return `${pad(h)}:${pad(m)}`; }

function makeSlotsForDate(isoDate: string) {
  if (!isoDate) return [];
  const d = new Date(isoDate + 'T00:00:00');
  const day = d.getDay(); // 0..6
  const cfg = HOURS[day];
  if (!cfg) return [];
  const open = toMinutes(cfg.open);
  const close = toMinutes(cfg.close);
  const slots: string[] = [];
  for (let t = open; t <= close - 30; t += 30) slots.push(toHHMM(t));
  return slots;
}

export default function BookingPage() {
  const [formData, setFormData] = useState<FormData>({
    name: '', whatsapp: '', email: '', service_type: '',
    preferred_date: '', preferred_time: '', notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);

  // Load booked slots whenever date or service changes
  useEffect(() => {
    async function fetchBooked() {
      const { preferred_date, service_type } = formData;
      if (!preferred_date || !service_type) { setBookedTimes([]); return; }
      const { data, error } = await supabase.rpc('get_booked_slots', {
        d: preferred_date, s: service_type
      });
      if (error) {
        console.error('get_booked_slots error:', error);
        setBookedTimes([]);
        return;
      }
      setBookedTimes((data ?? []).map((r: any) => String(r.preferred_time).slice(0,5)));
    }
    fetchBooked();
  }, [formData.preferred_date, formData.service_type]);

  const allSlots = useMemo(() => makeSlotsForDate(formData.preferred_date), [formData.preferred_date]);
  const availableSlots = useMemo(
    () => allSlots.filter(t => !bookedTimes.includes(t)),
    [allSlots, bookedTimes]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Double-check slot not taken
      const { data: taken, error: takenErr } = await supabase.rpc('slot_taken', {
        d: formData.preferred_date, s: formData.service_type, t: formData.preferred_time
      });
      if (takenErr) throw takenErr;
      if (taken) {
        alert('Sorry, that time just got booked. Please pick another time.');
        return;
      }

      const { error } = await supabase.from('bookings').insert([{
        name: formData.name,
        whatsapp: formData.whatsapp,
        email: formData.email || '',
        service_type: formData.service_type,
        preferred_date: formData.preferred_date,
        preferred_time: formData.preferred_time,
        notes: formData.notes || ''
      }]);
      if (error) throw error;

      const payload = { ...formData, source: 'Bolt_Form' };
      try {
        await fetch(MAKE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (webhookErr) {
        console.error('Error sending booking to Make webhook:', webhookErr);
      }

      setIsSuccess(true);
    } catch (err) {
      console.error('Error submitting booking:', err);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Success screen
  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 relative">
        <img src="/success-bg.jpg" alt="Relaxing spa background" className="absolute inset-0 w-full h-full object-cover"/>
        <div className="relative bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-12 text-center max-w-2xl w-full animate-fade-in">
          <div className="w-20 h-20 bg-gradient-to-br from-[#EAC7C7] to-[#C9A9A6] rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl font-bold text-[#C9A9A6] mb-4">Thank you, {formData.name}!</h2>
          <p className="text-lg text-gray-600 leading-relaxed">You'll receive a WhatsApp message shortly confirming your booking. We can't wait to pamper you!</p>
          <img src="/thankyou-flowers.png" alt="Decorative flowers" className="mx-auto mt-8 w-40 h-auto opacity-80" />
          <button
            onClick={() => {
              setIsSuccess(false);
              setFormData({ name:'', whatsapp:'', email:'', service_type:'', preferred_date:'', preferred_time:'', notes:'' });
              setBookedTimes([]);
            }}
            className="mt-8 px-8 py-4 bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] text-white font-medium rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Book Another Session
          </button>
        </div>
      </div>
    );
  }

  // Form
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F0] via-[#EAC7C7]/20 to-[#FFF8F0]">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] py-20 px-4">
        <img src="/about-intro.jpg" alt="Spa booking background" className="absolute inset-0 w-full h-full object-cover opacity-90"/>
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">Your calm begins here</h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">Book a session and let us pamper you with peace and care</p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 mt-6 md:-mt-12 pb-20 relative z-10">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="p-8 md:p-12">
            <p className="text-center text-gray-600 text-lg leading-relaxed mb-10">
              We offer tailored spa treatments designed to help you feel your best inside and out.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2"><User className="w-4 h-4 inline mr-2" />Full Name</label>
                  <input
                    type="text" required value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#C9A9A6] focus:ring-0 transition-colors" placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2"><Phone className="w-4 h-4 inline mr-2" />WhatsApp Number</label>
                  <input
                    type="tel" required value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#C9A9A6] focus:ring-0 transition-colors" placeholder="+233 501 234 567"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2"><Mail className="w-4 h-4 inline mr-2" />Email</label>
                <input
                  type="email" required value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#C9A9A6] focus:ring-0 transition-colors" placeholder="jane@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2"><Sparkles className="w-4 h-4 inline mr-2" />Service Type</label>
                <select
                  required value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#C9A9A6] focus:ring-0 transition-colors"
                >
                  <option value="">Select a service</option>
                  {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2"><Calendar className="w-4 h-4 inline mr-2" />Preferred Date</label>
                  <input
                    type="date" required value={formData.preferred_date}
                    onChange={(e) => {
                      setFormData({ ...formData, preferred_date: e.target.value, preferred_time: '' });
                    }}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#C9A9A6] focus:ring-0 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2"><Clock className="w-4 h-4 inline mr-2" />Preferred Time</label>
                  <select
                    required disabled={!formData.preferred_date || !formData.service_type}
                    value={formData.preferred_time}
                    onChange={(e) => setFormData({ ...formData, preferred_time: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#C9A9A6] focus:ring-0 transition-colors"
                  >
                    <option value="">{!formData.preferred_date || !formData.service_type ? 'Select date & service first' : 'Select a time'}</option>
                    {availableSlots.map((t) => (
                      <option key={t} value={t} disabled={bookedTimes.includes(t)}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes / Special Requests</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#C9A9A6] focus:ring-0 transition-colors resize-none"
                  placeholder="Let us know if you have any allergies, preferences, or special requests..."
                />
              </div>

              <button
                type="submit" disabled={isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Confirm My Booking 💗'}
              </button>
            </form>

            <div className="mt-12">
              <img src="/form-top-banner.jpg" alt="Spa interior footer banner" className="w-full h-56 md:h-72 object-cover rounded-t-3xl" />
            </div>

            <footer className="mt-8 text-center text-xs sm:text-sm text-gray-600">
              <div className="inline-block px-4 py-3 bg-[#FFF8F0] rounded-xl shadow-inner">
                <p className="leading-tight">LunaBloom Spa, East Legon, Accra</p>
                <p className="leading-tight mt-1">+233 501 234 567 • hello@lunabloomspa.com</p>
                <p className="mt-2 text-[11px] text-gray-500">© {new Date().getFullYear()} LunaBloom Spa</p>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
