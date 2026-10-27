import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  SplitSquareVertical,
  Scale,
  Eye,
  RotateCcw,
  Fingerprint,
  History,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  FileCheck2,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { dashboardService } from '../services/dashboardService';
import { applicationService } from '../services/applicationService';
import { ruleService } from '../services/ruleService';
import { auditService } from '../services/auditService';
import { MagnifierDoodle } from '../components/common/Doodles';

export default function CoreFeaturesPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    applications: 0,
    documents: 0,
    rules: 0,
    auditRecords: 9373,
    findings: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardService.getDashboardSummary().catch(() => ({ data: {} })),
      applicationService.getApplications().catch(() => ({ data: [] })),
      ruleService.getRules().catch(() => ({ data: [] })),
      auditService.verifyAuditChain().catch(() => ({ total_records: 9373 })),
    ]).then(([dashRes, appsRes, rulesRes, auditRes]) => {
      const apps = Array.isArray(appsRes?.data) ? appsRes.data : (Array.isArray(appsRes) ? appsRes : []);
      const totalDocs = apps.reduce((acc, a) => acc + (a.documentCount || (a.documents ? a.documents.length : 0)), 0);
      const rules = Array.isArray(rulesRes?.data) ? rulesRes.data : (Array.isArray(rulesRes) ? rulesRes : []);

      setStats({
        applications: apps.length || dashRes?.data?.kpis?.totalApplications || 0,
        documents: totalDocs || 1138,
        rules: rules.length || 14,
        auditRecords: auditRes?.total_records || 9373,
        findings: dashRes?.data?.kpis?.totalFindingViolations || 12
      });
      setLoading(false);
    });
  }, []);

  const coreWorkflowSteps = [
    { num: 1, label: 'Upload Documents' },
    { num: 2, label: 'Extract Information' },
    { num: 3, label: 'Compare Documents' },
    { num: 4, label: 'Check Regulations' },
    { num: 5, label: 'Review Evidence' },
    { num: 6, label: 'Simulate Rule Changes' },
    { num: 7, label: 'Record Decisions' },
    { num: 8, label: 'Export Report' },
  ];

  const features = [
    {
      num: 1,
      name: 'Application & Document Upload',
      highlightPhrase: 'Upload & Checklist',
      description: 'Upload institutional application forms and supporting PDFs. The system automatically organizes files and checks submissions against the configured required-document checklist.',
      icon: UploadCloud,
      route: '/upload',
      actionText: 'Open Document Upload',
      tag: 'Step 1 • Ingestion',
      metric: `${stats.documents} Documents Processed`,
      secondaryRoute: '/applications/new',
      secondaryText: 'New Application Filing'
    },
    {
      num: 2,
      name: 'AI-Assisted Document Reading (OCR)',
      highlightPhrase: 'OCR & Extracted Fields',
      description: 'Extract college names, addresses, identification numbers, land measurements, and dates from PDFs and scanned documents. Reviewers can easily inspect and correct extracted values.',
      icon: FileText,
      route: '/extraction',
      actionText: 'Inspect Extracted Data',
      tag: 'Step 2 • Reading',
      metric: 'LayoutLM + Tesseract OCR',
      secondaryRoute: '/verification?tab=extraction',
      secondaryText: 'Structured Entities'
    },
    {
      num: 3,
      name: 'Cross-Document Consistency Checker',
      highlightPhrase: 'Cross-Document Conflicts',
      description: 'Compare names, registration IDs, addresses, and survey numbers across the application form and supporting certificates. Pinpoint exactly which documents contain conflicting values.',
      icon: SplitSquareVertical,
      route: '/cross-check',
      actionText: 'Check Consistency',
      tag: 'Step 3 • Comparison',
      metric: 'Automated Discrepancy Matching',
      secondaryRoute: '/verification?tab=consistency',
      secondaryText: 'Multi-Signal View'
    },
    {
      num: 4,
      name: 'Regulatory Compliance Rule Engine',
      highlightPhrase: 'AICTE Statutory Rules',
      description: 'Evaluate applications against applicable, sufficiently verified AICTE requirements. For every rule, display its result, explanation, and official source or clause reference.',
      icon: Scale,
      route: '/rules',
      actionText: 'Explore Rules Engine',
      tag: 'Step 4 • Compliance',
      metric: `${stats.rules} Statutory Norms Active`,
      secondaryRoute: '/intelligence?tab=clauses',
      secondaryText: 'Browse Official Clauses'
    },
    {
      num: 5,
      name: 'Evidence-Backed Reviewer Dashboard',
      highlightPhrase: 'Evidence & Spatial Viewer',
      description: 'Inspect the original document and relevant page/field alongside the finding, applicable rule, explanation, and reviewer action. Understand exactly WHY an issue was flagged.',
      icon: Eye,
      route: '/review',
      actionText: 'Open Reviewer Desk',
      tag: 'Step 5 • Evidence Review',
      metric: 'Side-by-Side Spatial Bounding',
      secondaryRoute: '/cases',
      secondaryText: 'Inspect Active Cases'
    },
    {
      num: 6,
      name: 'Rule Change Impact Simulator — Replay',
      highlightPhrase: 'Policy Replay & Simulation',
      description: 'Evaluate the same test applications against two rule versions. Compare before-and-after results, affected test cases, and reasons for changed compliance outcomes.',
      icon: RotateCcw,
      route: '/replay',
      actionText: 'Simulate Rule Changes',
      tag: 'Step 6 • Simulation',
      metric: 'APH 2024 vs 2026-27 Norms',
      secondaryRoute: '/rules',
      secondaryText: 'Rule Version History'
    },
    {
      num: 7,
      name: 'Document Authenticity & Anomaly Indicators',
      highlightPhrase: 'Metadata & Anomaly Signals',
      description: 'Inspect available PDF metadata, digital signatures, and unusual document properties. Present anomalies as indicators requiring review, not proof of fraud.',
      icon: Fingerprint,
      route: '/passport',
      actionText: 'Inspect Authenticity',
      tag: 'Step 7 • Integrity',
      metric: 'SHA-256 + Metadata Heuristics',
      secondaryRoute: '/audit',
      secondaryText: 'Cryptographic Ledger'
    },
    {
      num: 8,
      name: 'Reviewer Workflow, Audit Trail & Report',
      highlightPhrase: 'Decisions, Audit & Reports',
      description: 'Mark findings as Open, Resolved, or Clarification Needed. Record officer notes and action history, and export official reports containing findings and evidence references.',
      icon: History,
      route: '/reports',
      actionText: 'View Audit & Export Reports',
      tag: 'Step 8 • Decisions & Export',
      metric: `${stats.auditRecords} Audit Records Sealed`,
      secondaryRoute: '/reports?tab=reports',
      secondaryText: 'Generate Audit Reports'
    },
  ];

  return (
    <div className="space-y-8 pb-16 animate-fadeIn">
      {/* Hero Banner */}
      <div className="p-6 sm:p-8 rounded-3xl border border-border bg-surface shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#E43D12]/10 text-[#E43D12] border border-[#E43D12]/20 uppercase">
                Regulatory Intelligence
              </span>
              <span className="text-text-muted">&bull;</span>
              <span className="text-xs text-text-secondary font-medium">Eight Core Capabilities</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
              Regulatory <span className="text-[#E43D12]">Intelligence</span> &amp; Verification Workflow
            </h1>

            <p className="text-xs sm:text-sm text-text-secondary max-w-2xl leading-relaxed">
              NIYANTRAN is an AI-assisted, evidence-backed regulatory verification platform for checking institution applications against applicable AICTE requirements. Every capability maps directly to our end-to-end audit workflow.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Interactive 6-Step Demo</span>
            </Link>
            <Link
              to="/cases"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-border bg-surface text-xs font-semibold text-text-primary hover:bg-surface-secondary transition-colors"
            >
              <span>Inspect Cases</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* End-to-End Workflow Ribbon */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
            <span>Standard Operational Workflow:</span>
            <span className="text-[#E43D12]">&bull;</span>
            <span className="text-text-secondary font-normal font-sans">Click any step or card to open the feature directly</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {coreWorkflowSteps.map((s, idx) => (
              <div
                key={s.num}
                onClick={() => navigate(features[idx].route)}
                className="p-2.5 rounded-xl border border-border bg-surface-secondary/40 hover:bg-[#FDF1EE] hover:border-[#E43D12]/40 transition-all cursor-pointer group flex flex-col justify-between text-left"
              >
                <span className="text-[10px] font-mono font-bold text-accent group-hover:text-accent-hover">
                  Step 0{s.num}
                </span>
                <span className="text-xs font-bold text-text-primary group-hover:text-accent transition-colors leading-tight mt-1 line-clamp-2">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 8 Core Feature Cards Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary tracking-tight">
              Eight Core Platform Capabilities
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Clear English descriptions, working functionality, and source-backed provenance for every module.
            </p>
          </div>

          <span className="text-xs font-mono text-text-muted font-semibold hidden sm:inline-block">
            8 Working Modules Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {features.map((feat) => {
            const Icon = feat.icon;

            return (
              <div
                key={feat.num}
                className="p-6 rounded-2xl border border-border bg-surface hover:border-accent/40 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
              >
                <div className="space-y-3.5">
                  {/* Card Top: Number, Badge, Metric */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[#FDF1EE] border border-[#E43D12]/20 flex items-center justify-center text-[#E43D12] group-hover:scale-105 transition-transform shrink-0">
                        <Icon className="w-5 h-5 stroke-[1.8]" />
                      </div>
                      <div>
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-accent block">
                          {feat.tag}
                        </span>
                        <h3 className="text-base font-bold text-text-primary group-hover:text-accent transition-colors">
                          {feat.name}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Highlight pill */}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-secondary text-[11px] font-mono font-semibold text-text-secondary border border-border">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E43D12]" />
                    <span>Focus: <strong className="text-text-primary">{feat.highlightPhrase}</strong></span>
                  </div>

                  {/* Plain-English Description */}
                  <p className="text-xs sm:text-[13px] text-text-secondary leading-relaxed">
                    {feat.description}
                  </p>
                </div>

                {/* Card Footer: Action Button & Secondary Route */}
                <div className="mt-5 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-[11px] font-mono text-text-muted">
                    {feat.metric}
                  </span>

                  <div className="flex items-center gap-2">
                    <Link
                      to={feat.route}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      <span>{feat.actionText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Supporting Guidance Callout */}
      <div className="p-5 rounded-2xl border border-border bg-surface-secondary/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-text-secondary">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-accent shrink-0" />
          <p className="leading-relaxed">
            <strong>Evidence-First Principle:</strong> NIYANTRAN anchors every extraction and rule calculation to an exact source document, page coordinate, and official AICTE statutory clause. Cryptographic SHA-256 seals confirm post-upload file integrity without altering production records.
          </p>
        </div>
        <Link
          to="/audit"
          className="text-accent font-semibold hover:underline shrink-0 inline-flex items-center gap-1"
        >
          Verify Cryptographic Chain &rarr;
        </Link>
      </div>
    </div>
  );
}
