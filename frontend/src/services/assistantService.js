import { apiClient } from './apiClient';

/**
 * NIYANTRAN Assistant API Client
 * Connects directly to backend statutory RAG and workflow endpoints.
 */
export const assistantService = {
  /**
   * Send user message to statutory intelligence engine
   * @param {string} message 
   * @param {object} context - { current_path, application_id }
   */
  async sendMessage(message, context = {}) {
    const res = await apiClient.post('/copilot/chat', {
      message,
      context,
    });
    return res.data;
  },

  /**
   * Retrieve dynamic prompt suggestions based on current route
   * @param {string} currentPath 
   */
  async getSuggestedPrompts(currentPath = '/dashboard') {
    const res = await apiClient.get('/copilot/suggested-prompts', {
      params: { current_path: currentPath },
    });
    return res.data;
  },

  /**
   * Retrieve 5-step statutory workflow progression for active filing
   * @param {string|null} applicationId 
   */
  async getWorkflowStatus(applicationId = null) {
    const res = await apiClient.get('/copilot/workflow-status', {
      params: applicationId ? { application_id: applicationId } : {},
    });
    return res.data;
  },
};

export default assistantService;
