
import React, { useState } from 'react';
import { Search, Bell, ChevronDown, Moon, Sun, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../../services/authApi';
import { setAccessToken } from '../../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const TopBar = () => {
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = async () => {
      try {
          await logout();
          toast.success('Logged out successfully');
      } catch (err) {
          console.error(err);
      }
  };

  const getPageTitle = () => {
    if (location.pathname.startsWith('/projects/')) {
      const id = location.pathname.split('/')[2];
      return `${id} Explore Zoho Projects!`;
    }

    if (location.pathname === '/collaboration') {
      const hash = location.hash.replace('#', '');
      return hash === 'calendar' ? 'Calendar' : 'Chat';
    }

    if (location.pathname === '/admin') return 'Employee';

    switch (location.pathname) {
      case '/': return 'Dashboard';
      case '/projects': return 'Projects';
      case '/vendors': return 'Vendors';
      case '/clients': return 'Clients';
      default: return 'MANO-ERP';
    }
  };

  return (
    <div className="h-[7vh] min-h-[52px] bg-white dark:bg-gh-bg border-b border-gray-200 dark:border-gh-border flex items-center justify-between px-6 sticky top-0 z-[30] w-full transition-colors">
      {/* Left: Dynamic Page Title */}
      <div className="flex items-center min-w-[150px]">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white capitalize tracking-tight">
          {getPageTitle()}
        </h1>
      </div>

      {/* Center: Global Search */}
      {(location.pathname !== '/' && !location.pathname.startsWith('/projects/') && location.pathname !== '/projects' && location.pathname !== '/collaboration' && location.pathname !== '/admin' && location.pathname !== '/vendors') ? (
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

        <div className="relative">
            <div 
                className="flex items-center space-x-3 cursor-pointer border-l pl-4 border-gray-200 dark:border-gh-border transition-colors hover:opacity-80"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <div className="text-right hidden md:block">
                <p className="text-sm font-semibold text-gray-800 dark:text-gh-text whitespace-nowrap">{user?.user_name || 'User'}</p>
                <p className="text-xs text-gray-500 dark:text-gh-muted whitespace-nowrap">{user?.desg_name || user?.user_type || 'Employee'}</p>
              </div>
              {user?.profile_image_url ? (
                <img 
                  src={user.profile_image_url} 
                  alt={user?.user_name} 
                  className="w-8 h-8 rounded-full object-cover border border-blue-200 dark:border-blue-800 shadow-sm"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800 text-sm transition-colors shadow-sm">
                  {(user?.user_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            {isProfileOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
                    <div className="absolute right-0 mt-3 w-48 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl py-1 z-50 anim-fade-in origin-top-right">
                        <button 
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors font-bold"
                        >
                            <LogOut size={16} />
                            Log out
                        </button>
                    </div>
                </>
            )}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
