import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  XCircle,
  ShieldCheck,
  UserCheck,
  Loader2
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { regulatoryService } from '../../services/regulatoryService';
import { useToast } from '../../context/ToastContext';

export default function RegulatoryClauseReviewModal({
  isOpen,
  onClose,
  clause,
  onReviewSuccess
}) {
  const { addToast } = useToast();
  const [status, setStatus] = useState(clause?.verification_status || 'verified');
  const [reviewedBy, setReviewedBy] = useState('Senior Compliance Officer');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (clause) {
      setStatus(clause.verification_status || 'verified');
      setNotes(clause.review_notes || '');
    }
  }, [clause]);

  if (!isOpen || !clause) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await regulatoryService.reviewClause(clause.id, {
        status,
        reviewed_by: reviewedBy,
        notes: notes.trim() || `Adjudication status set to ${status}.`
      });

      addToast({
        title: 'Clause Review Recorded',
        message: `Clause ${clause.clause_number || clause.id} updated to "${status}" and logged to audit chain.`,
        type: 'success'
      });

      if (onReviewSuccess) onReviewSuccess(res);
      onClose();
    } catch (err) {
      console.error('Failed to submit review:', err);
      addToast({
        title: 'Review Submission Failed',
        message: err.message || 'Error recording clause review.',
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const statusOptions = [
    {
      value: 'verified',
      label: 'Verified Statutory Norm',
      icon: CheckCircle2,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-300',
      description: 'The clause text has been checked against official gazette/handbook and verified active.'
    },
    {
      value: 'reviewed',
      label: 'Reviewed (Pending Confirmation)',
      icon: ShieldCheck,
      color: 'text-blue-700 bg-blue-50 border-blue-300',
      description: 'The clause has been examined and noted, awaiting final committee concurrence.'
    },
    {
      value: 'clarification_needed',
      label: 'Clarification Needed',
      icon: FileQuestion,
      color: 'text-amber-700 bg-amber-50 border-amber-300',
      description: 'The clause interpretation requires legal or AICTE council advisory.'
    },
    {
      value: 'rejected',
      label: 'Rejected / Outdated',
      icon: XCircle,
      color: 'text-rose-700 bg-rose-50 border-rose-300',
      description: 'This clause was superseded, struck down, or extracted with errors.'
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adjudicate Regulatory Clause"
      subtitle={`Reviewing ${clause.clause_number || clause.id}: ${clause.heading || 'Statutory Requirement'}`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
        {/* Verbatim Excerpt */}
        <div className="p-3 rounded-lg bg-surface-secondary border border-border space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-text-muted">
            <span>Source Citation: Page {clause.page_number}</span>
            <span className="font-mono text-[10px]">{clause.category}</span>
          </div>
          <p className="font-serif text-text-primary text-xs line-clamp-3 italic">
            "{clause.verbatim_text}"
          </p>
        </div>

        {/* Status Selection */}
        <div>
          <label className="block text-xs font-semibold text-text-primary mb-2">
            Verification Decision <span className="text-[#E43D12]">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {statusOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = status === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    isSelected
                      ? `${opt.color} ring-2 ring-offset-1 ring-accent`
                      : 'border-border bg-white hover:bg-[#FDFBF7] text-text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="font-semibold text-xs text-text-primary">{opt.label}</span>
                  </div>
                  <p className="text-[10px] opacity-80 leading-snug">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reviewer Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Reviewer Official Name / Role
            </label>
            <input
              type="text"
              required
              value={reviewedBy}
              onChange={(e) => setReviewedBy(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Audit Action
            </label>
            <div className="p-2 rounded-lg bg-surface-secondary border border-border text-[11px] font-mono text-text-secondary flex items-center gap-1.5 h-[34px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>REGULATORY_CLAUSE_REVIEW</span>
            </div>
          </div>
        </div>

        {/* Review Notes */}
        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">
            Reviewer Findings & Rationale
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Document validation checks, cross-reference against gazette notifications, or explain reasons for status change..."
            className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Recording in Audit Chain...
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                Commit Review Decision
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
