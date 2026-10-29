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
import { extractionService } from '../services/extractionService';
import { documentService } from '../services/documentService';
import AuthenticatedImage from '../components/common/AuthenticatedImage';
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
  const [documents, setDocuments] = useState([]);
  const [extractedFields, setExtractedFields] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [selectedPage, setSelectedPage] = useState(1);
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
      const [appRes, findingsRes, docsRes, fieldsRes] = await Promise.all([
        applicationService.getApplicationById(targetId),
        validationService.getFindings(targetId),
        documentService.getDocuments(targetId),
        extractionService.getExtractedFields(targetId),
      ]);
      setApp(appRes.data);

      const list = findingsRes.data || [];
      const loadedDocs = docsRes.data || appRes.data?.documents || [];
      const loadedFields = fieldsRes.data || [];
      setFindings(list);
      setDocuments(loadedDocs);
      setExtractedFields(loadedFields);

      // Prefer a real extracted field with source coordinates for the initial preview.
      const defaultField = loadedFields.find((field) =>
        field.documentId && field.coordinates?.x0 != null && field.coordinates?.y0 != null
      ) || loadedFields.find((field) => field.documentId) || null;

      setSelectedDocumentId((previous) => loadedDocs.some((doc) => doc.id === previous)
        ? previous
        : (defaultField?.documentId || loadedDocs[0]?.id || ''));
      setSelectedFieldId((previous) => loadedFields.some((field) => field.id === previous)
        ? previous
        : (defaultField?.id || ''));
      const retainedField = loadedFields.find((field) => field.id === selectedFieldId);
      setSelectedPage(retainedField?.pageNumber || defaultField?.pageNumber || 1);

      // Default to finding with discrepancies.
      const target = list.find((f) => f.rawStatus === 'fail' || f.severity === 'High') || list[0] || null;
      setSelectedFinding(target);
      if (target) setReviewerNotes(target.reviewerNotes || '');
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

  const handleSelectField = (field) => {
    setSelectedFieldId(field.id);
    if (field.documentId) setSelectedDocumentId(field.documentId);
    setSelectedPage(Number(field.pageNumber || 1));
    setMobileTab('evidence');
  };

  const selectedDocument = documents.find((doc) => doc.id === selectedDocumentId) || null;
  const selectedField = extractedFields.find((field) => field.id === selectedFieldId) || null;
  const pageCount = Math.max(1, Math.min(500, Number(selectedDocument?.page_count || selectedDocument?.pages || 1)));
  const fieldMatchesDisplayedPage = !!selectedField
    && selectedField.documentId === selectedDocumentId
    && Number(selectedField.pageNumber || 1) === Number(selectedPage);
  const selectedBBox = fieldMatchesDisplayedPage ? selectedField.coordinates : null;
  const bboxIsValid = !!selectedBBox
    && ['x0', 'y0', 'x1', 'y1'].every((key) => Number.isFinite(Number(selectedBBox[key])))
    && Number(selectedBBox.x1) > Number(selectedBBox.x0)
    && Number(selectedBBox.y1) > Number(selectedBBox.y0);
  const bboxQuery = bboxIsValid
    ? '?bbox=' + encodeURIComponent(JSON.stringify({
        x0: Number(selectedBBox.x0),
        y0: Number(selectedBBox.y0),
        x1: Number(selectedBBox.x1),
        y1: Number(selectedBBox.y1),
      }))
    : '';
  const pageImageUrl = selectedDocumentId
    ? '/api/documents/' + encodeURIComponent(selectedDocumentId) + '/page/' + (Number(selectedPage) || 1) + bboxQuery
    : '';

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
            <div className="mt-4 pt-3 border-t border-border/70">
              <div className="px-2 mb-2 flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">
                  Extracted Fields
                </span>
                <span className="text-[10px] font-mono text-text-muted">{extractedFields.length}</span>
              </div>
              {extractedFields.length === 0 ? (
                <p className="px-2 py-3 text-[11px] text-text-muted">
                  No extracted fields yet. Run document extraction first to enable source highlighting.
                </p>
              ) : extractedFields.map((field) => {
                const isSelected = selectedFieldId === field.id;
                const hasBox = !!field.coordinates
                  && ['x0', 'y0', 'x1', 'y1'].every((key) => Number.isFinite(Number(field.coordinates[key])));
                return (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => handleSelectField(field)}
                    className={"w-full text-left p-2.5 rounded-lg mb-1.5 border transition-colors " +
                      (isSelected ? 'bg-accent/10 border-accent/40' : 'border-transparent hover:bg-surface-elevated/50')}
                    aria-pressed={isSelected}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-semibold text-text-primary">{field.fieldName}</span>
                      <span className={"text-[9px] font-mono shrink-0 " + (hasBox ? 'text-emerald-500' : 'text-text-muted')}>
                        {hasBox ? 'BOX' : 'NO BOX'}
                      </span>
                    </span>
                    <span className="block mt-1 text-[10px] text-text-secondary break-words">{field.extractedValue}</span>
                    <span className="block mt-1 text-[9px] text-text-muted font-mono truncate">
                      {field.sourceDocument} · Pg {field.pageNumber}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* PANEL 2: Document Evidence Viewer & Side-by-Side Comparison (6 Cols) */}
        <div
          className={`lg:col-span-6 bg-surface rounded-2xl border border-border flex flex-col shadow-surface overflow-hidden ${
            mobileTab === 'evidence' ? 'block' : 'hidden lg:flex'
          }`}
        >
          {/* Viewer Toolbar */}
          <div className="p-3 border-b border-border bg-background/50 flex items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-accent shrink-0" />
              <span className="font-semibold text-text-primary font-mono text-xs truncate">
                {selectedDocument?.name || selectedDocument?.original_filename || 'Select a document'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-text-muted shrink-0">
              <button type="button" onClick={() => setZoomLevel((z) => Math.max(75, z - 15))}
                className="p-1 rounded hover:text-text-primary hover:bg-surface-elevated" title="Zoom Out" aria-label="Zoom out">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] px-1">{zoomLevel}%</span>
              <button type="button" onClick={() => setZoomLevel((z) => Math.min(150, z + 15))}
                className="p-1 rounded hover:text-text-primary hover:bg-surface-elevated" title="Zoom In" aria-label="Zoom in">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-3 border-b border-border grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface">
            <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              Document
              <select
                value={selectedDocumentId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  const nextField = extractedFields.find((field) => field.documentId === nextId && field.coordinates);
                  setSelectedDocumentId(nextId);
                  setSelectedFieldId(nextField?.id || '');
                  setSelectedPage(Number(nextField?.pageNumber || 1));
                }}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-text-primary"
              >
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>{doc.name || doc.original_filename || doc.id}</option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              Page
              <select
                value={selectedPage}
                onChange={(event) => {
                  const nextPage = Number(event.target.value) || 1;
                  const nextField = extractedFields.find((field) =>
                    field.documentId === selectedDocumentId
                    && Number(field.pageNumber || 1) === nextPage
                    && field.coordinates
                  );
                  setSelectedPage(nextPage);
                  setSelectedFieldId(nextField?.id || '');
                }}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-text-primary"
              >
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                  <option key={pageNumber} value={pageNumber}>Page {pageNumber}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Real document page. The authenticated API draws the selected field's source bbox. */}
          <div className="flex-1 bg-background p-4 overflow-auto flex flex-col items-center justify-start relative">
            {!selectedDocumentId ? (
              <div className="text-text-muted text-xs py-12">Create an application and upload a document to begin inspection.</div>
            ) : (
              <div
                style={{ transform: 'scale(' + (zoomLevel / 100) + ')', transformOrigin: 'top center' }}
                className="w-full min-h-[380px] flex items-start justify-center"
              >
                <AuthenticatedImage
                  src={pageImageUrl}
                  alt={(selectedDocument?.name || 'Document') + ' page ' + selectedPage + (bboxIsValid ? ' with highlighted ' + selectedField?.fieldName : '')}
                  className="max-w-full max-h-[640px] object-contain rounded border border-border bg-white shadow-sm"
                />
              </div>
            )}
            <div className="w-full mt-3 p-3 rounded-lg border border-border bg-surface text-[11px] text-text-secondary">
              {bboxIsValid ? (
                <span><strong className="text-accent">{selectedField?.fieldName}</strong> is highlighted on the actual stored document page. Select another extracted field to inspect its source location.</span>
              ) : selectedField ? (
                <span><strong className="text-text-primary">{selectedField.fieldName}</strong> has no usable source bounding box. The page is shown without a highlight; re-run extraction for this document if a source location is needed.</span>
              ) : (
                <span>Select an extracted field from the left panel. Fields with a <strong className="text-emerald-500">BOX</strong> label have coordinates available for highlighting.</span>
              )}
            </div>
          </div>
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
              <div className="text-[10px] text-text-secondary pt-1">Review the rule details and source evidence before making a decision.</div>
            </div>

            {/* Real extracted-field provenance */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase text-text-muted block">
                Selected Field Provenance
              </span>
              {selectedField ? (
                <div className="p-3 rounded-lg bg-surface-elevated/50 border border-border text-[11px] space-y-2">
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">Field</div>
                    <div className="font-semibold text-text-primary">{selectedField.fieldName}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">Extracted value</div>
                    <div className="font-mono text-accent break-words">{selectedField.extractedValue}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
                    <span className="text-text-muted">Source document</span>
                    <span className="text-text-secondary break-words">{selectedField.sourceDocument}</span>
                    <span className="text-text-muted">Page</span>
                    <span className="text-text-secondary">Page {selectedField.pageNumber}</span>
                    <span className="text-text-muted">Extraction method</span>
                    <span className="text-text-secondary break-words">{selectedField.extractionMethod}</span>
                    <span className="text-text-muted">Confidence</span>
                    <span className="text-text-secondary">{typeof selectedField.confidence === 'number' ? Math.round(selectedField.confidence * 100) + '%' : 'Not reported'}</span>
                    <span className="text-text-muted">Coordinates</span>
                    <span className="text-text-secondary font-mono break-words">
                      {selectedField.coordinates
                        ? 'x0:' + selectedField.coordinates.x0 + ', y0:' + selectedField.coordinates.y0 + ', x1:' + selectedField.coordinates.x1 + ', y1:' + selectedField.coordinates.y1
                        : 'Not available'}
                    </span>
                    <span className="text-text-muted">Verification status</span>
                    <span className="text-text-secondary">{selectedField.status || 'Needs Review'}</span>
                  </div>
                  <p className="text-[10px] text-text-muted border-t border-border pt-2">
                    Highlights use the stored extraction coordinates over the authenticated source page. Low-confidence or unlocated fields should be checked manually.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-text-muted p-3 rounded-lg bg-surface-elevated/40 border border-border">
                  Select an extracted field to view its source document, page, extraction metadata, and available coordinates.
                </p>
              )}
            </div>

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
