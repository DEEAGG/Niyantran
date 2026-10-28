import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  Trash2,
  Play,
  Check,
  ChevronDown,
  Sparkles,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { applicationService } from '../services/applicationService';
import { documentService } from '../services/documentService';
import { extractionService } from '../services/extractionService';
import { useToast } from '../context/ToastContext';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Stepper from '../components/common/Stepper';

const CATEGORIES = [
  'Application Form',
  'Institution Registration Document',
  'Affiliation Document',
  'Approval Document',
  'Supporting Declaration',
];

export default function UploadDocuments() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const fileInputRef = useRef(null);

  const [applications, setApplications] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState(
    id || searchParams.get('app') || ''
  );
  const [existingDocs, setExistingDocs] = useState([]);
  const [filesToUpload, setFilesToUpload] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedFields, setExtractedFields] = useState([]);
  const [previewDoc, setPreviewDoc] = useState(null);

  // Load applications & existing documents
  useEffect(() => {
    const loadApps = async () => {
      try {
        const res = await applicationService.getApplications();
        const appList = res.data || [];
        setApplications(appList);
        const targetId = id || searchParams.get('app');
        if (targetId) {
          setSelectedAppId(targetId);
        } else if (appList.length > 0) {
          setSelectedAppId(appList[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadApps();
  }, [id, searchParams]);

  const loadDocuments = async () => {
    if (!selectedAppId) return;
    try {
      const res = await documentService.getDocuments(selectedAppId);
      setExistingDocs(res.data || []);
      const fieldsRes = await extractionService.getExtractedFields(selectedAppId);
      setExtractedFields(fieldsRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [selectedAppId]);

  // File drop handler
  const handleFileDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer?.files || e.target?.files || []);
    const validFiles = droppedFiles.filter((f) => {
      const ext = f.name.toLowerCase().split('.').pop();
      return ['pdf', 'png', 'jpg', 'jpeg'].includes(ext);
    });

    if (validFiles.length < droppedFiles.length) {
      addToast({
        title: 'Unsupported File Format',
        message: 'Only PDF, PNG, and JPG/JPEG documents are supported for regulatory verification.',
        type: 'warning',
      });
    }

    const formatted = validFiles.map((f, idx) => ({
      file: f,
      name: f.name,
      size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
      category: CATEGORIES[idx % CATEGORIES.length] || 'Supporting Declaration',
      progress: 0,
      status: 'Ready',
    }));

    setFilesToUpload((prev) => [...prev, ...formatted]);
  };

  const removeFile = (index) => {
    setFilesToUpload((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateCategory = (index, cat) => {
    setFilesToUpload((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, category: cat } : item))
    );
  };

  // Upload handler
  const handleUpload = async () => {
    if (filesToUpload.length === 0) return;
    if (!selectedAppId) {
      addToast({
        title: 'Target Application Required',
        message: 'Please select an existing application or register a new filing before uploading.',
        type: 'warning',
      });
      return;
    }
    try {
      setUploading(true);
      await documentService.uploadDocuments(
        selectedAppId,
        filesToUpload.map((f) => ({
          file: f.file,
          category: f.category,
        }))
      );

      addToast({
        title: 'Upload Completed',
        message: `Successfully uploaded ${filesToUpload.length} document(s) to ${selectedAppId}.`,
        type: 'success',
      });

      setFilesToUpload([]);
      loadDocuments();
    } catch (err) {
      addToast({
        title: 'Upload Error',
        message: err.message || 'Failed to upload documents',
        type: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  // Extraction trigger
  const handleTriggerExtraction = async () => {
    try {
      setExtracting(true);
      // triggerExtraction already returns persisted fields (and performs one fallback read
      // only when the batch response contains no fields), so avoid a redundant serial API call.
      const res = await extractionService.triggerExtraction(selectedAppId);
      const displayFields = res.data || [];
      setExtractedFields(displayFields);
      addToast({
        title: 'Extraction Completed',
        message: `Extracted ${displayFields.length} structured entity field(s) across application documents.`,
        type: 'success',
      });
      loadDocuments();
    } catch (err) {
      addToast({
        title: 'Extraction Failed',
        message: err.message || 'Extraction pipeline error',
        type: 'error',
      });
    } finally {
      setExtracting(false);
    }
  };

  // Confirm field handler
  const handleConfirmField = async (fieldId) => {
    try {
      await extractionService.confirmField(selectedAppId, fieldId);
      addToast({
        title: 'Field Confirmed',
        message: 'Field verified and locked for regulatory validation.',
        type: 'success',
      });
      loadDocuments();
    } catch (err) {
      console.error(err);
    }
  };

  const selectedApp = applications.find((a) => a.id === selectedAppId);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20 font-semibold">
              Document Pipeline
            </span>
            <span className="text-xs text-text-muted font-mono">&bull; ReguTrace Ingestion</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Document Ingestion & OCR Extraction
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
            Upload institutional regulatory files, assign statutory categories, and trigger automated entity extraction.
          </p>
        </div>

        {extractedFields.length > 0 && (
          <Button
            variant="primary"
            size="sm"
            icon={ArrowRight}
            iconPosition="right"
            onClick={() => navigate(`/validation?app=${selectedAppId}`)}
          >
            Proceed to Validation
          </Button>
        )}
      </div>

      {/* Target Application Selector */}
      <div className="bg-surface rounded-2xl border border-border p-4 shadow-surface flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-text-secondary font-mono uppercase shrink-0">
            Target Application:
          </label>
          <div className="relative w-full sm:w-96">
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              style={{
                backgroundColor: 'var(--surface-elevated)',
                color: 'var(--text-primary)',
              }}
              className="w-full text-text-primary px-3 py-1.5 pr-8 rounded-lg border border-border text-xs font-semibold focus:outline-none focus:border-accent appearance-none cursor-pointer"
            >
              {applications.map((app) => (
                <option
                  key={app.id}
                  value={app.id}
                  style={{ backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)' }}
                >
                  {app.id} — {app.institutionName} ({app.status})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {selectedApp && (
          <div className="text-xs font-mono text-text-muted">
            Uploaded: <span className="font-bold text-accent">{existingDocs.length}/5</span> Statutory Categories
          </div>
        )}
      </div>

      {/* Grid: Upload Dropzone & Category Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Drag & Drop Ingestion Box (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className="bg-surface rounded-2xl border-2 border-dashed border-border hover:border-accent p-8 text-center cursor-pointer transition-all hover:bg-surface-elevated/20 group"
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="application/pdf"
              onChange={handleFileDrop}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-accent mx-auto mb-3 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-6 h-6 stroke-[1.8]" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">
              Drop statutory PDF files here or <span className="text-accent underline">browse</span>
            </h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto mt-1">
              Supports multiple PDF uploads up to 25MB per document. Files are encrypted and processed by ReguTrace OCR.
            </p>
          </div>

          {/* Pending Upload Queue */}
          {filesToUpload.length > 0 && (
            <div className="bg-surface rounded-2xl border border-border p-4 shadow-surface space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs font-semibold uppercase text-text-primary font-mono">
                  Upload Queue ({filesToUpload.length})
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={uploading}
                  onClick={handleUpload}
                >
                  Upload All Files
                </Button>
              </div>

              <div className="space-y-2">
                {filesToUpload.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-surface-elevated border border-border flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1">
                      <FileText className="w-4 h-4 text-accent shrink-0" />
                      <div className="truncate">
                        <div className="font-semibold text-text-primary truncate">{item.name}</div>
                        <div className="text-[10px] text-text-muted font-mono">{item.size}</div>
                      </div>
                    </div>

                    {/* Category Selector */}
                    <div className="w-48 shrink-0">
                      <select
                        value={item.category}
                        onChange={(e) => updateCategory(idx, e.target.value)}
                        style={{
                          backgroundColor: 'var(--surface)',
                          color: 'var(--text-primary)',
                        }}
                        className="w-full text-text-primary px-2 py-1 rounded border border-border text-[11px] focus:outline-none focus:border-accent"
                      >
                        {CATEGORIES.map((cat) => (
                          <option
                            key={cat}
                            value={cat}
                            style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                          >
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => removeFile(idx)}
                      className="text-text-muted hover:text-rose-400 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Statutory Category Checklist (5 Cols) */}
        <div className="lg:col-span-5 bg-surface rounded-2xl border border-border p-5 shadow-surface space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary font-mono">
                Mandatory Statutory Checklist
              </h3>
              <p className="text-[11px] text-text-muted">Required by AICTE technical approval norms</p>
            </div>
            <span className="text-xs font-mono text-accent font-bold">
              {existingDocs.length}/5
            </span>
          </div>

          <div className="space-y-2">
            {CATEGORIES.map((cat, idx) => {
              const uploaded = existingDocs.find((d) => d.category === cat);

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                    uploaded
                      ? 'bg-emerald-950/20 border-emerald-800/30'
                      : 'bg-surface-elevated/40 border-border'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {uploaded ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-semibold text-text-primary">{cat}</div>
                      {uploaded ? (
                        <div className="text-[10px] text-text-muted font-mono">
                          {uploaded.name} ({uploaded.size})
                        </div>
                      ) : (
                        <div className="text-[10px] font-mono" style={{ color: 'var(--status-pending)' }}>
                          Pending statutory filing
                        </div>
                      )}
                    </div>
                  </div>

                  {uploaded && (
                    <button
                      onClick={() => setPreviewDoc(uploaded)}
                      className="p-1 rounded text-text-muted hover:text-accent hover:bg-surface-hover"
                      title="Preview Document"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Trigger Extraction Button */}
          <div className="pt-3 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              icon={Sparkles}
              isLoading={extracting}
              disabled={existingDocs.length === 0}
              onClick={handleTriggerExtraction}
              className="w-full"
            >
              Run ReguTrace Entity Extraction
            </Button>
          </div>
        </div>
      </div>

      {/* Extracted Fields Table */}
      {extractedFields.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-surface space-y-0">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Extracted Structured Entities
              </h3>
              <p className="text-xs text-text-muted">
                OCR and LayoutLM parsing output with confidence metrics and human-confirmation triggers.
              </p>
            </div>
            <span className="text-xs font-mono text-accent">{extractedFields.length} entities extracted</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-background border-b border-border text-[10px] font-mono uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3">Field</th>
                  <th className="px-4 py-3">Extracted Value</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-text-secondary">
                {extractedFields.map((field) => {
                  const isConflict = field.status === 'Conflict' || field.status === 'Conflicting';
                  const statusVariant = 
                    field.status === 'Supported' ? 'success' :
                    isConflict ? 'warning' :
                    field.status === 'Not Found' ? 'default' : 'info';

                  return (
                    <tr key={field.id} className="hover:bg-surface-elevated/40">
                      <td className="px-4 py-3 font-semibold text-text-primary font-sans">
                        {field.fieldName || field.field_name}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-accent">
                          {field.extractedValue || field.field_value || '—'}
                        </div>
                        <div className="text-[10px] text-text-muted font-sans font-normal mt-0.5">
                          {field.sourceDocument || field.original_filename || 'Document'} • Pg {field.pageNumber || field.page_number || 1} • {Math.round((field.confidence ?? 1) * 100)}% Evidence
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant} size="sm">
                          {field.status || 'Needs Review'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!field.isConfirmed ? (
                          <button
                            onClick={() => handleConfirmField(field.id)}
                            className="px-2.5 py-1 rounded bg-accent/15 border border-accent/30 text-[10px] font-sans font-semibold text-accent hover:bg-accent/25 transition-colors cursor-pointer"
                          >
                            Confirm
                          </button>
                        ) : (
                          <span className="text-[10px] font-sans font-semibold inline-flex items-center gap-1 text-emerald-600">
                            <Check className="w-3 h-3" /> Confirmed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <Modal
          isOpen={Boolean(previewDoc)}
          onClose={() => setPreviewDoc(null)}
          title={`Document Preview — ${previewDoc.name}`}
          subtitle={`${previewDoc.category} &bull; ${previewDoc.size} &bull; ${previewDoc.pages} Pages`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            <div className="h-80 bg-background rounded-xl border border-border p-6 flex flex-col items-center justify-center text-center font-mono text-xs">
              <FileText className="w-12 h-12 text-accent mb-3" />
              <div className="font-bold text-text-primary text-sm">{previewDoc.name}</div>
              <div className="text-text-muted mt-1">Simulated Ingested PDF View</div>
              <div className="text-[11px] text-accent mt-3 p-2 rounded bg-surface border border-border">
                SHA-256: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setPreviewDoc(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
