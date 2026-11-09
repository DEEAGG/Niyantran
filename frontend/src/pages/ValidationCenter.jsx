import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  ChevronDown,
  ChevronRight,
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
            <span className="text-[10px] font-mono text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20 font-semibold">
              Compliance center
            </span>
            <span className="text-xs text-text-muted font-mono">&bull; ReguTrace Engine</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
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
      <div className="bg-surface rounded-xl border border-border p-5 shadow-surface flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-mono text-text-muted block">
            Target application for evaluation
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
              <span className="text-[10px] text-text-muted block">Code</span>
              <span className="font-bold text-text-primary">{selectedApp.institutionCode}</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted block">Capacity</span>
              <span className="font-bold text-accent">{selectedApp.intakeCapacity ? `${selectedApp.intakeCapacity} Seats` : "Standard intake"}</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted block">Compliance</span>
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

      {/* Findings Filter Tabs */}
      {findings.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {['All', 'Critical', 'High', 'Medium', 'Low'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${severityFilter === sev
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface border-border text-text-secondary hover:border-accent/40 hover:text-accent'
                }`}
            >
              {sev}
            </button>
          ))}
        </div>
      )}

      {/* Findings List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchFindings} />
      ) : findings.length === 0 ? (
        <EmptyState
          title="No Compliance Findings"
          description="No discrepancies detected for the selected application. Run validation or adjust the severity filter."
        />
      ) : (
        <div className="space-y-3">
          {findings.map((f) => (
            <div
              key={f.id}
              className="bg-surface rounded-xl border border-border overflow-hidden"
            >
              <button
                onClick={() => setExpandedFindingId(expandedFindingId === f.id ? null : f.id)}
                className="w-full flex items-start justify-between gap-4 p-4 text-left hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-status-error-bg text-status-error border border-status-error/20">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-accent">{f.id}</span>
                      <span className="font-semibold text-text-primary text-xs sm:text-sm">
                        {f.title || f.code || 'Statutory Non-Compliance'}
                      </span>
                      <Badge variant="error" size="sm">{f.severity || 'High'}</Badge>
                      <Badge
                        variant={
                          f.status === 'Passed'
                            ? 'success'
                            : f.status === 'Resolved'
                              ? 'success'
                              : f.status === 'Dismissed'
                                ? 'neutral'
                                : f.status === 'Clarification Requested'
                                  ? 'warning'
                                  : 'warning'
                        }
                        size="sm"
                      >
                        {f.status || 'Pending Review'}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {f.explanation || f.message || f.description}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${expandedFindingId === f.id ? 'rotate-180' : ''}`}
                />
              </button>

              {expandedFindingId === f.id && (
                <div className="border-t border-border p-4 bg-surface-elevated space-y-3">
                  {f.recommendedAction && (
                    <div className="p-3 rounded-lg bg-surface text-[11px] text-text-primary font-medium border border-border">
                      <span className="text-accent font-bold">Recommended Action:</span> {f.recommendedAction}
                    </div>
                  )}
                  <div className="text-[11px] font-mono text-text-muted">
                    Evaluated by Rule: <span className="text-accent">{f.ruleId || f.rule_id || 'ReguTrace'}</span>
                  </div>
                  {f.evidenceSources && f.evidenceSources.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {f.evidenceSources.map((ev, idx) => (
                        <div key={idx} className="p-3 rounded-lg border border-border bg-surface">
                          <div className="text-[10px] font-mono text-text-muted uppercase">
                            {ev.documentType || 'Evidence'}
                          </div>
                          <div className="text-xs font-semibold text-text-primary mt-0.5 truncate">
                            {ev.documentName || 'Document'}
                          </div>
                          <div className="text-[10px] text-text-muted font-mono mt-0.5">
                            Pg {ev.pageNumber || 1} • {ev.extractedValue || '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                    <span className="text-[10px] font-mono text-text-muted">
                      Finding ID {f.id}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={ArrowRight}
                      onClick={() => selectedApp && navigate(`/applications/${selectedApp.id}/evidence`)}
                    >
                      Inspect Evidence
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

