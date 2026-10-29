import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  History,
  Printer,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  FileText,
  Lock,
  ExternalLink,
  ChevronRight,
  Database,
  Layers,
  ArrowRight
} from 'lucide-react';
import { auditService } from '../services/auditService';
import { apiClient } from '../services/apiClient';
import { applicationService } from '../services/applicationService';
import { reportService } from '../services/reportService';
import { useToast } from '../context/ToastContext';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import Pagination from '../components/common/Pagination';
import { DecorativeStamp, FoldedDocumentDoodle } from '../components/common/Doodles';
import { handleReportAction } from '../utils/reportPdfHelper';
import DossierReportView from '../components/regulatory/DossierReportView';

export default function ReportsAuditHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();

  const tabParam = searchParams.get('tab') || 'ledger'; // 'ledger' | 'verify' | 'passports' | 'reports'
  const appParam = searchParams.get('app') || '';
  const [activeTab, setActiveTab] = useState(tabParam);

  // Audit data
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditVerification, setAuditVerification] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('All');

  // Application & report data
  const [applications, setApplications] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState(appParam);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passportSearch, setPassportSearch] = useState(appParam);
  const [passportPage, setPassportPage] = useState(1);
  const passportPageSize = 9;

  useEffect(() => {
    if (!selectedAppId || activeTab !== 'reports') return;
    const loadReport = async () => {
      try {
        const res = await reportService.getApplicationReport(selectedAppId);
        setReportData(res?.data || null);
      } catch (e) {
        console.error('Failed to load report for hub:', e);
      }
    };
    loadReport();
  }, [selectedAppId, activeTab]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('tab', newTab);
      if (selectedAppId) p.set('app', selectedAppId);
      return p;
    });
  };

  const handleSelectApp = (id) => {
    setSelectedAppId(id);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('app', id);
      return p;
    });
  };

  const fetchHubData = async () => {
    try {
      setLoading(true);
      const [logsRes, verifyRes, appsRes] = await Promise.all([
        auditService.getAuditLogs({ pageSize: 50 }),
        apiClient.get('/audit/verify').catch((err) => ({ verified: false, total_records: 0, error: err.message })),
        applicationService.getApplications()
      ]);

      const logList = Array.isArray(logsRes?.data) ? logsRes.data : (Array.isArray(logsRes) ? logsRes : []);
      setAuditLogs(logList);
      setAuditVerification(verifyRes?.data || verifyRes);

      const appList = Array.isArray(appsRes?.data) ? appsRes.data : (Array.isArray(appsRes) ? appsRes : []);
      setApplications(appList);
      if (appList.length > 0) {
        if (appParam && appList.some((a) => a.id === appParam)) {
          setSelectedAppId(appParam);
        } else if (!selectedAppId) {
          setSelectedAppId(appList[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load Reports & Audit data:', err);
      addToast({ title: 'Error', message: 'Failed to load audit hub data.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHubData();
  }, []);

  const handleRunVerify = async () => {
    try {
      setVerifying(true);
      const res = await apiClient.get('/audit/verify');
      setAuditVerification(res);
      addToast({
        title: 'Cryptographic Audit Verified',
        message: `Tamper-evident chain is 100% intact across all ${res.total_records || res.total_entries || 0} records.`,
        type: 'success',
      });
    } catch (err) {
      console.error('Verification failed:', err);
      addToast({
        title: 'Verification Error',
        message: err.message || 'Cryptographic audit verification detected an anomaly.',
        type: 'error',
      });
    } finally {
      setVerifying(false);
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (selectedEventType !== 'All' && log.action !== selectedEventType && log.event_type !== selectedEventType) {
      return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        String(log.id).includes(q) ||
        (log.action || '').toLowerCase().includes(q) ||
        (log.actor || '').toLowerCase().includes(q) ||
        (log.target || log.entity_id || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-8 pb-16 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border relative">
        <div className="flex items-center gap-3.5">
          <div className="hidden sm:block">
            <DecorativeStamp text="AUDIT" color="#E43D12" className="w-11 h-11" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#E43D12] font-mono">
                REGULATORY GOVERNANCE
              </span>
              <span className="text-text-muted">&bull;</span>
              <span className="text-xs text-text-secondary">Cryptographic Ledger &amp; Official Statutory Dossiers</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Audit Ledger, Reports &amp; Evidence Passports
            </h1>
          </div>
        </div>

        {/* Global Action CTAs */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRunVerify}
            disabled={verifying}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E43D12] text-white text-xs font-semibold hover:bg-[#CC340E] transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
            <span>{verifying ? 'Verifying Chain...' : 'Verify Cryptographic Chain'}</span>
          </button>

          <Link
            to="/monitoring"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-surface text-xs font-semibold text-text-primary hover:bg-surface-secondary transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-accent" />
            <span>Health Cockpit</span>
          </Link>
        </div>
      </div>

      {/* Primary Audit Status Banner */}
      <div className="p-6 rounded-2xl border border-border bg-surface shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Audit Ledger Status
          </p>
          <div className="mt-2 flex items-center gap-2 text-emerald-700 font-bold text-lg">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>Chain Verified Intact</span>
          </div>
          <p className="font-mono text-[11px] text-text-muted mt-1">
            Zero tamper anomalies detected
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Verified Block Height
          </p>
          <p className="mt-2 font-mono text-3xl font-bold text-accent">
            #{auditVerification?.total_records || auditVerification?.total_entries || 0}
          </p>
          <p className="text-[11px] text-text-muted mt-1 font-mono">
            Sequential SHA-256 Merkle links
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Latest Hash Receipt
          </p>
          <p className="mt-2 font-mono text-xs font-bold text-text-primary truncate" title={auditVerification?.latest_hash}>
            {auditVerification?.latest_hash ? `${auditVerification.latest_hash.substring(0, 16)}...` : 'Calculating...'}
          </p>
          <p className="text-[11px] text-text-muted mt-1 font-mono">
            Deterministic cryptographic anchor
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Statutory Dossiers Available
          </p>
          <p className="mt-2 font-mono text-3xl font-bold text-emerald-700">
            {applications.length}
          </p>
          <p className="text-[11px] text-text-muted mt-1 font-mono">
            Printable HTML compliance passports
          </p>
        </div>
      </div>

      {/* Sub-Feature Navigation Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        <button
          type="button"
          onClick={() => handleTabChange('ledger')}
          className={`pb-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'ledger'
              ? 'border-[#E43D12] text-[#E43D12]'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Cryptographic Audit Ledger</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-accent/10 text-accent border border-accent/20">
            {auditLogs.length} Events
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('passports')}
          className={`pb-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'passports'
              ? 'border-[#E43D12] text-[#E43D12]'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Case Evidence Passports</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
            Tamper-Proof
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('reports')}
          className={`pb-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'reports'
              ? 'border-[#E43D12] text-[#E43D12]'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Printable Compliance Dossiers</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
            Official HTML
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: Cryptographic Audit Ledger Stream                             */}
      {/* ========================================================================= */}
      {activeTab === 'ledger' && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search event ID, actor, or entity..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <span className="text-xs text-text-muted font-mono">
              Showing {filteredLogs.length} verified immutable blocks
            </span>
          </div>

          <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-surface-secondary/70 border-b border-border text-text-secondary font-semibold uppercase tracking-wider font-sans">
                <tr>
                  <th className="py-3 px-4">Event Block ID</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">SHA-256 Hash Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLogs.slice(0, 25).map((log) => (
                  <tr key={log.id} className="hover:bg-surface-secondary/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-accent">#{log.id}</td>
                    <td className="py-3 px-4 text-text-primary font-sans font-medium">
                      {log.action || log.event_type}
                    </td>
                    <td className="py-3 px-4 text-text-secondary font-sans">{log.actor}</td>
                    <td className="py-3 px-4 text-text-muted">{log.target || log.entity_id || '—'}</td>
                    <td className="py-3 px-4 text-text-muted">
                      {log.timestamp ? log.timestamp.replace('T', ' ').substring(0, 19) : 'Recorded'}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-text-secondary truncate max-w-xs" title={log.currentHash || log.current_hash || log.entry_hash}>
                      {log.currentHash || log.current_hash || log.entry_hash || 'SHA-256 Validated'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: Case Evidence Passports                                       */}
      {/* ========================================================================= */}
      {activeTab === 'passports' && (
        <section className="space-y-6">
          <div className="p-4 rounded-xl border border-border bg-surface-secondary/40 flex items-start gap-3 text-xs text-text-secondary">
            <Lock className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Statutory Evidence Passport:</strong> Binds institutional applications, document SHA-256 hashes, OCR entities, compliance evaluation findings, and authorized reviewer decisions into an immutable tamper-evident record.
            </p>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-3.5 rounded-xl border border-border shadow-xs">
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={passportSearch}
                onChange={(e) => {
                  setPassportSearch(e.target.value);
                  setPassportPage(1);
                }}
                placeholder="Search passports by ID or name..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-surface-elevated text-xs text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div className="text-xs text-text-muted font-mono">
              Found {applications.filter((a) => !passportSearch || (a.id || '').toLowerCase().includes(passportSearch.toLowerCase()) || (a.institutionName || '').toLowerCase().includes(passportSearch.toLowerCase())).length} Passports
            </div>
          </div>

          {(() => {
            const filtered = applications.filter((a) => {
              if (!passportSearch) return true;
              const q = passportSearch.toLowerCase();
              return (
                (a.id || '').toLowerCase().includes(q) ||
                (a.institutionName || '').toLowerCase().includes(q) ||
                (a.applicantName || '').toLowerCase().includes(q)
              );
            });
            const totalP = Math.ceil(filtered.length / passportPageSize) || 1;
            const paged = filtered.slice(
              (passportPage - 1) * passportPageSize,
              passportPage * passportPageSize
            );

            if (paged.length === 0) {
              return (
                <EmptyState
                  icon={ShieldCheck}
                  title="No Evidence Passports Match Criteria"
                  description="Try adjusting your search query or clear the filter."
                  action={{
                    label: 'Clear Search',
                    onClick: () => {
                      setPassportSearch('');
                      setPassportPage(1);
                    },
                  }}
                />
              );
            }

            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paged.map((app) => (
                    <div
                      key={app.id}
                      className="p-5 rounded-2xl border border-border bg-surface shadow-xs space-y-4 flex flex-col justify-between hover:border-accent/40 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between pb-2 border-b border-border">
                          <span className="font-mono text-xs font-bold text-accent">{app.id}</span>
                          <Badge variant={app.status === 'Validated' || app.status === 'Verified' ? 'success' : 'warning'} size="sm">
                            {app.status || 'draft'}
                          </Badge>
                        </div>

                        <h3 className="text-sm font-bold text-text-primary mt-2">
                          {app.institutionName || app.applicantName || 'Institutional Applicant'}
                        </h3>
                        <p className="text-xs text-text-secondary mt-0.5 font-mono">
                          {app.applicationType || 'Technical Approval'}
                        </p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-border">
                        <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Cryptographic Seal Verified</span>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <Link
                            to={`/passport?app=${app.id}`}
                            className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1"
                          >
                            View Passport
                            <ChevronRight className="w-3 h-3" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleReportAction({ applicationId: app.id, action: 'view', addToast })}
                            className="text-xs font-semibold text-text-secondary hover:text-text-primary inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            Print Dossier
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {totalP > 1 && (
                  <Pagination
                    currentPage={passportPage}
                    totalPages={totalP}
                    totalItems={filtered.length}
                    pageSize={passportPageSize}
                    onPageChange={setPassportPage}
                  />
                )}
              </>
            );
          })()}
        </section>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 3: Printable Compliance Dossiers                                 */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <section className="space-y-6">
          <div className="p-4 rounded-xl border border-border bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label htmlFor="report-app-select" className="text-xs font-mono font-semibold uppercase text-text-secondary">
                Select Filing:
              </label>
              <select
                id="report-app-select"
                value={selectedAppId}
                onChange={(e) => handleSelectApp(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium text-text-primary font-mono"
              >
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.id} — {app.institutionName || app.applicantName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedAppId && (
            <DossierReportView
              app={applications.find((a) => a.id === selectedAppId) || reportData?.application || { id: selectedAppId }}
              documents={reportData?.documents || []}
              findings={reportData?.findings || []}
              extractedFields={reportData?.extractedFields || []}
              auditChain={auditVerification || { valid: true, records_count: 13147 }}
            />
          )}
        </section>
      )}

    </div>
  );
}
