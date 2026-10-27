import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UploadCloud, 
  FileText, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Loader2,
  FileCode,
  ShieldCheck
} from 'lucide-react';
import { applicationService } from '@/services/applicationService';
import { documentService } from '@/services/documentService';
import { cn } from '@/lib/utils';

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit matching backend

const DOCUMENT_CATEGORIES = [
  'Land Title Deed',
  'Building Completion Certificate',
  'Approved Architectural Plan',
  'Fire & Safety NOC',
  'Faculty & Staff Roster',
  'Financial Audit Report',
  'General Document'
];

export default function DocumentUploadDropzone({ className = "", onUploadSuccess = null }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [institutionName, setInstitutionName] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [applicationType, setApplicationType] = useState("Technical Approval");
  const [isDragging, setIsDragging] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successApp, setSuccessApp] = useState(null);

  // Validate individual file
  const validateFile = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `File "${file.name}" has an unsupported format (.${ext}). Allowed: PDF, PNG, JPG, JPEG.`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File "${file.name}" exceeds the maximum 10 MB size limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`;
    }
    if (file.size === 0) {
      return `File "${file.name}" is empty.`;
    }
    return null;
  };

  const handleFilesAdded = (incomingFiles) => {
    setErrorMessage("");
    const newItems = [];
    const errors = [];

    Array.from(incomingFiles).forEach((file) => {
      const err = validateFile(file);
      if (err) {
        errors.push(err);
      } else {
        // Prevent exact duplicates in queue
        if (!files.some(f => f.file.name === file.name && f.file.size === file.size)) {
          newItems.push({
            file,
            id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            category: guessCategory(file.name),
          });
        }
      }
    });

    if (errors.length > 0) {
      setErrorMessage(errors.join(" "));
    }

    if (newItems.length > 0) {
      setFiles((prev) => [...prev, ...newItems]);
    }
  };

  const guessCategory = (filename) => {
    const lower = filename.toLowerCase();
    if (lower.includes('land') || lower.includes('deed') || lower.includes('khasra')) return 'Land Title Deed';
    if (lower.includes('build') || lower.includes('completion')) return 'Building Completion Certificate';
    if (lower.includes('plan') || lower.includes('arch')) return 'Approved Architectural Plan';
    if (lower.includes('fire') || lower.includes('noc')) return 'Fire & Safety NOC';
    if (lower.includes('faculty') || lower.includes('staff')) return 'Faculty & Staff Roster';
    if (lower.includes('audit') || lower.includes('finan')) return 'Financial Audit Report';
    return 'General Document';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter(f => f.id !== id));
  };

  const updateCategory = (id, newCategory) => {
    setFiles((prev) => prev.map(f => f.id === id ? { ...f, category: newCategory } : f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setErrorMessage("Please select at least one document to upload.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("Registering regulatory application record...");

    try {
      // 1. Create or register application in SQLite
      const targetInstitution = institutionName.trim() || `Institution Filing #${Date.now().toString().slice(-4)}`;
      const targetApplicant = applicantName.trim() || "Compliance Officer";

      const appPayload = {
        institutionName: targetInstitution,
        applicantName: targetApplicant,
        applicationType: applicationType,
        address: "AICTE Regional Jurisdiction, India",
        intakeCapacity: 120,
      };

      const appResponse = await applicationService.createApplication(appPayload);
      const createdApp = appResponse.data;
      const appId = createdApp.id;

      // 2. Upload documents sequentially via backend API
      setStatusMessage(`Ingesting ${files.length} document(s) & computing SHA-256 hashes...`);
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        setStatusMessage(`Processing (${i + 1}/${files.length}): ${item.file.name}...`);
        await documentService.uploadDocument(appId, item.file, item.category);
      }

      setStatusMessage("Cryptographic proof verified. Anchored in audit ledger.");
      setSuccessApp(createdApp);

      if (onUploadSuccess) {
        onUploadSuccess(createdApp);
      }

      // Smooth redirection to real application workspace
      setTimeout(() => {
        navigate(`/applications/${appId}`);
      }, 1200);

    } catch (err) {
      console.error("Upload workflow failed:", err);
      const detail = err.response?.data?.detail || err.message || "Failed to process document upload.";
      setErrorMessage(typeof detail === 'string' ? detail : JSON.stringify(detail));
      setIsSubmitting(false);
      setStatusMessage("");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div data-testid="document-upload-dropzone" className={cn("w-full rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm", className)}>
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Drop Surface */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center transition-all duration-200 select-none group",
            isDragging
              ? "border-[#E43D12] bg-[#FDF1EE] scale-[0.99] shadow-inner"
              : "border-[#E4E2DC] hover:border-[#E43D12]/60 hover:bg-[#FDF1EE]/20 bg-white"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesAdded(e.target.files);
              }
            }}
            className="hidden"
          />

          {/* Graphic Illustration Centerpiece */}
          <div className="mx-auto flex w-14 h-14 items-center justify-center rounded-2xl bg-[#FDF1EE] border border-[#E43D12]/20 text-[#E43D12] mb-3.5 shadow-sm group-hover:scale-105 transition-transform">
            <UploadCloud className="w-7 h-7 stroke-[1.8]" />
          </div>

          <h3 className="text-base sm:text-lg font-bold text-text-primary tracking-tight">
            Drop files here or browse to select
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-text-secondary max-w-md mx-auto">
            Upload institutional land title deeds, building plans, certificates, or NOC filings.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono">
            <span className="px-2.5 py-0.5 rounded-full bg-[#FDF1EE] text-[#E43D12] font-semibold border border-[#E43D12]/30">PDF</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FCF1F3] text-[#D6536D] font-semibold border border-[#D6536D]/30">PNG</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FEF9EB] text-[#B45309] font-semibold border border-[#EFB112]/40">JPG / JPEG</span>
            <span className="text-text-muted">&bull; Up to 10 MB per file</span>
          </div>
        </div>

        {/* Selected Files List */}
        {files.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-text-secondary px-1">
              <span>Selected Documents ({files.length})</span>
              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-text-muted hover:text-red-600 transition-colors"
              >
                Clear all
              </button>
            </div>

            <div className="divide-y divide-border/60 rounded-xl border border-border bg-surface-secondary/30 overflow-hidden">
              {files.map((item) => (
                <div key={item.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-accent shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">{item.file.name}</p>
                      <p className="text-[11px] text-text-muted font-mono">{formatFileSize(item.file.size)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <select
                      value={item.category}
                      onChange={(e) => updateCategory(item.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs bg-surface border border-border rounded-lg px-2.5 py-1 text-text-primary focus:outline-none focus:border-accent"
                    >
                      {DOCUMENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => removeFile(item.id)}
                      className="p-1 text-text-muted hover:text-red-600 rounded-md hover:bg-surface transition-colors"
                      aria-label="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optional Metadata Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Institution Name (Optional)
            </label>
            <input
              type="text"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              placeholder="e.g. Green Valley Institute of Technology"
              className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Application Type
            </label>
            <select
              value={applicationType}
              onChange={(e) => setApplicationType(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="Technical Approval">Technical Approval (AICTE Norms)</option>
              <option value="Affiliation Inspection">Affiliation Inspection (UGC / State Univ)</option>
              <option value="Building & Safety Verification">Building & Safety Verification</option>
              <option value="Faculty & Land Verification">Faculty & Land Verification</option>
            </select>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="flex-1 font-medium leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Status / Success Message */}
        {statusMessage && (
          <div className="p-3.5 rounded-xl border border-accent/30 bg-accent/5 text-accent text-xs flex items-center gap-2.5">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span className="font-medium">{statusMessage}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Immutable SHA-256 tamper-evident audit logging guaranteed.</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || files.length === 0}
            className={cn(
              "w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-sm",
              isSubmitting || files.length === 0
                ? "bg-border text-text-muted cursor-not-allowed"
                : "bg-accent hover:bg-accent-hover text-accent-foreground hover:shadow-md cursor-pointer active:scale-[0.98]"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Upload...</span>
              </>
            ) : (
              <>
                <span>Upload Documents</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
