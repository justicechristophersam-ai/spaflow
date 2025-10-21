import { useEffect, useMemo, useState } from 'react';
import { Flower2, Calendar, Clock, User, Phone, Mail, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function BookingPage() {
  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    email: '',
    service_type: '',
    preferred_date: '',
    preferred_time: '',
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // NEW: availability state
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);

  const services = [
    'Full Body Massage',
    'Deep Cleansing Facial',
    'Aromatherapy',
    'Body Scrub & Glow',
    "Couple's Package"
  ];

  const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/levm75ny7sndfg22njcofbsb2shnjiwo';

  // ---------------------------
  // Helpers (opening hours + slots)
  // ---------------------------

  // 0 = Sun ... 6 = Sat
  const HOURS: Record<number, { open: string; close: string }> = {
    0: { open: '10:00', close: '21:00' }, // Sunday
    1: { open: '10:00', close: '21:00' }, // Monday
    2: { open: '10:00', close: '21:00' }, // Tuesday
    3: { open: '10:30', close: '22:00' }, // Wednesday
    4: { open: '10:30', close: '22:00' }, // Thursday
    5: { open: '10:30', close: '22:00' }, // Friday
    6: { open: '10:30', close: '22:00' }  // Saturday
  };

  // per-service durations (minutes)
  const serviceDuration = useMemo(() => {
    switch (formData.service_type) {
      case "Couple's Package": return 90;
      case 'Body Scrub & Glow': return 75;
      default: return 60; // Full Body Massage, Facial, Aromatherapy
    }
  }, [formData.service_type]);

  // Generate all potential slots for a given date respecting opening hours
  function generateSlotsForDate(
    dateISO: string,            // "YYYY-MM-DD"
    durationMins: number,
    bufferMins = 0,
    leadTimeMins = 120          // prevent offering very short-notice slots
  ): string[] {
    if (!dateISO) return [];

    const [y, m, d] = dateISO.split('-').map(Number);
    const localDate = new Date(y, m - 1, d);
    const dow = localDate.getDay();
    const hours = HOURS[dow];
    if (!hours) return [];

    const [oh, om] = hours.open.split(':').map(Number);
    const [ch, cm] = hours.close.split(':').map(Number);

    const start = new Date(y, m - 1, d, oh, om, 0);
    const end   = new Date(y, m - 1, d, ch, cm, 0);

    // Apply lead time if booking for today
    const now = new Date();
    if (start.toDateString() === now.toDateString()) {
      const minStart = new Date(now.getTime() + leadTimeMins * 60000);
      if (minStart > start) {
        start.setTime(minStart.getTime());
        // snap minutes to next 5-min mark so labels look clean
        start.setMinutes(Math.ceil(start.getMinutes() / 5) * 5, 0, 0);
      }
    }

    const slots: string[] = [];
    const step = (durationMins + bufferMins) * 60000;

    for (let t = start.getTime(); t + durationMins * 60000 <= end.getTime(); t += step) {
      const dt = new Date(t);
      const hh = String(dt.getHours()).padStart(2, '0');
      const mm = String(dt.getMinutes()).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
    return slots;
  }

  function formatTimeLabel(hhmm: string) {
    const [hh, mm] = hhmm.split(':').map(Number);
    const dt = new Date(0, 0, 0, hh, mm);
    return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  // recompute slots & fetch booked slots when date or service changes
  useEffect(() => {
    async function refreshAvailability() {
      const { preferred_date, service_type } = formData;

      if (!preferred_date || !service_type) {
        setBookedTimes([]);
        setAvailableTimes([]);
        return;
      }

      // 1) All possible slots for this date/service
      const allSlots = generateSlotsForDate(preferred_date, serviceDuration, 0, 120);

      // 2) Fetch already booked times (pending + confirmed)
      const { data, error } = await supabase
        .from('bookings')
        .select('preferred_time, status')
        .eq('preferred_date', preferred_date)
        .eq('service_type', service_type)
        .in('status', ['pending', 'confirmed']);

      if (error) {
        console.error('Error loading booked slots', error);
        setBookedTimes([]);
        setAvailableTimes(allSlots);
        return;
      }

      const taken = (data ?? []).map((r: any) => String(r.preferred_time).slice(0, 5));
      setBookedTimes(taken);

      const free = allSlots.filter((t) => !taken.includes(t));
      setAvailableTimes(free);

      // Clear selected time if it just became unavailable
      if (formData.preferred_time && !free.includes(formData.preferred_time)) {
        setFormData((s) => ({ ...s, preferred_time: '' }));
      }
    }

    refreshAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.preferred_date, formData.service_type, serviceDuration]);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Re-check the slot right before insert (race-condition safe)
      const { data: clash, error: clashErr } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('service_type', formData.service_type)
        .eq('preferred_date', formData.preferred_date)
        .eq('preferred_time', formData.preferred_time)
        .in('status', ['pending', 'confirmed']);

      if (clashErr) {
        console.error('Availability re-check failed:', clashErr);
      } else if ((clash as any)?.length > 0) {
        alert('Sorry, that slot was just taken. Please choose another time.');
        setIsSubmitting(false);
        return;
      }

      // Proceed with insert (status defaults to 'pending' in DB)
      const { error } = await supabase.from('bookings').insert([
        {
          name: formData.name,
          whatsapp: formData.whatsapp,
          email: formData.email || '',
          service_type: formData.service_type,
          preferred_date: formData.preferred_date,
          preferred_time: formData.preferred_time,
          notes: formData.notes || ''
        }
      ]);

      if (error) throw error;

      // Webhook (best-effort)
      const payload = {
        name: formData.name,
        whatsapp: formData.whatsapp,
        email: formData.email || '',
        service_type: formData.service_type,
        preferred_date: formData.preferred_date,
        preferred_time: formData.preferred_time,
        notes: formData.notes || '',
        source: 'Bolt_Form'
      };

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
    } catch (error) {
      console.error('Error submitting booking:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ SUCCESS SCREEN
  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 relative">
        <img
          src="/success-bg.jpg"
          alt="Relaxing spa background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-12 text-center max-w-2xl w-full animate-fade-in">
          <div className="w-20 h-20 bg-gradient-to-br from-[#EAC7C7] to-[#C9A9A6] rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl font-bold text-[#C9A9A6] mb-4">
            Thank you, {formData.name}!
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            You'll receive a WhatsApp message shortly confirming your booking.
            We can't wait to pamper you!
          </p>
          <img
            src="/thankyou-flowers.png"
            alt="Decorative flowers"
            className="mx-auto mt-8 w-40 h-auto opacity-80"
          />
          <button
            onClick={() => {
              setIsSuccess(false);
              setFormData({
                name: '',
                whatsapp: '',
                email: '',
                service_type: '',
                preferred_date: '',
                preferred_time: '',
                notes: ''
              });
              setAvailableTimes([]);
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

  // ✅ MAIN BOOKING FORM
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F0] via-[#EAC7C7]/20 to-[#FFF8F0]">
      {/* ✅ HERO SECTION */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] py-20 px-4">
        <img
          src="/about-intro.jpg"
          alt="Spa booking background"
          className="absolute inset-0 w-full h-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Your calm begins here
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            Book a session and let us pamper you with peace and care
          </p>
        </div>
      </div>

      {/* ✅ FORM SECTION */}
      <div className="max-w-4xl mx-auto px-4 mt-6 md:-mt-12 pb-20 relative z-10">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* 🩷 Removed the old top banner here */}

          <div className="p-8 md:p-12">
            <p className="text-center text-gray-600 text-lg leading-relaxed mb-10">
              We offer tailored spa treatments designed to help you feel your best inside and out.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="w-4 h-4 inline mr-2" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#C9A9A6] focus:ring-0 transition-colors"
                    placeholder="Jane Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="w-4 h-4 inline mr-2" />
                    WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#C9A9A6] focus:ring-0 transition-colors"
                    placeholder="+233 501 234 567"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#C9A9A6] focus:ring-0 transition-colors"
                  placeholder="jane@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Sparkles className="w-4 h-4 inline mr-2" />
                  Service Type
                </label>
                <select
                  required
                  value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#C9A9A6] focus:ring-0 transition-colors"
                >
                  <option value="">Select a service</option>
                  {services.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Preferred Date
                  </label>
                  <input
                    type="date"
                    required
                    min={todayISO}
                    value={formData.preferred_date}
                    onChange={(e) => setFormData({ ...formData, preferred_date: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#C9A9A6] focus:ring-0 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Preferred Time
                  </label>

                  {/* Replaces <input type="time"> with a select bound to availableTimes */}
                  <select
                    required
                    value={formData.preferred_time}
                    onChange={(e) => setFormData({ ...formData, preferred_time: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#C9A9A6] focus:ring-0 transition-colors"
                    disabled={!formData.preferred_date || !formData.service_type}
                  >
                    <option value="">
                      {!formData.preferred_date
                        ? 'Select a date first'
                        : !formData.service_type
                        ? 'Select a service first'
                        : availableTimes.length
                        ? 'Select a time'
                        : 'Fully booked for this date'}
                    </option>

                    {availableTimes.map((t) => (
                      <option key={t} value={t}>{formatTimeLabel(t)}</option>
                    ))}
                  </select>

                  {bookedTimes.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">
                      {bookedTimes.length} slot{bookedTimes.length > 1 ? 's' : ''} already booked.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes / Special Requests
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#C9A9A6] focus:ring-0 transition-colors resize-none"
                  placeholder="Let us know if you have any allergies, preferences, or special requests..."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Confirm My Booking 💗'}
              </button>
            </form>

            {/* ✅ NEW FOOTER BANNER IMAGE (full width) */}
            <div className="mt-12">
              <img
                src="/form-top-banner.jpg"
                alt="Spa interior footer banner"
                className="w-full h-56 md:h-72 object-cover rounded-t-3xl"
              />
            </div>

            {/* ✅ FOOTER INFO */}
            <footer className="mt-8 text-center text-xs sm:text-sm text-gray-600">
              <div className="inline-block px-4 py-3 bg-[#FFF8F0] rounded-xl shadow-inner">
                <p className="leading-tight">LunaBloom Spa, East Legon, Accra</p>
                <p className="leading-tight mt-1">
                  +233 501 234 567 • hello@lunabloomspa.com
                </p>
                <p className="mt-2 text-[11px] text-gray-500">
                  © {new Date().getFullYear()} LunaBloom Spa
                </p>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
