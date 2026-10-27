import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Scale,
  BookOpen,
  Eye,
  Check,
  X,
  Printer,
  ChevronRight,
  Info,
  ExternalLink,
  RotateCcw,
  Building2,
  Calendar,
  Layers,
  FileCheck2
} from 'lucide-react';

export default function GuidedDemo({ onExit }) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedClause, setExpandedClause] = useState(null);

  const totalSteps = 6;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleExit = () => {
    if (onExit) {
      onExit();
    } else {
      navigate('/dashboard');
    }
  };

  const stepsMeta = [
    { num: 1, title: 'Application Received', short: 'Overview' },
    { num: 2, title: 'Documents Checked', short: 'Documents' },
    { num: 3, title: 'Information Extracted', short: 'Extraction' },
    { num: 4, title: 'Rules Verified', short: 'Rules' },
    { num: 5, title: 'Findings Explained', short: 'Findings' },
    { num: 6, title: 'Final Result', short: 'Summary' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-fadeIn select-none">
      
      {/* Top Banner: DEMO - SAMPLE DATA */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-md bg-amber-500 text-white font-bold font-mono text-[11px] uppercase tracking-wider">
            DEMO — SAMPLE DATA
          </span>
          <p className="text-amber-900 dark:text-amber-200 font-medium">
            Illustrative sample application demonstrating automated AICTE source-backed verification. No production records are modified.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-surface text-text-primary hover:bg-amber-500/10 font-semibold transition-colors cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5 text-text-muted" />
          <span>Exit Demo & Return</span>
        </button>
      </div>

      {/* Main Step Navigation Ribbon */}
      <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-accent font-bold">
              Step {currentStep} of {totalSteps}
            </div>
            <h1 className="text-xl font-bold text-text-primary mt-0.5">
              {stepsMeta[currentStep - 1].title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-border transition-colors ${
                currentStep === 1
                  ? 'opacity-40 cursor-not-allowed text-text-muted'
                  : 'bg-surface hover:bg-surface-elevated text-text-primary cursor-pointer'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentStep === totalSteps}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentStep === totalSteps
                  ? 'opacity-40 cursor-not-allowed bg-border text-text-muted'
                  : 'bg-accent hover:bg-accent-hover text-accent-foreground cursor-pointer shadow-sm'
              }`}
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="grid grid-cols-6 gap-2 pt-3">
          {stepsMeta.map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setCurrentStep(s.num)}
              className="text-left group cursor-pointer"
            >
              <div
                className={`h-1.5 rounded-full transition-all ${
                  s.num < currentStep
                    ? 'bg-emerald-500'
                    : s.num === currentStep
                    ? 'bg-accent ring-2 ring-accent/30'
                    : 'bg-border'
                }`}
              />
              <div className="mt-1.5 hidden md:block">
                <span
                  className={`text-[11px] font-medium truncate block ${
                    s.num === currentStep
                      ? 'text-accent font-bold'
                      : s.num < currentStep
                      ? 'text-text-primary'
                      : 'text-text-muted'
                  }`}
                >
                  {s.num}. {s.short}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* STEP 1: Application Received                              */}
      {/* ========================================================= */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-mono font-bold text-accent px-2 py-0.5 rounded bg-accent/10">
                  CASE OVERVIEW
                </span>
                <h2 className="text-lg font-bold text-text-primary pt-1">
                  Aryabhatta Institute of Technology & Management
                </h2>
                <p className="text-xs text-text-secondary">
                  Application Reference: <span className="font-mono font-semibold">DEMO-2026-AICTE-001</span> &bull; Submitted on 24 October 2026
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                Under Regulatory Review
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-elevated border border-border text-xs text-text-secondary leading-relaxed">
              <strong className="text-text-primary font-semibold block mb-1">What is this case?</strong>
              The institution is applying for an <strong>Extension of Approval (EoA) and Intake Expansion</strong> under AICTE Approval Process Handbook (APH 2024-2027) norms. They propose expanding B.Tech Computer Engineering seats from 240 to 360 students.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3.5 rounded-xl border border-border bg-surface text-xs space-y-1">
                <span className="text-text-muted text-[11px]">Approval Category</span>
                <div className="font-semibold text-text-primary">Technical Approval (EoA)</div>
                <div className="text-[11px] text-text-secondary">Degree Engineering</div>
              </div>
              <div className="p-3.5 rounded-xl border border-border bg-surface text-xs space-y-1">
                <span className="text-text-muted text-[11px]">Proposed Intake</span>
                <div className="font-semibold text-text-primary font-mono text-sm">360 Seats</div>
                <div className="text-[11px] text-text-secondary">Expanded from 240</div>
              </div>
              <div className="p-3.5 rounded-xl border border-border bg-surface text-xs space-y-1">
                <span className="text-text-muted text-[11px]">Jurisdiction</span>
                <div className="font-semibold text-text-primary">Northern Regional Office</div>
                <div className="text-[11px] text-text-secondary">Urban Municipal Zone</div>
              </div>
            </div>
          </div>

          {/* Simple Explanation of What Happens Next */}
          <div className="p-4 rounded-2xl border border-border bg-gradient-to-r from-accent/5 via-surface to-accent/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent text-accent-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="text-xs font-bold text-text-primary">Why automated verification is needed</h3>
                <p className="text-[11px] text-text-secondary">
                  Manual checks take days to cross-reference land deeds, NOCs, and faculty rolls. NIYANTRAN scans documents in seconds.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent-hover transition-colors shadow-sm cursor-pointer shrink-0"
            >
              <span>See Documents Checked</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 2: Documents Checked                                 */}
      {/* ========================================================= */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div>
              <span className="text-[11px] font-mono font-bold text-accent px-2 py-0.5 rounded bg-accent/10">
                DOCUMENT CHECKLIST &amp; AUTHENTICITY
              </span>
              <h2 className="text-lg font-bold text-text-primary mt-1">
                5 Mandatory Regulatory Documents Evaluated
              </h2>
              <p className="text-xs text-text-secondary">
                Each document is sealed with a SHA-256 cryptographic checksum and checked for text integrity and tampering.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              {[
                {
                  name: 'AICTE Application Form 2025-26',
                  type: 'Official Filing',
                  pages: 12,
                  hash: '8f3a92...b41c',
                  status: 'Verified',
                  statusColor: 'emerald',
                  explanation: 'Official digital form with institutional seal; all text layers readable.',
                },
                {
                  name: 'Registered Land Title Deed (Plot 42/A)',
                  type: 'Land Provenance',
                  pages: 18,
                  hash: '1d7e48...99a1',
                  status: 'Verified',
                  statusColor: 'emerald',
                  explanation: 'Registered sub-registrar deed; confirms 3.20 contiguous acres.',
                },
                {
                  name: 'Fire and Life Safety NOC (DFS Clearance)',
                  type: 'Statutory Safety',
                  pages: 2,
                  hash: 'e52a77...310f',
                  status: 'Issue Detected',
                  statusColor: 'rose',
                  explanation: 'Authentic certificate, but the validity expired on 31 March 2024.',
                },
                {
                  name: 'Architect Built-Up Area Completion Certificate',
                  type: 'Infrastructure',
                  pages: 8,
                  hash: '39af82...6d5e',
                  status: 'Verified',
                  statusColor: 'emerald',
                  explanation: 'Certified by Council of Architecture registered architect.',
                },
                {
                  name: 'Faculty & Cadre Roster (AY 2025-26)',
                  type: 'Academic Staff',
                  pages: 6,
                  hash: '4b119c...28e7',
                  status: 'Verified',
                  statusColor: 'emerald',
                  explanation: 'Lists 18 full-time teachers with appointment orders.',
                },
              ].map((doc, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-border bg-surface-elevated flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-text-primary flex items-center gap-2">
                        <span className="truncate">{doc.name}</span>
                        <span className="font-mono text-[10px] text-text-muted">({doc.pages} pgs)</span>
                      </div>
                      <div className="text-[11px] text-text-secondary mt-0.5">
                        {doc.explanation}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-text-muted hidden md:inline">
                      SHA: {doc.hash}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 ${
                        doc.statusColor === 'emerald'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {doc.statusColor === 'emerald' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      <span>{doc.status}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-surface flex items-center justify-between gap-4">
            <p className="text-xs text-text-secondary">
              Notice: The system immediately flags the expired Fire NOC before rules are even evaluated.
            </p>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent-hover transition-colors shadow-sm cursor-pointer shrink-0"
            >
              <span>Inspect Extracted Information</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 3: Information Extracted                             */}
      {/* ========================================================= */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div>
              <span className="text-[11px] font-mono font-bold text-accent px-2 py-0.5 rounded bg-accent/10">
                AI INFORMATION EXTRACTION
              </span>
              <h2 className="text-lg font-bold text-text-primary mt-1">
                Data Points Extracted &amp; Cross-Referenced
              </h2>
              <p className="text-xs text-text-secondary">
                Numbers and dates are parsed from PDFs and converted to standard units (acres, square meters, dates).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {[
                {
                  label: 'Institution Name',
                  extracted: 'Aryabhatta Institute of Technology & Management',
                  source: 'AICTE Form Pg 1 & Land Deed Pg 1',
                  confidence: 100,
                  consistency: 'Matches across all 5 documents',
                  consistent: true,
                },
                {
                  label: 'Contiguous Land Area',
                  extracted: '3.20 Acres (12,949 sq.m)',
                  source: 'Land Deed Pg 4, Clause 3',
                  confidence: 98.4,
                  consistency: 'Single survey plot #42/A',
                  consistent: true,
                },
                {
                  label: 'Proposed Intake Capacity',
                  extracted: '360 Students (Degree)',
                  source: 'AICTE Form Pg 2, Table 4.1',
                  confidence: 100,
                  consistency: 'Matches affiliation application',
                  consistent: true,
                },
                {
                  label: 'Total Instructional Built-Up Area',
                  extracted: '11,400 sq. meters',
                  source: 'Architect Certificate Pg 3',
                  confidence: 97.8,
                  consistency: 'Verified by physical drawing',
                  consistent: true,
                },
                {
                  label: 'Full-Time Teaching Faculty',
                  extracted: '18 Faculty Members',
                  source: 'Faculty Cadre Roster Pg 2',
                  confidence: 96.2,
                  consistency: 'Ratio deficit for 360 intake',
                  consistent: false,
                },
                {
                  label: 'Fire NOC Expiry Date',
                  extracted: '31-03-2024 (Expired)',
                  source: 'Fire NOC Certificate Pg 1',
                  confidence: 99.1,
                  consistency: 'Expired 18 months prior',
                  consistent: false,
                },
              ].map((field, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-border bg-surface-elevated space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text-muted text-[11px]">{field.label}</span>
                    <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      {field.confidence}% Confidence
                    </span>
                  </div>
                  <div className="text-sm font-bold text-text-primary font-mono">
                    {field.extracted}
                  </div>
                  <div className="pt-1 border-t border-border/60 flex items-center justify-between text-[11px]">
                    <span className="text-text-secondary truncate">From: {field.source}</span>
                    <span
                      className={`font-semibold ${
                        field.consistent ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                      }`}
                    >
                      {field.consistent ? '✓ Validated' : '⚠ Discrepancy'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-surface flex items-center justify-between gap-4">
            <p className="text-xs text-text-secondary">
              Next, NIYANTRAN feeds these extracted figures directly into the AICTE statutory rulebook.
            </p>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent-hover transition-colors shadow-sm cursor-pointer shrink-0"
            >
              <span>See Rules Verified</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 4: Rules Verified                                    */}
      {/* ========================================================= */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div>
              <span className="text-[11px] font-mono font-bold text-accent px-2 py-0.5 rounded bg-accent/10">
                OFFICIAL SOURCE-BACKED RULE VERIFICATION
              </span>
              <h2 className="text-lg font-bold text-text-primary mt-1">
                Evaluation Against AICTE Process Handbook 2024-2027
              </h2>
              <p className="text-xs text-text-secondary">
                Every calculation is anchored to a genuine clause from official gazettes and statutory regulations.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                {
                  id: 'RULE-LAND-01',
                  name: 'Minimum Contiguous Land Area for Technical Institution',
                  standard: 'Requires min 2.50 Acres in Urban Municipal zone.',
                  actual: '3.20 Acres provided on single plot.',
                  status: 'Passed',
                  sourceTitle: 'AICTE Approval Process Handbook (APH) 2024-2027',
                  clauseNumber: 'Clause 2.1 (Chapter II)',
                  clauseId: 'KB-CF2A2F4CBC66',
                  verbatim: 'Land area required for the establishment of Technical Campus in Mega and Urban Cities shall be a minimum of 2.5 Acres contiguous.',
                },
                {
                  id: 'RULE-LAND-02',
                  name: 'Land Contiguity & Non-Bifurcation Requirement',
                  standard: 'Plot must be contiguous with no public highway or railway bisecting.',
                  actual: 'Single continuous boundary verified via survey plan.',
                  status: 'Passed',
                  sourceTitle: 'AICTE Approval Process Handbook (APH) 2024-2027',
                  clauseNumber: 'Clause 2.2 (Chapter II)',
                  clauseId: 'KB-701991D46C21',
                  verbatim: 'The land must be contiguous without any split or separation by public road, canal or railway track.',
                },
                {
                  id: 'RULE-INFRA-01',
                  name: 'Instructional & Administrative Built-Up Space',
                  standard: 'Requires 10,800 sq.m built-up area for 360 total engineering intake.',
                  actual: '11,400 sq.m provided (Exceeds norm by +600 sq.m).',
                  status: 'Passed',
                  sourceTitle: 'AICTE Approval Process Handbook (APH) 2024-2027',
                  clauseNumber: 'Clause 2.4 (Chapter III)',
                  clauseId: 'KB-CB71F9E337F5',
                  verbatim: 'Built-up area calculations shall follow Appendix 4 specifications based on total approved intake capacity.',
                },
                {
                  id: 'RULE-FSR-01',
                  name: 'Faculty to Student Ratio (1:20 for Degree Engineering)',
                  standard: 'Requires min 24 faculty members for 360 intake (1:20 ratio).',
                  actual: 'Only 18 faculty members listed on staff roster (Deficit: 6 faculty).',
                  status: 'Flagged',
                  sourceTitle: 'AICTE Approval Process Handbook (APH) 2024-2027',
                  clauseNumber: 'Clause 3.2 (Chapter IV)',
                  clauseId: 'KB-222850EB03B8',
                  verbatim: 'Faculty Cadre Ratio shall be 1:20 for Under Graduate Engineering programs with Professor to Associate Professor to Assistant Professor ratio of 1:2:6.',
                },
                {
                  id: 'RULE-SAFE-01',
                  name: 'Mandatory Fire and Life Safety NOC Compliance',
                  standard: 'Must hold a valid, non-expired Fire Safety Clearance Certificate.',
                  actual: 'Submitted certificate expired on 31 March 2024.',
                  status: 'Flagged',
                  sourceTitle: 'AICTE Approval Process Handbook (APH) 2024-2027',
                  clauseNumber: 'Clause 5.2 (Chapter V)',
                  clauseId: 'KB-BDF3B3D29AFC',
                  verbatim: 'Fire and Life Safety Certificate issued by the competent State Fire Service Authority must be valid and uploaded as a mandatory prerequisite.',
                },
              ].map((rule) => (
                <div
                  key={rule.id}
                  className="p-4 rounded-xl border border-border bg-surface-elevated space-y-2.5 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-accent">
                        {rule.id}
                      </span>
                      <span className="font-semibold text-text-primary text-sm">
                        {rule.name}
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 self-start sm:self-auto ${
                        rule.status === 'Passed'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {rule.status === 'Passed' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      <span>{rule.status}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-surface border border-border">
                      <span className="text-text-muted block text-[10px]">Official Norm:</span>
                      <span className="text-text-secondary">{rule.standard}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-surface border border-border">
                      <span className="text-text-muted block text-[10px]">Case Evidence:</span>
                      <span className="font-semibold text-text-primary">{rule.actual}</span>
                    </div>
                  </div>

                  {/* Official Source Link & Citation */}
                  <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-text-secondary">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <BookOpen className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span className="font-medium text-text-primary">{rule.sourceTitle}</span>
                      <span className="text-text-muted">&bull;</span>
                      <span className="font-mono text-accent font-semibold">{rule.clauseNumber}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedClause(expandedClause === rule.id ? null : rule.id)}
                      className="text-accent hover:underline font-semibold cursor-pointer shrink-0 text-left"
                    >
                      {expandedClause === rule.id ? 'Hide Legal Text' : 'View Official Verbatim Text'}
                    </button>
                  </div>

                  {expandedClause === rule.id && (
                    <div className="p-3 rounded-lg bg-surface border border-accent/30 text-[11px] font-mono text-text-secondary leading-relaxed animate-fadeIn">
                      <div className="text-[10px] uppercase font-bold text-accent mb-1">
                        Verbatim Clause ({rule.clauseId}):
                      </div>
                      "{rule.verbatim}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-surface flex items-center justify-between gap-4">
            <p className="text-xs text-text-secondary">
              Notice: 3 rules satisfied, but 2 statutory issues require officer action before approval.
            </p>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent-hover transition-colors shadow-sm cursor-pointer shrink-0"
            >
              <span>See Findings Explained</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 5: Findings Explained                                */}
      {/* ========================================================= */}
      {currentStep === 5 && (
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div>
              <span className="text-[11px] font-mono font-bold text-rose-500 px-2 py-0.5 rounded bg-rose-500/10">
                ACTIONABLE ISSUES DIAGNOSIS
              </span>
              <h2 className="text-lg font-bold text-text-primary mt-1">
                2 Statutory Discrepancies Explained in Plain English
              </h2>
              <p className="text-xs text-text-secondary">
                Instead of cryptic error codes, NIYANTRAN tells the review officer exactly what is wrong, why it matters, and the recommended next step.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {/* Finding 1 */}
              <div className="p-5 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-500/5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span className="font-bold text-rose-700 dark:text-rose-400 text-sm">
                      Issue 1: Expired Fire &amp; Life Safety NOC
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono font-bold text-[10px] uppercase">
                    Critical Safety Defect
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
                    <span className="text-text-muted font-bold text-[10px] uppercase">What Was Found</span>
                    <p className="text-text-primary leading-snug">
                      The Fire Safety Clearance Certificate provided lists validity ending on <strong>31 March 2024</strong>.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
                    <span className="text-text-muted font-bold text-[10px] uppercase">Why It Matters</span>
                    <p className="text-text-secondary leading-snug">
                      AICTE Chapter V Clause 5.2 and National Building Code 2016 Part 4 forbid students on premises without an active NOC.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
                    <span className="text-accent font-bold text-[10px] uppercase">Recommended Action</span>
                    <p className="text-text-primary font-semibold leading-snug">
                      Issue a 15-day compliance notice requesting an updated NOC from the State Fire Authority.
                    </p>
                  </div>
                </div>
              </div>

              {/* Finding 2 */}
              <div className="p-5 rounded-xl border border-amber-300 bg-amber-500/5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-amber-800 text-sm">
                      Issue 2: Faculty Roster Shortfall for Proposed 360 Intake
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-600 text-white font-mono font-bold text-[10px] uppercase">
                    Academic Cadre Gap
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
                    <span className="text-text-muted font-bold text-[10px] uppercase">What Was Found</span>
                    <p className="text-text-primary leading-snug">
                      The institution lists <strong>18 full-time faculty</strong>, but the 1:20 cadre ratio requires <strong>24 faculty</strong> for 360 intake.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
                    <span className="text-text-muted font-bold text-[10px] uppercase">Why It Matters</span>
                    <p className="text-text-secondary leading-snug">
                      AICTE Chapter IV Clause 3.2 mandates 1:20 teaching ratio. Operating with 18 faculty causes a deficit of 6 teachers.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
                    <span className="text-accent font-bold text-[10px] uppercase">Recommended Action</span>
                    <p className="text-text-primary font-semibold leading-snug">
                      Grant Conditional Approval subject to appointing 6 faculty before the academic term starts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-surface flex items-center justify-between gap-4">
            <p className="text-xs text-text-secondary">
              The officer now has crystal-clear guidance to render a fair, evidence-backed decision.
            </p>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent-hover transition-colors shadow-sm cursor-pointer shrink-0"
            >
              <span>See Final Summary &amp; Dossier</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 6: Final Result & Summary                            */}
      {/* ========================================================= */}
      {currentStep === 6 && (
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
              <div>
                <span className="text-[11px] font-mono font-bold text-accent px-2 py-0.5 rounded bg-accent/10">
                  VERIFIED STATUTORY DOSSIER
                </span>
                <h2 className="text-xl font-bold text-text-primary mt-1">
                  Complete Verification Summary &amp; Decision
                </h2>
                <p className="text-xs text-text-secondary">
                  Case DEMO-2026-AICTE-001 &bull; Ready for Regional Officer Signature
                </p>
              </div>

              <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-bold inline-flex items-center gap-1.5 self-start sm:self-auto">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Conditional Approval Recommended</span>
              </span>
            </div>

            {/* Scorecard Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-surface-elevated border border-border">
                <span className="text-[11px] text-text-muted block">Documents Checked</span>
                <span className="text-xl font-bold text-text-primary font-mono mt-0.5 block">5 / 5</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">All Hashes Sealed</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-elevated border border-border">
                <span className="text-[11px] text-text-muted block">Rules Satisfied</span>
                <span className="text-xl font-bold text-emerald-600 font-mono mt-0.5 block">3 of 5</span>
                <span className="text-[10px] text-text-secondary font-medium">Land &amp; Area Norms OK</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-elevated border border-border">
                <span className="text-[11px] text-text-muted block">Actionable Issues</span>
                <span className="text-xl font-bold text-rose-500 font-mono mt-0.5 block">2 Flagged</span>
                <span className="text-[10px] text-text-secondary font-medium">Fire NOC &amp; Faculty Ratio</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-elevated border border-border">
                <span className="text-[11px] text-text-muted block">Verification Chain</span>
                <span className="text-xl font-bold text-accent font-mono mt-0.5 block">100%</span>
                <span className="text-[10px] text-text-secondary font-medium">Tamper-Evident Receipt</span>
              </div>
            </div>

            {/* Final Officer Decision Matrix */}
            <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-2 text-xs">
              <h3 className="font-bold text-text-primary text-xs uppercase tracking-wider font-mono">
                Statutory Decision Matrix
              </h3>
              <div className="space-y-1.5 text-text-secondary leading-relaxed">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Land &amp; Built-up Infrastructure Approved:</strong> 3.20 acres exceeds 2.50 acres threshold. 11,400 sq.m exceeds 10,800 sq.m norm.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Condition 1 (Safety):</strong> Final Extension of Approval order withheld until certified Fire NOC renewal is submitted.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Condition 2 (Faculty):</strong> Intake of 360 sanctioned subject to university affiliation inspection verifying 6 appointed faculty.
                  </span>
                </div>
              </div>
            </div>

            {/* Cryptographic Manifest Receipt */}
            <div className="p-4 rounded-xl bg-neutral-900 text-neutral-100 font-mono text-[11px] space-y-1.5 border border-neutral-700">
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800 text-[10px] text-neutral-400 uppercase tracking-wider">
                <span>Tamper-Evident Evidence Passport</span>
                <span>SHA-256 Validated</span>
              </div>
              <div className="text-emerald-400">
                ROOT_HASH: 7a82b9e6f30419d8542c16eb22d4f901a5b83910c2834011ef920a7b53982e01
              </div>
              <div className="text-neutral-400 text-[10px]">
                BINDING: DEMO-2026-AICTE-001 &bull; 5 Documents &bull; 5 Rules &bull; 2 Findings &bull; AICTE APH 2024-27
              </div>
            </div>

            {/* Exit CTA Controls */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-surface text-text-secondary hover:text-text-primary text-xs font-semibold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart Guided Demo</span>
              </button>

              <button
                type="button"
                onClick={handleExit}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-accent-foreground text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <span>Explore Live Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
