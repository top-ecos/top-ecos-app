import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
// Importing new icons to better match the screenshot
import { 
  Trophy,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

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
    icon: (
      <svg viewBox="-5 -10 110 135" width="32" height="32" fill="currentColor" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path d="m32 79h36c6.6211 0 12-5.3789 12-12v-34c0-6.6211-5.3789-12-12-12h-36c-6.6211 0-12 5.3789-12 12v34c0 6.6211 5.3789 12 12 12zm11-54h25c4.4102 0 8 3.5898 8 8v34c0 4.4102-3.5898 8-8 8h-25zm-19 8c0-4.4102 3.5898-8 8-8h7v50h-7c-4.4102 0-8-3.5898-8-8z"/>
      </svg>
    ),
    label: 'Accueil',
    href: '/'
  },
  {
    id: 'stations',
    icon: (
      <svg viewBox="0 0 68 85" width="22" height="22" fill="currentColor" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path d="M50.3,1h-31c-1.5,0-2.7,1.3-2.7,2.8v2.5h-2.4c-1.5,0-2.7,1.3-2.7,2.8v2.5H9c-1.5,0-2.7,1.3-2.7,2.8v49.8   C6.3,65.7,7.5,67,9,67h39.7c1.5,0,2.7-1.3,2.7-2.8v-2.5h2.4c1.5,0,2.7-1.3,2.7-2.8v-2.5H59c1.5,0,2.7-1.2,2.7-2.8V12.8   C60.1,11.1,52,2.7,50.3,1z M50.9,4.5l7.5,7.7h-6.9c-0.3,0-0.6-0.3-0.6-0.7V4.5z M49.5,64.2c0,0.4-0.3,0.8-0.7,0.8H9   c-0.4,0-0.7-0.4-0.7-0.8V14.4c0-0.4,0.3-0.8,0.7-0.8h2.4v45.3c0,1.5,1.2,2.8,2.7,2.8h35.3V64.2z M54.6,58.9c0,0.4-0.3,0.8-0.7,0.8   h-2.4H14.1c-0.4,0-0.7-0.4-0.7-0.8V11.6V9.1c0-0.4,0.3-0.8,0.7-0.8h2.4v45.3v0c0,1.5,1.2,2.8,2.7,2.8h0h35.3V58.9z M59,54.4h-2.4   H19.3c-0.4,0-0.7-0.4-0.7-0.8V6.3V3.8c0-0.4,0.3-0.8,0.7-0.8h29.6v8.5c0,1.5,1.2,2.7,2.6,2.7h8.2v39.5C59.7,54.1,59.4,54.4,59,54.4   z"/>
        <path d="M49.9,27.7H28.4c-0.6,0-1,0.4-1,1s0.4,1,1,1h21.5c0.6,0,1-0.4,1-1S50.4,27.7,49.9,27.7z"/>
        <path d="M49.9,34.1H28.4c-0.6,0-1,0.4-1,1s0.4,1,1,1h21.5c0.6,0,1-0.4,1-1S50.4,34.1,49.9,34.1z"/>
        <path d="M49.9,21.3H28.4c-0.6,0-1,0.4-1,1s0.4,1,1,1h21.5c0.6,0,1-0.4,1-1S50.4,21.3,49.9,21.3z"/>
      </svg>
    ),
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
    icon: (
      <svg viewBox="-5 -10 110 135" width="22" height="22" fill="currentColor" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path d="m89.582 4.168h-79.164c-3.4375 0-6.25 2.8125-6.25 6.25v79.168c0 3.4375 2.8125 6.25 6.25 6.25h79.168c3.4375 0 6.25-2.8125 6.25-6.25l-0.003907-79.168c0-3.4375-2.8125-6.25-6.25-6.25zm2.0859 85.414c0 1.1445-0.9375 2.082-2.082 2.082l-79.168 0.003907c-1.1445 0-2.082-0.9375-2.082-2.082l-0.003907-79.168c0-1.1445 0.9375-2.082 2.082-2.082h79.168c1.1445 0 2.082 0.9375 2.082 2.082v79.168zm-8.3359-41.664c0 1.1445-0.9375 2.082-2.082 2.082h-8.332c-0.79297 0-1.5-0.4375-1.8555-1.1445l-2.25-4.5-16.918 35.707c-0.35547 0.73047-1.082 1.1875-1.875 1.1875h-0.25c-0.89453-0.10547-1.6055-0.75-1.793-1.625l-11.043-51.48-7.8945 20.543c-0.3125 0.8125-1.082 1.332-1.9375 1.332h-8.332c-1.1445 0-2.082-0.9375-2.082-2.082s0.9375-2.082 2.082-2.082h6.8945l9.8945-25.75c0.33203-0.85547 1.168-1.418 2.1055-1.332 0.91797 0.0625 1.6875 0.73047 1.875 1.6445l11.207 52.312 16.125-34.02c0.33203-0.73047 1.0625-1.1875 1.8555-1.1875 0.8125 0 1.5195 0.4375 1.8945 1.1445l3.582 7.1875h7.043c1.1445 0 2.082 0.9375 2.082 2.082z"/>
      </svg>
    ),
    label: 'Dashboard',
    href: '/dashboard'
  },
  {
    id: 'profile',
    icon: (
      <svg viewBox="-5 -10 110 135" width="24" height="24" fill="currentColor" stroke="currentColor" strokeWidth={4} aria-hidden>
        <path d="m50 4.293c-25.23 0-45.715 20.477-45.715 45.703 0 25.23 20.484 45.711 45.715 45.711s45.711-20.484 45.711-45.711c0-25.23-20.484-45.703-45.711-45.703zm0 2.8477c23.684 0 42.855 19.172 42.855 42.855 0 11.465-4.4961 21.871-11.816 29.559-1.793-12.469-10.914-22.535-22.883-25.73 6.7109-3.1055 11.379-9.9141 11.379-17.789 0-10.793-8.7656-19.574-19.539-19.574-10.773 0-19.543 8.7812-19.543 19.574 0 7.875 4.668 14.684 11.379 17.789-11.965 3.1953-21.09 13.262-22.883 25.73-7.3203-7.6875-11.812-18.094-11.812-29.559 0-23.684 19.172-42.855 42.855-42.855zm0 12.18c9.2266 0 16.684 7.4648 16.684 16.715 0 9.2539-7.4531 16.723-16.684 16.723-9.2266 0-16.684-7.4727-16.684-16.723 0-9.2539 7.457-16.715 16.684-16.715zm0 36.297c15.148 0 27.418 11.613 28.434 26.453-7.5625 6.7109-17.52 10.785-28.434 10.785s-20.871-4.0742-28.434-10.785c1.0156-14.84 13.285-26.453 28.434-26.453z"/>
      </svg>
    ),
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
                  <div
                    className={cn(
                      "mb-1 flex items-center justify-center h-7 w-7 [&>svg]:h-full [&>svg]:w-full",
                      active ? "text-[#03BB26]" : "text-gray-500"
                    )}
                  >
                    {item.icon}
                  </div>
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
