import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { Navigation, NavTab } from './components/Navigation';
import { FeedTab } from './components/feed/FeedTab';
import { CalendarNotificationsTab } from './components/calendar/CalendarNotificationsTab';
import { MessagesTab } from './components/messages/MessagesTab';
import { ProfileTab } from './components/profile/ProfileTab';
import { AuthModal } from './components/onboarding/AuthModal';
import { LandingPage } from './components/landing/LandingPage';
import { useTheme } from './hooks/useTheme';

const AppContent: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [landingEntryKey, setLandingEntryKey] = useState(0);
  const [activeTab, setActiveTab] = useState<NavTab>('feed');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleEnterApp = () => {
    setView('app');
    setActiveTab('feed');
  };

  const handleOpenLanding = () => {
    setLandingEntryKey((k) => k + 1);
    setView('landing');
  };

  if (view === 'landing') {
    return (
      <LandingPage
        key={landingEntryKey}
        onEnterApp={handleEnterApp}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col antialiased selection:bg-accent selection:text-accent-ink transition-colors duration-200">
      <Navigation
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenLanding={handleOpenLanding}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1 flex flex-col min-w-0 px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 max-w-[1380px] mx-auto w-full">
        {activeTab === 'feed' && (
          <FeedTab
            onNavigateToMessages={() => setActiveTab('messages')}
            onOpenPreferences={() => setActiveTab('profile')}
            onOpenProfile={() => setActiveTab('profile')}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarNotificationsTab
            onNavigateToMessages={() => setActiveTab('messages')}
            onNavigateToFeed={() => setActiveTab('feed')}
          />
        )}

        {activeTab === 'messages' && <MessagesTab />}

        {activeTab === 'profile' && <ProfileTab />}
      </main>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
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
