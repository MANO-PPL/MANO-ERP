
import React from 'react';
import { Search, Bell, ChevronDown, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocation } from 'react-router-dom';

const TopBar = () => {
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  const getPageTitle = () => {
    if (location.pathname.startsWith('/projects/')) {
      const id = location.pathname.split('/')[2];
      return `${id} Explore Zoho Projects!`;
    }

    if (location.pathname === '/collaboration') {
      const hash = location.hash.replace('#', '');
      return hash === 'calendar' ? 'Calendar' : 'Chat';
    }

    switch (location.pathname) {
      case '/': return 'Dashboard';
      case '/projects': return 'Projects';
      case '/vendors': return 'Vendors';
      case '/clients': return 'Clients';
      default: return 'MANO-ERP';
    }
  };

  return (
    <div className="h-[8vh] min-h-[60px] bg-white dark:bg-gh-bg border-b border-gray-200 dark:border-gh-border flex items-center justify-between px-6 sticky top-0 z-10 w-full transition-colors">
      {/* Left: Dynamic Page Title */}
      <div className="flex items-center min-w-[150px]">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white capitalize tracking-tight">
          {getPageTitle()}
        </h1>
      </div>

      {/* Center: Global Search */}
      {(location.pathname !== '/' && !location.pathname.startsWith('/projects/') && location.pathname !== '/collaboration') ? (
        <div className="flex-1 w-[40%] mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gh-muted" size={18} />
            <input
              type="text"
              placeholder="Search projects, documents, tasks..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gh-input border border-gray-200 dark:border-gh-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-gh-accent focus:bg-white dark:focus:bg-gh-subtle transition-all text-sm text-gray-900 dark:text-gh-text placeholder-gray-400 dark:placeholder-gh-muted"
            />
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Right: Actions & Profile */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-gray-500 hover:text-blue-600 dark:text-gh-muted dark:hover:text-gh-accent transition-colors"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button className="text-gray-500 hover:text-blue-600 dark:text-gh-muted dark:hover:text-gh-accent relative transition-colors">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <div className="flex items-center space-x-3 cursor-pointer border-l pl-4 border-gray-200 dark:border-gh-border transition-colors">
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold text-gray-800 dark:text-gh-text whitespace-nowrap">Admin User</p>
            <p className="text-xs text-gray-500 dark:text-gh-muted whitespace-nowrap">PM</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800 text-sm transition-colors">
            AU
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
