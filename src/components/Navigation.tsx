import React, { useState, useRef, useEffect } from 'react';
import {
  Compass,
  MessageSquare,
  Plus,
  User,
  Calendar as CalendarIcon,
  Tag,
  Shield,
  Database,
  SlidersHorizontal,
  ChevronDown,
  LogIn
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export type NavTab = 'feed' | 'calendar' | 'messages' | 'create' | 'profile';

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAuth: () => void;
  onOpenDiscounts?: () => void;
  onOpenAdmin?: () => void;
  onOpenWusaCollector?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onOpenAuth,
  onOpenDiscounts,
  onOpenAdmin,
  onOpenWusaCollector
}) => {
  const {
    user,
    connectionRequests,
    conversations,
    unreadNotificationsCount,
    reportsList,
    duplicateResults
  } = useApp();

  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pendingReportsCount = reportsList.filter((r) => r.status === 'pending').length;
  const pendingDuplicatesCount = duplicateResults.filter((d) => d.status === 'pending_review').length;
  const adminBadgeCount = pendingReportsCount + pendingDuplicatesCount;

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
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/80">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Mark (Top-Left) */}
          <button
            type="button"
            onClick={() => onSelectTab('feed')}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer group focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-950 text-amber-400 flex items-center justify-center font-extrabold text-base shadow-2xs group-hover:bg-stone-900 transition-colors">
              W
            </div>
            <span className="font-extrabold text-lg tracking-tight text-stone-950">
              WatHive
            </span>
          </button>

          {/* Zone 2: Clean Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-7 text-sm font-medium">
            <button
              type="button"
              onClick={() => onSelectTab('feed')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === 'feed'
                  ? 'text-stone-950 font-semibold border-amber-400'
                  : 'text-stone-600 hover:text-stone-950 border-transparent'
              }`}
            >
              Explore
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('calendar')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 flex items-center gap-1.5 ${
                activeTab === 'calendar'
                  ? 'text-stone-950 font-semibold border-amber-400'
                  : 'text-stone-600 hover:text-stone-950 border-transparent'
              }`}
            >
              <span>Calendar</span>
              {unreadNotificationsCount > 0 && (
                <span className="text-[11px] font-bold text-stone-950 bg-amber-300 px-1.5 py-0.2 rounded-md tabular-nums">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('messages')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 flex items-center gap-1.5 ${
                activeTab === 'messages'
                  ? 'text-stone-950 font-semibold border-amber-400'
                  : 'text-stone-600 hover:text-stone-950 border-transparent'
              }`}
            >
              <span>Messages</span>
              {totalMessageBadge > 0 && (
                <span className="text-[11px] font-bold text-stone-950 bg-amber-300 px-1.5 py-0.2 rounded-md tabular-nums">
                  {totalMessageBadge}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenDiscounts}
              className="py-1 text-stone-600 hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 border-transparent"
            >
              Student Perks
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('profile')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === 'profile'
                  ? 'text-stone-950 font-semibold border-amber-400'
                  : 'text-stone-600 hover:text-stone-950 border-transparent'
              }`}
            >
              My Profile
            </button>
          </nav>

          {/* Zone 3: Ops Menu & Primary CTA */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Mobile quick goose avatar to profile */}
            <div className="md:hidden flex items-center gap-2">
              {user ? (
                <button
                  type="button"
                  onClick={() => onSelectTab('profile')}
                  className="p-0.5 rounded-full border-2 border-amber-400"
                  aria-label="My Student Profile"
                >
                  <img
                    src={user.avatar}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-stone-800 hover:bg-stone-50"
                >
                  Sign In
                </button>
              )}
            </div>

            {/* Utility / Ops Dropdown (replaces cluttered sidebar buttons) */}
            <div className="relative" ref={toolsRef}>
              <button
                type="button"
                onClick={() => setToolsOpen(!toolsOpen)}
                className="h-9 px-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-950 flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer relative"
                aria-label="Campus tools and admin consoles"
                title="Campus Tools & Admin Consoles"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-stone-600" />
                <span className="hidden sm:inline whitespace-nowrap">Console</span>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 hidden sm:inline" />
                {adminBadgeCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                )}
              </button>

              {toolsOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-stone-200 shadow-lg py-1.5 z-50">
                  <div className="px-3.5 py-1.5 text-[11px] font-semibold text-stone-400">
                    Campus Utilities
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setToolsOpen(false);
                      onOpenDiscounts?.();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-950 flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-amber-600" />
                      <span>WatCard Student Perks</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setToolsOpen(false);
                      onOpenAdmin?.();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-950 flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-stone-600" />
                      <span>Admin &amp; Ops Console</span>
                    </span>
                    {adminBadgeCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-red-600 text-white tabular-nums">
                        {adminBadgeCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setToolsOpen(false);
                      onOpenWusaCollector?.();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-950 flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-amber-600" />
                      <span>WUSA Collector Console</span>
                    </span>
                  </button>

                  {!user && (
                    <div className="border-t border-stone-100 mt-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setToolsOpen(false);
                          onOpenAuth();
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-semibold text-stone-900 hover:bg-amber-50 flex items-center gap-2 cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5 text-amber-600" />
                        <span>Sign In / Demo Login</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Primary CTA: Create Event */}
            <button
              type="button"
              onClick={() => onSelectTab('create')}
              className="h-9 px-3.5 sm:px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs sm:text-sm transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create Event</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Fixed Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 grid grid-cols-5 items-center h-16 pb-safe">
        <button
          type="button"
          onClick={() => onSelectTab('feed')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            activeTab === 'feed' ? 'text-stone-950 font-bold' : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <Compass className={`w-5 h-5 ${activeTab === 'feed' ? 'text-amber-500 stroke-[2.5]' : ''}`} />
          <span className="text-[10px] tracking-tight mt-1">Explore</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('calendar')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors relative ${
            activeTab === 'calendar' ? 'text-stone-950 font-bold' : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <div className="relative">
            <CalendarIcon className={`w-5 h-5 ${activeTab === 'calendar' ? 'text-amber-500 stroke-[2.5]' : ''}`} />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1.5 py-0.2 text-[9px] font-black rounded-full bg-amber-400 text-stone-950 tabular-nums">
                {unreadNotificationsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1">Calendar</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('messages')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors relative ${
            activeTab === 'messages' ? 'text-stone-950 font-bold' : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <div className="relative">
            <MessageSquare className={`w-5 h-5 ${activeTab === 'messages' ? 'text-amber-500 stroke-[2.5]' : ''}`} />
            {totalMessageBadge > 0 && (
              <span className="absolute -top-1 -right-2 px-1.5 py-0.2 text-[9px] font-black rounded-full bg-amber-400 text-stone-950 tabular-nums">
                {totalMessageBadge}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1">Messages</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('create')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            activeTab === 'create' ? 'text-stone-950 font-bold' : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <Plus className={`w-5 h-5 ${activeTab === 'create' ? 'text-amber-500 stroke-[2.5]' : ''}`} />
          <span className="text-[10px] tracking-tight mt-1">Create</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('profile')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            activeTab === 'profile' ? 'text-stone-950 font-bold' : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <User className={`w-5 h-5 ${activeTab === 'profile' ? 'text-amber-500 stroke-[2.5]' : ''}`} />
          <span className="text-[10px] tracking-tight mt-1">Profile</span>
        </button>
      </nav>
    </>
  );
};
