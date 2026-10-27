import React, { useState } from 'react';
import {
  GitBranch,
  AlertTriangle,
  Layers,
  ArrowRight,
  Loader2,
  FileText
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { regulatoryService } from '../../services/regulatoryService';
import { useToast } from '../../context/ToastContext';

export default function RegulatorySupersedeModal({
  isOpen,
  onClose,
  source,
  allSources = [],
  onSuccess
}) {
  const { addToast } = useToast();
  const [targetId, setTargetId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !source) return null;

  // Filter out the source itself
  const candidateSources = allSources.filter((s) => s.id !== source.id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetId) {
      addToast({
        title: 'Selection Required',
        message: 'Please choose the newer regulatory instrument that supersedes this one.',
        type: 'warning'
      });
      return;
    }

    try {
      setSubmitting(true);
      await regulatoryService.supersedeSource(
        source.id,
        targetId,
        notes.trim() || `Superseded by newer instrument ${targetId}`
      );

      addToast({
        title: 'Supersession Established',
        message: `${source.title} is now marked superseded by ${targetId}.`,
        type: 'success'
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to mark superseded:', err);
      addToast({
        title: 'Supersession Error',
        message: err.message || 'Error updating supersession hierarchy.',
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Link Regulatory Supersession"
      subtitle={`Establish regulatory precedence hierarchy for: ${source.title}`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
        <div className="p-3.5 rounded-xl bg-[#FEF9EB] border border-[#EFB112]/40 text-[#B45309] space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Regulatory Versioning Protocol</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Marking this instrument superseded ensures downstream rule engines prioritize provisions from the newer gazette / circular while maintaining complete historical audit provenance.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">
            Current Target Instrument (Being Superseded)
          </label>
          <div className="p-2.5 rounded-lg bg-surface-secondary border border-border flex items-center justify-between">
            <span className="font-semibold text-text-primary truncate">{source.title}</span>
            <span className="font-mono text-[10px] text-text-muted">{source.version || 'Original'}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">
            Superseded By (Newer Active Regulatory Instrument) <span className="text-[#E43D12]">*</span>
          </label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            required
            className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
          >
            <option value="">Select newer instrument...</option>
            {candidateSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.version || 'Latest'}) [{s.id}]
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">
            Supersession Justification / Legal Scope
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Amended under AICTE Circular 2024 Corrigendum Clause 3 regarding program purview..."
            className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || !targetId}>
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Updating Hierarchy...
              </>
            ) : (
              <>
                <GitBranch className="w-3.5 h-3.5 mr-1.5" />
                Commit Supersession Link
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
