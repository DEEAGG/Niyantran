import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import CommandNavbar from './CommandNavbar';
import GlobalSearchModal from '../common/GlobalSearchModal';
import { AssistantProvider } from '../../context/AssistantContext';
import NiyantranLauncher from '../assistant/NiyantranLauncher';
import NiyantranPanel from '../assistant/NiyantranPanel';

export default function AppLayout() {
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  return (
    <AssistantProvider>
      <div className="min-h-screen relative bg-background text-text-primary flex flex-col font-sans selection:bg-accent selection:text-background transition-colors duration-200 overflow-x-hidden">
        {/* Main UI Container */}
        <div className="relative z-10 flex flex-col min-h-screen">
          {/* Slim Command-Center Top Navigation */}
          <CommandNavbar onOpenSearch={() => setSearchModalOpen(true)} />

          {/* Global Command Search Modal */}
          <GlobalSearchModal
            isOpen={searchModalOpen}
            onClose={() => setSearchModalOpen(false)}
          />

          {/* Main Content Workspace */}
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
            <Outlet />
          </main>

          {/* Discreet Editorial Footer */}
          <footer className="border-t border-border bg-surface text-text-muted text-xs py-5 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-2">
                <span className="font-bold text-text-primary tracking-wide">NIYANTRAN</span>
                <span className="opacity-40">&bull;</span>
                <span className="text-text-secondary">Every Decision. Backed by Evidence.</span>
              </div>

              <div className="flex items-center gap-4 text-xs font-sans">
                <span className="text-text-secondary flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  ReguTrace Engine Active
                </span>
                <span className="opacity-40">&bull;</span>
                <Link to="/settings" className="hover:text-text-primary transition-colors">
                  Platform Settings
                </Link>
                <span className="opacity-40">&bull;</span>
                <Link to="/audit" className="hover:text-text-primary transition-colors">
                  Audit Ledger
                </Link>
              </div>
            </div>
          </footer>

          {/* NIYANTRAN Assistant Draggable Floating Launcher & Slide-over Panel */}
          <NiyantranLauncher />
          <NiyantranPanel />
        </div>
      </div>
    </AssistantProvider>
  );
}
