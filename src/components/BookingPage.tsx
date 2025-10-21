import { useState } from 'react';
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

  const services = [
    'Full Body Massage',
    'Deep Cleansing Facial',
    'Aromatherapy',
    'Body Scrub & Glow',
    "Couple's Package"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
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
      <div className="absolute inset-0 bg-black/30 py-12 px-4 flex flex-col items-center justify-center">
        <div className="relative w-full max-w-2xl mx-auto text-center">
          {/* ✅ Background Image for Success Section */}
          <img
            src="/success-bg.jpg"
            alt="Relaxing spa background"
            className="absolute inset-0 w-full h-full object-cover rounded-3xl opacity-20"
          />

          <div className="relative bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-12 animate-fade-in">
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

            {/* ✅ Decorative Image */}
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
              }}
              className="absolute inset-0 bg-black/30 text-white rounded-full font-medium hover:shadow-lg transition-all duration-300"
            >
              Book Another Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ MAIN BOOKING FORM
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F0] via-[#EAC7C7]/20 to-[#FFF8F0]">
      {/* ✅ HERO SECTION */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] py-20 px-4">
        {/* ✅ Background Hero Image */}
        <img
          src="/about-intro.jpg"
          alt="Spa booking background"
          className="absolute inset-0 w-full h-full object-cover opacity-90"
        />

        <div className="absolute inset-0 bg-black/30"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Flower2 className="w-16 h-16 text-white mx-auto mb-6 animate-pulse" />
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Your calm begins here
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Book a session and let us pamper you with peace and care
          </p>
        </div>
      </div>

      {/* ✅ FORM SECTION */}
      <div className="max-w-4xl mx-auto px-4 -mt-12 pb-20">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* ✅ Decorative Header Image */}
          <img
            src="/form-top-banner.jpg"
            alt="Spa interior decor"
            className="w-full h-48 object-cover"
          />

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
                  Email (Optional)
                </label>
                <input
                  type="email"
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
                  <input
                    type="time"
                    required
                    value={formData.preferred_time}
                    onChange={(e) => setFormData({ ...formData, preferred_time: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#C9A9A6] focus:ring-0 transition-colors"
                  />
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
            {/* FOOTER — compact for mobile */}
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
