import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Search,
  Check,
  X,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { validationService } from '../services/validationService';
import { reviewService } from '../services/reviewService';
import { applicationService } from '../services/applicationService';
import { useToast } from '../context/ToastContext';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import ErrorState from '../components/common/ErrorState';
import ConfirmModal from '../components/common/ConfirmModal';

export default function EvidenceExplorer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [activeAppId, setActiveAppId] = useState(id || '');
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState(null);
  const [findings, setFindings] = useState([]);
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [mobileTab, setMobileTab] = useState('evidence'); // 'findings' | 'evidence' | 'explanation'
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open: false, action: null });
  const [zoomLevel, setZoomLevel] = useState(100);

  const loadData = async () => {
    try {
      setLoading(true);
      let targetId = activeAppId;
      if (!targetId) {
        const appsRes = await applicationService.getApplications();
        const appList = appsRes.data || [];
        if (appList.length > 0) {
          targetId = appList[0].id;
          setActiveAppId(targetId);
        } else {
          setLoading(false);
          return;
        }
      }
      const appRes = await applicationService.getApplicationById(targetId);
      setApp(appRes.data);

      const findingsRes = await validationService.getFindings(targetId);
      const list = findingsRes.data || [];
      setFindings(list);

      // Default to finding with discrepancies
      const target = list.find((f) => f.rawStatus === 'fail' || f.severity === 'High') || list[0] || null;
      setSelectedFinding(target);
      if (target) {
        setReviewerNotes(target.reviewerNotes || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeAppId]);

  const handleSelectFinding = (finding) => {
    setSelectedFinding(finding);
    setReviewerNotes(finding.reviewerNotes || '');
    setMobileTab('evidence');
  };

  const handleReviewAction = async (action) => {
    if (!selectedFinding) return;
    try {
      setSubmittingAction(true);
      await reviewService.submitReview(selectedFinding.id, {
        action,
        reviewerNotes,
      });

      addToast({
        title: 'Review Decision Saved',
        message: `Marked finding ${selectedFinding.id} as "${action}".`,
        type: 'success',
      });

      setConfirmModal({ open: false, action: null });
      loadData();
    } catch (err) {
      addToast({
        title: 'Action Failed',
        message: err.message || 'Could not record review action',
        type: 'error',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[600px]">
          <Skeleton className="lg:col-span-3 h-full" />
          <Skeleton className="lg:col-span-6 h-full" />
          <Skeleton className="lg:col-span-3 h-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Link
            to={`/applications/${activeAppId}`}
            className="p-1.5 rounded-lg border border-border bg-surface text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20 font-semibold">
                Forensic Evidence Workbench
              </span>
              <span className="font-mono text-xs text-text-muted">{activeAppId}</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary mt-0.5">
              Evidence Explorer — {app?.institutionName || 'Investigation Desk'}
            </h1>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="flex lg:hidden bg-surface-elevated p-1 rounded-lg border border-border text-xs">
          <button
            onClick={() => setMobileTab('findings')}
            className={`px-3 py-1 rounded font-medium ${mobileTab === 'findings' ? 'bg-accent text-accent-foreground font-bold' : 'text-text-muted'}`}
          >
            Findings ({findings.length})
          </button>
          <button
            onClick={() => setMobileTab('evidence')}
            className={`px-3 py-1 rounded font-medium ${mobileTab === 'evidence' ? 'bg-accent text-accent-foreground font-bold' : 'text-text-muted'}`}
          >
            Evidence Viewer
          </button>
          <button
            onClick={() => setMobileTab('explanation')}
            className={`px-3 py-1 rounded font-medium ${mobileTab === 'explanation' ? 'bg-accent text-accent-foreground font-bold' : 'text-text-muted'}`}
          >
            Adjudication
          </button>
        </div>
      </div>

      {/* Main 3-Panel Desktop Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-h-[640px]">
        {/* PANEL 1: Findings Navigator (3 Cols) */}
        <div
          className={`lg:col-span-3 bg-surface rounded-2xl border border-border flex flex-col shadow-surface overflow-hidden ${
            mobileTab === 'findings' ? 'block' : 'hidden lg:flex'
          }`}
        >
          <div className="p-3.5 border-b border-border bg-background/50 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-primary font-mono">
              Findings ({findings.length})
            </span>
            <span className="text-[10px] text-text-muted font-mono">All Severe Items</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/40 p-1.5 space-y-1">
            {findings.map((f) => {
              const isSelected = selectedFinding?.id === f.id;

              return (
                <div
                  key={f.id}
                  onClick={() => handleSelectFinding(f)}
                  className={`p-3 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-surface-elevated border border-accent/40 shadow-subtle'
                      : 'hover:bg-surface-elevated/40 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-accent">{f.id}</span>
                    <Badge variant={f.severity === 'High' ? 'warning' : 'error'} size="sm">
                      {f.severity}
                    </Badge>
                  </div>
                  <div className="text-xs font-semibold text-text-primary mt-1 leading-snug">
                    {f.title}
                  </div>
                  <div className="text-[10px] text-text-muted font-mono mt-1 truncate">
                    Rule: {f.ruleId}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
                    <span className="mt-2 font-medium" style={{ color: 'var(--status-warning)' }}>{f.status}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL 2: Document Evidence Viewer & Side-by-Side Comparison (6 Cols) */}
        <div
          className={`lg:col-span-6 bg-surface rounded-2xl border border-border flex flex-col shadow-surface overflow-hidden ${
            mobileTab === 'evidence' ? 'block' : 'hidden lg:flex'
          }`}
        >
          {/* Viewer Toolbar */}
          <div className="p-3 border-b border-border bg-background/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              <span className="font-semibold text-text-primary font-mono text-xs">
                {selectedFinding?.evidenceSources?.[0]?.documentName || 'Document_Viewer.pdf'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-text-muted">
              <button
                onClick={() => setZoomLevel((z) => Math.max(75, z - 15))}
                className="p-1 rounded hover:text-text-primary hover:bg-surface-elevated"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] px-1">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(150, z + 15))}
                className="p-1 rounded hover:text-text-primary hover:bg-surface-elevated"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Document Canvas with Highlighted Bounding Box */}
          <div className="flex-1 bg-background p-4 overflow-auto flex flex-col items-center justify-center relative select-none">
            {selectedFinding ? (
              <div
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                className="w-full max-w-lg bg-surface-elevated border border-border rounded-xl p-6 shadow-2xl relative transition-transform duration-100 font-mono text-xs text-text-secondary space-y-4"
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-3 text-[11px] text-text-muted">
                  <span>AICTE TECHNICAL EDUCATION STATUTORY FORM</span>
                  <span>PAGE 1 OF 14</span>
                </div>

                <div className="space-y-3 pt-2 text-[11px]">
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-text-muted">APPLICANT INSTITUTION:</span>
                    <span className="text-text-primary font-bold">{app?.institutionName}</span>
                  </div>

                  {/* HIGHLIGHTED BOUNDING BOX FOR FORM INST-1042 */}
                  <div className="relative p-2.5 rounded-lg border-2 border-rose-500/80 bg-rose-950/20 shadow-glow-primary">
                    <div className="absolute -top-2.5 right-2 px-1.5 py-0.2 bg-rose-600 text-white text-[9px] font-bold rounded uppercase">
                      Detected Discrepancy Box (x: 140, y: 195)
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-text-secondary font-semibold">INSTITUTION CODE:</span>
                      <span className="font-bold text-rose-400 text-sm font-mono tracking-wider">
                        INST-1042
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-text-muted">ACADEMIC SESSION:</span>
                    <span className="text-text-primary">2026-2027</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-text-muted">SANCTIONED INTAKE:</span>
                    <span className="text-text-primary">{app?.intakeCapacity ? `${app.intakeCapacity} SEATS` : "STANDARD INTAKE"}</span>
                  </div>
                </div>

                <div className="text-[10px] text-text-muted pt-4 border-t border-border/40 text-center font-sans">
                  ReguTrace Spatial OCR Coordinate Locator &bull; Resolution: 300 DPI
                </div>
              </div>
            ) : (
              <div className="text-text-muted text-xs">Select a finding from the left panel</div>
            )}
          </div>

          {/* Cross-Document Corroboration Comparison Cards */}
          {selectedFinding && selectedFinding.evidenceSources?.length > 1 && (
            <div className="p-3 bg-surface-elevated/40 border-t border-border grid grid-cols-2 gap-3 text-xs">
              <div className="bg-surface p-2.5 rounded-xl border border-border">
                <span className="text-[10px] font-mono text-text-muted uppercase block">
                  Source 1: {selectedFinding.evidenceSources[0].documentType}
                </span>
                  <div className="text-xs font-bold font-mono text-sm mt-0.5" style={{ color: 'var(--status-error)' }}>
                    {selectedFinding.evidenceSources[0].extractedValue}
                  </div>
                <div className="text-[10px] text-text-muted mt-0.5 truncate">
                  {selectedFinding.evidenceSources[0].documentName} (Pg {selectedFinding.evidenceSources[0].pageNumber})
                </div>
              </div>

              <div className="bg-surface p-2.5 rounded-xl border border-border">
                <span className="text-[10px] font-mono text-text-muted uppercase block">
                  Source 2: {selectedFinding.evidenceSources[1].documentType}
                </span>
                <div className="font-bold font-mono text-sm mt-0.5" style={{ color: 'var(--status-warning)' }}>
                  {selectedFinding.evidenceSources[1].extractedValue}
                </div>
                <div className="text-[10px] text-text-muted mt-0.5 truncate">
                  {selectedFinding.evidenceSources[1].documentName} (Pg {selectedFinding.evidenceSources[1].pageNumber})
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PANEL 3: Explanation & Adjudication Inspector (3 Cols) */}
        <div
          className={`lg:col-span-3 bg-surface rounded-2xl border border-border flex flex-col justify-between shadow-surface overflow-hidden ${
            mobileTab === 'explanation' ? 'block' : 'hidden lg:flex'
          }`}
        >
        <div className="p-4 space-y-4 overflow-y-auto">
            <div className="border-b border-border pb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-semibold block">
                Regulatory Diagnosis
              </span>
              <h3 className="text-sm font-bold text-text-primary mt-1">
                {selectedFinding?.title}
              </h3>
            </div>

            {/* Explanation Prose */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase text-text-muted block">
                Detection Explanation
              </span>
              <p className="text-xs text-text-secondary leading-relaxed bg-surface-elevated/40 p-3 rounded-xl border border-border">
                {selectedFinding?.explanation}
              </p>
            </div>

            {/* Applicable Rule Reference */}
            <div className="p-3 rounded-xl bg-background border border-border space-y-1 text-xs font-mono">
              <span className="text-[10px] text-accent block">Applied Rule Reference</span>
              <div className="font-bold text-text-primary">{selectedFinding?.ruleId}</div>
              <div className="text-[11px] text-text-muted">{selectedFinding?.ruleName}</div>
              <div className="text-[10px] text-text-secondary pt-1">Threshold: Exact Cross-Doc String Match</div>
            </div>

            {/* Evidence Extraction Details */}
            {selectedFinding?.evidenceSources && selectedFinding.evidenceSources.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase text-text-muted block">
                  Extraction Details
                </span>
                <div className="p-2 rounded-lg bg-[var(--status-warning)]/5 border border-[var(--status-warning)]/20">
                  <p className="text-[10px] text-text-muted italic">
                    Evidence previews show simulated OCR coordinates. Not actual OCR output.
                  </p>
                </div>
                {selectedFinding.evidenceSources.map((src, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-surface-elevated/50 border border-border text-[11px] space-y-1.5">
                    <div className="font-mono font-semibold text-accent text-[10px]">Source {idx + 1}: {src.documentType}</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-text-muted">
                      <span>Document:</span>
                      <span className="text-text-secondary font-mono truncate">{src.documentName}</span>
                      <span>Page:</span>
                      <span className="text-text-secondary font-mono">{src.pageNumber}</span>
                      {src.coordinates && (
                        <>
                          <span>Bounding Box:</span>
                          <span className="text-text-secondary font-mono text-[9px]">
                            x:{src.coordinates.x} y:{src.coordinates.y} w:{src.coordinates.width} h:{src.coordinates.height}
                            <span className="text-text-muted ml-1">(Simulated Coordinates)</span>
                          </span>
                        </>
                      )}
                      <span>Extracted Value:</span>
                      <span className="font-bold text-accent">{src.extractedValue}</span>
                    </div>
                  </div>
                ))}
                <div className="p-2.5 rounded-lg bg-surface-elevated/50 border border-border text-[11px] space-y-1 font-mono">
                  <div className="text-[10px] font-semibold text-text-muted uppercase">Statutory & Evidence Provenance</div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-text-muted">Rule Key:</span>
                    <span className="text-accent font-bold">{selectedFinding.rule_key || selectedFinding.ruleId}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-text-muted">Regulatory Source:</span>
                    <span className="text-text-secondary truncate max-w-[180px]">{selectedFinding.official_source_name || 'AICTE Regulatory Norms'}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-text-muted">Clause Reference:</span>
                    <span className="text-text-primary font-semibold">{selectedFinding.clause_reference || 'Statutory Requirement'}</span>
                  </div>
                  {selectedFinding.page_reference && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-text-muted">Source Page:</span>
                      <span className="text-accent">Page {selectedFinding.page_reference}</span>
                    </div>
                  )}
                  {selectedFinding.evidence?.fingerprint && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-text-muted">Fingerprint:</span>
                      <span className="text-text-muted truncate max-w-[150px]">{selectedFinding.evidence.fingerprint}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reviewer Confirmation State */}
            <div className="space-y-1 p-2.5 rounded-lg bg-surface-elevated/30 border border-border">
              <div className="text-[10px] font-mono uppercase text-text-muted">Reviewer Confirmation</div>
              <div className="flex items-center gap-2 text-xs">
                {selectedFinding?.reviewerDecision ? (
                  <Badge variant={
                    selectedFinding.reviewerDecision === 'Accepted' ? 'success'
                    : selectedFinding.reviewerDecision === 'False Positive' ? 'neutral'
                    : 'warning'
                  } size="sm">{selectedFinding.reviewerDecision}</Badge>
                ) : (
                  <Badge variant="neutral" size="sm">Unconfirmed</Badge>
                )}
                <span className="text-text-muted text-[10px]">
                  {selectedFinding?.reviewedBy ? `by ${selectedFinding.reviewedBy}` : 'Awaiting officer review'}
                </span>
              </div>
            </div>

            {/* Recommended Action */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted block">
                Recommended Action
              </span>
              <p className="text-xs text-text-primary font-medium leading-snug">
                {selectedFinding?.recommendedAction}
              </p>
            </div>

            {/* Officer Notes */}
            <div className="space-y-1.5 pt-2">
              <label className="text-[10px] font-mono uppercase text-text-muted block">
                Officer Adjudication Comments
              </label>
              <textarea
                rows={3}
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Log observation notes or reasons for clarification request..."
                style={{
                  backgroundColor: 'var(--input-background)',
                  color: 'var(--text-primary)',
                }}
                className="w-full rounded-lg border border-border p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-accent"
              />
            </div>
          </div>

          {/* Adjudication Action Desk */}
          <div className="p-3.5 border-t border-border bg-surface-elevated/40 space-y-2">
            <Button
              variant="primary"
              size="sm"
              icon={HelpCircle}
              isLoading={submittingAction}
              onClick={() => setConfirmModal({ open: true, action: 'Clarification Requested' })}
              className="w-full"
            >
              Request Clarification
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={Check}
                disabled={submittingAction}
                onClick={() => setConfirmModal({ open: true, action: 'Accepted' })}
              >
                Accept Finding
              </Button>
              <Button
                variant="dark"
                size="sm"
                icon={X}
                disabled={submittingAction}
                onClick={() => setConfirmModal({ open: true, action: 'False Positive' })}
              >
                False Positive
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <ConfirmModal
          isOpen={confirmModal.open}
          onClose={() => setConfirmModal({ open: false, action: null })}
          onConfirm={() => handleReviewAction(confirmModal.action)}
          title={`Confirm Adjudication: "${confirmModal.action}"`}
          message={`Are you sure you want to mark finding ${selectedFinding?.id} as "${confirmModal.action}"? This will be recorded in the immutable audit trail.`}
          confirmText="Confirm Decision"
          confirmVariant={confirmModal.action === 'False Positive' ? 'dark' : 'primary'}
          isLoading={submittingAction}
        />
      )}
    </div>
  );
}
