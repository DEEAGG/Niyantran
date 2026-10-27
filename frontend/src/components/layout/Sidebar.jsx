import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  Layers,
  BookOpen,
  GitBranch,
  CheckSquare,
  FileText,
  History,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import BrandLogo from '../common/BrandLogo';

const navigationGroups = [
  {
    group: 'Overview',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Applications', path: '/applications', icon: FileSpreadsheet },
    ]
  },
  {
    group: 'Verification',
    items: [
      { name: 'Upload Documents', path: '/upload', icon: UploadCloud },
      { name: 'Validation Center', path: '/validation', icon: CheckCircle2 },
      { name: 'Evidence Explorer', path: '/applications/APP-2026-001/evidence', icon: Layers, badge: 'Core' },
    ]
  },
  {
    group: 'ReguTrace',
    items: [
      { name: 'Regulatory Rules', path: '/rules', icon: BookOpen },
      { name: 'Rule Change Replay', path: '/replay', icon: GitBranch, badge: 'Engine' },
    ]
  },
  {
    group: 'Management',
    items: [
      { name: 'Review Center', path: '/review', icon: CheckSquare },
      { name: 'Reports', path: '/reports', icon: FileText },
      { name: 'Audit History', path: '/audit', icon: History },
    ]
  },
  {
    group: 'System',
    items: [
      { name: 'Settings', path: '/settings', icon: Settings },
    ]
  }
];

export default function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
  const location = useLocation();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-brand-navy border-r border-brand-navy-border text-slate-300 transition-all duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-4 bg-brand-navy-dark border-b border-brand-navy-border/80">
          <NavLink to="/dashboard" className="flex items-center gap-3 overflow-hidden" onClick={() => isOpen && onClose()}>
            <BrandLogo size="md" showSubtitle={!isCollapsed} collapsed={isCollapsed} />
          </NavLink>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* System Status Banner Pill */}
        {!isCollapsed && (
          <div className="px-4 py-2.5 bg-brand-navy-light/40 border-b border-brand-navy-border/60">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span className="flex items-center gap-1.5 text-accent font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                ReguTrace Active
              </span>
              <span className="text-slate-400 font-mono text-[10px]">v2.0</span>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <div className="flex-1 px-3 py-4 space-y-5 overflow-y-auto overflow-x-hidden">
          {navigationGroups.map((group, idx) => (
            <div key={idx} className="space-y-1">
              {!isCollapsed ? (
                <h4 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                  {group.group}
                </h4>
              ) : (
                <div className="h-2 border-t border-brand-navy-border/40 mx-2 my-1" />
              )}

              <div className="mt-1 space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path || 
                    (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.name}
                      to={item.path}
                      onClick={() => isOpen && onClose()}
                      title={isCollapsed ? item.name : undefined}
                      className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-brand-blue text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-brand-navy-light/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                        }`} />
                        {!isCollapsed && <span className="truncate">{item.name}</span>}
                      </div>

                      {!isCollapsed && item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase font-semibold shrink-0 ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-brand-navy-border text-cyan-300'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Collapse Toggle */}
        <div className="hidden lg:flex items-center justify-between px-3 py-2 border-t border-brand-navy-border/70 bg-brand-navy-dark/40">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 text-xs transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-[11px] font-medium">Collapse Menu</span>
              </>
            )}
          </button>
        </div>

        {/* Footer Disclaimer */}
        {!isCollapsed && (
          <div className="p-3 bg-brand-navy-dark/95 border-t border-brand-navy-border text-[11px] text-slate-400">
            <p className="leading-snug">
              Autonomous Regulatory Intelligence Platform.
            </p>
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span className="text-accent">ReguTrace Engine</span>
              <span>APH Standards</span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
