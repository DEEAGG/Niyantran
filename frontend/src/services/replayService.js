import { apiClient } from './apiClient';

export const replayService = {
  async runReplay(payload) {
    const rulesets = await apiClient.get('/rulesets');
    const activeRuleset = Array.isArray(rulesets) ? rulesets.find((r) => r.status === 'active' || r.is_active) || rulesets[0] : null;
    const targetRulesetId = payload.toRulesetId || activeRuleset?.id;

    if (!targetRulesetId) {
      throw new Error('No target ruleset available for policy replay analysis.');
    }

    const res = await apiClient.post('/replay', {
      to_ruleset_id: targetRulesetId,
      from_ruleset_id: payload.fromRulesetId || null,
      application_ids: payload.applicationIds && payload.applicationIds.length > 0 ? payload.applicationIds : null,
    });

    const results = (res.replays || []).map((r) => {
      const diffs = r.diffs || [];
      const hasChange = diffs.some((d) => d.change_type !== 'unchanged');
      return {
        applicationId: r.application_id,
        institutionName: `Application ${r.application_id}`,
        intakeCapacity: r.intake_capacity || 0,
        oldResult: 'PASS',
        newResult: hasChange ? 'FAIL' : 'PASS',
        impact: hasChange ? 'Newly Failing' : 'Unchanged',
        explanation: diffs.length > 0 ? diffs[0].diff_reason || 'Rule evaluation outcome altered.' : 'No variance detected between ruleset versions.',
      };
    });

    const summary = {
      replayId: res.replay_id || `REP-${Date.now()}`,
      ruleId: payload.ruleId || 'ACTIVE-RULESET',
      oldVersion: payload.oldVersion || 'v1.0',
      newVersion: payload.newVersion || 'v2.0',
      totalEvaluated: results.length,
      unchanged: results.filter((r) => r.impact === 'Unchanged').length,
      newlyFailing: results.filter((r) => r.impact === 'Newly Failing').length,
      newlyPassing: 0,
      results,
    };

    return { data: summary, message: 'Policy replay evaluation completed against live database.' };
  },

  async getReplayById(id) {
    const res = await apiClient.get(`/replays/${id}`);
    return { data: res };
  },
};

export default replayService;
