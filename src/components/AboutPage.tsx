// src/components/AboutPage.tsx
import { MapPin, Clock, Phone, Mail, Flower2 } from 'lucide-react';

interface AboutPageProps {
  onNavigate: (page: 'book' | 'about') => void;
}

export default function AboutPage({ onNavigate }: AboutPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F0] via-[#EAC7C7]/10 to-[#FFF8F0]">
      {/* HERO: full-width image with blush overlay (mobile-first) */}
      <header className="relative overflow-hidden">
        {/* Background image (mobile-first: smaller focal height, cover on larger screens) */}
        <img
          src="/hero-spa.jpg"
          alt="LunaBloom spa therapist giving a massage"
          className="absolute inset-0 w-full h-56 sm:h-72 md:h-96 object-cover object-center"
        />
        {/* Blush overlay for readable text */}
        <div aria-hidden="true" className="absolute inset-0 bg-black/30" />

        {/* Decorative soft blur circles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="hidden md:block absolute top-6 right-6 w-28 h-28 rounded-full bg-white/10 blur-3xl" />
          <div className="hidden md:block absolute bottom-6 left-6 w-36 h-36 rounded-full bg-white/10 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-4 py-10 sm:py-14 text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-white/10 p-2 mb-4">
            <Flower2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            About LunaBloom
          </h1>
          <p className="mt-2 text-sm sm:text-base text-white/90 max-w-xl mx-auto">
            A sanctuary where relaxation meets self-care — rooted in Ghanaian warmth and floral serenity.
          </p>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-4xl mx-auto px-4 mt-6 md:-mt-10 pb-16 relative z-10">
        {/* White card with intro text */}
        <section className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 sm:p-6 md:p-8">
            <p className="text-base sm:text-lg text-gray-700 leading-relaxed text-center max-w-2xl mx-auto mt-2">
              Welcome to LunaBloom. A sanctuary where relaxation meets self-care. Nestled in the heart of Accra,
              LunaBloom offers holistic spa experiences designed to help you feel refreshed, centered, and radiant.
            </p>

            {/* floral divider */}
            <div className="flex items-center justify-center my-6 text-2xl" aria-hidden="true">
              <span className="mx-2">🌸</span>
              <span className="mx-2">•</span>
              <span className="mx-2">🌿</span>
            </div>

            {/* Contact & Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-4 p-4 bg-gradient-to-br from-[#FFF8F0] to-[#EAC7C7]/6 rounded-xl">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#EAC7C7] to-[#C9A9A6] flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Location</h3>
                  <p className="text-sm text-gray-600">East Legon, Accra</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-gradient-to-br from-[#FFF8F0] to-[#EAC7C7]/6 rounded-xl">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#EAC7C7] to-[#C9A9A6] flex items-center justify-center">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Hours</h3>
                  <p className="text-sm text-gray-600">Monday – Sunday</p>
                  <p className="text-sm text-gray-600">9:00 AM – 8:00 PM</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-gradient-to-br from-[#FFF8F0] to-[#EAC7C7]/6 rounded-xl">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#EAC7C7] to-[#C9A9A6] flex items-center justify-center">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Contact</h3>
                  <p className="text-sm text-gray-600">+233 501 234 567</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-gradient-to-br from-[#FFF8F0] to-[#EAC7C7]/6 rounded-xl">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#EAC7C7] to-[#C9A9A6] flex items-center justify-center">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Email</h3>
                  <p className="text-sm text-gray-600">hello@lunabloomspa.com</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WHY CHOOSE US */}
        <section className="mt-6 bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-4 sm:p-6 md:p-8">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#C9A9A6] text-center mb-4">
              Why Choose LunaBloom?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <img
                src="/ghanaian-spa-warmth.jpg"
                alt="Ghanaian inspired spa setup with floral decor"
                className="w-full h-48 object-cover rounded-xl"
              />
              <ul className="space-y-3 text-gray-700 text-sm sm:text-base">
                <li>Authentic Ghanaian inspired wellness treatments</li>
                <li>Over 10 years of spa and beauty expertise</li>
                <li>Premium natural oils and floral essences</li>
                <li>Friendly and professional therapists dedicated to your comfort</li>
              </ul>
            </div>
          </div>
        </section>

        {/* FEATURED SERVICES */}
        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { title: 'Aromatherapy Massage', image: '/aroma.jpg' },
            { title: 'Facial Glow Treatment', image: '/facial.jpg' },
            { title: 'Relaxation Package', image: '/relaxation.jpg' },
          ].map((card) => (
            <article
              key={card.title}
              className="rounded-xl overflow-hidden bg-white shadow-md hover:shadow-lg transition-shadow duration-200"
            >
              <div className="relative w-full h-44 sm:h-48">
                <img src={card.image} alt={card.title} className="object-cover w-full h-full" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-3">
                  <h3 className="text-white text-sm sm:text-base font-semibold">{card.title}</h3>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm text-gray-600">
                  A thoughtfully curated treatment to help you unwind and restore balance.
                </p>
              </div>
            </article>
          ))}
        </section>

        {/* CTA */}
        <div className="mt-6 text-center">
          <button
            onClick={() => onNavigate('book')}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 w-full sm:w-auto bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] text-white text-base font-semibold rounded-full shadow-lg hover:scale-[1.02] transition-transform duration-200"
            aria-label="Book a session at LunaBloom"
          >
            <span>Book a Session</span>
            <Flower2 className="w-5 h-5" />
          </button>
        </div>

        {/* FOOTER */}
        <footer className="mt-8 text-center text-xs sm:text-sm text-gray-600">
          <div className="inline-block px-4 py-3 bg-[#FFF8F0] rounded-xl shadow-inner">
            <p className="leading-tight">LunaBloom Spa, East Legon, Accra</p>
            <p className="leading-tight mt-1">+233 501 234 567 • hello@lunabloomspa.com</p>
            <p className="mt-2 text-[11px] text-gray-500">© {new Date().getFullYear()} LunaBloom Spa</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
