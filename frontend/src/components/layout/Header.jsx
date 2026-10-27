import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Menu,
  Bell,
  Search,
  Calendar,
  CheckCircle2,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';

const routeTitles = {
  dashboard: 'Regulatory Dashboard',
  applications: 'Applications Management',
  upload: 'Document Ingestion',
  validation: 'Validation Center',
  evidence: 'Evidence Explorer',
  rules: 'Regulatory Rules',
  replay: 'ReguTrace Replay Engine',
  review: 'Review Center',
  reports: 'Compliance Reports',
  audit: 'Audit History',
  settings: 'Settings & Gateway',
};

export default function Header({ onMenuClick, isCollapsed }) {
  const location = useLocation();
  const [currentDate, setCurrentDate] = useState('');
  const isMock = import.meta.env.VITE_USE_MOCK_API !== 'false';

  useEffect(() => {
    const now = new Date();
    setCurrentDate(
      now.toLocaleDateString('en-IN', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    );
  }, []);

  // Compute clean breadcrumb hierarchy
  const segments = location.pathname.split('/').filter(Boolean);
  const rootSegment = segments[0] || 'dashboard';
  const pageTitle = routeTitles[rootSegment] || (rootSegment.charAt(0).toUpperCase() + rootSegment.slice(1));

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white/95 backdrop-blur border-b border-slate-200">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 lg:gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 text-slate-600 rounded-lg lg:hidden hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-blue"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Dynamic Breadcrumb Bar */}
        <nav className="flex items-center gap-1.5 text-xs sm:text-sm font-medium" aria-label="Breadcrumb">
          <Link to="/dashboard" className="text-slate-400 hover:text-slate-600 transition-colors">
            NIYANTRAN
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="font-semibold text-slate-900 tracking-tight">
            {pageTitle}
          </span>
          {segments.length > 1 && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span className="text-brand-blue font-mono text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-semibold">
                {segments[1]}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Right: Status, Date, Notification, Profile */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mock API Engine Status Indicator */}
        <Link
          to="/settings"
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border bg-blue-50/90 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors"
          title="Click to view API Gateway settings"
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          <span>{isMock ? 'Mock API Active' : 'FastAPI Connected'}</span>
        </Link>

        {/* Date Display */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-500 font-medium border-l border-slate-200 pl-4">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{currentDate}</span>
        </div>

        {/* Notification Bell */}
        <button
          className="relative p-2 text-slate-500 rounded-lg hover:bg-slate-100 hover:text-slate-700 transition-colors"
          title="Regulatory notifications"
          aria-label="View notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
        </button>

        {/* Reviewer Profile */}
        <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-brand-navy text-white flex items-center justify-center font-bold text-xs shadow-sm ring-1 ring-slate-200">
            AS
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-800 leading-tight">
              Dr. A. Sharma
            </span>
            <span className="text-[10px] text-slate-500">
              Regulatory Reviewer
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
