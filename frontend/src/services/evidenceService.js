import { apiClient } from './apiClient';

export const evidenceService = {
  async getFindingEvidence(findingId) {
    const res = await apiClient.get(`/findings/${findingId}/evidence`);
    return res;
  },
};

export default evidenceService;
