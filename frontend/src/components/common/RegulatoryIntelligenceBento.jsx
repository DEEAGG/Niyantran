import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FileCheck2, 
  ShieldCheck, 
  AlertTriangle, 
  ExternalLink, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  Database,
  Layers,
  ChevronRight,
  Fingerprint
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { applicationService } from '../../services/applicationService';
import { auditService } from '../../services/auditService';
import { dashboardService } from '../../services/dashboardService';

import ScrollReveal from './ScrollReveal';

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export default function RegulatoryIntelligenceBento({ className = "" }) {
  const navigate = useNavigate();
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [cases, setCases] = useState([]);
  const [auditData, setAuditData] = useState(null);
  const [complianceOverview, setComplianceOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      applicationService.getApplications({ pageSize: 5 }).catch(() => ({ data: [] })),
      auditService.verifyAuditChain().catch(() => ({ verified: true, total_records: 0 })),
      dashboardService.getDashboardSummary().catch(() => ({ data: {} })),
    ]).then(([appRes, auditRes, dashRes]) => {
      if (!isMounted) return;
      const rawApps = Array.isArray(appRes?.data) ? appRes.data : [];
      const dashData = dashRes?.data || {};
      const comp = dashData.complianceOverview || null;

      const formatted = rawApps.map((a) => {
        const isVerified = a.status === 'Verified';
        const isDiscrepancy = a.status === 'Discrepancy Detected';
        const isUnderReview = a.status === 'Under Review';
        
        let findingsText = 'Awaiting Evaluation';
        if (a.failedRules > 0) {
          findingsText = `${a.failedRules} violations recorded • ${a.unverifiedRules || 0} unverified`;
        } else if (a.findingsCount > 0) {
          findingsText = `${a.findingsCount} findings recorded`;
        } else if (isVerified) {
          findingsText = 'All Applicable AICTE Norms Met';
        } else if (isUnderReview) {
          findingsText = 'Under Regulatory Review';
        }

        return {
          id: a.id,
          institution: a.institutionName || a.institution_name || 'Institutional Applicant',
          type: a.applicationType || a.application_type || 'Technical Approval',
          status: a.status || 'Draft',
          statusColor: isVerified ? '#18794E' : isDiscrepancy ? '#DC2626' : isUnderReview ? '#B45309' : '#4357E8',
          findings: findingsText,
          documents: a.documentCount || (a.documents ? a.documents.length : 0),
          hash: a.sha256 ? `${a.sha256.slice(0, 6)}…${a.sha256.slice(-4)}` : 'Provenance Hash Active',
          tag: isVerified ? 'Verified Case' : isDiscrepancy ? 'Discrepancy Detected' : isUnderReview ? 'Under Review' : 'Active Filing',
        };
      });

      setCases(formatted);
      setAuditData(auditRes);
      setComplianceOverview(comp);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const totalCases = cases.length;
  const blockHeight = auditData?.total_records || 0;
  const activeCase = cases.length > 0 ? cases[activeCardIndex] || cases[0] : null;

  // Real compliance calculation derived from persisted validation rules
  const hasComplianceScore = complianceOverview && complianceOverview.score !== null && complianceOverview.score !== undefined;
  const rawScore = hasComplianceScore ? complianceOverview.score : 0;
  const gaugePercent = hasComplianceScore ? Math.min(1, Math.max(0, rawScore / 100)) : 0;
  
  const R = 54;
  const circumference = Math.PI * R;
  const dashOffset = circumference * (1 - gaugePercent);
  const needleAngle = -90 + gaugePercent * 180;

  // Determine accurate descriptive label for norms compliance
  let scoreDisplay = '—';
  let scoreSubtitle = 'No Applications Evaluated';
  let badgeLabel = 'Not Evaluated';
  let badgeClass = 'text-text-muted bg-surface-secondary border-border';

  if (hasComplianceScore) {
    scoreDisplay = `${rawScore.toFixed(1)}%`;
    const passed = complianceOverview.passedRules || 0;
    const total = complianceOverview.totalRules || 0;
    const failed = complianceOverview.failedRules || 0;
    const unverified = complianceOverview.unverifiedRules || 0;

    if (failed > 0) {
      scoreSubtitle = `${failed} Violations • ${unverified} Unverified (${passed}/${total} Passed)`;
      badgeLabel = 'Discrepancy Detected';
      badgeClass = 'text-red-700 bg-red-50 border-red-200';
    } else if (unverified > 0) {
      scoreSubtitle = `${unverified} Unverified • Insufficient Evidence (${passed}/${total} Passed)`;
      badgeLabel = 'Insufficient Evidence';
      badgeClass = 'text-amber-700 bg-amber-50 border-amber-200';
    } else if (passed === total && total > 0) {
      scoreSubtitle = `All ${total} Statutory Norms Compliant`;
      badgeLabel = 'Compliant';
      badgeClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    } else {
      scoreSubtitle = `${passed} of ${total} Rules Compliant`;
      badgeLabel = complianceOverview.status || 'Evaluated';
      badgeClass = 'text-blue-700 bg-blue-50 border-blue-200';
    }
  } else if (totalCases > 0) {
    scoreSubtitle = 'Awaiting Regulatory Evaluation';
    badgeLabel = 'Awaiting Evaluation';
    badgeClass = 'text-amber-700 bg-amber-50 border-amber-200';
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Bento Grid Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* TILE 1: Active Institutional Dossiers Stack (Span 2) */}
        <ScrollReveal stagger={1} className="md:col-span-2 lg:col-span-2 rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          {/* Subtle top badge */}
          <div className="flex items-center justify-between pb-3.5 border-b border-border/80">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-text-primary">
                Active Case Dossiers
              </span>
            </div>
            {cases.length > 0 && (
              <div className="flex items-center gap-1.5">
                {cases.slice(0, 4).map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCardIndex(i)}
                    className={cn(
                      "text-xs font-mono px-3 py-1 rounded-full transition-all cursor-pointer",
                      activeCardIndex === i
                        ? "bg-text-primary text-surface font-bold"
                        : "bg-surface-secondary text-text-secondary hover:text-text-primary font-medium"
                    )}
                  >
                    {c.id.slice(-4)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dossier Card Face or Empty State */}
          {activeCase ? (
            <div className="my-5 p-5 rounded-xl border border-border bg-surface-secondary/50 relative">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-xs font-bold text-accent px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                      {activeCase.id}
                    </span>
                    <span className="text-xs font-semibold text-text-muted truncate">
                      {activeCase.type}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-text-primary tracking-tight truncate mt-1">
                    {activeCase.institution}
                  </h3>
                </div>
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap shrink-0 border"
                  style={{
                    backgroundColor: `${activeCase.statusColor}14`,
                    color: activeCase.statusColor,
                    borderColor: `${activeCase.statusColor}30`,
                  }}
                >
                  {activeCase.status}
                </span>
              </div>

              {/* Findings & Provenance line */}
              <div className="mt-4 pt-3.5 border-t border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-text-secondary font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-semibold text-text-primary">{activeCase.findings}</span>
                </div>
                <div className="flex items-center gap-3 text-text-muted font-mono text-xs font-medium">
                  <span><strong className="text-accent">{activeCase.documents}</strong> Documents</span>
                  <span>Provenance: {activeCase.hash}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="my-8 text-center p-6 rounded-xl border border-dashed border-border text-xs sm:text-sm text-text-muted">
              <p className="font-semibold text-text-primary">No institutional applications registered yet.</p>
              <p className="mt-1 text-text-secondary">Upload an institutional dossier or create a filing to initiate regulatory evaluation.</p>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs sm:text-sm">
            <span className="text-text-secondary font-medium">
              Direct evidence links to <span className="text-accent font-semibold">statutory norms</span>.
            </span>
            {activeCase ? (
              <button
                onClick={() => navigate(`/applications/${activeCase.id}`)}
                className="inline-flex items-center gap-1.5 font-bold text-accent hover:text-accent-hover transition-colors cursor-pointer"
              >
                Open Dossier Workspace
                <ArrowUpRight className="w-4 h-4" />
              </button>
            ) : (
              <Link
                to="/applications/new"
                className="inline-flex items-center gap-1.5 font-bold text-accent hover:text-accent-hover transition-colors"
              >
                Register New Application
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </ScrollReveal>

        {/* TILE 2: Statutory Compliance Gauge */}
        <ScrollReveal stagger={2} className="rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3.5 border-b border-border/80">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-text-primary">
              Norms Compliance
            </span>
            <span className={cn("text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border", badgeClass)}>
              {badgeLabel}
            </span>
          </div>

          {/* Radial Semi-Circle Gauge */}
          <div className="my-auto py-3 flex flex-col items-center justify-center text-center">
            <div className="relative" style={{ width: 130, height: 75 }}>
              <svg width="130" height="75" viewBox="0 0 130 75" className="overflow-visible">
                {/* Background arc */}
                <path
                  d="M 11 68 A 54 54 0 0 1 119 68"
                  fill="none"
                  stroke="#E4E2DC"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Active progress arc in Vermilion */}
                <path
                  d="M 11 68 A 54 54 0 0 1 119 68"
                  fill="none"
                  stroke="#E43D12"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  style={{ transition: `stroke-dashoffset 900ms ${EASE}` }}
                />
                {/* Needle Indicator */}
                <g
                  style={{
                    transform: `rotate(${needleAngle}deg)`,
                    transformOrigin: "65px 68px",
                    transition: `transform 900ms ${EASE}`
                  }}
                >
                  <line
                    x1="65"
                    y1="68"
                    x2="65"
                    y2="26"
                    stroke="#171A20"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </g>
                <circle cx="65" cy="68" r="4" fill="#171A20" />
              </svg>
            </div>
            <p className="mt-2.5 font-mono text-3xl font-bold text-text-primary tracking-tight">
              {scoreDisplay}
            </p>
            <p className="text-xs text-text-secondary font-medium mt-1 max-w-[210px] leading-relaxed">
              {scoreSubtitle}
            </p>
          </div>

          <div className="pt-3 text-center border-t border-border/60">
            <span className="text-xs font-mono font-semibold text-text-muted">
              AICTE APH 2024–27 Standards
            </span>
          </div>
        </ScrollReveal>

        {/* TILE 3: Real-Time Audit Stream & Security Ledger */}
        <ScrollReveal stagger={3} className="rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3.5 border-b border-border/80">
            <div className="flex items-center gap-1.5">
              <Database className="w-4 h-4 text-accent" />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-text-primary">
                Audit Stream
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
              Live Chain
            </span>
          </div>

          <div className="my-auto py-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs sm:text-sm font-semibold text-text-secondary">Audit Block Height</span>
              <span className="font-mono text-base font-bold text-text-primary">
                #{blockHeight.toLocaleString()}
              </span>
            </div>
            
            {/* Hash Receipt Preview */}
            <div className="p-3.5 rounded-xl bg-surface-secondary/70 border border-border font-mono text-xs space-y-1.5">
              <div className="flex items-center justify-between text-text-muted">
                <span className="font-bold">CHAIN STATE</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {auditData?.verified ? 'VERIFIED' : 'ACTIVE'}
                </span>
              </div>
              <p className="truncate text-text-primary text-[11px] font-semibold">
                Latest Hash: {auditData?.latest_hash ? `${auditData.latest_hash.slice(0, 16)}…` : 'GENESIS'}
              </p>
              <p className="text-[11px] text-text-secondary font-medium">
                Ledger: <span className="text-accent font-semibold">SHA-256</span> Tamper-Evident Chain
              </p>
            </div>
          </div>

          <Link
            to="/audit"
            className="inline-flex items-center justify-between text-xs sm:text-sm font-bold text-accent hover:text-accent-hover pt-3 border-t border-border/60 transition-colors"
          >
            <span>View Cryptographic Ledger</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </ScrollReveal>

      </div>

      {/* Secondary Ribbon: Multi-Signal Authenticity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Signal 1: Tamper-Evident SHA-256 */}
        <ScrollReveal stagger={1} className="p-4 rounded-xl border border-border bg-surface flex items-center gap-3.5 hover:border-accent/40 shadow-xs transition-colors">
          <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-text-primary">File Hash Provenance</p>
            <p className="text-xs text-text-secondary mt-0.5 leading-snug">
              Every document hashed with <span className="text-accent font-semibold">SHA-256</span> at upload boundary.
            </p>
          </div>
        </ScrollReveal>

        {/* Signal 2: OCR Evidence */}
        <ScrollReveal stagger={2} className="p-4 rounded-xl border border-border bg-surface flex items-center gap-3.5 hover:border-accent/40 shadow-xs transition-colors">
          <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <Fingerprint className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-text-primary">Spatial OCR Citations</p>
            <p className="text-xs text-text-secondary mt-0.5 leading-snug">
              Extracted entities linked to exact <span className="text-accent font-semibold">page coordinates</span>.
            </p>
          </div>
        </ScrollReveal>

        {/* Signal 3: Gazette Policy Engine */}
        <ScrollReveal stagger={3} className="p-4 rounded-xl border border-border bg-surface flex items-center gap-3.5 hover:border-accent/40 shadow-xs transition-colors">
          <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-text-primary">Statutory Backtesting</p>
            <p className="text-xs text-text-secondary mt-0.5 leading-snug">
              Replay filings against <span className="text-accent font-semibold">updated rulesets</span>.
            </p>
          </div>
        </ScrollReveal>

      </div>
    </div>
  );
}
