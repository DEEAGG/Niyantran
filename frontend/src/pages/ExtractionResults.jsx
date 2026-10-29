import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  FileSpreadsheet, ShieldCheck, CheckCircle2, AlertTriangle, 
  ArrowRight, Search, Filter, Sparkles, Eye, FileText, Check, 
  ChevronRight, RefreshCw, Layers, Edit3
} from 'lucide-react';
import { extractionService } from '../services/extractionService';
import { applicationService } from '../services/applicationService';
import { documentService } from '../services/documentService';
import { useToast } from '../context/ToastContext';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';

export default function ExtractionResults() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryApp = searchParams.get('app');
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [applications, setApplications] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState(id || queryApp || '');
  const [appDocs, setAppDocs] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Correction state
  const [editingField, setEditingField] = useState(null);
  const [correctedValue, setCorrectedValue] = useState('');
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);

  // Load applications
  useEffect(() => {
    const fetchApps = async () => {
      try {
        const res = await applicationService.getApplications();
        const appList = res.data || [];
        setApplications(appList);
        if (queryApp) {
          setSelectedAppId(queryApp);
        } else if (!id && appList.length > 0) {
          const initialApp = appList.find(a => (a.institution_name && a.institution_name.includes('ADGIPS')) || a.id === 'APP-E1CA4CCA9DC2') || appList[0];
          setSelectedAppId(initialApp ? initialApp.id : appList[0].id);
        }
      } catch (err) {
        console.error('Error fetching applications:', err);
      }
    };
    fetchApps();
  }, [id, queryApp]);

  // Load extracted fields
  const fetchFields = async () => {
    if (!selectedAppId) {
      setLoading(false);
      setFields([]);
      setAppDocs([]);
      return;
    }
    try {
      setLoading(true);
      const [fieldsRes, docsRes] = await Promise.all([
        extractionService.getExtractedFields(selectedAppId).catch(() => ({ data: [] })),
        documentService.getDocuments(selectedAppId).catch(() => ({ data: [] })),
      ]);
      setFields(fieldsRes.data || []);
      setAppDocs(docsRes.data || []);
    } catch (err) {
      console.error('Error fetching extracted fields:', err);
      addToast('Failed to load extracted fields.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, [selectedAppId]);

  const handleConfirmField = async (fieldId) => {
    try {
      await extractionService.confirmField(selectedAppId, fieldId);
      addToast('Field manually confirmed and stamped.', 'success');
      fetchFields();
    } catch (err) {
      console.error('Confirm field error:', err);
      addToast('Error confirming field.', 'error');
    }
  };

  const handleOpenEdit = (field) => {
    setEditingField(field);
    setCorrectedValue(field.extractedValue || '');
  };

  const handleSaveCorrection = async (e) => {
    if (e) e.preventDefault();
    if (!editingField) return;
    try {
      setIsSavingCorrection(true);
      await extractionService.updateField(editingField.id, {
        fieldValue: correctedValue,
        confirmed: true,
      });
      addToast('Extracted field value corrected and confirmed.', 'success');
      setEditingField(null);
      fetchFields();
    } catch (err) {
      console.error('Correction save error:', err);
      addToast(err.message || 'Error updating field value.', 'error');
    } finally {
      setIsSavingCorrection(false);
    }
  };

  const handleTriggerReExtraction = async () => {
    try {
      setIsExtracting(true);
      await extractionService.triggerExtraction(selectedAppId);
      addToast('Re-extraction completed with refreshed OCR vectors.', 'success');
      fetchFields();
    } catch (err) {
      console.error('Extraction trigger error:', err);
      addToast('Error executing extraction.', 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  const filteredFields = fields.filter((f) => {
    if (filterStatus !== 'All' && f.status !== filterStatus) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        f.fieldName.toLowerCase().includes(q) ||
        String(f.extractedValue).toLowerCase().includes(q) ||
        f.sourceDocument.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner / Hero */}
      <div className="bg-surface rounded-xl p-6 sm:p-8 border border-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-accent/15 text-accent border border-accent/25 flex items-center gap-1.5 font-semibold">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                PyMuPDF & Tesseract Pattern Extractor
              </span>
              <span className="text-xs text-text-muted font-mono">Multimodal Extraction Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
              Extracted Statutory Entities
            </h1>
            <p className="text-sm text-text-secondary mt-1.5 max-w-2xl leading-relaxed">
              Structured key-value entities, institutional identifiers, and quantitative values extracted from ingested PDF documents with confidence metrics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              isLoading={isExtracting}
              onClick={handleTriggerReExtraction}
            >
              Re-Run Extraction
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={ShieldCheck}
              onClick={() => navigate('/validation')}
            >
              Execute Validation
            </Button>
          </div>
        </div>

        {/* Application Selector */}
        <div className="pt-6 mt-6 border-t border-border/70 flex flex-col sm:flex-row sm:items-center gap-4">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider shrink-0">
            Current Application:
          </label>
          <select
            value={selectedAppId}
            onChange={(e) => {
              setSelectedAppId(e.target.value);
              setSearchParams({ app: e.target.value });
            }}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-surface-elevated border border-border text-text-primary font-mono focus:outline-none focus:border-accent"
            style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
          >
            {applications.map((app) => (
              <option key={app.id} value={app.id}>
                {app.id} — {app.institutionName} ({app.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Context-Aware Document Intelligence Banner */}
      {appDocs.some(d => (d.name || d.original_filename || '').toLowerCase().includes('lecture') || (d.name || d.original_filename || '').toLowerCase().includes('notes')) && (
        <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-text-secondary flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="text-text-primary block font-semibold">Context-Aware Ingestion Active:</strong>
            <p>
              Uploaded application files include Academic Coursework / Lecture Notes (e.g. <em>OOPS in Java</em>). NIYANTRAN extracts only verified content supported by the document type and does not force or fabricate unrelated regulatory entities (institution name, land area, registration number).
            </p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search field name, extracted text, or document..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
            style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
          >
            <option value="All">All Verification Statuses</option>
            <option value="Needs Review">Needs Review</option>
            <option value="Supported">Supported</option>
            <option value="Conflict">Conflict</option>
            <option value="Not Found">Not Found</option>
          </select>
        </div>
      </div>

      {/* Entities Table - Simplified 4 Columns: Field | Extracted Value | Verification | Action */}
      {loading ? (
        <div className="bg-surface rounded-xl p-8 border border-border space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : filteredFields.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No extracted entities found"
          description="Either no documents have been processed for this application, or your search filter yielded 0 results."
          action={{
            label: "Trigger Extraction",
            onClick: handleTriggerReExtraction
          }}
        />
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-elevated text-text-muted font-mono uppercase text-[11px] border-b border-border">
                  <th className="py-3.5 px-4 font-bold">Field</th>
                  <th className="py-3.5 px-4 font-bold">Extracted Value</th>
                  <th className="py-3.5 px-4 font-bold">Verification</th>
                  <th className="py-3.5 px-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredFields.map((f) => {
                  const isConflict = f.status === 'Conflict' || f.status === 'Conflicting';
                  const statusVariant = 
                    f.status === 'Supported' ? 'success' :
                    isConflict ? 'warning' :
                    f.status === 'Not Found' ? 'default' : 'info';

                  return (
                    <tr 
                      key={f.id}
                      className={`hover:bg-surface-elevated/40 transition-colors ${
                        isConflict ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-semibold text-text-primary text-xs">
                        {f.fieldName}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-accent text-xs">
                          {f.extractedValue || 'Not found'}
                        </div>
                        <div className="text-[10px] text-text-muted font-sans mt-0.5">
                          {f.sourceDocument} • Page {f.pageNumber} • {Math.round((f.confidence || 0.9) * 100)}% Evidence
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={statusVariant}>
                          {f.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[11px] py-1 px-2.5 text-text-secondary hover:text-text-primary"
                            onClick={() => handleOpenEdit(f)}
                          >
                            <Edit3 className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          {f.isConfirmed ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Confirmed
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[11px] py-1 px-2.5 font-semibold text-accent border-accent/30 hover:bg-accent/10"
                              onClick={() => handleConfirmField(f.id)}
                            >
                              Confirm
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reviewer Correction Modal */}
      {editingField && (
        <Modal
          isOpen={Boolean(editingField)}
          onClose={() => setEditingField(null)}
          title="Correct Extracted Field Value"
        >
          <form onSubmit={handleSaveCorrection} className="space-y-4 text-xs">
            <div>
              <span className="text-text-muted font-mono uppercase text-[10px] block">Field Attribute:</span>
              <strong className="text-text-primary text-sm font-semibold">{editingField.fieldName}</strong>
            </div>

            <div className="p-3 rounded-lg bg-surface-secondary text-text-secondary font-mono text-xs">
              <span className="text-[10px] text-text-muted block uppercase">Original Extracted Text:</span>
              <span className="text-text-primary font-bold">{editingField.extractedValue}</span>
              <span className="block text-[10px] text-text-muted mt-1">Source: {editingField.sourceDocument} (Page {editingField.pageNumber})</span>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-text-primary block">
                Corrected Value:
              </label>
              <input
                type="text"
                value={correctedValue}
                onChange={(e) => setCorrectedValue(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary font-mono focus:outline-none focus:border-accent"
                required
                autoFocus
              />
              <p className="text-[11px] text-text-muted">
                Saving will normalize the value, record your correction, and log an entry into the tamper-evident audit ledger.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setEditingField(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={isSavingCorrection}
              >
                Save &amp; Confirm Correction
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
