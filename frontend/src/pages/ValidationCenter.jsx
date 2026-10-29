import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Layers,
  Filter,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { validationService } from '../services/validationService';
import { applicationService } from '../services/applicationService';
import { useToast } from '../context/ToastContext';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';

export default function ValidationCenter() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [applications, setApplications] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState(
    searchParams.get('app') || ''
  );
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [findings, setFindings] = useState([]);
  const [severityFilter, setSeverityFilter] = useState('All');
  const [expandedFindingId, setExpandedFindingId] = useState(null);
  const [error, setError] = useState(null);

  // Load applications list
  useEffect(() => {
    const loadApplications = async () => {
      try {
        const res = await applicationService.getApplications();
        const appList = res.data || [];
        setApplications(appList);
        if (!searchParams.get('app') && appList.length > 0) {
          setSelectedAppId(appList[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadApplications();
  }, [searchParams]);

  // Fetch validation findings for selected application
  const fetchFindings = async () => {
    if (!selectedAppId) {
      setLoading(false);
      setFindings([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await validationService.getFindings(selectedAppId, {
        severity: severityFilter,
      });
      setFindings(res.data || []);

      // Synthetic summary based on findings
      const totalChecks = 14;
      const failedChecks = res.data?.length || 0;
      setValidationResult({
        totalChecks,
        passedChecks: totalChecks - failedChecks,
        failedChecks,
        needsReview: res.data?.filter((f) => f.status === 'Pending Review').length || 0,
        activeRulebook: 'ReguTrace Technical Norms v2.0 (2026 Mandate)',
      });
    } catch (err) {
      setError(err.message || 'Failed to fetch compliance findings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAppId) {
      fetchFindings();
    }
  }, [selectedAppId, severityFilter]);

  // Run validation handler
  const handleRunValidation = async () => {
    try {
      setValidating(true);
      const res = await validationService.validateApplication(selectedAppId);
      addToast({
        title: 'Validation Completed',
        message: `Evaluated 14 automated compliance rules against ${selectedAppId}.`,
        type: 'success',
      });
      fetchFindings();
    } catch (err) {
      addToast({
        title: 'Validation Failed',
        message: err.message || 'Could not execute rulebook validation',
        type: 'error',
      });
    } finally {
      setValidating(false);
    }
  };

  const selectedApp = applications.find((a) => a.id === selectedAppId);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20 font-semibold">
              Compliance Center
            </span>
            <span className="text-xs text-text-muted font-mono">&bull; ReguTrace Engine</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Automated Regulatory Validation
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
            Execute active technical norms and cross-document verification algorithms against institutional filings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            icon={Play}
            isLoading={validating}
            onClick={handleRunValidation}
          >
            Run Validation
          </Button>
        </div>
      </div>

      {/* Target Application Selector Ribbon */}
      <div className="bg-surface rounded-2xl border border-border p-5 shadow-surface flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-text-muted block">
            Target Application for Evaluation
          </label>
          <div className="relative max-w-lg">
            <select
              value={selectedAppId}
              onChange={(e) => {
                setSelectedAppId(e.target.value);
                setExpandedFindingId(null);
              }}
              style={{
                backgroundColor: 'var(--surface-elevated)',
                color: 'var(--text-primary)',
              }}
              className="w-full text-text-primary px-3 py-2 pr-9 rounded-lg border border-border text-xs sm:text-sm font-semibold focus:outline-none focus:border-accent appearance-none cursor-pointer"
            >
              {applications.map((app) => (
                <option
                  key={app.id}
                  value={app.id}
                  style={{
                    backgroundColor: 'var(--surface-elevated)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {app.id} — {app.institutionName} ({app.status})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {selectedApp && (
          <div className="flex items-center gap-4 text-xs font-mono border-t md:border-t-0 md:border-l border-border pt-3 md:pt-0 md:pl-6 text-text-secondary">
            <div>
              <span className="text-[10px] text-text-muted uppercase block">Code</span>
              <span className="font-bold text-text-primary">{selectedApp.institutionCode}</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase block">Capacity</span>
              <span className="font-bold text-accent">{selectedApp.intakeCapacity ? `${selectedApp.intakeCapacity} Seats` : "Standard intake"}</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase block">Compliance</span>
              <Badge
                variant={
                  selectedApp.status === 'Verified'
                    ? 'success'
                    : selectedApp.status === 'Discrepancy Detected'
                    ? 'error'
                    : 'warning'
                }
                size="sm"
              >
                {selectedApp.status}
              </Badge>
            </div>
          </div>
        )}
      </div>

      {/* Validation Summary Metrics */}
      {validationResult && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <span className="text-xs text-text-secondary font-medium">Automated Checks</span>
              <div className="text-2xl font-semibold text-text-primary font-mono mt-1.5">
                {validationResult.totalChecks}
              </div>
              <div className="text-[11px] text-text-muted mt-1 truncate">
                {validationResult.activeRulebook}
              </div>
            </div>

            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <span className="text-xs text-text-secondary font-medium">Passed Checks</span>
              <div className="text-2xl font-semibold text-text-primary font-mono mt-1.5">
                {validationResult.passedChecks}
              </div>
              <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--status-success)' }} />
                <span>{Math.round((validationResult.passedChecks / validationResult.totalChecks) * 100)}% Pass Rate</span>
              </div>
            </div>

            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <span className="text-xs text-text-secondary font-medium">Failed Checks</span>
              <div className="text-2xl font-semibold text-text-primary font-mono mt-1.5">
                {validationResult.failedChecks}
              </div>
              <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--status-error)' }} />
                <span>Non-compliant criteria</span>
              </div>
            </div>

            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <span className="text-xs text-text-secondary font-medium">Needs Review</span>
              <div className="text-2xl font-semibold text-text-primary font-mono mt-1.5">
                {validationResult.needsReview}
              </div>
              <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--status-pending)' }} />
                <span>Officer adjudication queue</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Findings Table Section */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-surface">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Validation Findings & Discrepancies
            </h3>
            <p className="text-xs text-text-muted">
              Rule checks failing regulatory compliance criteria for {selectedAppId}.
            </p>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted font-mono">Severity:</span>
            <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border text-xs">
              {['All', 'Critical', 'High', 'Medium'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    severityFilter === sev
                      ? 'bg-surface-elevated text-text-primary font-bold'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchFindings} />
        ) : findings.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-text-primary">All Statutory Checks Cleared</h4>
            <p className="text-xs text-text-muted max-w-md mx-auto mt-1">
              No regulatory discrepancies were detected for application {selectedAppId} under the active {severityFilter !== 'All' ? `${severityFilter} severity` : ''} rule-set.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {findings.map((f) => {
              const isExpanded = expandedFindingId === f.id;

              return (
                <div key={f.id} className="transition-colors hover:bg-surface-elevated/30">
                  <div
                    onClick={() => setExpandedFindingId(isExpanded ? null : f.id)}
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-400 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-accent">{f.id}</span>
                          <span className="font-semibold text-text-primary text-xs sm:text-sm">{f.title}</span>
                          <Badge
                            variant={
                              f.severity === 'Critical'
                                ? 'error'
                                : f.severity === 'High'
                                ? 'warning'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {f.severity}
                          </Badge>
                        </div>
                        <div className="text-xs text-text-secondary mt-1 flex items-center gap-2 font-mono text-[11px]">
                          <span>Rule: {f.ruleId}</span>
                          <span>&bull;</span>
                          <span>Field: {f.affectedField}</span>
                          <span>&bull;</span>
                          <span className="text-amber-400">{f.status}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Link
                        to={`/applications/${selectedAppId}/evidence`}
                        onClick={(e) => e.stopPropagation()}
                        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs text-accent hover:bg-accent hover:text-accent-foreground transition-colors font-semibold"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Evidence Explorer</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      <ChevronRight
                        className={`w-4 h-4 text-text-muted transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Expandable Explanation Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 bg-background/50 border-t border-border/40 text-xs space-y-3 animate-in fade-in duration-150">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-text-muted block">
                          Detection Explanation
                        </span>
                        <p className="text-text-secondary mt-0.5 leading-relaxed">
                          {f.explanation}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {f.evidenceSources?.map((source, sIdx) => (
                          <div
                            key={sIdx}
                            className="bg-surface p-3 rounded-lg border border-border font-mono text-[11px]"
                          >
                            <span className="text-accent font-semibold block">
                              Source {sIdx + 1}: {source.documentType}
                            </span>
                            <div className="text-text-primary mt-1 font-bold">
                              Value: {source.extractedValue}
                            </div>
                            <div className="text-text-muted text-[10px] mt-0.5">
                              Doc: {source.documentName} (Page {source.pageNumber})
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 flex items-center justify-between text-[11px]">
                        <span className="text-text-muted">
                          Recommended Action:{' '}
                          <strong className="text-text-primary font-sans font-medium">
                            {f.recommendedAction}
                          </strong>
                        </span>
                        <Link
                          to={`/review`}
                          className="text-accent hover:underline font-semibold"
                        >
                          Adjudicate in Review Center &rarr;
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
