import React, { useState, useRef, useEffect } from 'react';
import {
  Compass,
  MessageSquare,
  User,
  Calendar as CalendarIcon,
  LogIn,
  LogOut,
  Sun,
  Moon,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ThemeMode } from '../hooks/useTheme';
import { BeeLogo } from './common/BeeLogo';

export type NavTab = 'feed' | 'calendar' | 'messages' | 'profile';

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAuth: () => void;
  onOpenLanding: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onOpenAuth,
  onOpenLanding,
  theme,
  onToggleTheme
}) => {
  const { user, logout, connectionRequests, conversations } = useApp();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const pendingRequestsCount = connectionRequests.filter(
    (r) => r.status === 'pending' && r.recipientId === user?.id
  ).length;

  const unreadMessagesCount = conversations.reduce(
    (sum, c) => sum + (c.unreadCount || 0),
    0
  );

  const totalMessageBadge = pendingRequestsCount + unreadMessagesCount;

  return (
    <>
      {/* Desktop & Tablet Top Bar */}
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md border-b border-line transition-colors duration-200">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 h-[60px] md:h-[72px] flex items-center justify-between gap-4 sm:gap-8">
          {/* Brand Mark: Returns to Landing Page from ANY page */}
          <button
            type="button"
            onClick={onOpenLanding}
            aria-label="Return to WatHive welcome page"
            className="flex items-center gap-[10px] whitespace-nowrap shrink-0 cursor-pointer group rounded-xl py-1 px-1 -ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <span className="inline-flex items-center justify-center shrink-0">
              <BeeLogo
                size={44}
                className="w-9 h-9 md:w-11 md:h-11 text-ink transition-opacity duration-150 group-hover:opacity-80"
              />
            </span>
            <span className="font-display font-semibold text-xl md:text-2xl tracking-tight text-ink leading-none">
              WatHive
            </span>
          </button>

          {/* Center Nav: Explore, Buddy Buzz, My Events */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-3"
          >
            <button
              type="button"
              onClick={() => onSelectTab('feed')}
              aria-current={activeTab === 'feed' ? 'page' : undefined}
              className={`px-4 py-2.5 min-h-[44px] rounded-full text-base font-semibold inline-flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer transition-all duration-150 active:bg-[#FFC933] active:text-[#1C1917] active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                activeTab === 'feed'
                  ? 'bg-[#FFD54F] text-[#1C1917]'
                  : 'bg-transparent text-ink hover:bg-[#FFD54F] hover:text-[#1C1917]'
              }`}
            >
              Explore
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('messages')}
              aria-current={activeTab === 'messages' ? 'page' : undefined}
              className={`group px-4 py-2.5 min-h-[44px] rounded-full text-base font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-all duration-150 active:bg-[#FFC933] active:text-[#1C1917] active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                activeTab === 'messages'
                  ? 'bg-[#FFD54F] text-[#1C1917]'
                  : 'bg-transparent text-ink hover:bg-[#FFD54F] hover:text-[#1C1917]'
              }`}
            >
              <span>Buddy Buzz</span>
              {totalMessageBadge > 0 && (
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums leading-none transition-colors duration-150 ${
                    activeTab === 'messages'
                      ? 'bg-[#1C1917] text-[#FFD54F]'
                      : 'bg-[#FFD54F] text-[#1C1917] group-hover:bg-[#1C1917] group-hover:text-[#FFD54F] group-active:bg-[#1C1917] group-active:text-[#FFD54F]'
                  }`}
                >
                  {totalMessageBadge}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('calendar')}
              aria-current={activeTab === 'calendar' ? 'page' : undefined}
              className={`px-4 py-2.5 min-h-[44px] rounded-full text-base font-semibold inline-flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer transition-all duration-150 active:bg-[#FFC933] active:text-[#1C1917] active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                activeTab === 'calendar'
                  ? 'bg-[#FFD54F] text-[#1C1917]'
                  : 'bg-transparent text-ink hover:bg-[#FFD54F] hover:text-[#1C1917]'
              }`}
            >
              My Events
            </button>
          </nav>

          {/* Right: Theme Toggle + Avatar Dropdown (Profile, Sign In / Sign Out only) */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-10 h-10 rounded-2xl bg-surface-soft/70 hover:bg-surface-soft text-ink flex items-center justify-center transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-accent" />
              ) : (
                <Moon className="w-4 h-4 text-ink" />
              )}
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
                className="h-10 pl-1.5 pr-2.5 rounded-2xl bg-surface-soft/70 hover:bg-surface-soft flex items-center gap-2 transition-colors cursor-pointer shadow-soft"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover ring-2 ring-accent/80"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-accent text-accent-ink flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                )}

                <span className="hidden sm:inline text-xs font-semibold text-ink max-w-[110px] truncate">
                  {user ? user.name.split(' ')[0] : 'Guest'}
                </span>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted transition-transform duration-150 ${
                    menuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  aria-label="Account menu"
                  className="absolute right-0 mt-2.5 w-56 bg-surface rounded-3xl shadow-lift border border-line py-2 z-50"
                >
                  <div className="px-4 py-2.5 border-b border-line">
                    <p className="text-sm font-bold text-ink truncate">
                      {user ? user.name : 'Waterloo Guest'}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {user ? `${user.faculty} · ${user.year}` : 'Sign in for buddy matching'}
                    </p>
                  </div>

                  <div className="py-1.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onSelectTab('profile');
                      }}
                      className={`w-full px-4 py-2.5 text-left text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                        activeTab === 'profile'
                          ? 'bg-accent-soft text-ink font-semibold'
                          : 'text-ink hover:bg-surface-soft/70'
                      }`}
                    >
                      <User className="w-4 h-4 text-accent-text" />
                      <span>Profile</span>
                    </button>

                    {user ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          logout();
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs font-medium text-danger hover:bg-danger-soft flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenAuth();
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs font-semibold text-accent-text hover:bg-accent-soft flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>Sign In</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Fixed Tab Bar: 4 items */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-line grid grid-cols-4 items-center gap-1 px-1.5 py-1.5 min-h-[64px] pb-safe"
      >
        <button
          type="button"
          onClick={() => onSelectTab('feed')}
          aria-current={activeTab === 'feed' ? 'page' : undefined}
          className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-4 py-1.5 sm:py-2.5 min-h-[44px] rounded-full text-xs sm:text-base font-semibold leading-tight whitespace-nowrap transition-all duration-150 cursor-pointer active:bg-[#FFC933] active:text-[#1C1917] active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
            activeTab === 'feed'
              ? 'bg-[#FFD54F] text-[#1C1917]'
              : 'bg-transparent text-ink hover:bg-[#FFD54F] hover:text-[#1C1917]'
          }`}
        >
          <Compass className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span>Explore</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('messages')}
          aria-current={activeTab === 'messages' ? 'page' : undefined}
          className={`group flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-4 py-1.5 sm:py-2.5 min-h-[44px] rounded-full text-xs sm:text-base font-semibold leading-tight whitespace-nowrap relative transition-all duration-150 cursor-pointer active:bg-[#FFC933] active:text-[#1C1917] active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
            activeTab === 'messages'
              ? 'bg-[#FFD54F] text-[#1C1917]'
              : 'bg-transparent text-ink hover:bg-[#FFD54F] hover:text-[#1C1917]'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            {totalMessageBadge > 0 && (
              <span
                className={`sm:hidden absolute -top-1.5 -right-2.5 px-1 py-0.5 text-[9px] font-bold rounded-full tabular-nums leading-none transition-colors duration-150 ${
                  activeTab === 'messages'
                    ? 'bg-[#1C1917] text-[#FFD54F]'
                    : 'bg-[#FFD54F] text-[#1C1917] group-hover:bg-[#1C1917] group-hover:text-[#FFD54F] group-active:bg-[#1C1917] group-active:text-[#FFD54F]'
                }`}
              >
                {totalMessageBadge}
              </span>
            )}
          </div>
          <span>Buddy Buzz</span>
          {totalMessageBadge > 0 && (
            <span
              className={`hidden sm:inline-flex text-xs font-bold px-2 py-0.5 rounded-full tabular-nums leading-none transition-colors duration-150 ${
                activeTab === 'messages'
                  ? 'bg-[#1C1917] text-[#FFD54F]'
                  : 'bg-[#FFD54F] text-[#1C1917] group-hover:bg-[#1C1917] group-hover:text-[#FFD54F] group-active:bg-[#1C1917] group-active:text-[#FFD54F]'
              }`}
            >
              {totalMessageBadge}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('calendar')}
          aria-current={activeTab === 'calendar' ? 'page' : undefined}
          className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-4 py-1.5 sm:py-2.5 min-h-[44px] rounded-full text-xs sm:text-base font-semibold leading-tight whitespace-nowrap transition-all duration-150 cursor-pointer active:bg-[#FFC933] active:text-[#1C1917] active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
            activeTab === 'calendar'
              ? 'bg-[#FFD54F] text-[#1C1917]'
              : 'bg-transparent text-ink hover:bg-[#FFD54F] hover:text-[#1C1917]'
          }`}
        >
          <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span>My Events</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('profile')}
          aria-current={activeTab === 'profile' ? 'page' : undefined}
          className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-4 py-1.5 sm:py-2.5 min-h-[44px] rounded-full text-xs sm:text-base font-semibold leading-tight whitespace-nowrap transition-all duration-150 cursor-pointer active:bg-[#FFC933] active:text-[#1C1917] active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
            activeTab === 'profile'
              ? 'bg-[#FFD54F] text-[#1C1917]'
              : 'bg-transparent text-ink hover:bg-[#FFD54F] hover:text-[#1C1917]'
          }`}
        >
          <User className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span>Profile</span>
        </button>
      </nav>
    </>
  );
};
