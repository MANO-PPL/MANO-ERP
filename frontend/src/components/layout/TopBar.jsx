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

  const [activeProjectInfo, setActiveProjectInfo] = useState(null);

  React.useEffect(() => {
    if (location.pathname.startsWith('/projects/')) {
      const id = location.pathname.split('/')[2];
      try {
        const cached = sessionStorage.getItem(`active_project_info_${id}`);
        if (cached) {
          setActiveProjectInfo(JSON.parse(cached));
          return;
        }
        const listStr = sessionStorage.getItem('crm_projects_list');
        if (listStr) {
          const list = JSON.parse(listStr);
          const found = list.find(p => String(p.dbId) === String(id) || String(p.id) === String(id));
          if (found) {
            setActiveProjectInfo({ name: found.name, project_code: found.id });
            return;
          }
        }
      } catch (e) { }
      setActiveProjectInfo(null);
    } else {
      setActiveProjectInfo(null);
    }
  }, [location.pathname]);

  React.useEffect(() => {
    const handleProjectUpdate = (e) => {
      if (e.detail) {
        setActiveProjectInfo(e.detail);
      }
    };
    window.addEventListener('active-project-updated', handleProjectUpdate);
    return () => window.removeEventListener('active-project-updated', handleProjectUpdate);
  }, []);

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
      if (activeProjectInfo?.name) {
        return (
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-gray-900 dark:text-white tracking-tight">{activeProjectInfo.name}</span>
            {activeProjectInfo.project_code && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20">
                {activeProjectInfo.project_code}
              </span>
            )}
          </div>
        );
      }
      return `Project ${id}`;
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
      case '/resources': return 'Resources';
      case '/resource-rate': return 'Resource Rate Lab';
      case '/units': return 'Units';
      default: {
        const seg = location.pathname.replace('/', '');
        return seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : 'Dashboard';
      }
    }
  };

  return (
    <div className="h-11 min-h-[44px] bg-white dark:bg-gh-bg border-b border-gray-200 dark:border-gh-border flex items-center justify-between px-5 sticky top-0 z-[30] w-full transition-colors">
      {/* Left: Active Page Title */}
      <div className="flex items-center min-w-[130px]">
        <div className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
          {getPageTitle()}
        </div>
      </div>

      {/* Center: Spacer */}
      <div className="flex-1" />

      {/* Right: Actions & Profile */}
      <div className="flex items-center space-x-3 text-xs">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-gray-500 hover:text-blue-600 dark:text-gh-muted dark:hover:text-gh-accent transition-colors p-1 rounded-md"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <button className="text-gray-500 hover:text-blue-600 dark:text-gh-muted dark:hover:text-gh-accent relative transition-colors p-1 rounded-md">
          <Bell size={17} />
          <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
        </button>

        <div className="relative">
            <div 
                className="flex items-center space-x-2.5 cursor-pointer border-l pl-3 border-gray-200 dark:border-gh-border transition-colors hover:opacity-80"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <div className="text-right hidden md:block">
                <p className="text-xs font-bold text-gray-800 dark:text-gh-text whitespace-nowrap leading-tight">{user?.user_name || 'User'}</p>
                <p className="text-[10px] text-gray-500 dark:text-gh-muted whitespace-nowrap leading-tight">{user?.desg_name || user?.user_type || 'Employee'}</p>
              </div>
              {user?.profile_image_url ? (
                <img 
                  src={user.profile_image_url} 
                  alt={user?.user_name} 
                  className="w-7 h-7 rounded-full object-cover border border-blue-200 dark:border-blue-800 shadow-sm"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800 text-xs transition-colors shadow-sm">
                  {(user?.user_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            {isProfileOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl py-1 z-50 anim-fade-in origin-top-right">
                        <button 
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors font-bold"
                        >
                            <LogOut size={15} />
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
