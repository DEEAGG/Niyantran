import { apiClient } from './apiClient';

export const reportService = {
  async getApplicationReport(applicationId) {
    const res = await apiClient.get(`/applications/${applicationId}/report?format=json`);
    return res;
  },
};

export default reportService;
