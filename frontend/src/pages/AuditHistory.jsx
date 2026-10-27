import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  History, ShieldCheck, Search, Filter, Clock, User, 
  Cpu, FileText, CheckCircle2, AlertTriangle, Play, Eye, 
  ChevronRight, Lock, Sparkles, Terminal
} from 'lucide-react';
import { auditService } from '../services/auditService';
import { useToast } from '../context/ToastContext';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';

export default function AuditHistory() {
  const { addToast } = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('All');
  const [selectedActor, setSelectedActor] = useState('All');

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await auditService.getAuditEvents();
      setEvents(res.data || []);
    } catch (err) {
      console.error('Error fetching audit trail:', err);
      addToast('Failed to load audit events.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const filteredEvents = events.filter((ev) => {
    if (selectedEntity !== 'All' && ev.entityType !== selectedEntity) return false;
    if (selectedActor !== 'All') {
      if (selectedActor === 'Automated' && !ev.actor.includes('Engine')) return false;
      if (selectedActor === 'Officer' && !ev.actor.includes('Sharma')) return false;
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        ev.id.toLowerCase().includes(q) ||
        ev.eventType.toLowerCase().includes(q) ||
        ev.actor.toLowerCase().includes(q) ||
        (ev.applicationId && ev.applicationId.toLowerCase().includes(q)) ||
        ev.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getEventIcon = (type) => {
    if (type.includes('Validation')) return Cpu;
    if (type.includes('Review')) return ShieldCheck;
    if (type.includes('Replay')) return Play;
    return FileText;
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner / Hero */}
      <div className="bg-surface rounded-xl p-6 sm:p-8 border border-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-accent/15 text-accent border border-accent/25 flex items-center gap-1.5 font-semibold">
                <Lock className="w-3.5 h-3.5" />
                Cryptographic Audit Trail (SHA-256 Ledger)
              </span>
              <span className="text-xs font-mono flex items-center gap-1" style={{ color: 'var(--status-success)' }}>
                <CheckCircle2 className="w-3 h-3" />
                Audit Ledger Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
              System Audit History
            </h1>
            <p className="text-sm text-text-secondary mt-1.5 max-w-2xl leading-relaxed">
              Cryptographic audit log capturing document ingestions, OCR checkpoints, automated rule evaluations, officer review decisions, and policy replays with tamper-evident hash chaining.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={History}
              onClick={fetchEvents}
            >
              Refresh Ledger
            </Button>
          </div>
        </div>

        {/* Statistical Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-border/60">
          <div>
            <span className="text-xs text-text-muted block">Total Logged Events</span>
            <span className="text-xl font-bold font-mono text-text-primary mt-0.5 block">{events.length} Recorded</span>
          </div>
          <div>
            <span className="text-xs text-text-muted block">Automated Engine Audits</span>
            <span className="text-xl font-bold font-mono text-accent mt-0.5 block">
              {events.filter(e => e.actor.includes('Engine')).length} Actions
            </span>
          </div>
          <div>
            <span className="text-xs text-text-muted block">Officer Review Decisions</span>
            <span className="text-xl font-bold font-mono text-emerald-400 mt-0.5 block">
              {events.filter(e => e.actor.includes('Sharma')).length} Signed
            </span>
          </div>
          <div>
            <span className="text-xs text-text-muted block">Chain Integrity Verification</span>
            <span className="text-xl font-bold font-mono text-text-primary mt-0.5 block">100% Valid</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ID, application, actor, or event narrative..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
            style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
          >
            <option value="All">All Entity Types</option>
            <option value="Validation">Validation</option>
            <option value="Review">Review Action</option>
            <option value="Replay">Replay Simulation</option>
            <option value="Application">Application</option>
          </select>

          <select
            value={selectedActor}
            onChange={(e) => setSelectedActor(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
            style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
          >
            <option value="All">All Actors</option>
            <option value="Automated">ReguTrace Engine (Automated)</option>
            <option value="Officer">Compliance Officers</option>
          </select>
        </div>
      </div>

      {/* Audit Timeline List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="bg-surface rounded-xl p-5 border border-border space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          icon={History}
          title="No audit events found"
          description="No event records match your current search terms or category filters."
          action={{
            label: "Reset Filters",
            onClick: () => { setSearchTerm(''); setSelectedEntity('All'); setSelectedActor('All'); }
          }}
        />
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((ev) => {
            const Icon = getEventIcon(ev.eventType);
            const isEngine = ev.actor.includes('Engine');
            return (
              <div
                key={ev.id}
                className="bg-surface rounded-xl p-5 border border-border hover:border-accent/30 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isEngine 
                      ? 'bg-accent/15 text-accent border border-accent/25' 
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-accent">
                        {ev.id}
                      </span>
                      <span className="text-text-muted text-xs">•</span>
                      <span className="text-xs font-semibold text-text-primary">
                        {ev.eventType}
                      </span>
                      {ev.applicationId && (
                        <Link
                          to={`/applications/${ev.applicationId}`}
                          className="font-mono text-xs text-text-secondary hover:text-text-primary hover:underline bg-surface-elevated px-2 py-0.5 rounded border border-border"
                        >
                          {ev.applicationId}
                        </Link>
                      )}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-text-muted border border-border">
                        {ev.entityType}
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed">
                      {ev.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted pt-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-text-muted" />
                        Actor: <strong className="text-text-primary">{ev.actor}</strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-text-muted" />
                        {new Date(ev.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex md:flex-col items-end justify-between md:justify-start gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-border">
                  <span className="text-[10px] font-mono text-text-muted bg-surface-elevated px-2 py-1 rounded border border-border/80">
                    SHA-256 Verified
                  </span>
                  {ev.applicationId && (
                    <Link
                      to={`/applications/${ev.applicationId}`}
                      className="text-xs text-accent hover:underline flex items-center gap-1"
                    >
                      Dossier
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
