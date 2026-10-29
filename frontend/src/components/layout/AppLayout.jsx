import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import CommandNavbar from './CommandNavbar';
import GlobalSearchModal from '../common/GlobalSearchModal';
import AnimatedGradient, { NIYANTRAN_BRAND_GRADIENT } from '../ui/animated-gradient';

export default function AppLayout() {
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  return (
    <div className="min-h-screen relative bg-[#F7F6F2] text-text-primary flex flex-col font-sans selection:bg-accent selection:text-background transition-colors duration-200 overflow-x-hidden">
      {/* True Full-Viewport Floating Gradient Background */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none w-screen h-screen min-h-[100dvh]" 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100dvh',
          minHeight: '100vh',
          pointerEvents: 'none',
          zIndex: 0,
        }}
        aria-hidden="true"
        data-testid="global-animated-gradient"
      >
        {/* Primary WebGL2 Shader Animated Gradient */}
        <AnimatedGradient
          config={NIYANTRAN_BRAND_GRADIENT}
          className="w-full h-full opacity-70"
          noise={{ opacity: 0.07, scale: 1 }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />

        {/* Responsive Floating Gradient Blobs (Viewport-relative organic motion across all screens) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {/* Blob 1: Soft Vermilion, top-left drift */}
          <div 
            className="absolute rounded-full blur-[80px] sm:blur-[110px] pointer-events-none animate-float-blob-1 opacity-70"
            style={{
              top: '-8vh',
              left: '6vw',
              width: 'min(50vw, 750px)',
              height: 'min(50vw, 750px)',
              background: 'radial-gradient(circle, rgba(228, 61, 18, 0.22) 0%, rgba(228, 61, 18, 0.06) 50%, transparent 72%)',
            }}
          />

          {/* Blob 2: Golden Yellow, bottom-right drift */}
          <div 
            className="absolute rounded-full blur-[75px] sm:blur-[100px] pointer-events-none animate-float-blob-2 opacity-65"
            style={{
              bottom: '-6vh',
              right: '6vw',
              width: 'min(46vw, 680px)',
              height: 'min(46vw, 680px)',
              background: 'radial-gradient(circle, rgba(239, 177, 18, 0.20) 0%, rgba(239, 177, 18, 0.05) 50%, transparent 72%)',
            }}
          />

          {/* Blob 3: Rose Pink, center-right drift */}
          <div 
            className="absolute rounded-full blur-[80px] sm:blur-[105px] pointer-events-none animate-float-blob-3 opacity-60"
            style={{
              top: '28vh',
              right: '24vw',
              width: 'min(40vw, 560px)',
              height: 'min(40vw, 560px)',
              background: 'radial-gradient(circle, rgba(214, 83, 109, 0.16) 0%, rgba(214, 83, 109, 0.04) 50%, transparent 72%)',
            }}
          />
        </div>
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
