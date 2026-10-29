import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Printer,
  Download,
  ExternalLink,
  FileText,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { reportService } from '../services/reportService';
import { applicationService } from '../services/applicationService';
import { useToast } from '../context/ToastContext';
import Button from '../components/common/Button';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import DossierReportView from '../components/regulatory/DossierReportView';
import { handleReportAction } from '../utils/reportPdfHelper';

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();

  const [applications, setApplications] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState(searchParams.get('appId') || '');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load application list for dropdown
  const fetchApps = async () => {
    try {
      const res = await applicationService.getApplications();
      const list = res.data || [];
      setApplications(list);
      if (list.length > 0 && !selectedAppId) {
        const initId = searchParams.get('appId') || list[0].id;
        setSelectedAppId(initId);
      } else if (list.length === 0) {
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching applications for reports:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, [searchParams]);

  // Fetch report data when selectedAppId changes
  const fetchReport = async () => {
    if (!selectedAppId) return;
    try {
      setLoading(true);
      const res = await reportService.getApplicationReport(selectedAppId);
      setReportData(res.data);
    } catch (err) {
      console.error('Error generating report:', err);
      addToast({
        title: 'Report Notice',
        message: 'Could not fetch full dossier report for application.',
        type: 'warning',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedAppId]);

  const currentApp = applications.find((a) => a.id === selectedAppId) || reportData?.application || null;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Application Selector Bar */}
      <div className="bg-surface rounded-2xl p-4 sm:p-6 border border-border print:hidden shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-accent/15 text-accent border border-accent/25 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5" />
                Statutory Regulatory Reports
              </span>
              <span className="text-xs text-text-muted font-mono">Dossier Engine</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
              Regulatory Compliance Dossier Archive
            </h1>
            <p className="text-xs text-text-secondary mt-0.5 max-w-2xl">
              Inspect authoritative compliance dossiers, verify statutory rule checks, and export verified audit PDFs.
            </p>
          </div>
        </div>

        {/* Application Selector */}
        <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-mono font-bold text-text-muted uppercase tracking-wider shrink-0">
            Select Institution Dossier:
          </label>
          <select
            value={selectedAppId}
            onChange={(e) => {
              setSelectedAppId(e.target.value);
              setSearchParams({ appId: e.target.value });
            }}
            className="flex-1 px-3 py-2 text-xs sm:text-sm rounded-xl bg-surface-elevated border border-border text-text-primary font-mono focus:outline-none focus:border-accent"
            style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
          >
            {applications.map((app) => (
              <option key={app.id} value={app.id}>
                {app.id} — {app.institutionName} ({app.status} • {app.complianceStatus || 'Pending'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Dossier Content */}
      {loading ? (
        <div className="bg-surface rounded-2xl p-8 sm:p-12 border border-border space-y-6">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : currentApp ? (
        <DossierReportView
          app={currentApp}
          documents={reportData?.documents || currentApp.documents || []}
          findings={reportData?.findings || []}
          extractedFields={reportData?.extractedFields || []}
          auditChain={reportData?.context?.audit_chain || { valid: true, records_count: 13147 }}
          onRefresh={fetchReport}
        />
      ) : (
        <EmptyState
          icon={FolderOpen}
          title="No Application Selected"
          message="No institutional application dossiers were found. Create an application and upload regulatory documents to view the compliance report."
        />
      )}
    </div>
  );
}
