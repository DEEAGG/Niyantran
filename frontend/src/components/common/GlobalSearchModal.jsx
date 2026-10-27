import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileSpreadsheet, BookOpen, Layers, GitBranch, ArrowRight, X } from 'lucide-react';
import { applicationService } from '../../services/applicationService';
import { ruleService } from '../../services/ruleService';

export default function GlobalSearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [applications, setApplications] = useState([]);
  const [rules, setRules] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      applicationService.getApplications().then((res) => {
        setApplications(res.data || []);
      }).catch(() => setApplications([]));

      ruleService.getRules().then((res) => {
        setRules(res.data || []);
      }).catch(() => setRules([]));
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredApps = query
    ? applications.filter(
        (a) =>
          a.institutionName.toLowerCase().includes(query.toLowerCase()) ||
          a.id.toLowerCase().includes(query.toLowerCase()) ||
          a.institutionCode.toLowerCase().includes(query.toLowerCase())
      )
    : applications.slice(0, 3);

  const filteredRules = query
    ? rules.filter(
        (r) =>
          r.name.toLowerCase().includes(query.toLowerCase()) ||
          r.id.toLowerCase().includes(query.toLowerCase())
      )
    : rules.slice(0, 2);

  const handleSelect = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1100] overflow-y-auto">
      {/* Opaque dark backdrop */}
      <div
        className="fixed inset-0 bg-black/80 transition-opacity"
        onClick={onClose}
      />
      <div className="min-h-full flex items-start justify-center p-4 pt-20">
        <div 
          className="relative w-full max-w-xl rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden animate-fadeIn bg-[var(--surface-elevated)]"
          style={{ opacity: 1, zIndex: 1101 }}
        >
          {/* Search Input Bar */}
          <div className="flex items-center px-4 border-b border-[var(--border)] bg-[var(--surface)]">
            <Search className="w-5 h-5 text-text-muted shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Jump to application, rule, or regulatory module..."
              className="w-full bg-transparent px-3 py-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none font-sans"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-xs text-text-muted hover:text-text-primary px-2"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="ml-2 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-[var(--surface-hover)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results Area */}
          <div className="max-h-80 overflow-y-auto p-3 space-y-4 text-xs bg-[var(--surface-elevated)]">
            {/* Quick Actions */}
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted px-2 mb-1.5 font-sans">
                Quick Navigation
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => handleSelect('/applications/new')}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-text-primary hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <span className="flex items-center gap-2.5 font-medium">
                    <FileSpreadsheet className="w-4 h-4 text-accent" />
                    <span>Create New Application</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
                </button>
                <button
                  onClick={() => handleSelect('/replay')}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-text-primary hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <span className="flex items-center gap-2.5 font-medium">
                    <GitBranch className="w-4 h-4 text-accent" />
                    <span>Launch ReguTrace Replay Simulator</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
                </button>
                <button
                  onClick={() => handleSelect('/applications/APP-2026-003/evidence')}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-text-primary hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <span className="flex items-center gap-2.5 font-medium">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>Evidence Explorer — Deccan Institute Code Mismatch</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
                </button>
              </div>
            </div>

            {/* Applications Matches */}
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted px-2 mb-1.5 font-sans">
                Applications
              </div>
              <div className="space-y-1">
                {filteredApps.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleSelect(`/applications/${a.id}`)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-text-primary">{a.institutionName}</div>
                      <div className="text-[11px] text-text-muted">
                        <span className="font-mono text-accent">{a.id}</span> &bull; {a.institutionCode}
                      </div>
                    </div>
                    <span className="text-[11px] text-text-muted">{a.status}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Rules Matches */}
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted px-2 mb-1.5 font-sans">
                Regulatory Rules
              </div>
              <div className="space-y-1">
                {filteredRules.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelect(`/rules/${r.id}`)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-text-primary">{r.name}</div>
                      <div className="text-[11px] text-text-muted">
                        <span className="font-mono text-accent">{r.id}</span> &bull; {r.category}
                      </div>
                    </div>
                    <span className="text-[11px] text-text-muted font-mono">{r.activeVersion}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-4 py-2.5 bg-[var(--surface-secondary)] border-t border-[var(--border)] flex items-center justify-between text-[11px] text-text-muted">
            <span>Press <kbd className="font-mono px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-text-primary">ESC</kbd> to exit</span>
            <span>NIYANTRAN ReguTrace QuickJump</span>
          </div>
        </div>
      </div>
    </div>
  );
}
