import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, GitCompare, Play, Check, AlertCircle, 
  Clock, ShieldCheck, ArrowRight, ChevronRight, Sparkles 
} from 'lucide-react';
import { ruleService } from '../services/ruleService';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';

export default function RuleVersions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const ruleId = id;

  const [rule, setRule] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [baseVersion, setBaseVersion] = useState('v1.0');
  const [targetVersion, setTargetVersion] = useState('v2.0');

  useEffect(() => {
    if (!ruleId) {
      setLoading(false);
      return;
    }
    const fetchRule = async () => {
      try {
        setLoading(true);
        const res = await ruleService.getRuleById(ruleId);
        setRule(res.data);
        if (res.data?.versions?.length >= 2) {
          setBaseVersion(res.data.versions[0].version);
          setTargetVersion(res.data.versions[res.data.versions.length - 1].version);
        }
      } catch (err) {
        console.error('Error fetching rule for version comparison:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRule();
  }, [ruleId]);

  if (!id) {
    return (
      <div className="p-8">
        <EmptyState
          title="No Regulatory Rule Selected"
          description="Select a rule from the Regulatory Rules Catalog to inspect version progression and parameter diffs."
          actionLabel="Go to Rules Catalog"
          onAction={() => navigate('/rules')}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!rule) {
    return (
      <EmptyState
        icon={GitCompare}
        title="Rule Not Found"
        description="Could not find regulatory rule for version comparison."
        action={{
          label: "Return to Rules",
          onClick: () => navigate('/rules')
        }}
      />
    );
  }

  const versions = rule.versions || [];
  const baseData = versions.find((v) => v.version === baseVersion) || versions[0] || {};
  const targetData = versions.find((v) => v.version === targetVersion) || versions[versions.length - 1] || {};

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Breadcrumb Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Link to="/rules" className="hover:text-text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Rules
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to={`/rules/${rule.id}`} className="hover:text-text-primary font-mono transition-colors">
            {rule.id}
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-accent">Version Comparison</span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/rules/${rule.id}`)}
          >
            Back to Specification
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Play}
            onClick={() => navigate(`/replay?ruleId=${rule.id}&oldVersion=${baseVersion}&newVersion=${targetVersion}`)}
          >
            Simulate Replay with this Diff
          </Button>
        </div>
      </div>

      {/* Hero Strip */}
      <div className="bg-surface rounded-xl p-6 sm:p-8 border border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold text-accent px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                {rule.id}
              </span>
              {rule.source_status === 'UNVERIFIED' && (
                <Badge variant="warning">UNVERIFIED CLAUSE</Badge>
              )}
              <Badge variant="info">{rule.category}</Badge>
            </div>
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              Rule Version Diff: {rule.name}
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              Visual side-by-side comparison of statutory parameters, threshold values, and enactment timelines.
            </p>
          </div>

          {/* Quick Replay Launch Callout */}
          <div className="flex items-center gap-3 bg-surface-elevated p-3 rounded-lg border border-border shrink-0">
            <Sparkles className="w-4 h-4 text-accent" />
            <div className="text-xs">
              <span className="text-text-muted block">Replay Engine Ready:</span>
              <span className="font-mono text-text-primary font-semibold">{baseVersion} → {targetVersion}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface-elevated/40 p-4 rounded-xl border border-border">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
            Base Version (Original)
          </label>
          <select
            value={baseVersion}
            onChange={(e) => setBaseVersion(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-accent"
            style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
          >
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                {v.version} (Effective {v.effectiveDate})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-accent uppercase tracking-wider block flex items-center justify-between">
            <span>Target Version (Modified / Current)</span>
            <span className="text-[10px] font-mono lowercase">shows delta</span>
          </label>
          <select
            value={targetVersion}
            onChange={(e) => setTargetVersion(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-accent/40 text-text-primary font-mono focus:outline-none focus:border-accent"
            style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
          >
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                {v.version} (Effective {v.effectiveDate})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Side-by-Side Diff Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Side: Base Version */}
        <div className="bg-surface rounded-xl p-6 border border-border space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <span className="text-xs text-text-muted font-mono block">Baseline Version</span>
              <span className="text-xl font-bold font-mono text-text-primary">{baseData.version || 'v1.0'}</span>
            </div>
            <span className="px-2.5 py-1 rounded text-xs font-mono bg-surface-elevated text-text-secondary border border-border">
              Historical Reference
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-xs font-mono text-text-muted uppercase block mb-1">Effective Date</span>
              <p className="text-sm font-mono text-text-primary">{baseData.effectiveDate || '2024-01-01'}</p>
            </div>

            <div>
              <span className="text-xs font-mono text-text-muted uppercase block mb-1">Mandated Threshold</span>
              <div className="p-3 rounded-lg bg-surface-elevated border border-border">
                <span className="text-base font-bold font-mono text-text-primary">
                  {String(baseData.threshold)}
                </span>
                <span className="text-xs text-text-muted ml-2 font-mono">
                  {rule.unit || ''}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs font-mono text-text-muted uppercase block mb-1">Enacting Authority</span>
              <p className="text-xs text-text-secondary">{baseData.author || 'AICTE Council Resolution'}</p>
            </div>

            <div>
              <span className="text-xs font-mono text-text-muted uppercase block mb-1">Change Rationale</span>
              <p className="text-xs text-text-secondary leading-relaxed bg-surface-elevated/60 p-3 rounded-lg border border-border/60">
                {baseData.changeSummary || 'Initial baseline specification.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Target Version (Highlighted Differences) */}
        <div className="bg-surface rounded-xl p-6 border border-accent/40 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <span className="text-xs text-accent font-mono block">Target Revision</span>
              <span className="text-xl font-bold font-mono text-accent">{targetData.version || 'v2.0'}</span>
            </div>
            <span className="px-2.5 py-1 rounded text-xs font-mono bg-accent/15 text-accent border border-accent/30 font-semibold">
              Active Norm
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-xs font-mono text-text-muted uppercase block mb-1">Effective Date</span>
              <p className="text-sm font-mono text-text-primary flex items-center gap-2">
                {targetData.effectiveDate || '2026-04-01'}
                {targetData.effectiveDate !== baseData.effectiveDate && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Updated Timeline
                  </span>
                )}
              </p>
            </div>

            <div>
              <span className="text-xs font-mono text-text-muted uppercase block mb-1">Mandated Threshold</span>
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-between">
                <div>
                  <span className="text-base font-bold font-mono text-accent">
                    {String(targetData.threshold)}
                  </span>
                  <span className="text-xs text-text-secondary ml-2 font-mono">
                    {rule.unit || ''}
                  </span>
                </div>
                {targetData.threshold !== baseData.threshold && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                    Modified Threshold
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs font-mono text-text-muted uppercase block mb-1">Enacting Authority</span>
              <p className="text-xs text-text-secondary">{targetData.author || 'ReguTrace Norms Committee'}</p>
            </div>

            <div>
              <span className="text-xs font-mono text-text-muted uppercase block mb-1">Change Rationale</span>
              <p className="text-xs text-text-secondary leading-relaxed bg-accent/5 p-3 rounded-lg border border-accent/20">
                {targetData.changeSummary || 'Updated regulatory threshold.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Replay Simulation Action Bar */}
      <div className="p-6 rounded-xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
            <Play className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text-primary">
              Ready to backtest this rule revision?
            </h4>
            <p className="text-xs text-text-secondary">
              Run the ReguTrace Replay Engine to detect how this diff changes approval outcomes for existing institutions.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          icon={Play}
          onClick={() => navigate(`/replay?ruleId=${rule.id}&oldVersion=${baseVersion}&newVersion=${targetVersion}`)}
        >
          Launch Cohort Replay
        </Button>
      </div>
    </div>
  );
}
