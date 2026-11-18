import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navigation, NavTab } from './components/Navigation';
import { FeedTab } from './components/feed/FeedTab';
import { CalendarNotificationsTab } from './components/calendar/CalendarNotificationsTab';
import { MessagesTab } from './components/messages/MessagesTab';
import { CreateEventTab } from './components/create/CreateEventTab';
import { ProfileTab } from './components/profile/ProfileTab';
import { AuthModal } from './components/onboarding/AuthModal';
import { StudentDiscountsModal } from './components/discounts/StudentDiscountsModal';
import { AdminModerationModal } from './components/admin/AdminModerationModal';
import { WusaAdminDashboard } from './components/wusa-collector/WusaAdminDashboard';

const AppContent: React.FC = () => {
  const { isLoggedIn } = useApp();
  const [activeTab, setActiveTab] = useState<NavTab>('feed');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [discountsModalOpen, setDiscountsModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [isCollectorView, setIsCollectorView] = useState<boolean>(() => {
    return window.location.search.includes('view=wusa-collector') || window.location.pathname.startsWith('/wusa-collector');
  });

  if (isCollectorView) {
    return (
      <WusaAdminDashboard
        onBackToWatHive={() => {
          setIsCollectorView(false);
          const url = new URL(window.location.href);
          url.searchParams.delete('view');
          window.history.pushState({}, '', url.pathname + (url.search ? url.search : ''));
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-stone-900 flex flex-col antialiased selection:bg-amber-300 selection:text-stone-950">
      {/* Top Horizontal Navigation Bar + Mobile Bottom Bar */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenDiscounts={() => setDiscountsModalOpen(true)}
        onOpenAdmin={() => setAdminModalOpen(true)}
        onOpenWusaCollector={() => {
          setIsCollectorView(true);
          const url = new URL(window.location.href);
          url.searchParams.set('view', 'wusa-collector');
          window.history.pushState({}, '', url.toString());
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 max-w-[1380px] mx-auto w-full">
        {activeTab === 'feed' && (
          <FeedTab
            onNavigateToMessages={() => setActiveTab('messages')}
            onOpenPreferences={() => setActiveTab('profile')}
            onOpenProfile={() => setActiveTab('profile')}
            onOpenAuth={() => setAuthModalOpen(true)}
            onOpenWusaCollector={() => {
              setIsCollectorView(true);
              const url = new URL(window.location.href);
              url.searchParams.set('view', 'wusa-collector');
              window.history.pushState({}, '', url.toString());
            }}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarNotificationsTab
            onNavigateToMessages={() => setActiveTab('messages')}
            onNavigateToFeed={() => setActiveTab('feed')}
          />
        )}

        {activeTab === 'messages' && (
          <MessagesTab />
        )}

        {activeTab === 'create' && (
          <CreateEventTab
            onEventCreated={() => setActiveTab('feed')}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            onOpenCreateEvent={() => setActiveTab('create')}
          />
        )}
      </main>

      {/* Auth & Onboarding Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Verified Student Discounts Modal */}
      <StudentDiscountsModal
        isOpen={discountsModalOpen}
        onClose={() => setDiscountsModalOpen(false)}
      />

      {/* Admin & Operations Console Modal */}
      <AdminModerationModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        onOpenWusaCollector={() => {
          setIsCollectorView(true);
          const url = new URL(window.location.href);
          url.searchParams.set('view', 'wusa-collector');
          window.history.pushState({}, '', url.toString());
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
