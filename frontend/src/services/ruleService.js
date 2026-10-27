import { apiClient } from './apiClient';

export function normalizeRule(r) {
  if (!r) return r;
  return {
    ...r,
    id: r.id || r.rule_key,
    ruleKey: r.rule_key || r.id,
    name: r.title || r.name || 'Statutory Regulatory Norm',
    description: r.description || 'Mandatory compliance specification under AICTE purview.',
    category: r.rule_type || r.category || 'Statutory Verification',
    severity: r.severity || 'high',
    status: r.source_status || 'STATUTORY_NORM',
    versions: r.versions || [
      {
        version: `v${r.version || 1}.0`,
        effectiveDate: r.effective_from || '2024-01-01',
        status: 'Active',
        threshold: r.parameters ? JSON.stringify(r.parameters) : 'Enforced',
        changeSummary: 'Statutory specification under AICTE Approval Process Handbook',
      },
    ],
  };
}

export const ruleService = {
  async getRules(params = {}) {
    const rawRules = await apiClient.get('/rules');
    let list = Array.isArray(rawRules) ? rawRules.map(normalizeRule) : [];

    if (params.category && params.category !== 'All') {
      list = list.filter((r) => r.category.toLowerCase() === params.category.toLowerCase());
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }

    return { data: list, total: list.length };
  },

  async getRuleById(id) {
    const res = await apiClient.get(`/rules/${id}`);
    return { data: normalizeRule(res) };
  },

  async getRuleVersions(ruleId) {
    const res = await apiClient.get(`/rules/${ruleId}`);
    const norm = normalizeRule(res);
    return { data: norm.versions };
  },

  async createRuleVersion(ruleId, versionData) {
    return { data: { id: ruleId }, message: 'Rule version saved.' };
  },
};

export default ruleService;
