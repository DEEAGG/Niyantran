import React, { useState, useEffect, useRef } from 'react';
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
import ScrollReveal from '../components/common/ScrollReveal';

export default function Dashboard() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
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
      <section ref={heroRef} className="relative pt-6 pb-10 sm:pt-8 sm:pb-12">
        {/* Subtle Ambient Wave Background Canvas */}
        <HeroWave className="opacity-30 pointer-events-none" />

        {/* NIYANTRAN Decorative Doodle Cluster (Documents, Magnifier, Regulatory Seals) */}
        <DoodleHeroCluster />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-4">
          
          {/* Subtle Tag with Vermilion Node Indicator */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 border border-border text-xs sm:text-sm font-semibold text-text-secondary shadow-xs backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-[#E43D12] animate-pulse" />
            <span className="text-text-primary">Autonomous <span className="text-accent font-semibold">Regulatory Verification</span> &amp; Evidence Tracing</span>
          </div>

          {/* Editorial Animated Headline with CharacterV1 Scroll-Linked Convergence */}
          <div className="pt-2 flex justify-center">
            <EditorialScrollHeading
              text="Turn Documents into Clear Decisions"
              highlightWord="Documents"
              containerRef={heroRef}
              className="justify-center text-center max-w-3xl font-extrabold"
            />
          </div>

          {/* Concise Supporting Subtext */}
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto font-medium leading-relaxed">
            Review filings, trace <span className="text-accent font-semibold">evidentiary proof</span>, and identify regulatory discrepancies in one unified workspace.
          </p>

          {/* Immediate Action / Real Upload Drop-Zone */}
          <div className="pt-6 max-w-2xl mx-auto text-left">
            <DocumentUploadDropzone />

            {/* Guided Interactive Demo Trigger */}
            <div className="mt-3 flex items-center justify-between p-4 rounded-xl border border-border bg-surface shadow-xs text-xs sm:text-sm">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shrink-0" />
                <div className="min-w-0 text-left">
                  <span className="font-bold text-text-primary">Want to see NIYANTRAN in action?</span>
                  <span className="hidden sm:inline text-text-secondary ml-1.5 font-medium">&bull; Walk through a live case in 6 easy steps.</span>
                </div>
              </div>
              <Link
                to="/demo"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-white text-xs sm:text-sm font-bold hover:bg-accent-hover transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Try Interactive Demo</span>
              </Link>
            </div>
          </div>

          {/* Active Case Registry Callout Banner */}
          <div className="pt-3 max-w-2xl mx-auto">
            <div className="p-3.5 rounded-xl border border-border bg-surface/90 backdrop-blur-sm flex items-center justify-between gap-4 text-xs sm:text-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="px-2 py-0.5 rounded bg-accent/10 text-accent font-mono font-bold shrink-0">
                  REGISTRY
                </span>
                <span className="truncate text-text-primary font-medium">
                  {(data?.kpis?.totalApplications ?? data?.totalApplications ?? 0) > 0
                    ? `${data?.kpis?.totalApplications ?? data?.totalApplications} applications registered • ${data?.kpis?.totalFindingViolations ?? data?.criticalFindings ?? 0} findings require officer review`
                    : 'Operational workspace ready • Register an application to initiate regulatory compliance audit'}
                </span>
              </div>
              <Link
                to={(data?.kpis?.totalApplications ?? data?.totalApplications ?? 0) > 0 ? "/applications" : "/applications/new"}
                className="inline-flex items-center gap-1 font-bold text-accent hover:text-accent-hover shrink-0"
              >
                {(data?.kpis?.totalApplications ?? data?.totalApplications ?? 0) > 0 ? "Inspect Registry" : "New Application"}
                <ChevronRight className="w-4 h-4" />
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
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
              Regulatory Intelligence <span className="text-accent">Overview</span>
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary mt-1 font-medium">
              Live proof provenance, statutory gazette compliance, and cryptographic audit activity.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/features"
              className="text-xs sm:text-sm font-bold text-accent hover:text-accent-hover inline-flex items-center gap-1.5"
            >
              Explore Intelligence Features
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <RegulatoryIntelligenceBento />
      </section>

      {/* ========================================================= */}
      {/* 3. WORKLOAD COHORT STATUS & RECENT REGULATORY ACTIVITY    */}
      {/* ========================================================= */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          
          {/* Workload Accounting Bar & Summary (Span 7) */}
          <ScrollReveal stagger={1} className="lg:col-span-7 rounded-2xl border border-border bg-surface p-6 sm:p-7 shadow-sm flex flex-col justify-between">
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
                    <div className="flex items-center justify-between pb-3.5 border-b border-border/80">
                      <h3 className="text-base sm:text-lg font-bold uppercase tracking-wider text-text-primary">
                        Workload Status Breakdown
                      </h3>
                      <span className="text-xs sm:text-sm font-bold text-accent bg-[#FDF1EE] px-3 py-1 rounded-full border border-accent/25">
                        {total} Filings Total
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-5 space-y-3">
                      <div className="h-4 w-full rounded-full bg-surface-secondary overflow-hidden flex">
                        <div
                          style={{ width: `${verifiedPct}%` }}
                          className="bg-emerald-600 h-full transition-all duration-500"
                          title="Verified Compliant"
                        />
                        <div
                          style={{ width: `${pendingPct}%` }}
                          className="bg-accent h-full transition-all duration-500"
                          title="Pending Filings"
                        />
                        <div
                          style={{ width: `${flaggedPct}%` }}
                          className="bg-amber-500 h-full transition-all duration-500"
                          title="Flagged Discrepancy"
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs sm:text-sm text-text-secondary pt-1 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                          <span>Verified: <strong className="text-text-primary">{verified}</strong> ({verifiedPct}%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                          <span>Pending: <strong className="text-text-primary">{pending}</strong> ({pendingPct}%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          <span>Flagged: <strong className="text-text-primary">{flagged}</strong> ({flaggedPct}%)</span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              <p className="mt-4 text-xs sm:text-sm text-text-secondary leading-relaxed font-medium">
                Workload statuses reflect immutable database records. <span className="text-accent font-bold">Pending filings</span> indicate incomplete uploads requiring document ingestion.
              </p>
            </div>

            <div className="pt-4 mt-6 border-t border-border flex items-center justify-between">
              <span className="text-xs sm:text-sm text-text-muted font-semibold">
                Statutory Gazette Version: 2026.2 (Active)
              </span>
              <Link
                to="/monitoring"
                className="text-xs sm:text-sm font-bold text-accent hover:text-accent-hover inline-flex items-center gap-1.5"
              >
                Open Monitoring Console
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </ScrollReveal>

          {/* Recent Filings Quick Registry (Span 5) */}
          <ScrollReveal stagger={2} className="lg:col-span-5 rounded-2xl border border-border bg-surface p-6 sm:p-7 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3.5 border-b border-border/80">
              <h3 className="text-base sm:text-lg font-bold uppercase tracking-wider text-text-primary">
                Recent Regulatory Filings
              </h3>
              <Link
                to="/applications"
                className="text-xs sm:text-sm font-bold text-accent hover:text-accent-hover"
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
                        <span className="text-xs font-bold text-accent">
                          {app.id}
                        </span>
                        <span className="text-xs text-text-muted truncate">
                          {app.applicationType || 'Technical Approval'}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-text-primary truncate mt-0.5 group-hover:text-accent transition-colors">
                        {app.institutionName}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${
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
                <div className="py-8 text-center text-xs sm:text-sm text-text-muted">
                  No applications filed yet. Upload documents or create a new filing to begin.
                </div>
              )}
            </div>

            <div className="pt-3 text-right">
              <Link
                to="/review"
                className="text-xs sm:text-sm font-bold text-accent hover:text-accent-hover inline-flex items-center gap-1.5"
              >
                Go to Adjudication Review Desk
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </ScrollReveal>

        </div>
      )}

    </div>
  );
}
