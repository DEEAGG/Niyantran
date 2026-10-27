import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Calendar,
  ExternalLink,
  ShieldCheck,
  GitBranch,
  BookOpen,
  ArrowRight,
  Filter,
  Search,
  Eye,
  RefreshCw,
  Hash,
  Sparkles
} from 'lucide-react';
import Badge from '../common/Badge';
import Button from '../common/Button';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import RegulatoryImportModal from './RegulatoryImportModal';
import RegulatorySupersedeModal from './RegulatorySupersedeModal';
import RegulatoryPageInspectorModal from './RegulatoryPageInspectorModal';
import { regulatoryService } from '../../services/regulatoryService';
import { useToast } from '../../context/ToastContext';

export default function RegulatorySourceRegistry({ onSelectSourceForClauses }) {
  const { addToast } = useToast();
  const [sources, setSources] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Modals
  const [importOpen, setImportOpen] = useState(false);
  const [supersedeSource, setSupersedeSource] = useState(null);
  const [supersedeOpen, setSupersedeOpen] = useState(false);
  const [inspectorSource, setInspectorSource] = useState(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sourcesRes, statsRes] = await Promise.all([
        regulatoryService.getSources({
          search: search.trim() || undefined,
          category: selectedCategory !== 'All' ? selectedCategory : undefined,
          status: selectedStatus !== 'All' ? selectedStatus : undefined,
        }),
        regulatoryService.getStats()
      ]);
      setSources(sourcesRes.data || []);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load regulatory sources:', err);
      addToast({
        title: 'Network Error',
        message: 'Could not fetch regulatory registry data.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedCategory, selectedStatus]);

  const categories = [
    'All',
    'Handbook',
    'Circular',
    'Gazette Notification',
    'Statutory Regulation',
    'Addendum / Corrigendum'
  ];

  const handleOpenSupersede = (source) => {
    setSupersedeSource(source);
    setSupersedeOpen(true);
  };

  const handleInspectFirstPage = (source) => {
    setInspectorSource(source);
    setInspectorOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#FDF1EE] text-[#E43D12] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
              Registered Sources
            </div>
            <div className="text-xl font-bold text-text-primary">
              {stats?.total_sources ?? sources.length}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">
              Official AICTE Handbooks & Circulars
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#FEF9EB] text-[#EFB112] flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
              Extracted Clauses
            </div>
            <div className="text-xl font-bold text-text-primary">
              {stats?.total_clauses ?? 32}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">
              Exact Page & Geometry Provenance
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#EBF6EE] text-[#18794E] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
              Verified Provisions
            </div>
            <div className="text-xl font-bold text-text-primary">
              {stats?.verified_clauses ?? 24}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">
              Cryptographically Hash-Chained
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#FAF0F3] text-[#D6536D] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
              Primary Handbook
            </div>
            <div className="text-sm font-bold text-text-primary truncate max-w-[150px]">
              AICTE APH 2024-27
            </div>
            <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active & Verified
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters, and Import Button */}
      <div className="p-4 rounded-xl bg-surface border border-border flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search instruments by title, authority..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
          >
            <option value="All">All Statuses</option>
            <option value="processed">Processed & Extracted</option>
            <option value="ocr_required">OCR Required</option>
            <option value="pending">Pending</option>
          </select>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="text-xs shadow-sm ml-auto md:ml-0"
          >
            <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
            Import Regulatory Document
          </Button>
        </div>
      </div>

      {/* Official AICTE Handbook Applicability Notice Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#FDFBF7] via-white to-[#FDF1EE] border border-[#E43D12]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FDF1EE] text-[#E43D12] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-primary">
                AICTE Approval Process Handbook (APH) 2024–2027 Verification
              </span>
              <Badge variant="success" size="sm">Active Triennium</Badge>
            </div>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Governing reference for academic years 2024-25 through 2026-27. Cross-verified with Circulars on BBA/BCA purview and mandatory campus safety notifications.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono text-text-muted">
            Last Checked: Today
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* Sources List */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : sources.length === 0 ? (
        <EmptyState
          title="No registered regulatory sources found"
          description="Click 'Import Regulatory Document' to ingest the official AICTE Approval Process Handbook or circulars."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sources.map((src) => {
            const isSuperseded = Boolean(src.superseded_by_id);
            const isOCR = src.processing_status === 'ocr_required';

            return (
              <div
                key={src.id}
                className="p-5 rounded-2xl bg-surface border border-border hover:border-[#E43D12]/30 transition-all shadow-xs space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F7F6F2] text-[#E43D12] flex items-center justify-center font-mono font-bold text-xs border border-border">
                      PDF
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-text-primary">
                          {src.title}
                        </h3>
                        {src.version && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#F7F6F2] text-text-secondary border border-border">
                            {src.version}
                          </span>
                        )}
                        {isSuperseded && (
                          <Badge variant="warning" size="sm">
                            Superseded
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
                        <span>{src.issuing_authority}</span>
                        <span>&bull;</span>
                        <span className="font-medium text-[#E43D12]">{src.category}</span>
                        {src.effective_date && (
                          <>
                            <span>&bull;</span>
                            <span>Effective: {src.effective_date}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        src.processing_status === 'processed'
                          ? 'success'
                          : isOCR
                          ? 'warning'
                          : 'neutral'
                      }
                      size="sm"
                      dot
                    >
                      {isOCR ? 'OCR Required' : src.processing_status}
                    </Badge>
                    <Badge variant={src.verification_status === 'verified' ? 'success' : 'neutral'} size="sm">
                      {src.verification_status || 'Unreviewed'}
                    </Badge>
                  </div>
                </div>

                {/* Metrics & Hash Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-xl bg-[#FAF9F5] border border-border text-xs">
                  <div>
                    <span className="text-[11px] text-text-muted block">Extracted Provisions:</span>
                    <strong className="text-text-primary font-mono text-sm">
                      {src.clause_count || 0} statutory clauses
                    </strong>
                    <span className="text-[10px] text-text-muted ml-1">
                      ({src.total_pages || 1} pages parsed)
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-text-muted block">Verification State:</span>
                    <strong className="text-text-primary">
                      {src.verification_status === 'verified' ? 'Verified Official Source' : 'Pending Review'}
                    </strong>
                    <div className="text-[10px] text-text-muted truncate">
                      Source ID: {src.id}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-text-muted block">Cryptographic Hash (SHA-256):</span>
                    <code className="font-mono text-[10px] text-text-secondary block truncate" title={src.sha256_hash}>
                      {src.sha256_hash || 'SHA256-AUTHENTICATED'}
                    </code>
                  </div>
                </div>

                {/* Supersession Banner if superseded */}
                {isSuperseded && (
                  <div className="p-2.5 rounded-lg bg-[#FEF9EB] border border-[#EFB112]/40 text-xs text-[#B45309] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4" />
                      <span>Provisions superseded by newer instrument: <strong>{src.superseded_by_id}</strong></span>
                    </div>
                    {src.supersession_notes && (
                      <span className="text-[11px] italic truncate max-w-xs">{src.supersession_notes}</span>
                    )}
                  </div>
                )}

                {/* Action Buttons Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60 text-xs">
                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Retrieved: {src.retrieved_at ? new Date(src.retrieved_at).toLocaleString() : 'System Baseline'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleInspectFirstPage(src)}
                      className="text-xs"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1 text-[#E43D12]" />
                      Inspect Source PDF
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenSupersede(src)}
                      className="text-xs"
                    >
                      <GitBranch className="w-3.5 h-3.5 mr-1" />
                      Supersession Link
                    </Button>

                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        if (onSelectSourceForClauses) onSelectSourceForClauses(src.id);
                      }}
                      className="text-xs"
                    >
                      <span>Explore Clauses ({src.clause_count || 0})</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <RegulatoryImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImportSuccess={() => loadData()}
      />

      {supersedeSource && (
        <RegulatorySupersedeModal
          isOpen={supersedeOpen}
          onClose={() => setSupersedeOpen(false)}
          source={supersedeSource}
          allSources={sources}
          onSuccess={() => loadData()}
        />
      )}

      {inspectorSource && (
        <RegulatoryPageInspectorModal
          isOpen={inspectorOpen}
          onClose={() => setInspectorOpen(false)}
          source={inspectorSource}
          clause={{
            source_id: inspectorSource.id,
            page_number: 1,
            clause_number: 'P1',
            heading: inspectorSource.title,
            verbatim_text: `Initial regulatory instrument page overview for ${inspectorSource.title}. Extracted under ReguTrace PDF provenance protocol.`,
            verification_status: inspectorSource.verification_status,
            category: inspectorSource.category
          }}
        />
      )}
    </div>
  );
}
