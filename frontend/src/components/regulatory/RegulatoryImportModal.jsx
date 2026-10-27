import React, { useState } from 'react';
import {
  UploadCloud,
  Globe,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Info,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { regulatoryService } from '../../services/regulatoryService';
import { useToast } from '../../context/ToastContext';

export default function RegulatoryImportModal({ isOpen, onClose, onImportSuccess }) {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'url'
  const [submitting, setSubmitting] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);

  // Manual Upload Form State
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Handbook');
  const [issuingAuthority, setIssuingAuthority] = useState('All India Council for Technical Education (AICTE)');
  const [version, setVersion] = useState('2024-2027');
  const [effectiveDate, setEffectiveDate] = useState('2024-04-01');
  const [sourceUrl, setSourceUrl] = useState('');

  // Fetch URL Form State
  const [fetchUrl, setFetchUrl] = useState('https://www.aicte.gov.in/sites/default/files/APH%20Final.pdf');
  const [fetchTitle, setFetchTitle] = useState('AICTE Approval Process Handbook (APH) 2024-2027');
  const [fetchCategory, setFetchCategory] = useState('Handbook');
  const [fetchAuthority, setFetchAuthority] = useState('AICTE');
  const [fetchVersion, setFetchVersion] = useState('2024-2027');
  const [fetchEffectiveDate, setFetchEffectiveDate] = useState('2024-04-01');

  const categories = [
    'Handbook',
    'Circular',
    'Gazette Notification',
    'Statutory Regulation',
    'Addendum / Corrigendum',
    'Executive Order'
  ];

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.toLowerCase().endsWith('.pdf')) {
        setErrorDetails('Only valid PDF documents (.pdf) can be ingested into the regulatory registry.');
        return;
      }
      setFile(selected);
      setErrorDetails(null);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorDetails('Please select a PDF file to upload.');
      return;
    }
    if (!title.trim()) {
      setErrorDetails('Document title is required.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorDetails(null);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('category', category);
      formData.append('issuing_authority', issuingAuthority);
      formData.append('version', version);
      formData.append('effective_date', effectiveDate);
      if (sourceUrl) formData.append('source_url', sourceUrl);

      const res = await regulatoryService.uploadSource(formData);
      addToast({
        title: 'Document Ingested Successfully',
        message: `${res.title} ingested with ${res.clauses_extracted} clauses extracted.`,
        type: 'success'
      });
      if (onImportSuccess) onImportSuccess(res);
      onClose();
    } catch (err) {
      console.error('Upload failed:', err);
      const msg = err.message || 'Failed to ingest regulatory document.';
      setErrorDetails(msg);
      addToast({
        title: 'Ingestion Error',
        message: msg,
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!fetchUrl.trim()) {
      setErrorDetails('Please specify a valid official source URL.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorDetails(null);
      const payload = {
        url: fetchUrl.trim(),
        title: fetchTitle.trim() || undefined,
        category: fetchCategory,
        issuing_authority: fetchAuthority,
        version: fetchVersion,
        effective_date: fetchEffectiveDate
      };

      const res = await regulatoryService.fetchSourceUrl(payload);
      addToast({
        title: 'Remote Instrument Ingested',
        message: `${res.title} fetched and ingested with ${res.clauses_extracted} clauses.`,
        type: 'success'
      });
      if (onImportSuccess) onImportSuccess(res);
      onClose();
    } catch (err) {
      console.error('Fetch failed:', err);
      const msg = err.message || 'Failed to fetch remote document.';
      setErrorDetails(msg);
      addToast({
        title: 'Official URL Unavailable',
        message: msg,
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
      title="Import Official Regulatory Instrument"
      subtitle="Ingest statutory handbooks, circulars, or gazettes into the verifiable ReguTrace knowledge base."
      maxWidth="max-w-2xl"
    >
      <div className="p-6 space-y-6">
        {/* Method Selector Tabs */}
        <div className="flex border-b border-border gap-4">
          <button
            type="button"
            onClick={() => { setActiveTab('upload'); setErrorDetails(null); }}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-[#E43D12] text-[#E43D12]'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Safe Manual PDF Ingestion (Recommended)
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('url'); setErrorDetails(null); }}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'url'
                ? 'border-[#E43D12] text-[#E43D12]'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Globe className="w-4 h-4" />
            Official Portal Crawler (URL Fetch)
          </button>
        </div>

        {/* Tab 1: Safe Manual Upload */}
        {activeTab === 'upload' && (
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-xl p-5 text-center bg-[#FDFBF7] hover:bg-[#F9F7F1] transition-colors relative cursor-pointer">
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-[#FDF1EE] text-[#E43D12] flex items-center justify-center">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-text-primary">
                    {file ? file.name : 'Click to select or drag & drop AICTE PDF handbook / circular'}
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB • Ready for text extraction` : 'Maximum file size: 50MB • Cryptographic SHA-256 computed on ingestion'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Document Title <span className="text-[#E43D12]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. AICTE Approval Process Handbook 2024-2027"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Issuing Authority <span className="text-[#E43D12]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={issuingAuthority}
                  onChange={(e) => setIssuingAuthority(e.target.value)}
                  placeholder="e.g. AICTE"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Instrument Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Regulatory Version
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="e.g. 2024-2027 or v1.0"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Effective Date
                </label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Official Origin URL (Optional)
                </label>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://www.aicte.gov.in/..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
                />
              </div>
            </div>

            {errorDetails && (
              <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#CE2C31]/30 flex items-start gap-2 text-xs text-[#CE2C31]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorDetails}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting || !file}>
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Extracting Clauses & Ingesting...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                    Ingest Regulatory Instrument
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Tab 2: URL Fetch */}
        {activeTab === 'url' && (
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#FEF9EB] border border-[#EFB112]/40 text-xs text-[#B45309] space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-4 h-4" />
                <span>Government Portal Availability Notice</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Official government servers (such as <code>aicte.gov.in</code>) frequently block automated crawlers or experience 502 Bad Gateway outages. If the remote request fails, simply switch to <strong>Safe Manual PDF Ingestion</strong> tab to upload your saved PDF copy.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Official Portal Document URL <span className="text-[#E43D12]">*</span>
              </label>
              <input
                type="url"
                required
                value={fetchUrl}
                onChange={(e) => setFetchUrl(e.target.value)}
                placeholder="https://www.aicte.gov.in/sites/default/files/APH%20Final.pdf"
                className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12] font-mono"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Instrument Title
                </label>
                <input
                  type="text"
                  value={fetchTitle}
                  onChange={(e) => setFetchTitle(e.target.value)}
                  placeholder="AICTE Approval Process Handbook"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Category
                </label>
                <select
                  value={fetchCategory}
                  onChange={(e) => setFetchCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Issuing Authority
                </label>
                <input
                  type="text"
                  value={fetchAuthority}
                  onChange={(e) => setFetchAuthority(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Regulatory Version
                </label>
                <input
                  type="text"
                  value={fetchVersion}
                  onChange={(e) => setFetchVersion(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-[#E43D12]"
                />
              </div>
            </div>

            {errorDetails && (
              <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#CE2C31]/30 text-xs text-[#CE2C31] space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorDetails}</span>
                </div>
                <div className="pt-2 border-t border-[#CE2C31]/20">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('upload'); setErrorDetails(null); }}
                    className="text-xs font-semibold text-[#E43D12] hover:underline flex items-center gap-1"
                  >
                    Switch to Safe Manual PDF Ingestion instead <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting || !fetchUrl}>
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Connecting to Government Portal...
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5 mr-1.5" />
                    Fetch & Extract Remote Instrument
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
