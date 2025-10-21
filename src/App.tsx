import { useState } from 'react';
import Navigation from './components/Navigation';
import BookingPage from './components/BookingPage';
import AboutPage from './components/AboutPage';

function App() {
  const [currentPage, setCurrentPage] = useState<'book' | 'about'>('book');

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
