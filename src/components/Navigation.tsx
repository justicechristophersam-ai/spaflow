import { Flower2 } from 'lucide-react';

interface NavigationProps {
  currentPage: 'book' | 'about';
  onNavigate: (page: 'book' | 'about') => void;
}

export default function Navigation({ currentPage, onNavigate }: NavigationProps) {
  return (
    <nav className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* ✅ Logo Section - clickable and responsive */}
          <button
            onClick={() => onNavigate('book')} // navigate to home (book page)
            className="flex items-center space-x-2 focus:outline-none group"
          >
            <Flower2 className="w-8 h-8 sm:w-10 sm:h-10 text-[#C9A9A6] transition-transform duration-200 group-hover:scale-110" />
            
            </span>
          </button>

          {/* ✅ Navigation Links */}
          <div className="flex space-x-6 sm:space-x-8">
            <button
              onClick={() => onNavigate('book')}
              className={`text-base font-medium transition-colors ${
                currentPage === 'book'
                  ? 'text-[#C9A9A6] border-b-2 border-[#C9A9A6]'
                  : 'text-gray-600 hover:text-[#C9A9A6]'
              }`}
            >
              Book a Session
            </button>

            <button
              onClick={() => onNavigate('about')}
              className={`text-base font-medium transition-colors ${
                currentPage === 'about'
                  ? 'text-[#C9A9A6] border-b-2 border-[#C9A9A6]'
                  : 'text-gray-600 hover:text-[#C9A9A6]'
              }`}
            >
              About Us
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
}
