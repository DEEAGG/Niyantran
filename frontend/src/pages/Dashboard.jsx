import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Clock,
  Compass
} from 'lucide-react';
import { dashboardService } from '../services/dashboardService';
import HeroWave from '../components/ui/dynamic-wave-canvas-background';
import { EditorialScrollHeading } from '../components/ui/text-scroll-animation';
import DocumentUploadDropzone from '../components/common/DocumentUploadDropzone';
import RegulatoryIntelligenceBento from '../components/common/RegulatoryIntelligenceBento';
import { DoodleHeroCluster } from '../components/common/Doodles';
import Skeleton from '../components/common/Skeleton';
import ErrorState from '../components/common/ErrorState';

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

  return (
    <div className="space-y-12 pb-16 animate-fadeIn">
      
      {/* ========================================================= */}
      {/* 1. EDITORIAL HERO & UPLOAD FIRST VIEWPORT                 */}
      {/* ========================================================= */}
      <section className="relative pt-6 pb-10 sm:pt-8 sm:pb-12">
        {/* Subtle Ambient Wave Background Canvas */}
        <HeroWave className="opacity-30 pointer-events-none" />

        {/* NIYANTRAN Decorative Doodle Cluster (Documents, Magnifier, Regulatory Seals) */}
        <DoodleHeroCluster />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-4">
          
          {/* Subtle Tag with Vermilion Node Indicator */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 border border-border text-xs font-medium text-text-secondary shadow-sm backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E43D12] animate-pulse" />
            <span className="font-medium text-text-primary">Autonomous Regulatory Verification &amp; Evidence Tracing</span>
          </div>

          {/* Editorial Animated Headline */}
          <div className="pt-2 flex justify-center">
            <EditorialScrollHeading
              text="Turn Documents into Clear Decisions"
              highlightWord="Documents"
              className="justify-center text-center max-w-3xl font-extrabold"
            />
          </div>

          {/* Concise Supporting Subtext */}
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto font-normal leading-relaxed">
            Review applications, trace evidence, and identify discrepancies in one workspace.
          </p>

          {/* Immediate Action / Real Upload Drop-Zone */}
          <div className="pt-6 max-w-2xl mx-auto text-left">
            <DocumentUploadDropzone />

            {/* Guided Interactive Demo Trigger */}
            <div className="mt-3 flex items-center justify-between p-3.5 rounded-xl border border-border bg-surface shadow-xs text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
                <div className="min-w-0 text-left">
                  <span className="font-semibold text-text-primary text-xs sm:text-sm">Want to see NIYANTRAN in action?</span>
                  <span className="hidden sm:inline text-text-secondary ml-1.5 text-xs">&bull; Walk through a sample case in 6 easy steps.</span>
                </div>
              </div>
              <Link
                to="/demo"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Try Interactive Demo</span>
              </Link>
            </div>
          </div>

          {/* Active Case Registry Callout Banner */}
          <div className="pt-3 max-w-2xl mx-auto">
            <div className="p-3.5 rounded-xl border border-border bg-surface/90 backdrop-blur-sm flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="px-2 py-0.5 rounded bg-accent/10 text-accent font-mono font-bold shrink-0">
                  REGISTRY
                </span>
                <span className="truncate text-text-primary font-medium">
                  {(data?.kpis?.totalApplications ?? data?.totalApplications ?? 0) > 0
                    ? `${data?.kpis?.totalApplications ?? data?.totalApplications} institutional applications registered • ${data?.kpis?.totalFindingViolations ?? data?.criticalFindings ?? 0} findings require review`
                    : 'Operational workspace ready • Register an application to initiate regulatory compliance audit'}
                </span>
              </div>
              <Link
                to={(data?.kpis?.totalApplications ?? data?.totalApplications ?? 0) > 0 ? "/applications" : "/applications/new"}
                className="inline-flex items-center gap-1 font-semibold text-accent hover:text-accent-hover shrink-0"
              >
                {(data?.kpis?.totalApplications ?? data?.totalApplications ?? 0) > 0 ? "Inspect Registry" : "New Application"}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. REGULATORY INTELLIGENCE BENTO SHOWCASE                 */}
      {/* ========================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary tracking-tight">
              Regulatory Intelligence Overview
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Live proof provenance, statutory gazette compliance, and cryptographic audit activity.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/features"
              className="text-xs font-semibold text-accent hover:text-accent-hover inline-flex items-center gap-1"
            >
              Explore Intelligence Features
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <RegulatoryIntelligenceBento />
      </section>

      {/* ========================================================= */}
      {/* 3. WORKLOAD COHORT STATUS & RECENT REGULATORY ACTIVITY    */}
      {/* ========================================================= */}
      {data && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          
          {/* Workload Accounting Bar & Summary (Span 7) */}
          <div className="lg:col-span-7 rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col justify-between">
            <div>
              {(() => {
                const total = data.cohortBreakdown?.total ?? data.kpis?.totalApplications ?? 0;
                const verified = data.cohortBreakdown?.verified ?? 0;
                const pending = data.cohortBreakdown?.pendingFilings ?? 0;
                const flagged = data.cohortBreakdown?.issues ?? 0;
                const verifiedPct = total > 0 ? ((verified / total) * 100).toFixed(1) : '0.0';
                const pendingPct = total > 0 ? ((pending / total) * 100).toFixed(1) : '0.0';
                const flaggedPct = total > 0 ? ((flagged / total) * 100).toFixed(1) : '0.0';

                return (
                  <>
                    <div className="flex items-center justify-between pb-3 border-b border-border/80">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                        Workload Status Breakdown
                      </h3>
                      <span className="font-mono text-xs font-bold text-text-primary">
                        {total} Filings Total
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-5 space-y-2">
                      <div className="h-3 w-full rounded-full bg-surface-secondary overflow-hidden flex">
                        <div
                          style={{ width: `${verifiedPct}%` }}
                          className="bg-emerald-600 h-full"
                          title="Verified Compliant"
                        />
                        <div
                          style={{ width: `${pendingPct}%` }}
                          className="bg-accent h-full"
                          title="Pending Filings"
                        />
                        <div
                          style={{ width: `${flaggedPct}%` }}
                          className="bg-amber-500 h-full"
                          title="Flagged Discrepancy"
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-text-secondary pt-1 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                          <span>Verified: {verified} ({verifiedPct}%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                          <span>Pending: {pending} ({pendingPct}%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          <span>Flagged: {flagged} ({flaggedPct}%)</span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              <p className="mt-4 text-xs text-text-secondary leading-relaxed">
                Workload statuses reflect immutable SQLite records without double-counting. Pending filings include incomplete documentation requiring officer ingestion.
              </p>
            </div>

            <div className="pt-4 mt-6 border-t border-border flex items-center justify-between">
              <span className="text-xs text-text-muted">
                Statutory Gazette Version: 2026.2 (Active)
              </span>
              <Link
                to="/monitoring"
                className="text-xs font-semibold text-accent hover:text-accent-hover inline-flex items-center gap-1"
              >
                Open Monitoring Console
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Recent Filings Quick Registry (Span 5) */}
          <div className="lg:col-span-5 rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-border/80">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                Recent Regulatory Filings
              </h3>
              <Link
                to="/applications"
                className="text-xs font-semibold text-accent hover:text-accent-hover"
              >
                View all
              </Link>
            </div>

            <div className="divide-y divide-border/60 my-2">
              {(data.recentApplications || []).length > 0 ? (
                (data.recentApplications || []).slice(0, 4).map((app) => (
                  <div
                    key={app.id}
                    onClick={() => navigate(`/applications/${app.id}`)}
                    className="py-3 flex items-center justify-between gap-3 cursor-pointer group hover:bg-surface-secondary/40 px-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-accent">
                          {app.id}
                        </span>
                        <span className="text-[11px] text-text-muted truncate">
                          {app.applicationType || 'Technical Approval'}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-text-primary truncate mt-0.5 group-hover:text-accent transition-colors">
                        {app.institutionName}
                      </p>
                    </div>

                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        app.status === 'Verified'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : app.status === 'Discrepancy Detected'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : app.status === 'Under Review'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-surface-secondary text-text-secondary border border-border'
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-text-muted">
                  No applications filed yet. Upload documents or create a new filing to begin.
                </div>
              )}
            </div>

            <div className="pt-2 text-right">
              <Link
                to="/review"
                className="text-xs font-semibold text-accent hover:text-accent-hover inline-flex items-center gap-1"
              >
                Go to Adjudication Review Desk
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

        </section>
      )}

    </div>
  );
}
