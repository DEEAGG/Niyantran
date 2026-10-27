import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, GitCompare, Play, BookOpen, Clock, ShieldCheck, 
  Layers, AlertTriangle, CheckCircle2, FileText, Code2, Sparkles, 
  ChevronRight, ArrowRight
} from 'lucide-react';
import { ruleService } from '../services/ruleService';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';

export default function RuleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const ruleId = id;

  const [rule, setRule] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ruleId) {
      setLoading(false);
      return;
    }
    const fetchRule = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await ruleService.getRuleById(ruleId);
        setRule(res.data);
      } catch (err) {
        console.error('Error fetching rule details:', err);
        setError(`Rule "${ruleId}" not found in regulatory catalog.`);
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
          description="Select a rule from the Regulatory Rules Catalog to view clause provenance and historical parameters."
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
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !rule) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Regulatory Rule Not Found"
        description={error || "The requested rule could not be retrieved from the catalog."}
        action={{
          label: "Back to Rulebook",
          onClick: () => navigate('/rules')
        }}
      />
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Link to="/rules" className="hover:text-text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Rules Catalog
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-accent font-mono">{rule.id}</span>
        </div>

        <div className="flex items-center gap-3">
          {rule.versions && rule.versions.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              icon={GitCompare}
              onClick={() => navigate(`/rules/${rule.id}/versions`)}
            >
              Compare Versions ({rule.versions.length})
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={Play}
            onClick={() => navigate(`/replay?ruleId=${rule.id}`)}
          >
            Run Replay Simulator
          </Button>
        </div>
      </div>

      {/* Main Header Card */}
      <div className="bg-surface rounded-xl p-6 sm:p-8 border border-border relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm font-bold text-accent px-2.5 py-0.5 rounded bg-accent/10 border border-accent/20">
                {rule.id}
              </span>
              {rule.source_status === 'UNVERIFIED' && (
                <Badge variant="warning">UNVERIFIED CLAUSE</Badge>
              )}
              <Badge variant={rule.severity === 'Critical' ? 'danger' : rule.severity === 'High' ? 'warning' : 'info'}>
                {rule.severity} Severity
              </Badge>
              <span className="px-2.5 py-0.5 rounded text-xs bg-surface-elevated text-text-secondary border border-border">
                {rule.category}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
              {rule.name}
            </h1>

            <p className="text-sm text-text-secondary leading-relaxed max-w-3xl">
              {rule.description}
            </p>
          </div>

          <div className="bg-surface-elevated/80 rounded-xl p-4 border border-border/80 min-w-[220px] shrink-0 space-y-3">
            <div>
              <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider block">
                Active Version
              </span>
              <span className="text-lg font-bold font-mono text-text-primary">
                {rule.activeVersion}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider block">
                Statutory Status
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Legally Enforced
              </span>
            </div>
            <div>
              <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider block">
                Effective Since
              </span>
              <span className="text-xs text-text-secondary font-mono">
                {rule.effectiveDate}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Specification & Validation Logic */}
        <div className="lg:col-span-2 space-y-6">
          {/* Statutory Specification Panel */}
          <div className="bg-surface rounded-xl p-6 border border-border space-y-5">
            <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              Statutory Validation Specification
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-surface-elevated/70 border border-border/70 space-y-1">
                <span className="text-[11px] font-mono text-text-muted uppercase">Target Parameter</span>
                <p className="text-sm font-medium text-text-primary">{rule.parameter}</p>
              </div>

              <div className="p-4 rounded-lg bg-surface-elevated/70 border border-border/70 space-y-1">
                <span className="text-[11px] font-mono text-text-muted uppercase">Required Threshold</span>
                <p className="text-sm font-semibold font-mono text-accent">{rule.expectedValue || 'Strict Match'}</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Regulatory Intent & Compliance Criteria
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed bg-surface-elevated/40 p-4 rounded-lg border border-border/60">
                This rule acts as a deterministic verification gate. When documents are ingested via NIYANTRAN, 
                multimodal OCR & LayoutLM extract the statutory entities, map them to standard schema fields, 
                and execute this deterministic check against the active version threshold. Non-compliance results in 
                an evidentiary finding flagged for officer adjudication.
              </p>
            </div>
          </div>

          {/* Executable DSL Logic Representation */}
          <div className="bg-surface rounded-xl p-6 border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Code2 className="w-4 h-4 text-accent" />
                ReguTrace Declarative Engine DSL
              </h2>
              <span className="text-xs font-mono text-text-muted">DSL v2.0 • JSON</span>
            </div>

            <pre className="p-4 rounded-lg bg-black/60 border border-border/70 text-xs font-mono text-accent/90 overflow-x-auto leading-relaxed">
{JSON.stringify({
  rule_id: rule.id,
  version: rule.activeVersion,
  category: rule.category,
  severity: rule.severity,
  evaluator: "DeterministicCrossFieldMatcher",
  parameters: {
    target: rule.parameter,
    threshold: rule.expectedValue || ">= 60",
    tolerance_pct: 0.0,
    cross_document: true,
  },
  audit_trail: {
    enacted_by: "Council Resolution",
    effective_date: rule.effectiveDate,
    hash: "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
  }
}, null, 2)}
            </pre>
          </div>
        </div>

        {/* Right Column (1 Col): Version Evolution & Replay Actions */}
        <div className="space-y-6">
          {/* Version Evolution History */}
          <div className="bg-surface rounded-xl p-6 border border-border space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" />
                Version Evolution Log
              </h2>
              <span className="text-xs font-mono text-accent">
                {rule.versions ? rule.versions.length : 1} revisions
              </span>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {rule.versions && rule.versions.map((ver, idx) => {
                const isActive = ver.version === rule.activeVersion;
                return (
                  <div key={ver.version} className="relative group">
                    {/* Circle Node */}
                    <div 
                      className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 transition-colors ${
                        isActive 
                          ? 'bg-accent border-accent shadow-sm shadow-accent/50' 
                          : 'bg-surface border-text-muted/60'
                      }`} 
                    />

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-text-primary">
                          {ver.version}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-text-muted">
                        Effective: {ver.effectiveDate} • By: {ver.author}
                      </div>

                      <p className="text-xs text-text-secondary leading-relaxed bg-surface-elevated/60 p-2.5 rounded border border-border/40">
                        {ver.changeSummary}
                      </p>

                      <div className="text-[11px] text-text-muted">
                        Threshold: <strong className="text-accent font-mono">{String(ver.threshold)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {rule.versions && rule.versions.length > 1 && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  icon={GitCompare}
                  onClick={() => navigate(`/rules/${rule.id}/versions`)}
                >
                  View Side-by-Side Diff
                </Button>
              </div>
            )}
          </div>

          {/* Replay Simulation Callout Card */}
          <div className="bg-gradient-to-br from-surface to-surface-elevated rounded-xl p-6 border border-accent/20 space-y-4">
            <div className="flex items-center gap-2 text-accent">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-sm font-semibold text-text-primary">
                Simulate Rule Impact
              </h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Wondering how modifying this rule affects past applications? The <strong>ReguTrace Replay Simulator</strong> retroactively evaluates historical submissions against new threshold parameters.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="w-full text-xs"
              icon={Play}
              onClick={() => navigate(`/replay?ruleId=${rule.id}`)}
            >
              Backtest Against Cohorts
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
