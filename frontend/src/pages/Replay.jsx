import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  Play, RotateCcw, AlertTriangle, CheckCircle2, TrendingDown, 
  ArrowRight, ShieldAlert, Sparkles, Filter, Info, BarChart2, 
  Layers, ArrowUpRight, FileSpreadsheet, Eye
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  ReferenceLine, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { replayService } from '../services/replayService';
import { ruleService } from '../services/ruleService';
import { applicationService } from '../services/applicationService';
import { useToast } from '../context/ToastContext';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';

export default function Replay() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const urlRuleId = searchParams.get('ruleId') || '';
  const urlOldVer = searchParams.get('oldVersion') || 'v1.0';
  const urlNewVer = searchParams.get('newVersion') || 'v2.0';

  const [rules, setRules] = useState([]);
  const [selectedRuleId, setSelectedRuleId] = useState(urlRuleId);
  const [oldVersion, setOldVersion] = useState(urlOldVer);
  const [newVersion, setNewVersion] = useState(urlNewVer);
  const [selectedCohort, setSelectedCohort] = useState('ALL');
  
  const [isRunning, setIsRunning] = useState(false);
  const [replayResult, setReplayResult] = useState(null);
  const [runHistory, setRunHistory] = useState([]);
  const [filterImpact, setFilterImpact] = useState('ALL');

  // Load rules on mount
  useEffect(() => {
    const fetchRules = async () => {
      try {
        const res = await ruleService.getRules();
        const ruleList = res.data || [];
        setRules(ruleList);
        if (!urlRuleId && ruleList.length > 0) {
          setSelectedRuleId(ruleList[0].id || ruleList[0].rule_key);
        }
      } catch (err) {
        console.error('Error fetching rules for replay:', err);
      }
    };
    fetchRules();
  }, []);

  // Update versions when selectedRuleId changes
  useEffect(() => {
    const currentRule = rules.find((r) => r.id === selectedRuleId);
    if (currentRule && currentRule.versions && currentRule.versions.length >= 2) {
      setOldVersion(currentRule.versions[0].version);
      setNewVersion(currentRule.versions[currentRule.versions.length - 1].version);
    }
  }, [selectedRuleId, rules]);

  // Execute replay simulation
  const handleExecuteReplay = async (showToast = false) => {
    try {
      setIsRunning(true);
      const res = await replayService.runReplay({
        ruleId: selectedRuleId,
        oldVersion,
        newVersion,
        applicationIds: [],
      });
      setReplayResult(res.data);
      setRunHistory((prev) => [res.data, ...prev.slice(0, 4)]);
      if (showToast) {
        addToast({ title: 'Simulation Completed', message: 'ReguTrace Replay simulation executed successfully.', type: 'success' });
      }
    } catch (err) {
      console.error('Replay execution error:', err);
      if (showToast) {
        addToast({ title: 'Simulation Error', message: 'Failed to execute policy replay.', type: 'error' });
      }
    } finally {
      setIsRunning(false);
    }
  };

  // Reset simulation
  const handleResetReplay = () => {
    if (rules.length > 0) {
      setSelectedRuleId(rules[0].id || rules[0].rule_key);
    }
    setFilterImpact('ALL');
    handleExecuteReplay(true);
  };

  // Run automatically on first mount if directed with searchParams
  useEffect(() => {
    handleExecuteReplay(false);
  }, [selectedRuleId]);

  const currentRule = rules.find((r) => r.id === selectedRuleId);

  // Prepare chart data for comparative capacity
  const chartData = replayResult?.results?.map((r) => ({
    name: r.applicationId,
    capacity: r.intakeCapacity,
    institution: r.institutionName,
    impact: r.impact,
  })) || [];

  const pieData = replayResult ? [
    { name: 'Unchanged', value: replayResult.unchanged, color: '#10B981' },
    { name: 'Newly Failing', value: replayResult.newlyFailing, color: '#EF4444' },
    { name: 'Newly Passing', value: replayResult.newlyPassing, color: '#06B6D4' },
  ].filter(d => d.value > 0) : [];

  const filteredResults = replayResult?.results?.filter((r) => {
    if (filterImpact === 'ALL') return true;
    return r.impact === filterImpact;
  }) || [];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner / Hero */}
      <div className="bg-surface rounded-xl p-6 sm:p-8 border border-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-accent/15 text-accent border border-accent/25 flex items-center gap-1.5 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                ReguTrace Backtester
              </span>
              <span className="text-xs text-text-muted font-mono">Statutory Norms v2.0</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
              ReguTrace Replay Engine
            </h1>
            <p className="text-sm text-text-secondary mt-1.5 max-w-2xl leading-relaxed">
              Backtest regulatory rule changes and threshold modifications against historical institutional cohorts to detect shock waves, newly failing institutions, and compliance deltas before enacting policy.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="md"
              icon={RotateCcw}
              onClick={handleResetReplay}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={Play}
              isLoading={isRunning}
              onClick={() => handleExecuteReplay(true)}
              className="shadow-lg shadow-accent/20"
            >
              Run Replay Simulation
            </Button>
          </div>
        </div>
      </div>

      {/* Policy Simulation Notice */}
      <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <Badge variant="info" size="sm">POLICY SANDBOX</Badge>
          <span>What-if re-evaluations simulate proposed regulatory amendments across application cohorts without altering published decisions.</span>
        </div>
        <span className="font-mono text-[11px] text-text-muted">Statutory Cohort Simulation Engine</span>
      </div>

      {/* Simulation Configuration Controls */}
      <div className="bg-surface rounded-xl p-6 border border-border space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            Simulation Parameters & Cohort Target
          </h2>
          <span className="text-xs text-text-muted font-mono">Deterministic Backtester</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Target Rule */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
              Regulatory Rule to Backtest
            </label>
            <select
              value={selectedRuleId}
              onChange={(e) => setSelectedRuleId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-accent"
              style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
            >
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} — {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Baseline Version */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
              Baseline (Old) Version
            </label>
            <input
              type="text"
              value={oldVersion}
              onChange={(e) => setOldVersion(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-accent"
              style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Target Version */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-accent uppercase tracking-wider block">
              Target (New) Version
            </label>
            <input
              type="text"
              value={newVersion}
              onChange={(e) => setNewVersion(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-accent/40 text-text-primary font-mono focus:outline-none focus:border-accent"
              style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {/* Regulatory Policy Impact Scenario */}
        <div className="p-4 rounded-lg bg-accent/5 border border-accent/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <span className="font-semibold text-text-primary block">
                Regulatory Policy Impact Scenario:
              </span>
              <p className="text-text-secondary leading-relaxed">
                Evaluating <strong>{currentRule?.title || selectedRuleId || 'Policy Rule'}</strong> comparing <strong>{oldVersion}</strong> against <strong>{newVersion}</strong> across all active institutional applications to identify newly compliant, newly failing, or unchanged compliance outcomes.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (rules.length > 0) {
                setSelectedRuleId(rules[0].id || rules[0].rule_key);
              }
              handleExecuteReplay();
            }}
            className="shrink-0 text-xs"
          >
            Re-run Simulation
          </Button>
        </div>
      </div>

      {/* Simulation Results Section */}
      {isRunning ? (
        <div className="bg-surface rounded-xl p-12 border border-border text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto" />
          <h3 className="text-base font-semibold text-text-primary">
            ReguTrace Analytical Engine Running...
          </h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Re-evaluating historical application manifests, OCR extraction vectors, and parameter constraints against target rulebook...
          </p>
        </div>
      ) : replayResult && (
        <div className="space-y-6">
          {/* Impact KPI Summary Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface rounded-xl p-5 border border-border">
              <span className="text-xs text-text-muted block">Applications Evaluated</span>
              <div className="text-2xl font-bold font-mono text-text-primary mt-1">
                {replayResult.totalSimulated}
              </div>
              <span className="text-[11px] text-text-muted mt-1 block">100% Cohort Sampled</span>
            </div>

            <div className="bg-surface rounded-xl p-5 border border-rose-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-rose-400 font-semibold block">Newly Failing (Impact)</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
                {replayResult.newlyFailing}
              </div>
              <span className="text-[11px] text-rose-400/80 mt-1 block font-mono">Requires Notice / Action</span>
            </div>

            <div className="bg-surface rounded-xl p-5 border border-border">
              <span className="text-xs text-text-muted block">Newly Passing</span>
              <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
                {replayResult.newlyPassing}
              </div>
              <span className="text-[11px] text-text-muted mt-1 block">Relaxed Threshold Cases</span>
            </div>

            <div className="bg-surface rounded-xl p-5 border border-border">
              <span className="text-xs text-text-muted block">Unchanged (Stable)</span>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                {replayResult.unchanged}
              </div>
              <span className="text-[11px] text-text-muted mt-1 block">Zero Delta in Outcome</span>
            </div>
          </div>

          {/* Analytical Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Comparative Threshold Bar Chart */}
            <div className="lg:col-span-2 bg-surface rounded-xl p-6 border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Intake Capacity vs Rule Thresholds
                  </h3>
                  <p className="text-xs text-text-muted">
                    Reference Lines: v1.0 Threshold (30) vs v2.0 Mandate (60)
                  </p>
                </div>
                <span className="text-xs font-mono text-accent bg-accent/10 px-2.5 py-1 rounded">
                  Cohort Analysis
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--surface-elevated)', 
                        borderColor: 'var(--border)', 
                        borderRadius: '8px', 
                        fontSize: '12px',
                        color: 'var(--text-primary)' 
                      }} 
                    />
                    <ReferenceLine y={30} stroke="#22C55E" strokeDasharray="3 3" label={{ value: 'v1.0 (30)', fill: '#22C55E', fontSize: 10 }} />
                    <ReferenceLine y={60} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'v2.0 (60)', fill: '#EF4444', fontSize: 10 }} />
                    <Bar dataKey="capacity" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Impact Distribution Donut Chart */}
            <div className="bg-surface rounded-xl p-6 border border-border space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  Policy Impact Distribution
                </h3>
                <p className="text-xs text-text-muted">
                  Ratio of affected vs unaffected institutions
                </p>
              </div>

              <div className="h-48 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--surface-elevated)', 
                        borderColor: 'var(--border)', 
                        borderRadius: '8px', 
                        fontSize: '12px',
                        color: 'var(--text-primary)' 
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border">
                {pieData.map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-text-secondary">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </span>
                    <span className="font-mono font-bold text-text-primary">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Cohort Impact Table */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden space-y-0">
            <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  Application Cohort Simulation Ledger
                </h3>
                <p className="text-xs text-text-muted">
                  Individual application outcomes under {oldVersion} vs {newVersion}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Filter Impact:</span>
                <select
                  value={filterImpact}
                  onChange={(e) => setFilterImpact(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
                  style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
                >
                  <option value="ALL">All Outcomes</option>
                  <option value="Newly Failing">Newly Failing</option>
                  <option value="Unchanged">Unchanged</option>
                  <option value="Newly Passing">Newly Passing</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-elevated/50 text-[11px] font-mono uppercase text-text-muted border-b border-border">
                    <th className="py-3 px-4">Application ID</th>
                    <th className="py-3 px-4">Institution Name</th>
                    <th className="py-3 px-4">Source Value & Diff</th>
                    <th className="py-3 px-4 font-mono">{oldVersion} Result</th>
                    <th className="py-3 px-4 font-mono">{newVersion} Result</th>
                    <th className="py-3 px-4">Regulatory Impact</th>
                    <th className="py-3 px-4">Adjudication Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {filteredResults.map((item) => {
                    const isFailing = item.impact === 'Newly Failing';
                    return (
                      <tr 
                        key={item.applicationId}
                        className={`transition-colors hover:bg-surface-elevated/40 ${
                          isFailing ? 'bg-[var(--status-error)]/5' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-semibold text-accent">
                          {item.applicationId}
                        </td>
                        <td className="py-3 px-4 text-text-primary font-medium">
                          {item.institutionName}
                          <span className="block text-[11px] text-text-muted mt-0.5">
                            {item.explanation}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          <div className="font-semibold text-text-primary">{item.sourceField || `intakeCapacity = ${item.intakeCapacity}`}</div>
                          <div className="text-[10px] text-accent mt-0.5">{item.parameterDiff || `${oldVersion} → ${newVersion}`}</div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={item.oldResult === 'PASS' ? 'success' : 'danger'} size="sm">
                            {item.oldResult}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={item.newResult === 'PASS' ? 'success' : 'danger'} size="sm">
                            {item.newResult}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge 
                            variant={
                              item.impact === 'Newly Failing'
                                ? 'danger'
                                : item.impact === 'Newly Passing'
                                ? 'info'
                                : 'neutral'
                            }
                            size="sm"
                            dot={item.impact !== 'Unchanged'}
                          >
                            {item.impact}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {item.requiresReReview ? (
                            <Badge variant="warning" size="sm">Requires Re-Review</Badge>
                          ) : (
                            <span className="text-[11px] text-text-muted font-mono">Decision Intact</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/applications/${item.applicationId}`}
                            className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors font-medium"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Inspect
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-surface-elevated/30 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-text-muted">
              <div>
                <span>Simulation ID: <strong className="font-mono text-text-primary">{replayResult.replayId}</strong></span>
                <span className="mx-2">&bull;</span>
                <span>Rule: <strong className="font-mono text-accent">{replayResult.ruleId}</strong></span>
              </div>
              <span>Executed at: {new Date(replayResult.executedAt).toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Simulation Run History */}
          {runHistory.length > 1 && (
            <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-primary font-mono">
                  Session Simulation History ({runHistory.length} runs)
                </h4>
                <span className="text-[10px] text-text-muted font-mono">Preserved in memory</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {runHistory.map((run, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-surface-elevated/40 border border-border text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-accent text-[11px]">{run.replayId}</span>
                      <span className="text-[10px] text-text-muted">{new Date(run.executedAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="font-medium text-text-primary">{run.ruleId} ({run.oldVersion} &rarr; {run.newVersion})</div>
                    <div className="text-[11px] text-text-muted flex gap-3 pt-1">
                      <span style={{ color: 'var(--status-error)' }}>Failing: {run.newlyFailing}</span>
                      <span style={{ color: 'var(--status-success)' }}>Unchanged: {run.unchanged}</span>
                      <span className="text-accent">Passing: {run.newlyPassing}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
