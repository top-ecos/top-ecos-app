import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
// Importing new icons to better match the screenshot
import { 
  Home, 
  FileInput,
  LineChart,
  Trophy,
  User, 
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/shared/contexts/AuthContext';
import { cn } from '@/shared/lib/utils';

interface SidebarItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  href: string;
}

// Updated navigation array to match the screenshot's text and icons
const navigation: SidebarItem[] = [
  {
    id: 'home',
    icon: <Home size={22} strokeWidth={1.5} />,
    label: 'Accueil',
    href: '/'
  },
  {
    id: 'stations',
    icon: <FileInput size={22} strokeWidth={1.5} />,
    label: 'Stations',
    href: '/cases'
  },  
  {
    id: 'ranking',
    icon: <Trophy size={22} strokeWidth={1.5} />,
    label: 'Classement',
    href: '/ranking'
  },
  {
    id: 'dashboard',
    icon: <LineChart size={22} strokeWidth={1.5} />,
    label: 'Dashboard',
    href: '/dashboard'
  },
  {
    id: 'profile',
    icon: <User size={22} strokeWidth={1.5} />,
    label: 'Profil',
    href: '/profile'
  },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleNavigation = (href: string) => {
    navigate(href);
  };

  const handleSignOut = () => {
    signOut();
  };

  const isActive = (href: string) => {
    return location.pathname === href;
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 z-40 h-screen w-60 bg-white border-r flex-col p-4 space-y-6">
        {/* Logo Section */}
        <div
          className="flex items-center justify-center cursor-pointer"
          role="button"
          aria-label="Aller à l'accueil"
          title="Aller à l'accueil"
          tabIndex={0}
          onClick={() => navigate('/')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/'); }}
        >
          <img
            src="/topecos.png"
            alt="TopECOS Logo"
            className="h-15 w-15 max-w-full object-contain transform scale-75"
          />
        </div>

        {/* Navigation Section uses flex-grow to push logout to the bottom */}
        <nav className="flex-grow">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      "w-full flex items-center gap-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-150 min-h-[44px]",
                      active
                        ? "bg-[#03BB26]/10 text-[#03BB26]"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <div className={cn(active ? "text-[#03BB26]" : "text-gray-500")}
                    >
                      {item.icon}
                    </div>
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sign out button */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-x-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all duration-150 min-h-[44px]"
            title="Déconnexion"
          >
            <LogOut size={22} strokeWidth={1.5} className="text-gray-500" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200">
        {/* Changed grid-cols-4 to grid-cols-5 to fit the 5 navigation items */}
        <ul className="grid grid-cols-5 gap-1 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.id} className="flex">
                <button
                  onClick={() => handleNavigation(item.href)}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center rounded-md py-2 min-h-[44px] text-xs font-medium transition-colors",
                    active ? "text-[#03BB26]" : "text-gray-600 hover:text-gray-800"
                  )}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                >
                  <div className={cn("mb-1", active ? "text-[#03BB26]" : "text-gray-500")}>{item.icon}</div>
                  <span className="leading-none">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
};
