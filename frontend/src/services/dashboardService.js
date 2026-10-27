import { apiClient } from './apiClient';

export const dashboardService = {
  async getDashboardSummary() {
    return apiClient.get('/dashboard/summary');
  },
};

export default dashboardService;
