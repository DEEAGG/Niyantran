import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  XCircle,
  Eye,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Hash,
  Scale,
  Zap,
  Lock,
} from 'lucide-react';
import Badge from '../common/Badge';
import Button from '../common/Button';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import RegulatoryPageInspectorModal from './RegulatoryPageInspectorModal';
import RegulatoryClauseReviewModal from './RegulatoryClauseReviewModal';
import { regulatoryService } from '../../services/regulatoryService';
import { useToast } from '../../context/ToastContext';

export default function RegulatoryClauseExplorer({
  initialSourceId = null,
  sources = []
}) {
  const [clauses, setClauses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [selectedSourceId, setSelectedSourceId] = useState(initialSourceId || 'All');
  const [auditStats, setAuditStats] = useState(null);
  const [activatingId, setActivatingId] = useState(null);
  const { addToast } = useToast();

  // Modals state
  const [inspectorClause, setInspectorClause] = useState(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [reviewClause, setReviewClause] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const fetchClauses = async () => {
    try {
      setLoading(true);
      const params = {
        search: search.trim() || undefined,
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
        priority: selectedPriority !== 'All' ? selectedPriority : undefined,
        source_id: selectedSourceId !== 'All' ? selectedSourceId : undefined,
        limit: 150,
      };

      const res = await regulatoryService.getReviewQueue(params);
      setClauses(res.data || []);
      if (res.stats) {
        setAuditStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to load clauses from review queue, falling back to search:', err);
      try {
        const fallbackRes = await regulatoryService.searchClauses(params);
        setClauses(fallbackRes.data || []);
      } catch (e) {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClauses();
  }, [search, selectedCategory, selectedStatus, selectedPriority, selectedSourceId]);

  const categories = [
    'All',
    'Land & Infrastructure',
    'Faculty & Academic Ratios',
    'Programs & Admissions',
    'Campus Safety & Anti-Ragging',
    'Institutional Identity',
    'General Statutory Norms'
  ];

  const handleInspect = (clause) => {
    setInspectorClause(clause);
    setInspectorOpen(true);
  };

  const handleReview = (clause) => {
    setReviewClause(clause);
    setReviewOpen(true);
  };

  const handleActivateClause = async (clause) => {
    try {
      setActivatingId(clause.id);
      await regulatoryService.activateClause(clause.id);
      addToast({
        title: 'Clause Activated',
        message: `Clause ${clause.clause_number || clause.id} is now active and enforceable by the compliance rules engine.`,
        type: 'success'
      });
      fetchClauses();
    } catch (err) {
      addToast({
        title: 'Activation Failed',
        message: err.message || 'Clause must be verified before activation.',
        type: 'error'
      });
    } finally {
      setActivatingId(null);
    }
  };

  const currentSource = sources.find((s) => s.id === (inspectorClause?.source_id || selectedSourceId));

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <div className="p-4 rounded-xl bg-surface border border-border flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search verbatim clauses, section numbers, keywords..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Source Selector */}
          <select
            value={selectedSourceId}
            onChange={(e) => setSelectedSourceId(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
          >
            <option value="All">All Registered Instruments</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>

          {/* Category Selector */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
          >
            <option value="All">All Verification States</option>
            <option value="verified">Verified Only</option>
            <option value="reviewed">Reviewed</option>
            <option value="unverified">Pending Review</option>
            <option value="clarification_needed">Clarification Needed</option>
          </select>

          {/* Priority Queue Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white text-text-primary font-medium focus:outline-none focus:border-[#E43D12]"
          >
            <option value="All">All Audit Priorities</option>
            <option value="CRITICAL">⚡ Critical (Compliance-Active)</option>
            <option value="HIGH">⚠️ High (Superseded/Amended)</option>
            <option value="MEDIUM">⚖️ Medium (Statutory Norm)</option>
            <option value="LOW">📁 Low (Headers/Artifacts)</option>
          </select>
        </div>
      </div>

      {/* Audit Intelligence Summary Banner */}
      {auditStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-surface border border-border/70 text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] text-text-muted uppercase font-semibold">Active Compliance Rules</span>
            <span className="text-base font-bold text-[#E43D12]">{auditStats.compliance_critical} clauses</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-text-muted uppercase font-semibold">Superseded / Amended</span>
            <span className="text-base font-bold text-amber-600">{auditStats.superseded} clauses</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-text-muted uppercase font-semibold">Enforceable Norms</span>
            <span className="text-base font-bold text-emerald-600">{auditStats.enforceable_norms} clauses</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-text-muted uppercase font-semibold">Extraction Artifacts</span>
            <span className="text-base font-bold text-slate-500">{auditStats.artifacts_detected} detected</span>
          </div>
        </div>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-text-secondary px-1">
        <span>
          Showing <strong className="text-text-primary">{clauses.length}</strong> statutory clauses with verified page citations
        </span>
        <span className="text-[11px] font-mono text-text-muted">
          PyMuPDF Exact Geometry Provenance Active
        </span>
      </div>

      {/* Clauses Grid / List */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : clauses.length === 0 ? (
        <EmptyState
          title="No regulatory clauses match the filter"
          description="Try broadening your search term or selecting a different instrument category."
        />
      ) : (
        <div className="space-y-4">
          {clauses.map((clause) => {
            const isVerified = clause.verification_status === 'verified';
            const isReviewed = clause.verification_status === 'reviewed';
            const isClarification = clause.verification_status === 'clarification_needed';
            const isRejected = clause.verification_status === 'rejected';

            return (
              <div
                key={clause.id}
                className="p-5 rounded-2xl bg-surface border border-border hover:border-[#E43D12]/40 transition-all shadow-xs space-y-3.5 group"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleInspect(clause)}
                      className="px-2.5 py-1 rounded-lg bg-[#FDF1EE] text-[#E43D12] border border-[#E43D12]/20 text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-[#FCE3DC] transition-colors"
                      title="Inspect Original PDF Page"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Page {clause.page_number}
                    </button>
                    <span className="text-xs font-mono font-bold text-text-primary">
                      {clause.clause_number || `Norm #${clause.id}`}
                    </span>
                    <span className="text-text-muted">&bull;</span>
                    <span className="text-xs font-semibold text-text-primary">
                      {clause.heading}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {clause.priority === 'CRITICAL' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        ⚡ COMPLIANCE-CRITICAL
                      </span>
                    )}
                    {clause.is_superseded && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" /> SUPERSEDED
                      </span>
                    )}
                    <Badge
                      variant={
                        isVerified ? 'success' : isReviewed ? 'info' : isClarification ? 'warning' : isRejected ? 'danger' : 'neutral'
                      }
                      size="sm"
                      dot
                    >
                      {clause.verification_status || 'Pending Review'}
                    </Badge>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F7F6F2] text-text-secondary border border-border">
                      {clause.category || 'Statutory Norm'}
                    </span>
                  </div>
                </div>

                {/* Supersession Warning Banner */}
                {clause.is_superseded && (
                  <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">Potentially Superseded Requirement:</strong> {clause.audit_note || 'Superseded by subsequent AICTE Corrigendum / Addendum.'}
                    </div>
                  </div>
                )}

                {/* Linked Compliance Rule */}
                {clause.linked_rule_key && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[11px] font-medium text-text-muted">Enforced by Compliance Engine:</span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[11px] font-semibold">
                      {clause.linked_rule_key} &bull; {clause.linked_rule_title || 'Institutional Norm'}
                    </span>
                  </div>
                )}

                {/* Verbatim Statutory Excerpt */}
                <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-border text-xs text-text-primary font-serif leading-relaxed">
                  "{clause.verbatim_text}"
                </div>

                {/* Applicability Scope Details */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] bg-[#F7F6F2] p-2.5 rounded-xl border border-border/70">
                  <span className="font-semibold text-text-primary">Statutory Applicability:</span>
                  <span className="px-1.5 py-0.5 rounded bg-white border border-border font-mono text-[10px] text-text-secondary">
                    {clause.applicability_scope_details?.academic_years || 'AY 2024-2027'}
                  </span>
                  <span className="text-text-muted">&bull;</span>
                  <span className="text-text-secondary font-medium">
                    {clause.applicability_scope_details?.institution_category || 'Approved Technical Institutions'}
                  </span>
                  <span className="text-text-muted">&bull;</span>
                  <span className="text-text-muted text-[10px]">
                    {clause.applicability_scope_details?.jurisdiction || 'AICTE National Purview'}
                  </span>
                </div>

                {/* Structured Rule Summary */}
                {clause.summary_rule && (
                  <div className="text-[11px] text-text-secondary flex items-start gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-[#E43D12] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-text-primary">Condition:</strong> {clause.summary_rule}
                    </span>
                  </div>
                )}

                {/* Review Notes or Reviewer Info */}
                {clause.review_notes && (
                  <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/50 text-[11px] text-emerald-900 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">{clause.reviewed_by || 'Officer'}:</span> {clause.review_notes}
                    </div>
                  </div>
                )}

                {/* Card Actions Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                    <span>Source ID:</span>
                    <code className="font-mono text-[10px] text-text-secondary">{clause.source_id}</code>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isVerified ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleActivateClause(clause)}
                        disabled={activatingId === clause.id}
                        className="text-xs bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300"
                      >
                        <Zap className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        {activatingId === clause.id ? 'Activating...' : 'Activate for Rules'}
                      </Button>
                    ) : (
                      <span className="text-[10px] text-text-muted italic flex items-center gap-1" title="Human review required prior to rule engine activation">
                        <Lock className="w-3 h-3 text-text-muted" /> Review required to activate
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleInspect(clause)}
                      className="text-xs"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1 text-[#E43D12]" />
                      Inspect Page
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleReview(clause)}
                      className="text-xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      Adjudicate / Review
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspector Modal */}
      {inspectorClause && (
        <RegulatoryPageInspectorModal
          isOpen={inspectorOpen}
          onClose={() => setInspectorOpen(false)}
          clause={inspectorClause}
          source={currentSource}
        />
      )}

      {/* Review Modal */}
      {reviewClause && (
        <RegulatoryClauseReviewModal
          isOpen={reviewOpen}
          onClose={() => setReviewOpen(false)}
          clause={reviewClause}
          onReviewSuccess={() => fetchClauses()}
        />
      )}
    </div>
  );
}
