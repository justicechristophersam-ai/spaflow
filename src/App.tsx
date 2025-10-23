import { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import BookingPage from './components/BookingPage';
import AboutPage from './components/AboutPage';
import { updateMetaTags, pageMetaTags } from './lib/metaTags';

function App() {
  const [currentPage, setCurrentPage] = useState<'book' | 'about'>('book');

  useEffect(() => {
    const metaConfig = currentPage === 'book' ? pageMetaTags.booking : pageMetaTags.about;
    updateMetaTags(metaConfig);
  }, [currentPage]);

  return (
    <div className="min-h-screen bg-[#FFF8F0]">
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />
      {currentPage === 'book' ? (
        <BookingPage />
      ) : (
        <AboutPage onNavigate={setCurrentPage} />
      )}
    </div>
  );
}

export default App;
