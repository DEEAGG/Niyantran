import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import CommandNavbar from './CommandNavbar';
import GlobalSearchModal from '../common/GlobalSearchModal';
import AnimatedGradient, { NIYANTRAN_BRAND_GRADIENT } from '../ui/animated-gradient';

export default function AppLayout() {
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  return (
    <div className="min-h-screen relative bg-[#F7F6F2] text-text-primary flex flex-col font-sans selection:bg-accent selection:text-background transition-colors duration-200 overflow-x-hidden">
      {/* Global Ambient WebGL2 Shader Animated Gradient Layer */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden" 
        aria-hidden="true"
        data-testid="global-animated-gradient"
      >
        <AnimatedGradient
          config={NIYANTRAN_BRAND_GRADIENT}
          className="w-full h-full opacity-40"
          noise={{ opacity: 0.08, scale: 1 }}
        />
      </div>

      {/* Main UI Container (Stacked cleanly above the WebGL background) */}
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

        {/* Discreet Warm Editorial Footer */}
        <footer className="border-t border-[#E4E2DC] bg-white/90 text-text-muted text-xs py-5 px-4 sm:px-6 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="font-bold text-text-primary tracking-wide">NIYANTRAN</span>
              <span className="opacity-40">&bull;</span>
              <span className="text-text-secondary">Every Decision. Backed by Evidence.</span>
            </div>

            <div className="flex items-center gap-4 text-xs font-sans">
              <span className="text-[#E43D12] flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E43D12] animate-pulse" />
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
      </div>
    </div>
  );
}
