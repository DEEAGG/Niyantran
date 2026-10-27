import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  BookOpen, Search, GitCompare, History, Plus, Play, 
  ArrowRight, ShieldCheck, Layers, AlertTriangle, CheckCircle2, 
  Clock, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import { ruleService } from '../services/ruleService';
import { useToast } from '../context/ToastContext';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';

export default function Rules() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSeverity, setSelectedSeverity] = useState('All');

  // Modal for creating a new demonstration rule version
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetRuleId, setTargetRuleId] = useState('');
  const [newVersion, setNewVersion] = useState('v2.1-draft');
  const [newThreshold, setNewThreshold] = useState('75');
  const [changeSummary, setChangeSummary] = useState('Proposal: Increase minimum intake threshold from 60 to 75 seats for high-density metropolitan zones.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await ruleService.getRules({
        search,
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
      });
      const ruleList = res.data || [];
      setRules(ruleList);
      if (!targetRuleId && ruleList.length > 0) {
        setTargetRuleId(ruleList[0].id || ruleList[0].rule_key);
      }
    } catch (err) {
      console.error('Error fetching rules:', err);
      addToast('Failed to load regulatory rules.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [search, selectedCategory]);

  const categories = ['All', 'Institutional Identity', 'Academic Threshold', 'Academic Norms', 'Statutory Documentation', 'Legal Governance', 'Infrastructure'];

  const filteredRules = rules.filter((r) => {
    if (selectedSeverity !== 'All' && r.severity !== selectedSeverity) return false;
    return true;
  });

  const handleCreateVersion = async (e) => {
    e.preventDefault();
    if (!targetRuleId || !newVersion || !changeSummary) {
      addToast('Please fill out all required fields.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      await ruleService.createRuleVersion(targetRuleId, {
        version: newVersion,
        effectiveDate: new Date().toISOString().split('T')[0],
        changeSummary,
        threshold: newThreshold,
        author: 'Council Policy Draft'
      });
      addToast(`New rule version ${newVersion} created successfully for ${targetRuleId}.`, 'success');
      setIsModalOpen(false);
      fetchRules();
    } catch (err) {
      console.error('Failed to create version:', err);
      addToast('Error creating new rule version.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner / Hero */}
      <div className="bg-surface rounded-xl p-6 sm:p-8 border border-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-accent/15 text-accent border border-accent/25 flex items-center gap-1.5">
                <BookOpen className="w-3 h-3" />
                AICTE APH 2026-27 Rulebook
              </span>
              <span className="text-xs text-text-muted font-mono">ReguTrace Engine v2.0 Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
              Regulatory Rule Registry
            </h1>
            <p className="text-sm text-text-secondary mt-1.5 max-w-2xl leading-relaxed">
              Formalized regulatory rules, quantitative approval thresholds, multi-document cross-validation logic, and temporal change tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/intelligence?tab=registry"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E43D12]/30 bg-[#FDF1EE] text-xs font-semibold text-[#E43D12] hover:bg-[#FCE3DC] transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Source Handbooks & Ingestion</span>
            </Link>
            <Button
              variant="outline"
              size="sm"
              icon={Plus}
              onClick={() => setIsModalOpen(true)}
            >
              Propose Rule Revision
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Play}
              onClick={() => navigate('/replay')}
            >
              Launch Replay Simulator
            </Button>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-border/60">
          <div>
            <span className="text-xs text-text-muted block">Enforced Rules</span>
            <span className="text-xl font-bold font-mono text-text-primary mt-0.5 block">{rules.length} Active Norms</span>
          </div>
          <div>
            <span className="text-xs text-text-muted block">Active Version</span>
            <span className="text-xl font-bold font-mono text-accent mt-0.5 block">APH-2026-v2.0</span>
          </div>
          <div>
            <span className="text-xs text-text-muted block">Multi-Doc Cross Checks</span>
            <span className="text-xl font-bold font-mono text-text-primary mt-0.5 block">100% Automated</span>
          </div>
          <div>
            <span className="text-xs text-text-muted block">Replay Engine</span>
            <span className="text-xl font-bold font-mono mt-0.5 block" style={{ color: 'var(--status-success)' }}>Continuous Sync</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rule ID, title, keyword or parameter..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-muted" />
              <span className="text-xs text-text-muted">Severity:</span>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
                style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
              >
                <option value="All">All Severities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-accent text-background font-semibold shadow-sm'
                  : 'bg-surface hover:bg-surface-elevated text-text-secondary border border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Rules List Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="bg-surface rounded-xl p-6 border border-border space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : filteredRules.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No regulatory rules found"
          description="No rules match your active search terms or category filters."
          action={{
            label: "Clear Filters",
            onClick: () => { setSearch(''); setSelectedCategory('All'); setSelectedSeverity('All'); }
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredRules.map((rule) => {
            const isFlagship = rule.id.startsWith('DEMO-');
            return (
              <div
                key={rule.id}
                className="bg-surface hover:bg-surface-elevated/80 border border-border rounded-xl p-6 transition-all duration-200 flex flex-col justify-between group hover:border-accent/40 hover:shadow-lg"
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-accent tracking-wider">
                          {rule.id}
                        </span>
                        {rule.source_status === 'UNVERIFIED' ? (
                          <span 
                            className="px-2 py-0.5 rounded text-[10px] font-mono uppercase border"
                            style={{ 
                              backgroundColor: 'rgba(250, 204, 21, 0.12)', 
                              color: 'var(--status-pending)', 
                              borderColor: 'rgba(250, 204, 21, 0.3)' 
                            }}
                          >
                            UNVERIFIED CLAUSE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-accent/15 text-accent border border-accent/20">
                            Statutory Norm
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-text-primary mt-1 group-hover:text-accent transition-colors">
                        {rule.name}
                      </h3>
                    </div>
                    <Badge variant={rule.severity === 'Critical' ? 'danger' : rule.severity === 'High' ? 'warning' : 'info'}>
                      {rule.severity}
                    </Badge>
                  </div>

                  {/* Category & Status */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-surface-elevated text-text-secondary border border-border/80">
                      {rule.category}
                    </span>
                    <span className="flex items-center gap-1 text-text-muted">
                      <Clock className="w-3 h-3" />
                      Active: <strong className="text-text-primary font-mono">{rule.activeVersion}</strong>
                    </span>
                    <span className="text-text-muted font-mono">
                      (Effective {rule.effectiveDate})
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                    {rule.description}
                  </p>

                  {/* Parameter Threshold Card */}
                  <div className="p-3 rounded-lg bg-surface-elevated/70 border border-border/60 space-y-1">
                    <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider block">
                      Enforced Threshold / Condition
                    </span>
                    <div className="text-xs font-medium text-text-primary font-mono flex items-center justify-between">
                      <span>{rule.expectedValue || rule.parameter}</span>
                    </div>
                  </div>

                  {/* Version Evolution Pill */}
                  {rule.versions && rule.versions.length > 1 && (
                    <div className="flex items-center gap-1.5 text-xs text-accent/90 bg-accent/5 px-2.5 py-1.5 rounded-lg border border-accent/15">
                      <History className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {rule.versions.length} versions tracked ({rule.versions.map(v => v.version).join(' → ')})
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/rules/${rule.id}`}
                      className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
                    >
                      View Spec
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    {rule.versions && rule.versions.length > 1 && (
                      <Link
                        to={`/rules/${rule.id}/versions`}
                        className="text-xs font-medium text-accent hover:underline flex items-center gap-1 ml-3"
                      >
                        <GitCompare className="w-3 h-3" />
                        Diff Versions
                      </Link>
                    )}
                  </div>

                  {(rule.versions?.length >= 2 || rule.rule_type === 'numeric_threshold') && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Play}
                      onClick={() => navigate(`/replay?ruleId=${rule.id}`)}
                      className="text-xs py-1"
                    >
                      Replay
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Propose Rule Revision Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Propose Regulatory Rule Revision"
        subtitle="ReguTrace tracks legislative changes and allows retroactive impact simulation before deployment."
        size="md"
      >
        <form onSubmit={handleCreateVersion} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Select Target Regulatory Rule
            </label>
            <select
              value={targetRuleId}
              onChange={(e) => setTargetRuleId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
              style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
            >
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} — {r.name} (Current: {r.activeVersion})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                New Version Tag
              </label>
              <input
                type="text"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                placeholder="e.g. v2.1-draft"
                required
                className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
                style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Proposed Threshold Value
              </label>
              <input
                type="text"
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
                placeholder="e.g. 75"
                required
                className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
                style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Regulatory Rationale / Change Summary
            </label>
            <textarea
              rows={3}
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="Explain the statutory justification for amending this regulatory threshold..."
              required
              className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent resize-none"
              style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary leading-relaxed">
              Once saved, you can use the <strong>ReguTrace Replay Simulator</strong> to backtest this proposed revision against historical applicant filings to detect newly failing institutions before enactment.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
            >
              Save Proposed Revision
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
