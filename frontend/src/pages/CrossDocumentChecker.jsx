import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  SplitSquareVertical,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  ArrowRight,
  ChevronRight,
  RotateCw,
  Eye,
  Layers,
  Sparkles,
  Building2,
  Calendar,
  MapPin,
  Hash,
  ShieldCheck,
  Scale
} from 'lucide-react';
import { applicationService } from '../services/applicationService';
import { extractionService } from '../services/extractionService';
import { validationService } from '../services/validationService';
import { useToast } from '../context/ToastContext';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';

export default function CrossDocumentChecker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const appIdParam = searchParams.get('app') || '';
  const [applications, setApplications] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState(appIdParam);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'CONFLICTS' | 'MATCHES'
  const [searchTerm, setSearchTerm] = useState('');

  // Extracted entities and findings
  const [fields, setFields] = useState([]);
  const [findings, setFindings] = useState([]);
  const [appDetails, setAppDetails] = useState(null);

  // Load applications
  useEffect(() => {
    const fetchApps = async () => {
      try {
        const res = await applicationService.getApplications();
        const appList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setApplications(appList);
        if (!appIdParam && appList.length > 0) {
          const withDocs = appList.find(a => a.id === 'APP-2026-001') || appList.find(a => a.status !== 'draft' && a.status !== 'Draft') || appList[0];
          setSelectedAppId(withDocs.id);
          setSearchParams({ app: withDocs.id });
        }
      } catch (err) {
        console.error('Error fetching applications for CrossDocumentChecker:', err);
      }
    };
    fetchApps();
  }, []);

  // Load data for selected application
  const loadAppData = async (id) => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [appRes, fieldsRes, findingsRes] = await Promise.all([
        applicationService.getApplicationById(id).catch(() => null),
        extractionService.getExtractedFields(id).catch(() => ({ data: [] })),
        validationService.getFindings(id).catch(() => ({ data: [] })),
      ]);

      setAppDetails(appRes?.data || null);
      setFields(fieldsRes?.data || []);
      setFindings(findingsRes?.data || []);
    } catch (err) {
      console.error('Error loading cross document data:', err);
      addToast('Failed to load cross-document comparisons.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAppId) {
      loadAppData(selectedAppId);
    }
  }, [selectedAppId]);

  const handleSelectApp = (id) => {
    setSelectedAppId(id);
    setSearchParams({ app: id });
  };

  // Group fields across documents by normalized attribute name
  const crossDocGroups = React.useMemo(() => {
    const groups = {};

    // Standard attributes to trace across documents
    const knownAttributes = [
      { key: 'institution_name', label: 'College / Institution Name', icon: Building2 },
      { key: 'registration_number', label: 'Registration / Trust ID', icon: Hash },
      { key: 'land_area', label: 'Total Land Area & Units', icon: Scale },
      { key: 'address', label: 'Campus Address & Location', icon: MapPin },
      { key: 'valid_until', label: 'Certificate Validity / Expiry', icon: Calendar },
    ];

    // Initialize with known attributes
    knownAttributes.forEach(attr => {
      groups[attr.key] = {
        key: attr.key,
        label: attr.label,
        icon: attr.icon,
        documents: [],
        hasConflict: false,
        isConsistent: false,
        summary: ''
      };
    });

    // Populate from extracted fields
    fields.forEach((f) => {
      const fieldKey = (f.fieldName || f.field_name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const matchedAttr = knownAttributes.find(a => fieldKey.includes(a.key) || a.key.includes(fieldKey)) || {
        key: fieldKey,
        label: f.fieldName || 'Extracted Attribute',
        icon: FileText
      };

      if (!groups[matchedAttr.key]) {
        groups[matchedAttr.key] = {
          key: matchedAttr.key,
          label: matchedAttr.label,
          icon: matchedAttr.icon,
          documents: [],
          hasConflict: false,
          isConsistent: false,
          summary: ''
        };
      }

      groups[matchedAttr.key].documents.push({
        id: f.id,
        docName: f.sourceDocument || f.original_filename || 'Uploaded Document',
        docType: f.document_type || 'PDF Filing',
        pageNumber: f.pageNumber || f.page_number || 1,
        value: f.extractedValue || f.extracted_value || f.field_value || '—',
        normalized: f.normalizedValue || f.normalized_value || '',
        confidence: f.confidence || 0.95
      });
    });

    // Deduplicate documents within each group by docName
    Object.values(groups).forEach(g => {
      const seen = new Set();
      g.documents = g.documents.filter(d => {
        const k = `${d.docName}-${d.value}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      // Check consistency or conflicts
      if (g.documents.length >= 2) {
        const vals = g.documents.map(d => (d.normalized || d.value).trim().toLowerCase());
        const allMatch = vals.every(v => v === vals[0]);
        g.isConsistent = allMatch;
        g.hasConflict = !allMatch;
      } else if (g.documents.length === 1) {
        // Single document present
        g.isConsistent = true;
        g.hasConflict = false;
      }
    });

    // Overlay known cross-match findings from the rules engine
    findings.forEach(f => {
      const msg = (f.message || f.description || '').toLowerCase();
      if (msg.includes('cross') || msg.includes('mismatch') || msg.includes('conflict') || f.code === 'CROSS_DOC_MISMATCH') {
        Object.values(groups).forEach(g => {
          if (msg.includes(g.key) || msg.includes(g.label.toLowerCase())) {
            g.hasConflict = true;
            g.isConsistent = false;
            g.finding = f;
          }
        });
      }
    });

    return Object.values(groups).filter(g => g.documents.length > 0);
  }, [fields, findings]);

  const filteredGroups = crossDocGroups.filter(g => {
    if (filterType === 'CONFLICTS' && !g.hasConflict) return false;
    if (filterType === 'MATCHES' && g.hasConflict) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchLabel = g.label.toLowerCase().includes(q);
      const matchDocs = g.documents.some(d => d.value.toLowerCase().includes(q) || d.docName.toLowerCase().includes(q));
      return matchLabel || matchDocs;
    }
    return true;
  });

  const totalCompared = crossDocGroups.length;
  const conflictCount = crossDocGroups.filter(g => g.hasConflict).length;
  const matchCount = crossDocGroups.filter(g => g.isConsistent && g.documents.length >= 2).length;

  return (
    <div className="space-y-6 pb-16 animate-fadeIn">
      {/* Page Header */}
      <div className="p-6 rounded-2xl border border-border bg-surface shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#E43D12]/10 text-[#E43D12] border border-[#E43D12]/20 uppercase">
                Feature 3 • Consistency Engine
              </span>
              <span className="text-text-muted">&bull;</span>
              <span className="text-xs text-text-secondary font-medium">Cross-Document Verification</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Cross-Document Consistency Checker
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-2xl leading-relaxed">
              Compare institutional names, registration numbers, land areas, and addresses across multiple uploaded PDF files to automatically detect and pinpoint conflicting values.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              icon={RotateCw}
              loading={refreshing}
              onClick={async () => {
                setRefreshing(true);
                await loadAppData(selectedAppId);
                setRefreshing(false);
              }}
            >
              Re-Scan
            </Button>
            <Link
              to={`/review?app=${selectedAppId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-all shadow-xs cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Review Findings</span>
            </Link>
          </div>
        </div>

        {/* Application Selector */}
        <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider shrink-0">
            Selected Application:
          </label>
          <select
            value={selectedAppId}
            onChange={(e) => handleSelectApp(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-accent"
          >
            {applications.map((app) => (
              <option key={app.id} value={app.id}>
                {app.id} &mdash; {app.institutionName || app.applicantName || 'Application'} ({app.status || 'Active'})
              </option>
            ))}
          </select>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/60 text-xs">
          <div className="p-3 rounded-xl bg-surface-secondary/50 border border-border flex items-center justify-between">
            <span className="text-text-secondary font-medium">Attributes Compared:</span>
            <span className="font-mono font-bold text-text-primary text-sm">{totalCompared}</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
            <span className="text-emerald-800 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Cross-Document Matches:
            </span>
            <span className="font-mono font-bold text-emerald-700 text-sm">{matchCount}</span>
          </div>
          <div className={`p-3 rounded-xl border flex items-center justify-between ${
            conflictCount > 0 
              ? 'bg-[#E43D12]/10 border-[#E43D12]/30 text-[#E43D12]' 
              : 'bg-surface-secondary/50 border-border text-text-secondary'
          }`}>
            <span className="font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Conflicting Values Detected:
            </span>
            <span className="font-mono font-bold text-sm">{conflictCount}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search attribute name, value, or document name..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'CONFLICTS', 'MATCHES'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterType === type
                  ? 'bg-accent text-white shadow-xs'
                  : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {type === 'ALL' ? 'All Attributes' : type === 'CONFLICTS' ? 'Conflicts Only' : 'Matches Only'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Comparison Cards */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          icon={SplitSquareVertical}
          title="No Cross-Document Fields Found"
          description="Upload multiple institutional documents (such as Land Deed, Fire NOC, and Building Plan) to enable automated cross-document consistency verification."
          action={{
            label: 'Upload Supporting Documents',
            onClick: () => navigate(`/upload?app=${selectedAppId}`)
          }}
        />
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const Icon = group.icon;
            const isConflict = group.hasConflict;

            return (
              <div
                key={group.key}
                className={`p-5 rounded-2xl border transition-all duration-150 bg-surface shadow-xs ${
                  isConflict
                    ? 'border-[#E43D12]/40 bg-[#FDF1EE]/30'
                    : 'border-border hover:border-accent/30'
                }`}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/70">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isConflict ? 'bg-[#E43D12]/15 text-[#E43D12]' : 'bg-surface-secondary text-text-primary'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-text-primary">
                        {group.label}
                      </h3>
                      <span className="text-[11px] font-mono text-text-muted">
                        Compared across {group.documents.length} document(s)
                      </span>
                    </div>
                  </div>

                  <div>
                    {isConflict ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#E43D12]/10 border border-[#E43D12]/30 text-[#E43D12] font-mono font-bold text-xs">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Conflicting Values Detected
                      </span>
                    ) : group.documents.length >= 2 ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 font-mono font-bold text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Cross-Document Consistent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-secondary border border-border text-text-secondary font-mono text-xs">
                        Single Document Available
                      </span>
                    )}
                  </div>
                </div>

                {/* Conflict Notice if present */}
                {isConflict && (
                  <div className="mt-3 p-3 rounded-xl bg-white border border-[#E43D12]/30 text-xs text-[#E43D12] space-y-1">
                    <span className="font-bold">Discrepancy Note:</span>
                    <p className="text-text-primary leading-relaxed font-sans">
                      Different values were extracted across supporting filings. Reviewers must inspect the original documents to confirm whether an amendment, typographical variance, or deficiency exists.
                    </p>
                  </div>
                )}

                {/* Multi-Document Values Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                  {group.documents.map((doc, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border space-y-1.5 transition-colors ${
                        isConflict
                          ? 'border-[#E43D12]/30 bg-white'
                          : 'border-border bg-surface-secondary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-text-muted font-mono">
                        <span className="truncate max-w-[180px] font-medium text-text-secondary">
                          {doc.docName}
                        </span>
                        <span>Page {doc.pageNumber}</span>
                      </div>

                      <div className="font-mono text-xs font-bold text-text-primary break-words pt-1">
                        {doc.value}
                      </div>

                      {doc.normalized && doc.normalized !== doc.value && (
                        <div className="text-[10px] font-mono text-text-muted">
                          Normalized: <span className="text-[#E43D12] font-semibold">{doc.normalized}</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[10px] font-mono text-text-muted">
                        <span>Confidence: {((doc.confidence || 0.95) * 100).toFixed(0)}%</span>
                        <Link
                          to={`/review?app=${selectedAppId}`}
                          className="text-[#E43D12] font-semibold hover:underline flex items-center gap-0.5"
                        >
                          View Scan &rarr;
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
