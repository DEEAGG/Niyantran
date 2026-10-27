import { apiClient } from './apiClient';
import { validationService } from './validationService';

export const reviewService = {
  async getReviews(params = {}) {
    return validationService.getFindings(params.applicationId, params);
  },

  async submitReview(findingId, payload) {
    const res = await apiClient.post(`/findings/${findingId}/decision`, {
      decision: payload.action,
      reason: payload.reviewerNotes || payload.notes || 'Review decision recorded',
      actor: payload.actor || 'compliance-officer',
    });
    return { data: res, message: `Review action recorded successfully.` };
  },
};

export default reviewService;
