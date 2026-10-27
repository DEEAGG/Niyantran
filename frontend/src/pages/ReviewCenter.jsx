import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  CheckSquare, ShieldAlert, AlertTriangle, CheckCircle2, 
  HelpCircle, Eye, MessageSquare, Clock, Filter, Search, 
  FileCheck, Shield, ChevronRight, UserCheck, X
} from 'lucide-react';
import { reviewService } from '../services/reviewService';
import { useToast } from '../context/ToastContext';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';

export default function ReviewCenter() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();

  const appParam = searchParams.get('app') || '';

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Pending');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState(appParam);

  // Adjudication modal state
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState('Accept Finding');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await reviewService.getReviews({
        applicationId: appParam || undefined,
        severity: severityFilter !== 'All' ? severityFilter : undefined,
      });
      setReviews(res.data || []);
    } catch (err) {
      console.error('Error fetching review findings:', err);
      addToast('Failed to load compliance reviews.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [severityFilter, appParam]);

  const handleOpenAdjudicate = (finding) => {
    setSelectedFinding(finding);
    setReviewAction('Accept Finding');
    setReviewerNotes(finding.reviewerNotes || '');
    setIsModalOpen(true);
  };

  const handleSubmitDecision = async (e) => {
    e.preventDefault();
    if (!selectedFinding) return;

    try {
      setIsSubmitting(true);
      await reviewService.submitReview(selectedFinding.id, {
        action: reviewAction,
        reviewerNotes,
      });

      addToast(`Finding ${selectedFinding.id} recorded as "${reviewAction}".`, 'success');
      setIsModalOpen(false);
      fetchReviews();
    } catch (err) {
      console.error('Failed to submit review decision:', err);
      addToast('Error recording officer decision.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter reviews by activeTab and search
  const filteredReviews = reviews.filter((r) => {
    if (activeTab === 'Pending' && r.status !== 'Pending Review') return false;
    if (activeTab === 'Clarification' && r.status !== 'Clarification Requested') return false;
    if (activeTab === 'Resolved' && (r.status === 'Pending Review' || r.status === 'Clarification Requested')) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        (r.id || '').toLowerCase().includes(q) ||
        (r.applicationId || '').toLowerCase().includes(q) ||
        (r.institutionName || '').toLowerCase().includes(q) ||
        (r.title || '').toLowerCase().includes(q) ||
        (r.code || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = reviews.filter((r) => r.status === 'Pending Review').length;
  const clarifCount = reviews.filter((r) => r.status === 'Clarification Requested').length;
  const resolvedCount = reviews.filter((r) => r.status !== 'Pending Review' && r.status !== 'Clarification Requested').length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner / Hero */}
      <div className="bg-surface rounded-xl p-6 sm:p-8 border border-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-accent/15 text-accent border border-accent/25 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5" />
                Statutory Adjudication Desk
              </span>
              <span className="text-xs text-text-muted font-mono">Role: Compliance Officer</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
              Officer Review Center
            </h1>
            <p className="text-sm text-text-secondary mt-1.5 max-w-2xl leading-relaxed">
              Adjudicate automated discrepancy findings flagged by ReguTrace, inspect multi-document evidentiary coordinates, and dispatch official statutory clarification notices.
            </p>
          </div>

          <div className="bg-surface-elevated/80 rounded-xl p-4 border border-border/80 flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/20 flex items-center justify-center text-accent">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-text-primary block">Compliance Officer</span>
              <span className="text-[11px] text-text-muted font-mono">Authorized Institutional Reviewer • AICTE ReguTrace</span>
            </div>
          </div>
        </div>

        {/* Statistical Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-border">
          <div>
            <span className="text-xs text-text-muted block">Pending Officer Review</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--status-pending)' }} />
              <span className="text-xl font-semibold font-mono text-text-primary">{pendingCount} Cases</span>
            </div>
          </div>
          <div>
            <span className="text-xs text-text-muted block">Clarification Notices</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-xl font-semibold font-mono text-text-primary">{clarifCount} Dispatched</span>
            </div>
          </div>
          <div>
            <span className="text-xs text-text-muted block">Adjudicated Decisions</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--status-success)' }} />
              <span className="text-xl font-semibold font-mono text-text-primary">{resolvedCount} Completed</span>
            </div>
          </div>
          <div>
            <span className="text-xs text-text-muted block">Session Audit Trail</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-xl font-semibold font-mono text-text-primary">100% Logged</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-2 bg-surface p-1 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab('Pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'Pending'
                  ? 'bg-accent text-background shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Pending Review
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                {pendingCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('Clarification')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'Clarification'
                  ? 'bg-accent text-background shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Clarifications Issued
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                {clarifCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('Resolved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'Resolved'
                  ? 'bg-accent text-background shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Adjudicated
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                {resolvedCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('All')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'All'
                  ? 'bg-accent text-background shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All Findings ({reviews.length})
            </button>
          </div>

          {/* Search & Severity Filter */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search finding, ID, college..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
              />
            </div>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
              style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
            >
              <option value="All">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
            </select>
          </div>
        </div>
      </div>

      {/* Findings List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-surface rounded-xl p-6 border border-border space-y-3">
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : filteredReviews.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No pending reviews in this queue"
          description="All flagged items in this status filter have been adjudicated or resolved."
          action={{
            label: "View All Queue",
            onClick: () => { setActiveTab('All'); setSeverityFilter('All'); setSearchTerm(''); }
          }}
        />
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((finding) => (
            <div
              key={finding.id}
              className="bg-surface rounded-xl p-6 border border-border hover:border-accent/30 transition-all space-y-4"
            >
              {/* Finding Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-accent">
                      {finding.id}
                    </span>
                    <span className="text-text-muted text-xs">•</span>
                    <Link
                      to={`/applications/${finding.applicationId}`}
                      className="font-mono text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors hover:underline"
                    >
                      {finding.applicationId}
                    </Link>
                    <Badge variant={finding.severity === 'Critical' ? 'danger' : finding.severity === 'High' ? 'warning' : 'info'}>
                      {finding.severity}
                    </Badge>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-surface-elevated text-text-muted font-mono">
                      Rule: {finding.ruleId}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-text-primary">
                    {finding.title}
                  </h3>

                  <p className="text-xs text-text-muted">
                    Applicant Institution: <strong className="text-text-secondary">{finding.institutionName}</strong>
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    finding.status === 'Pending Review' 
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : finding.status === 'Clarification Requested'
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {finding.status}
                  </span>
                </div>
              </div>

              {/* Summary Description */}
              <p className="text-xs text-text-secondary leading-relaxed bg-surface-elevated/50 p-3.5 rounded-lg border border-border/60">
                {finding.summary}
              </p>

              {/* Evidentiary Sources Snippets */}
              {finding.evidenceSources && finding.evidenceSources.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider block">
                    Extracted Evidentiary Discrepancy:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {finding.evidenceSources.map((ev, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-surface-elevated border border-border/60 text-xs space-y-1">
                        <div className="flex items-center justify-between text-text-muted font-mono text-[11px]">
                          <span>{ev.documentType} (Page {ev.pageNumber})</span>
                        </div>
                        <div className="font-mono font-bold text-accent">
                          {ev.extractedValue}
                        </div>
                        <div className="text-[10px] text-text-muted truncate">
                          File: {ev.documentName}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviewer Note if previously touched */}
              {finding.reviewerNotes && (
                <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 text-xs space-y-1">
                  <span className="font-semibold text-text-primary flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-accent" />
                    Officer Decision Note:
                  </span>
                  <p className="text-text-secondary">{finding.reviewerNotes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
                <Link
                  to={`/applications/${finding.applicationId}/evidence`}
                  className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors font-medium"
                >
                  <Eye className="w-3.5 h-3.5 text-accent" />
                  Open Full Evidence Workbench
                </Link>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenAdjudicate(finding)}
                  className="text-xs"
                >
                  Adjudicate Finding
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Adjudication Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Statutory Adjudication"
        subtitle={selectedFinding ? `${selectedFinding.id} — ${selectedFinding.title}` : ''}
        size="md"
      >
        {selectedFinding && (
          <form onSubmit={handleSubmitDecision} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Select Adjudication Action
              </label>
              <div className="space-y-2">
                {[
                  { value: 'Accept Finding', label: 'Accept Finding (Confirm Regulatory Non-Compliance)', desc: 'Validates automated discrepancy. Flags application for formal notice.' },
                  { value: 'Clarification Requested', label: 'Issue Clarification Notice to Applicant', desc: 'Allows college 14 calendar days to upload revised attested documents.' },
                  { value: 'Mark False Positive', label: 'Dismiss as False Positive (Approved Exception)', desc: 'Overrides finding with officer notes explaining statutory exemption.' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      reviewAction === opt.value
                        ? 'bg-accent/10 border-accent text-text-primary'
                        : 'bg-surface border-border text-text-secondary hover:border-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reviewAction"
                      value={opt.value}
                      checked={reviewAction === opt.value}
                      onChange={(e) => setReviewAction(e.target.value)}
                      className="mt-1 text-accent focus:ring-accent"
                    />
                    <div className="text-xs">
                      <span className="font-semibold block text-text-primary">{opt.label}</span>
                      <span className="text-text-muted block mt-0.5">{opt.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                Officer Findings & Statutory Remarks
              </label>
              <textarea
                rows={3}
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Enter statutory justification, clause references, or specific instructions for the applicant..."
                required
                className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent resize-none"
                style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="p-3 rounded-lg bg-surface-elevated border border-border text-xs text-text-muted flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent shrink-0" />
              <span>
                Action will be permanently recorded in the tamper-evident audit ledger with timestamp and reviewer certificate.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
              >
                Confirm Adjudication
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
