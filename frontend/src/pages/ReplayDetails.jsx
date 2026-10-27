import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Play, History, CheckCircle2, AlertTriangle, 
  BarChart2, FileText, ChevronRight, Clock, Sparkles 
} from 'lucide-react';
import { replayService } from '../services/replayService';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';

export default function ReplayDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const replayId = id;

  const [replay, setReplay] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    if (!replayId) {
      setLoading(false);
      return;
    }
    const fetchReplay = async () => {
      try {
        setLoading(true);
        const res = await replayService.getReplayById(replayId);
        setReplay(res.data);
      } catch (err) {
        console.error('Error fetching replay details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReplay();
  }, [replayId]);

  if (!id) {
    return (
      <div className="p-8">
        <EmptyState
          title="No Policy Replay Selected"
          description="Select or execute a policy replay simulation from the Replay Center to inspect impact differentials."
          actionLabel="Go to Replay Center"
          onAction={() => navigate('/replay')}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!replay) {
    return (
      <EmptyState
        icon={History}
        title="Replay Execution Not Found"
        description="The requested simulation report is not available in the archive."
        action={{
          label: "Back to Replay Engine",
          onClick: () => navigate('/replay')
        }}
      />
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Link to="/replay" className="hover:text-text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Replay Simulator
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-accent font-mono">{replay.replayId || replayId}</span>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={Play}
          onClick={() => navigate('/replay')}
        >
          New Replay Simulation
        </Button>
      </div>

      {/* Header */}
      <div className="bg-surface rounded-xl p-6 sm:p-8 border border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold text-accent px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                {replay.ruleId}
              </span>
              <span className="text-xs font-mono text-text-muted">
                {replay.oldVersion} → {replay.newVersion}
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-text-primary">
              Replay Simulation Report: {replay.replayId}
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              Executed at {new Date(replay.executedAt).toLocaleString()} by ReguTrace Engine
            </p>
          </div>

          <div className="flex items-center gap-4 bg-surface-elevated p-3.5 rounded-xl border border-border">
            <div className="text-center">
              <span className="text-[10px] uppercase font-mono text-text-muted block">Cohort</span>
              <span className="text-lg font-bold font-mono text-text-primary">{replay.totalSimulated}</span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <span className="text-[10px] uppercase font-mono text-rose-400 block">Newly Failing</span>
              <span className="text-lg font-bold font-mono text-rose-400">{replay.newlyFailing}</span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <span className="text-[10px] uppercase font-mono text-emerald-400 block">Unchanged</span>
              <span className="text-lg font-bold font-mono text-emerald-400">{replay.unchanged}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">Simulation Case Ledger</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-elevated text-text-muted font-mono uppercase text-[11px] border-b border-border">
                <th className="py-3 px-4">Application</th>
                <th className="py-3 px-4">Institution Name</th>
                <th className="py-3 px-4">Intake</th>
                <th className="py-3 px-4">{replay.oldVersion}</th>
                <th className="py-3 px-4">{replay.newVersion}</th>
                <th className="py-3 px-4">Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {replay.results?.map((item) => (
                <tr key={item.applicationId} className="hover:bg-surface-elevated/40">
                  <td className="py-3 px-4 font-mono text-accent font-semibold">{item.applicationId}</td>
                  <td className="py-3 px-4 text-text-primary">{item.institutionName}</td>
                  <td className="py-3 px-4 font-mono font-bold text-text-primary">{item.intakeCapacity}</td>
                  <td className="py-3 px-4"><Badge variant="success">{item.oldResult}</Badge></td>
                  <td className="py-3 px-4">
                    <Badge variant={item.newResult === 'PASS' ? 'success' : 'danger'}>{item.newResult}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      item.impact === 'Newly Failing' ? 'bg-rose-500/15 text-rose-400' : 'bg-surface-elevated text-text-muted'
                    }`}>
                      {item.impact}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
