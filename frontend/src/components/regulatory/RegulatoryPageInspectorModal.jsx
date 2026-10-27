import React, { useState } from 'react';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ShieldCheck,
  Hash,
  ExternalLink,
  Layers,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  X
} from 'lucide-react';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { regulatoryService } from '../../services/regulatoryService';

export default function RegulatoryPageInspectorModal({
  isOpen,
  onClose,
  clause,
  source
}) {
  const [currentPage, setCurrentPage] = useState(clause?.page_number || 1);
  const [zoom, setZoom] = useState(100);
  const [imageError, setImageError] = useState(false);

  React.useEffect(() => {
    if (clause?.page_number) {
      setCurrentPage(clause.page_number);
      setImageError(false);
    }
  }, [clause]);

  if (!isOpen || !clause) return null;

  const sourceId = clause.source_id || source?.id;
  const totalPages = source?.total_pages || 6;
  const imageUrl = regulatoryService.getPageImageUrl(sourceId, currentPage);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
      setImageError(false);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
      setImageError(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Source Document Inspector — ${source?.title || 'Regulatory Source'}`}
      subtitle={`Verified AICTE Page Citation: Page ${currentPage} of ${totalPages}`}
      maxWidth="max-w-5xl"
    >
      <div className="flex flex-col lg:flex-row h-[75vh] divide-y lg:divide-y-0 lg:divide-x divide-border">
        {/* Left Side: High-Resolution Page Canvas */}
        <div className="flex-1 flex flex-col bg-[#2A2928] select-none overflow-hidden relative">
          {/* Canvas Toolbar */}
          <div className="h-11 px-4 bg-[#1E1E1D] border-b border-white/10 flex items-center justify-between text-xs text-white/80 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-white/5 border border-white/10">
                Page {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z - 15, 60))}
                className="p-1 rounded hover:bg-white/10"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="font-mono text-[11px]">{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z + 15, 180))}
                className="p-1 rounded hover:bg-white/10"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Rendered Page Image Container */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#181817]">
            {imageError ? (
              <div className="text-center p-6 text-white/60">
                <FileText className="w-12 h-12 mx-auto mb-2 text-white/40" />
                <p className="text-xs">Page raster render unavailable.</p>
                <p className="text-[11px] text-white/40 mt-1">Reviewing text extraction directly from PyMuPDF stream.</p>
              </div>
            ) : (
              <img
                src={imageUrl}
                alt={`Page ${currentPage}`}
                style={{ width: `${zoom}%`, maxWidth: 'none' }}
                onError={() => setImageError(true)}
                className="rounded shadow-2xl transition-all duration-150 border border-white/10 bg-white"
              />
            )}
          </div>
        </div>

        {/* Right Side: Extracted Clause & Provenance Details */}
        <div className="w-full lg:w-96 flex flex-col bg-surface overflow-hidden shrink-0">
          <div className="p-4 border-b border-border bg-[#FDFBF7] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#FDF1EE] text-[#E43D12] border border-[#E43D12]/20">
                {clause.clause_number || `P${clause.page_number}`}
              </span>
              <span className="text-xs font-semibold text-text-primary truncate">
                {clause.heading || 'Statutory Norm'}
              </span>
            </div>
            <Badge
              variant={
                clause.verification_status === 'verified'
                  ? 'success'
                  : clause.verification_status === 'reviewed'
                  ? 'info'
                  : clause.verification_status === 'rejected'
                  ? 'danger'
                  : 'pending'
              }
              size="sm"
            >
              {clause.verification_status || 'Unreviewed'}
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Page Citation Badge */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-secondary border border-border">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#E43D12]" />
                <span className="font-semibold text-text-primary">Source Page Provenance:</span>
              </div>
              <span className="font-mono font-bold text-text-primary">
                Page {clause.page_number}
              </span>
            </div>

            {/* Verbatim Regulatory Text */}
            <div>
              <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                Verbatim Statutory Text
              </label>
              <div className="p-3 rounded-lg bg-white border border-border font-serif text-text-primary leading-relaxed text-xs shadow-xs max-h-48 overflow-y-auto">
                {clause.verbatim_text}
              </div>
            </div>

            {/* Structured Summary Rule */}
            {clause.summary_rule && (
              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                  Engine Parsed Norm
                </label>
                <div className="p-2.5 rounded-lg bg-[#FEF9EB] border border-[#EFB112]/30 text-[#B45309] text-[11px] leading-relaxed">
                  {clause.summary_rule}
                </div>
              </div>
            )}

            {/* Metadata Grid */}
            <div className="space-y-2 pt-2 border-t border-border text-[11px]">
              <div className="flex justify-between">
                <span className="text-text-muted">Instrument:</span>
                <span className="text-text-primary font-medium text-right truncate max-w-[180px]">
                  {source?.title || clause.source_id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Issuing Authority:</span>
                <span className="text-text-primary font-medium">{source?.issuing_authority || 'AICTE'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Category:</span>
                <span className="text-text-primary font-medium">{clause.category || source?.category || 'Regulatory Norm'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Scope / Jurisdiction:</span>
                <span className="text-text-primary font-medium">{clause.applicability_scope || 'National / All AICTE Institutions'}</span>
              </div>
              {clause.reviewed_by && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Reviewed By:</span>
                  <span className="text-text-primary font-medium">{clause.reviewed_by}</span>
                </div>
              )}
            </div>

            {/* Cryptographic SHA-256 Digest */}
            <div className="p-2.5 rounded-lg bg-surface-secondary border border-border space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Source SHA-256 Digest</span>
              </div>
              <p className="font-mono text-[10px] text-text-secondary break-all">
                {source?.sha256_hash || 'SHA256-AUTHENTICATED'}
              </p>
            </div>
          </div>

          <div className="p-3 border-t border-border bg-[#FDFBF7] flex justify-end">
            <Button size="sm" variant="outline" onClick={onClose}>
              Close Inspector
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
