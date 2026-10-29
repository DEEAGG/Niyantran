import { apiClient } from './apiClient';

export const reportService = {
  async getApplicationReport(applicationId) {
    const res = await apiClient.get(`/applications/${applicationId}/report?format=json`);
    return res;
  },

  async getReportPdfBlob(applicationId) {
    const res = await apiClient.get(`/applications/${applicationId}/dossier.pdf`, {
      responseType: 'blob',
      headers: {
        Accept: 'application/pdf',
      },
    });
    return res;
  },
};

export default reportService;
