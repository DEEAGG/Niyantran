import { apiClient, USE_MOCK_API, simulateDelay } from './apiClient';

export const authenticityService = {
  async getAuthenticity(applicationId) {
    if (USE_MOCK_API) {
      await simulateDelay(200);
      return { data: { documents: [] } };
    }
    return apiClient.get(`/applications/${applicationId}/authenticity`);
  },

  async evaluateDocument(documentId) {
    if (USE_MOCK_API) {
      await simulateDelay(300);
      return { data: { document_id: documentId, signals: [] } };
    }
    return apiClient.post(`/documents/${documentId}/authenticity/evaluate`);
  },

  async getManualVerifications(applicationId) {
    if (USE_MOCK_API) {
      await simulateDelay(150);
      return { data: [] };
    }
    return apiClient.get(`/applications/${applicationId}/manual-verifications`);
  },

  async recordManualVerification(documentId, outcome, notes = '', reviewerId = 'Officer Sharma') {
    if (USE_MOCK_API) {
      await simulateDelay(250);
      return { data: { document_id: documentId, outcome } };
    }
    return apiClient.post(`/documents/${documentId}/manual-verification`, {
      reviewer_id: reviewerId,
      outcome: outcome.toLowerCase(),
      notes,
    });
  },

  async getPassport(applicationId) {
    if (USE_MOCK_API) {
      await simulateDelay(300);
      return { data: null };
    }
    return apiClient.get(`/applications/${applicationId}/passport`);
  },

  getPageImageUrl(documentId, pageNumber = 1) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    return `${baseUrl}/documents/${documentId}/page/${pageNumber}`;
  },
};
