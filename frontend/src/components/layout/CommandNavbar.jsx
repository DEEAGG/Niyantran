import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Search,
  Bell,
  Menu,
  X,
  FilePlus,
  Layers,
  History,
  Settings as SettingsIcon,
  Palette,
  Check,
  AlertTriangle,
  GitBranch,
  ShieldCheck,
  CheckSquare,
  LogOut,
} from 'lucide-react';
import BrandLogo from '../common/BrandLogo';
import { useTheme, THEMES } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export default function CommandNavbar({ onOpenSearch }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    setProfileOpen(false);
    setNotificationsOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Intelligence', to: '/features' },
    { label: 'Cases', to: '/cases' },
    { label: 'Monitoring', to: '/monitoring' },
  ];

  return (
    <header className="sticky top-0 z-[100] w-full h-14 border-b border-[var(--border)] bg-[var(--surface)] select-none">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        
        {/* Left: Brand Logo & Wordmark */}
        <div className="flex items-center gap-6 shrink-0">
          <Link to="/dashboard" className="focus:outline-none flex items-center gap-2 group">
            <BrandLogo size="sm" showSubtitle={false} />
          </Link>

          {/* Desktop Direct Navigation Links */}
          <nav className="hidden lg:flex items-center gap-0.5 text-xs font-medium">
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-[#FDF1EE] text-[#E43D12] font-bold border border-[#E43D12]/30 shadow-xs'
                      : 'text-text-secondary hover:text-text-primary hover:bg-[#F2EFE9]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right Section: System status, Search, Notifications, CTA, Profile */}
        <div className="flex items-center gap-2.5">
          {/* Engine Status Pill */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-white border border-[#E4E2DC] text-[11px] text-text-secondary font-mono shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-text-primary font-medium">ReguTrace Engine</span>
            <span className="text-text-muted">v2.0</span>
          </div>

          {/* Quick Search Shortcut */}
          <button
            type="button"
            onClick={() => onOpenSearch && onOpenSearch()}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-[#E4E2DC] text-xs text-text-muted hover:text-text-primary hover:border-[#E43D12]/40 transition-all cursor-pointer shadow-xs"
          >
            <Search className="w-3.5 h-3.5 text-text-muted" />
            <span className="hidden md:inline">Quick search...</span>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-[#F7F6F2] border border-[#E4E2DC] text-[10px] font-mono text-text-secondary">
              ⌘K
            </kbd>
          </button>

          {/* New Filing CTA Button in Vermilion */}
          <Link
            to="/upload"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E43D12] text-white text-xs font-semibold hover:bg-[#CC340E] transition-all shadow-sm active:scale-95"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>New Filing</span>
          </Link>

          {/* Regulatory Alerts Bell */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setProfileOpen(false);
              }}
              className="relative p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              title="Regulatory alerts"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[var(--surface)]" />
            </button>

            {notificationsOpen && (
              <div 
                className="dropdown-menu absolute right-0 mt-2 w-80 p-3 shadow-2xl rounded-lg border border-[var(--border)]"
                style={{ backgroundColor: 'var(--surface-elevated)', opacity: 1, zIndex: 1000 }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                  <span className="text-xs font-semibold text-text-primary">Regulatory Alerts (2)</span>
                  <Link to="/review" className="text-[11px] text-accent hover:underline font-medium">
                    Review Desk &rarr;
                  </Link>
                </div>

                <div className="py-2 space-y-2 text-xs">
                  <Link 
                    to="/applications/APP-2026-003/evidence"
                    className="block p-2 rounded-md bg-[var(--background)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-colors"
                  >
                    <div className="flex items-center justify-between font-semibold text-rose-400">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        Code Mismatch
                      </span>
                      <span className="text-[10px] font-mono text-text-muted">APP-2026-003</span>
                    </div>
                    <p className="text-[11px] text-text-secondary mt-1 leading-snug">
                      INST-1042 on Form vs INST-1024 on Registration Certificate.
                    </p>
                  </Link>

                  <Link 
                    to="/review"
                    className="block p-2 rounded-md bg-[var(--background)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-colors"
                  >
                    <div className="flex items-center justify-between font-semibold text-amber-400">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        Chronology Conflict
                      </span>
                      <span className="text-[10px] font-mono text-text-muted">APP-2026-004</span>
                    </div>
                    <p className="text-[11px] text-text-secondary mt-1 leading-snug">
                      Society registration date (2018) succeeds land deed date (2014).
                    </p>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Officer Profile & Theme Menu */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen(!profileOpen);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 pl-2 border-l border-[var(--border)] focus:outline-none group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-md bg-[#FDF1EE] border border-[#E43D12]/30 flex items-center justify-center font-bold text-xs text-[#E43D12] group-hover:border-[#E43D12] transition-colors font-mono">
                {user?.initials || 'AO'}
              </div>
              <ChevronDown className={`w-3 h-3 text-text-muted transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div 
                className="dropdown-menu absolute right-0 mt-2 w-64 p-3 shadow-2xl rounded-lg border border-[var(--border)] space-y-3"
                style={{ backgroundColor: 'var(--surface-elevated)', opacity: 1, zIndex: 1000 }}
              >
                <div className="pb-2 border-b border-[var(--border)]">
                  <div className="font-semibold text-xs text-text-primary truncate">
                    {user?.full_name || user?.email || 'Authorized User'}
                  </div>
                  <div className="text-[11px] text-text-secondary truncate mt-0.5">
                    {user?.role === 'admin'
                      ? 'System Administrator'
                      : user?.role === 'reviewer'
                      ? 'Regulatory Reviewer'
                      : 'Institution Officer'}
                  </div>
                  <div className="text-[10px] font-mono text-[#E43D12] mt-0.5 truncate">
                    {user?.institution_name || user?.email}
                  </div>
                </div>

                {/* Theme Selector */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-text-muted flex items-center gap-1.5">
                    <Palette className="w-3 h-3 text-accent" />
                    Color Theme
                  </span>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setTheme(THEMES.EXPERIMENTAL)}
                      className={`p-2 rounded-md text-left text-xs border transition-all cursor-pointer ${
                        theme === THEMES.EXPERIMENTAL
                          ? 'bg-accent/15 border-accent text-accent font-semibold'
                          : 'bg-[var(--background)] border-[var(--border)] text-text-secondary hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px]">Dark Neutral</span>
                        {theme === THEMES.EXPERIMENTAL && <Check className="w-3 h-3 text-accent" />}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#0A0D12] border border-[var(--border)]" />
                        <span className="w-2 h-2 rounded-full bg-[#111620]" />
                        <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme(THEMES.OBSIDIAN)}
                      className={`p-2 rounded-md text-left text-xs border transition-all cursor-pointer ${
                        theme === THEMES.OBSIDIAN
                          ? 'bg-accent/15 border-accent text-accent font-semibold'
                          : 'bg-[var(--background)] border-[var(--border)] text-text-secondary hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px]">Obsidian</span>
                        {theme === THEMES.OBSIDIAN && <Check className="w-3 h-3 text-accent" />}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#090D14] border border-[#232B38]" />
                        <span className="w-2 h-2 rounded-full bg-[#131A26]" />
                        <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                      </div>
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border)] space-y-1">
                  <Link
                    to="/settings"
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <SettingsIcon className="w-3.5 h-3.5 text-text-muted" />
                    <span>Settings & Profile</span>
                  </Link>
                  <Link
                    to="/audit"
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <History className="w-3.5 h-3.5 text-text-muted" />
                    <span>Audit Ledger</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-[var(--surface-hover)] focus:outline-none cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden border-b border-[var(--border)] px-4 py-3 space-y-2 bg-[var(--surface-elevated)] shadow-2xl"
          style={{ zIndex: 1000 }}
        >
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="p-2 rounded-md bg-[var(--surface-secondary)] text-text-primary font-medium hover:bg-[var(--surface-hover)]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/upload"
              className="p-2 rounded-md bg-accent text-[var(--accent-contrast,white)] font-medium text-center col-span-2"
            >
              + New Application
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
