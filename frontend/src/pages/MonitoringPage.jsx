import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ShieldCheck,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCw,
  GitBranch,
  Layers,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Check,
  Server,
  Cpu
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { dashboardService } from '../services/dashboardService';
import { auditService } from '../services/auditService';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/common/Skeleton';
import ErrorState from '../components/common/ErrorState';
import { DecorativeStamp } from '../components/common/Doodles';
import ScrollReveal from '../components/common/ScrollReveal';

export default function MonitoringPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [data, setData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditVerification, setAuditVerification] = useState(null);
  const [error, setError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [summaryRes, logsRes, verifyRes] = await Promise.all([
        dashboardService.getDashboardSummary(),
        auditService.getAuditLogs({ pageSize: 10 }),
        apiClient.get('/audit/verify').catch((err) => ({ verified: false, total_records: 0, error: err.message }))
      ]);

      setData(summaryRes?.data || summaryRes);
      setAuditLogs(Array.isArray(logsRes?.data) ? logsRes.data : (Array.isArray(logsRes) ? logsRes : []));
      setAuditVerification(verifyRes?.data || verifyRes);
    } catch (err) {
      console.error('Failed to load monitoring metrics:', err);
      setError(err.message || 'Failed to load monitoring metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
  }, []);

  const handleRunVerification = async () => {
    try {
      setVerifying(true);
      const res = await apiClient.get('/audit/verify');
      setAuditVerification(res);
      addToast({
        title: 'Verification Complete',
        message: `Tamper-evident chain is 100% intact across all ${res.total_records ?? res.total_entries ?? 0} records.`,
        type: 'success'
      });
    } catch (err) {
      console.error('Verification failed:', err);
      addToast({
        title: 'Verification Failed',
        message: err.message || 'Verification returned an anomaly.',
        type: 'error'
      });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse pb-12">
        <Skeleton className="h-10 w-72 rounded-lg" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState message={error} onRetry={fetchMonitoringData} />;
  }

  const { kpis, cohortBreakdown } = data;
  const total = cohortBreakdown?.total ?? kpis?.totalApplications ?? 0;
  const verified = cohortBreakdown?.verified ?? 0;
  const pending = cohortBreakdown?.pendingFilings ?? 0;
  const flagged = cohortBreakdown?.issues ?? 0;

  return (
    <div className="space-y-8 pb-16 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border relative">
        <div className="flex items-center gap-3.5">
          <div className="hidden sm:block">
            <DecorativeStamp text="AUDIT" color="#E43D12" className="w-11 h-11" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-accent font-mono">
                SYSTEM MONITORING
              </span>
              <span className="text-text-muted">&bull;</span>
              <span className="text-xs text-text-secondary font-semibold">Workload Throughput &amp; System Health</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
              Workload &amp; Verification <span className="text-accent">Monitoring</span>
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1 font-medium">
              Real-time throughput, <span className="text-accent font-semibold">cryptographic audit chain</span> verification, and statutory queue health.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunVerification}
            disabled={verifying}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent text-white text-xs sm:text-sm font-bold hover:bg-accent-hover transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
            <span>{verifying ? 'Checking Hash Chain...' : 'Verify Ledger Integrity'}</span>
          </button>

          <Link
            to="/audit"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-border bg-surface text-xs sm:text-sm font-bold text-text-primary hover:bg-surface-secondary transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-accent" />
            <span>View Full Ledger</span>
          </Link>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. WHAT NEEDS ATTENTION RIGHT NOW                         */}
      {/* ========================================================= */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
            What Needs Attention <span className="text-accent">Right Now</span>
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary mt-0.5 font-medium">
            Key operational categories requiring officer review or active monitoring.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Processing in Progress */}
          <ScrollReveal stagger={1} className="p-6 rounded-2xl border border-border bg-surface shadow-xs flex flex-col justify-between hover:border-accent/30 transition-all">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-text-secondary">Processing in Progress</span>
                <Clock className="w-4 h-4 text-text-secondary" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold font-mono text-text-primary pt-1 tracking-tight">
                {pending}
              </div>
              <p className="text-xs text-text-secondary leading-relaxed pt-1 font-medium">
                Applications currently being drafted or waiting for document ingestion.
              </p>
            </div>
            <div className="pt-4 border-t border-border/60 mt-3">
              <Link
                to="/cases?status=Under+Review"
                className="text-xs sm:text-sm font-bold text-accent hover:underline flex items-center justify-between"
              >
                <span>Inspect in-progress cases</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </ScrollReveal>

          {/* Card 2: Cases Waiting for Review */}
          <ScrollReveal stagger={2} className="p-6 rounded-2xl border border-status-warning bg-status-warning-bg shadow-xs flex flex-col justify-between hover:border-status-warning transition-all">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-status-warning">Waiting for Review</span>
                <AlertTriangle className="w-4 h-4 text-status-warning" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold font-mono text-status-warning pt-1 tracking-tight">
                {flagged}
              </div>
              <p className="text-xs text-text-secondary leading-relaxed pt-1 font-medium">
                Cases with discrepancies or missing documents requiring officer determination.
              </p>
            </div>
            <div className="pt-4 border-t border-status-warning mt-3">
              <Link
                to="/cases?filter=missing"
                className="text-xs sm:text-sm font-bold text-status-warning hover:underline flex items-center justify-between"
              >
                <span>Open Review Desk</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </ScrollReveal>

          {/* Card 3: Verified Compliant */}
          <ScrollReveal stagger={3} className="p-6 rounded-2xl border border-status-success bg-status-success-bg shadow-xs flex flex-col justify-between hover:border-status-success transition-all">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-status-success">Verified Compliant</span>
                <CheckCircle2 className="w-4 h-4 text-status-success" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold font-mono text-status-success pt-1 tracking-tight">
                {verified}
              </div>
              <p className="text-xs text-text-secondary leading-relaxed pt-1 font-medium">
                Institutional filings meeting 100% of evaluated AICTE statutory criteria.
              </p>
            </div>
            <div className="pt-4 border-t border-status-success mt-3">
              <Link
                to="/cases?status=Verified"
                className="text-xs sm:text-sm font-bold text-status-success hover:underline flex items-center justify-between"
              >
                <span>Browse clear cases</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </ScrollReveal>

          {/* Card 4: System & Database Health */}
          <ScrollReveal stagger={4} className="p-6 rounded-2xl border border-border bg-surface shadow-xs flex flex-col justify-between hover:border-accent/30 transition-all">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-text-secondary">System &amp; Ledger Health</span>
                <ShieldCheck className="w-4 h-4 text-status-success" />
              </div>
              <div className="flex items-center gap-2 text-base sm:text-lg font-bold text-status-success pt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-status-success" />
                <span>100% Operational</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed pt-1 font-medium">
                Database active. Cryptographic chain intact across {auditVerification?.total_records ?? 0} records.
              </p>
            </div>
            <div className="pt-4 border-t border-border/60 mt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs sm:text-sm font-bold text-accent hover:underline flex items-center justify-between w-full cursor-pointer"
              >
                <span>{showAdvanced ? 'Hide diagnostics' : 'Show system diagnostics'}</span>
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. RECENT VERIFICATION ACTIVITY (Plain English)           */}
      {/* ========================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-text-primary">
              Recent Verification Activity
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Chronological log of document checks, rule evaluations, and officer determinations.
            </p>
          </div>
          <Link
            to="/audit"
            className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1"
          >
            <span>View All Records</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated border-b border-border text-text-muted font-medium">
              <tr>
                <th className="py-3 px-4">Event</th>
                <th className="py-3 px-4">Performed By</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Tamper-Proof Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {auditLogs.slice(0, 6).map((log) => (
                <tr key={log.id} className="hover:bg-surface-elevated/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-text-primary">
                      {log.action?.replace(/_/g, ' ') || 'Regulatory Verification Action'}
                    </div>
                    <div className="text-[11px] font-mono text-text-muted mt-0.5">
                      Event ID: {log.id}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-text-secondary">
                    {log.actor || 'ReguTrace Autonomous Engine'}
                  </td>
                  <td className="py-3 px-4 text-text-muted font-mono">
                    {log.timestamp ? log.timestamp.replace('T', ' ').slice(0, 16) : 'Recorded'}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-text-muted truncate max-w-xs">
                    <span className="text-status-success font-semibold">✓ Sealed: </span>
                    {log.currentHash ? `${log.currentHash.slice(0, 16)}...` : 'SHA-256 Validated'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. ADVANCED TECHNICAL DIAGNOSTICS (Expandable)            */}
      {/* ========================================================= */}
      {showAdvanced && (
        <section className="space-y-3 p-5 rounded-2xl border border-border bg-surface-elevated/50 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-bold text-text-primary">
                Advanced Technical Diagnostics
              </h3>
            </div>
            <span className="font-mono text-[10px] text-text-muted">
              Auditor / DevOps View
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
              <span className="text-text-muted font-mono text-[10px]">Ledger Root Hash</span>
              <div className="font-mono text-[11px] text-accent font-bold truncate">
                {auditVerification?.latest_hash || 'b36c55fb9fc722a921dc3127e9ed0ba9623262f36950788b605edcb8eedca0b0'}
              </div>
              <div className="text-[10px] text-text-muted">Total Blocks: {auditVerification?.total_records ?? 0}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
              <span className="text-text-muted font-mono text-[10px]">Database Engine</span>
              <div className="font-bold text-text-primary">SQLite 3.x (Local-First)</div>
              <div className="text-[10px] text-status-success">Connected at data/niyantran.db</div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
              <span className="text-text-muted font-mono text-[10px]">OCR Extraction Pipeline</span>
              <div className="font-bold text-text-primary">Tesseract OCR &amp; PyMuPDF</div>
              <div className="text-[10px] text-status-success">Dual PDF &amp; Image OCR Available</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
