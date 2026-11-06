import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  FilePlus,
} from 'lucide-react';
import { dashboardService } from '../services/dashboardService';
import DocumentUploadDropzone from '../components/common/DocumentUploadDropzone';
import RegulatoryIntelligenceBento from '../components/common/RegulatoryIntelligenceBento';
import Skeleton from '../components/common/Skeleton';
import ErrorState from '../components/common/ErrorState';
import ScrollReveal from '../components/common/ScrollReveal';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await dashboardService.getDashboardSummary();
      setData(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 py-6">
        <div className="space-y-3 max-w-2xl">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-7 h-56" />
          <Skeleton className="lg:col-span-5 h-56" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12">
        <ErrorState title="Could not load dashboard" message={error} />
      </div>
    );
  }

  const total = data?.cohortBreakdown?.total ?? data?.kpis?.totalApplications ?? 0;
  const verified = data?.cohortBreakdown?.verified ?? 0;
  const pending = data?.cohortBreakdown?.pendingFilings ?? 0;
  const flagged = data?.cohortBreakdown?.issues ?? 0;
  const verifiedPct = total > 0 ? ((verified / total) * 100).toFixed(1) : '0.0';
  const pendingPct = total > 0 ? ((pending / total) * 100).toFixed(1) : '0.0';
  const flaggedPct = total > 0 ? ((flagged / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-10 pb-16">
      {/* Page header */}
      <section className="pt-4 pb-2">
        <div className="flex flex-col gap-5">
          <div className="max-w-3xl">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
              Regulatory Overview
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">
              Review filings, trace evidentiary proof, and identify regulatory discrepancies in one unified workspace.
            </p>
          </div>

          <div className="max-w-2xl">
            <DocumentUploadDropzone />

            <div className="mt-3 flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-surface">
              <div className="flex items-center gap-3 min-w-0">
                <span className="px-2 py-0.5 rounded bg-accent-secondary text-accent text-[11px] font-medium shrink-0">
                  Registry
                </span>
                <span className="truncate text-xs sm:text-sm text-text-primary">
                  {total > 0
                    ? `${total} applications registered • ${flagged} findings require officer review`
                    : 'Operational workspace ready • Register an application to initiate a regulatory compliance audit'}
                </span>
              </div>
              <Link
                to={total > 0 ? '/applications' : '/applications/new'}
                className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-accent hover:text-accent-hover shrink-0"
              >
                {total > 0 ? 'Inspect Registry' : 'New Application'}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Regulatory intelligence */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary">
              Regulatory Intelligence
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary mt-1">
              Proof provenance, statutory gazette compliance, and cryptographic audit activity.
            </p>
          </div>
          <Link
            to="/features"
            className="text-xs sm:text-sm font-semibold text-accent hover:text-accent-hover inline-flex items-center gap-1.5 shrink-0"
          >
            Explore features
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <RegulatoryIntelligenceBento />
      </section>

      {/* Workload & recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Workload */}
        <ScrollReveal stagger={1} className="lg:col-span-7 rounded-xl border border-border bg-surface p-6 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-border/80">
              <h3 className="text-base font-semibold text-text-primary">
                Workload status
              </h3>
              <span className="text-xs font-semibold text-accent bg-accent-secondary px-3 py-1 rounded-full border border-accent/25">
                {total} filings total
              </span>
            </div>

            <div className="mt-5 space-y-3">
              <div className="h-4 w-full rounded-full bg-surface-secondary overflow-hidden flex">
                <div style={{ width: `${verifiedPct}%` }} className="bg-emerald-600 h-full transition-all duration-500" title="Verified compliant" />
                <div style={{ width: `${pendingPct}%` }} className="bg-accent h-full transition-all duration-500" title="Pending filings" />
                <div style={{ width: `${flaggedPct}%` }} className="bg-amber-500 h-full transition-all duration-500" title="Flagged discrepancy" />
              </div>

              <div className="flex items-center justify-between text-xs text-text-secondary pt-1 font-medium flex-wrap gap-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  <span>Verified: <strong className="text-text-primary font-semibold">{verified}</strong> ({verifiedPct}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                  <span>Pending: <strong className="text-text-primary font-semibold">{pending}</strong> ({pendingPct}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Flagged: <strong className="text-text-primary font-semibold">{flagged}</strong> ({flaggedPct}%)</span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-text-secondary leading-relaxed">
              Workload statuses reflect immutable database records. Pending filings indicate incomplete uploads requiring document ingestion.
            </p>
          </div>

          <div className="pt-4 mt-6 border-t border-border flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs text-text-muted font-medium">
              Statutory Gazette Version: 2026.2 (Active)
            </span>
            <Link
              to="/monitoring"
              className="text-xs font-semibold text-accent hover:text-accent-hover inline-flex items-center gap-1.5"
            >
              Open monitoring console
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </ScrollReveal>

        {/* Recent filings */}
        <ScrollReveal stagger={2} className="lg:col-span-5 rounded-xl border border-border bg-surface p-6 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-border/80">
              <h3 className="text-base font-semibold text-text-primary">
                Recent filings
              </h3>
              <Link to="/applications" className="text-xs font-semibold text-accent hover:text-accent-hover">
                View all
              </Link>
            </div>

            <div className="divide-y divide-border/60 my-2">
              {(data?.recentApplications || []).length > 0 ? (
                (data?.recentApplications || []).slice(0, 4).map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => navigate(`/applications/${app.id}`)}
                    className="w-full text-left py-3 flex items-center justify-between gap-3 cursor-pointer group hover:bg-surface-secondary/40 px-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-accent font-mono">
                          {app.id}
                        </span>
                        <span className="text-xs text-text-muted truncate">
                          {app.applicationType || 'Technical Approval'}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-text-primary truncate mt-0.5 group-hover:text-accent transition-colors">
                        {app.institutionName}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 border ${app.status === 'Verified'
                          ? 'bg-status-success-bg text-status-success border-status-success/30'
                          : app.status === 'Discrepancy Detected'
                            ? 'bg-status-error-bg text-status-error border-status-error/30'
                            : app.status === 'Under Review'
                              ? 'bg-status-warning-bg text-status-warning border-status-warning/30'
                              : 'bg-surface-secondary text-text-secondary border-border'
                        }`}
                    >
                      {app.status}
                    </span>
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-xs sm:text-sm text-text-muted">
                  No applications filed yet. Upload documents or create a new filing to begin.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 text-right">
            <Link
              to="/review"
              className="text-xs font-semibold text-accent hover:text-accent-hover inline-flex items-center gap-1.5"
            >
              Go to review desk
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
