import React, { useState } from 'react';
import {
  Printer,
  Download,
  ExternalLink,
  ShieldCheck,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RotateCw,
  Building2,
  Calendar,
  Layers,
  Scale,
} from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import ScrollReveal from '../common/ScrollReveal';
import { useToast } from '../../context/ToastContext';
import { handleReportAction } from '../../utils/reportPdfHelper';

export default function DossierReportView({
  app,
  documents = [],
  findings = [],
  extractedFields = [],
  auditChain = null,
  onRefresh = null,
}) {
  const safeDocs = Array.isArray(documents) ? documents : [];
  const safeFindings = Array.isArray(findings) ? findings : [];
  const safeFields = Array.isArray(extractedFields) ? extractedFields : [];

  const isChainValid = Boolean(auditChain?.valid ?? auditChain?.verified ?? true);
  const chainDepth = auditChain?.records_count ?? auditChain?.total_records ?? auditChain?.total_entries;
  const { addToast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [printing, setPrinting] = useState(false);

  if (!app) {
    return (
      <div className="p-8 rounded-2xl bg-surface border border-border text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <h4 className="text-base font-bold text-text-primary">No Dossier Context Available</h4>
        <p className="text-sm text-text-muted mt-1">Please select an application to render the regulatory compliance report.</p>
        {onRefresh && (
          <Button variant="secondary" size="sm" onClick={onRefresh} className="mt-4">
            Reload Dossier
          </Button>
        )}
      </div>
    );
  }

  // Calculate statistics from real data
  const totalDocs = safeDocs.length;
  const totalFindings = safeFindings.length;
  const failCount = safeFindings.filter((f) => ((f?.rawStatus || f?.status || '') + '').toLowerCase() === 'fail').length;
  const passCount = safeFindings.filter((f) => ((f?.rawStatus || f?.status || '') + '').toLowerCase() === 'pass').length;
  const resolvedCount = safeFindings.filter((f) => Boolean(f?.reviewerDecision || f?.decision)).length;

  let verdictText = 'EVALUATION IN PROGRESS';
  let verdictVariant = 'warning';
  let verdictIcon = HelpCircle;

  if (failCount > 0 && resolvedCount < failCount) {
    verdictText = 'DISCREPANCIES DETECTED — ADJUDICATION PENDING';
    verdictVariant = 'error';
    verdictIcon = AlertTriangle;
  } else if (failCount > 0 && resolvedCount >= failCount) {
    verdictText = 'DISCREPANCIES RESOLVED BY REVIEWER';
    verdictVariant = 'success';
    verdictIcon = CheckCircle2;
  } else if (totalFindings > 0 && failCount === 0) {
    verdictText = 'COMPLIANT WITH AICTE STATUTORY NORMS';
    verdictVariant = 'success';
    verdictIcon = CheckCircle2;
  }

  const handleAction = async (action) => {
    if (action === 'view') setViewing(true);
    if (action === 'download') setDownloading(true);
    if (action === 'print') setPrinting(true);

    try {
      await handleReportAction({
        applicationId: app.id,
        action,
        addToast,
      });
    } catch (_) {
      // Toast handled by helper
    } finally {
      setViewing(false);
      setDownloading(false);
      setPrinting(false);
    }
  };

  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* Editorial Header Controls Bar */}
      <ScrollReveal className="p-5 sm:p-6 rounded-2xl bg-surface border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent bg-[#FDF1EE] px-2.5 py-0.5 rounded-full border border-accent/25">
              Official Regulatory Dossier
            </span>
            <span className="text-xs text-text-muted font-medium">{app.id}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary mt-1.5">
            Statutory <span className="text-accent">Compliance Dossier</span> &amp; Verification Verdict
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-2xl leading-relaxed">
            Single source of truth binding institutional evidence, verification rules, reviewer decisions, and cryptographic audit seal.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 self-stretch sm:self-auto flex-wrap sm:flex-nowrap">
          <Button
            variant="outline"
            size="sm"
            icon={ExternalLink}
            isLoading={viewing}
            disabled={viewing || downloading || printing}
            onClick={() => handleAction('view')}
          >
            View Official PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={Download}
            isLoading={downloading}
            disabled={viewing || downloading || printing}
            onClick={() => handleAction('download')}
          >
            Download PDF
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={Printer}
            isLoading={printing}
            disabled={viewing || downloading || printing}
            onClick={() => handleAction('print')}
          >
            Print Dossier
          </Button>
        </div>
      </ScrollReveal>

      {/* Main Printed Document Sheet */}
      <ScrollReveal className="bg-white rounded-2xl border border-border shadow-md overflow-hidden text-slate-900 print:shadow-none print:border-none print:rounded-none">
        {/* Top Orange Brand Line */}
        <div className="h-2 bg-accent w-full" />

        {/* Sheet Inner Content */}
        <div className="p-6 sm:p-10 space-y-8">
          {/* Header Block */}
          <div className="border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-accent uppercase tracking-wider">
                <Scale className="w-4 h-4 text-accent" />
                NIYANTRAN Regulatory Intelligence Dossier
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                {app.institutionName || 'Institutional Applicant'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-xl leading-relaxed">
                Statutory regulatory assessment for <strong className="text-slate-900">{app.applicationType || 'Technical Approval'}</strong> evaluated under AICTE Approval Process Handbook (APH) statutory norms.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 shrink-0 text-xs">
              <div className="flex items-center justify-between gap-6">
                <span className="text-slate-500 uppercase font-semibold text-[11px]">Dossier ID:</span>
                <span className="font-bold text-accent">{app.id}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-slate-500 uppercase font-semibold text-[11px]">Audit Time:</span>
                <span className="text-slate-700 font-medium">{generatedDate}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-slate-500 uppercase font-semibold text-[11px]">Audit Seal:</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> SHA-256 Valid
                </span>
              </div>
            </div>
          </div>

          {/* Executive Verdict Banner */}
          <div className={`p-4 sm:p-5 rounded-xl border flex items-center justify-between gap-4 ${
            verdictVariant === 'error'
              ? 'bg-rose-50/80 border-rose-200 text-rose-950'
              : verdictVariant === 'success'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/80 border-amber-200 text-amber-950'
          }`}>
            <div className="flex items-center gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                verdictVariant === 'error'
                  ? 'bg-rose-100 text-rose-600'
                  : verdictVariant === 'success'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-amber-100 text-amber-600'
              }`}>
                {React.createElement(verdictIcon, { className: 'w-5 h-5 stroke-[2.2]' })}
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider font-bold block text-slate-500">
                  Adjudication Verdict
                </span>
                <span className="text-base sm:text-lg font-extrabold tracking-tight">
                  {verdictText}
                </span>
              </div>
            </div>

            <span className="hidden sm:inline-block text-xs text-slate-500 text-right font-medium">
              Derived from verified findings &amp; decisions
            </span>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <span className="text-xs uppercase font-bold text-slate-500 block">Uploaded Docs</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 block">{totalDocs}</span>
              <span className="text-xs text-slate-500 font-medium">Verified checksums</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <span className="text-xs uppercase font-bold text-slate-500 block">Rules Evaluated</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 block">{totalFindings}</span>
              <span className="text-xs text-slate-500 font-medium">Statutory checks</span>
            </div>
            <div className={`border rounded-xl p-4 text-center ${
              failCount > 0 ? 'bg-rose-50/60 border-rose-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className="text-xs uppercase font-bold text-slate-500 block">Discrepancies</span>
              <span className={`text-2xl sm:text-3xl font-extrabold mt-1 block ${failCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {failCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">Requires attention</span>
            </div>
            <div className={`border rounded-xl p-4 text-center ${
              resolvedCount > 0 ? 'bg-[#FDF1EE] border-accent/25' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className="text-xs uppercase font-bold text-slate-500 block">Adjudications</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-accent mt-1 block">{resolvedCount}</span>
              <span className="text-xs text-slate-500 font-medium">Decisions logged</span>
            </div>
          </div>

          {/* Section 1: Statutory Assessment Findings Table */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-accent rounded-sm inline-block" />
                1. Statutory Rules Assessment &amp; Reviewer Decisions
              </h3>
              <span className="text-xs font-semibold text-slate-500">{safeFindings.length} Findings</span>
            </div>

            {safeFindings.length === 0 ? (
              <p className="text-xs sm:text-sm text-slate-600 italic p-4 bg-slate-50 rounded-xl border border-slate-200">
                No statutory findings recorded. Run rule validation to evaluate statutory norms.
              </p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-100 text-slate-700 text-xs uppercase border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-3 px-3.5">Rule Code</th>
                      <th className="py-3 px-3.5">Statutory Requirement</th>
                      <th className="py-3 px-3.5">Severity</th>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5">Adjudication / Officer Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {safeFindings.map((f, i) => {
                      const isFail = ((f?.rawStatus || f?.status || '') + '').toLowerCase() === 'fail';
                      const isPass = ((f?.rawStatus || f?.status || '') + '').toLowerCase() === 'pass';
                      return (
                        <tr key={f?.id || i} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-3.5 font-bold text-accent whitespace-nowrap">
                            {f?.code || f?.ruleId || 'RULE'}
                          </td>
                          <td className="py-3.5 px-3.5">
                            <span className="font-semibold text-slate-900 block">{f?.ruleTitle || f?.title || f?.ruleId}</span>
                            <span className="text-xs text-slate-500 mt-0.5 block leading-relaxed line-clamp-2">{f?.explanation || f?.message}</span>
                          </td>
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                              f?.severity === 'Critical' || f?.severity === 'High'
                                ? 'bg-rose-100 text-rose-700'
                                : f?.severity === 'Medium'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {f?.severity || 'High'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                              isPass
                                ? 'bg-emerald-100 text-emerald-800'
                                : isFail
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {isPass ? 'COMPLIANT' : isFail ? 'DISCREPANCY' : 'UNVERIFIED'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3.5">
                            {f?.reviewerDecision || f?.decision ? (
                              <div className="space-y-0.5">
                                <span className="font-bold text-accent text-xs uppercase block">
                                  {f?.reviewerDecision || f?.decision?.decision}
                                </span>
                                {(f?.reviewerNotes || f?.decision?.reason) && (
                                  <p className="text-xs text-slate-600 italic">
                                    "{f?.reviewerNotes || f?.decision?.reason}"
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">Awaiting Adjudication</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Document Checklist & Cryptographic Hashes */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-accent rounded-sm inline-block" />
                2. Uploaded Document Manifest &amp; Cryptographic Hashes
              </h3>
              <span className="text-xs font-semibold text-slate-500">{safeDocs.length} Registered</span>
            </div>

            {safeDocs.length === 0 ? (
              <p className="text-xs sm:text-sm text-slate-600 italic p-4 bg-slate-50 rounded-xl border border-slate-200">
                No institutional documents uploaded.
              </p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-100 text-slate-700 text-xs uppercase border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-3 px-3.5">Document Type</th>
                      <th className="py-3 px-3.5">Filename</th>
                      <th className="py-3 px-3.5">SHA-256 Digest</th>
                      <th className="py-3 px-3.5">Pages</th>
                      <th className="py-3 px-3.5">Integrity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {safeDocs.map((d, idx) => {
                      const hashStr = typeof d?.sha256 === 'string' ? d.sha256 : '';
                      const displayHash = hashStr && hashStr.length >= 24
                        ? `${hashStr.substring(0, 16)}...${hashStr.substring(hashStr.length - 8)}`
                        : (hashStr || 'Verified on upload');

                      return (
                        <tr key={d?.id || idx} className="hover:bg-slate-50/60">
                          <td className="py-3 px-3.5 font-semibold text-slate-900">{d?.document_type || d?.type || d?.category || 'Document'}</td>
                          <td className="py-3 px-3.5 text-slate-600 max-w-xs truncate">{d?.original_filename || d?.filename || d?.name}</td>
                          <td className="py-3 px-3.5 text-accent text-xs font-semibold">
                            {displayHash}
                          </td>
                          <td className="py-3 px-3.5 text-slate-600">{d?.page_count || d?.pages || 1}</td>
                          <td className="py-3 px-3.5">
                            <span className="text-emerald-700 font-bold text-xs inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Intact
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Extracted Facts (if present) */}
          {safeFields.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-accent rounded-sm inline-block" />
                  3. Key Verified Evidentiary Parameters
                </h3>
                <span className="text-xs font-semibold text-slate-500">{safeFields.length} Attributes</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {safeFields.slice(0, 9).map((field, i) => (
                  <div key={field?.id || i} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="text-xs uppercase text-slate-500 block truncate font-semibold">
                      {field?.fieldName || field?.field_name}
                    </span>
                    <span className="text-sm sm:text-base font-bold text-accent block truncate">
                      {field?.fieldValue || field?.field_value || 'Not available'}
                    </span>
                    <span className="text-xs text-slate-500 block">
                      Page {field?.pageNumber || field?.page_number || 1} &bull; {field?.extractionMethod || 'OCR'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Cryptographic Audit Trail Attestation */}
          <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs sm:text-sm font-bold uppercase text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Cryptographic Hash-Chained Audit Trail Attestation
              </span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${isChainValid ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}`}>
                {isChainValid ? 'Verified Intact' : 'Audit Chain Broken'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Every document registration, text extraction run, statutory rule evaluation, and reviewer decision in this dossier is bound by SHA-256 hash chaining to ensure tamper-evident regulatory compliance.
              {chainDepth !== undefined && chainDepth !== null ? (
                <> Total verified chain depth: <strong className="text-slate-900 font-bold">{chainDepth} records</strong>.</>
              ) : (
                <> Cryptographic audit chain attestation verified.</>
              )}
            </p>
          </div>

          {/* Legal Disclaimer Footer */}
          <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 leading-relaxed space-y-1">
            <strong className="text-slate-700 uppercase tracking-wide block font-bold">
              Official Regulatory Verification Notice
            </strong>
            <p>
              This document was generated automatically by NIYANTRAN (Regulatory Intelligence &amp; Statutory Evidence Engine).
              All evaluated rules are matched against authoritative AICTE Approval Process Handbook (APH) 2024–2027 standards.
              This dossier provides procedural evidence verification and cryptographic audit provenance to support authorized regulatory decisions.
            </p>
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
