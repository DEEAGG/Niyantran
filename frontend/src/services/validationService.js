import { apiClient } from './apiClient';

export function normalizeFinding(f) {
  if (!f) return f;
  const rawStatus = (f.status || 'fail').toLowerCase();
  const rawSev = (f.severity || 'high').toLowerCase();
  const severity = rawSev === 'critical' ? 'Critical' : rawSev === 'high' ? 'High' : rawSev === 'medium' ? 'Medium' : 'Low';

  let displayStatus = 'Pending Review';
  if (f.decision_type) {
    const dt = f.decision_type.toLowerCase();
    if (dt === 'resolved') displayStatus = 'Resolved';
    else if (dt === 'rejected') displayStatus = 'Dismissed';
    else if (dt === 'escalated') displayStatus = 'Clarification Requested';
  } else if (rawStatus === 'pass') {
    displayStatus = 'Passed';
  }

  const ev = f.evidence || {};
  let evidenceSources = [];
  if (Array.isArray(ev)) {
    evidenceSources = ev;
  } else if (ev && Object.keys(ev).length > 0) {
    evidenceSources = [
      {
        documentType: ev.document_type || 'Statutory Application Package',
        documentName: ev.document_name || 'Document.pdf',
        pageNumber: ev.page_number || 1,
        extractedValue: String(ev.extracted_value !== undefined ? ev.extracted_value : (ev.value || 'Field Discrepancy')),
        coordinates: ev.bounding_box || null,
      },
    ];
  }

  return {
    ...f,
    id: f.id,
    applicationId: f.application_id || f.applicationId,
    institutionName: f.institution_name || 'Institutional Applicant',
    ruleId: f.rule_key || f.rule_id || f.ruleId || 'REG-RULE',
    title: f.title || f.rule_title || 'Regulatory Finding',
    severity,
    status: displayStatus,
    rawStatus,
    explanation: f.message || f.explanation || 'Regulatory condition not satisfied.',
    recommendedAction: f.recommendation || f.recommended_action || f.recommendedAction || 'Inspect physical records or submit clarification.',
    evidenceSources,
    reviewerDecision: f.decision_type || f.reviewerDecision || null,
    reviewerNotes: f.decision_reason || f.reviewerNotes || '',
    reviewedAt: f.decision_created_at || f.reviewedAt || null,
    reviewedBy: f.decision_actor || f.reviewedBy || null,
    createdAt: f.created_at || new Date().toISOString(),
  };
}

export const validationService = {
  async validateApplication(applicationId) {
    const res = await apiClient.post(`/applications/${applicationId}/validate`);
    const findings = Array.isArray(res.findings) ? res.findings.map(normalizeFinding) : [];
    return {
      data: {
        ...res,
        findings,
        totalChecks: (res.summary?.total_rules_evaluated) || (res.summary?.total_rules) || findings.length,
        passedChecks: (res.summary?.pass) || (res.summary?.passed) || 0,
        failedChecks: (res.summary?.fail) || (res.summary?.failed) || 0,
        unverifiedChecks: (res.summary?.unverified) || 0,
      },
    };
  },

  async getFindings(applicationId = null, params = {}) {
    const endpoint = applicationId ? `/applications/${applicationId}/findings` : '/findings';
    const raw = await apiClient.get(endpoint, { params });
    const rawList = Array.isArray(raw) ? raw : (raw.data || []);
    let list = rawList.map(normalizeFinding);

    if (params.severity && params.severity !== 'All') {
      list = list.filter((f) => f.severity.toLowerCase() === params.severity.toLowerCase());
    }
    if (params.status && params.status !== 'All') {
      list = list.filter((f) => f.status.toLowerCase() === params.status.toLowerCase());
    }

    return { data: list, total: list.length };
  },

  async getFindingById(findingId) {
    const res = await apiClient.get(`/findings/${findingId}`);
    return { data: normalizeFinding(res) };
  },
};

export default validationService;
