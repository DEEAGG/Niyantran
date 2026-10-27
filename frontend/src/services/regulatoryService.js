import { apiClient } from './apiClient';

export const regulatoryService = {
  // Get overview stats
  async getStats() {
    return await apiClient.get('/regulatory/stats');
  },

  // Get list of sources with filters
  async getSources(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.category && params.category !== 'All') searchParams.append('category', params.category);
    if (params.status && params.status !== 'All') searchParams.append('status', params.status);
    if (params.verification_status && params.verification_status !== 'All') {
      searchParams.append('verification_status', params.verification_status);
    }
    if (params.search) searchParams.append('search', params.search);

    const query = searchParams.toString();
    const endpoint = query ? `/regulatory/sources?${query}` : '/regulatory/sources';
    return await apiClient.get(endpoint);
  },

  // Get specific source detail
  async getSourceDetail(sourceId) {
    return await apiClient.get(`/regulatory/sources/${encodeURIComponent(sourceId)}`);
  },

  // Upload a regulatory PDF file
  async uploadSource(formData) {
    // Note: formData should contain file, title, category, issuing_authority, version, effective_date, source_url
    return await apiClient.post('/regulatory/sources/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Fetch from URL (with government portal error handling)
  async fetchSourceUrl(payload) {
    return await apiClient.post('/regulatory/sources/fetch', payload);
  },

  // Get clauses for a specific source
  async getSourceClauses(sourceId, params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page_number) searchParams.append('page_number', params.page_number);
    if (params.search) searchParams.append('search', params.search);
    const query = searchParams.toString();
    const endpoint = query 
      ? `/regulatory/sources/${encodeURIComponent(sourceId)}/clauses?${query}`
      : `/regulatory/sources/${encodeURIComponent(sourceId)}/clauses`;
    return await apiClient.get(endpoint);
  },

  // Global searchable knowledge base
  async searchClauses(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.category && params.category !== 'All') searchParams.append('category', params.category);
    if (params.verification_status && params.verification_status !== 'All') {
      searchParams.append('verification_status', params.verification_status);
    }
    if (params.search) searchParams.append('search', params.search);
    if (params.source_id) searchParams.append('source_id', params.source_id);
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.offset) searchParams.append('offset', params.offset);

    const query = searchParams.toString();
    const endpoint = query ? `/regulatory/clauses?${query}` : '/regulatory/clauses';
    return await apiClient.get(endpoint);
  },

  // Review a clause
  async reviewClause(clauseId, payload) {
    return await apiClient.post(`/regulatory/clauses/${encodeURIComponent(clauseId)}/review`, payload);
  },

  // Mark a source as superseded
  async supersedeSource(sourceId, supersededById, notes) {
    return await apiClient.post(`/regulatory/sources/${encodeURIComponent(sourceId)}/supersede`, {
      superseded_by_id: supersededById,
      notes: notes || '',
    });
  },

  // Get statutory audit summary
  async getAuditSummary() {
    return await apiClient.get('/regulatory/audit');
  },

  // Get prioritized review queue
  async getReviewQueue(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.priority && params.priority !== 'All') searchParams.append('priority', params.priority);
    if (params.status && params.status !== 'All') searchParams.append('status', params.status);
    if (params.source_id) searchParams.append('source_id', params.source_id);
    if (params.audit_tag) searchParams.append('audit_tag', params.audit_tag);
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.offset) searchParams.append('offset', params.offset);

    const query = searchParams.toString();
    const endpoint = query ? `/regulatory/review-queue?${query}` : '/regulatory/review-queue';
    return await apiClient.get(endpoint);
  },

  // Mark a clause as superseded
  async supersedeClause(clauseId, supersededByClauseId, notes) {
    return await apiClient.post(`/regulatory/clauses/${encodeURIComponent(clauseId)}/supersede`, {
      superseded_by_clause_id: supersededByClauseId,
      notes: notes || '',
    });
  },

  // Activate a verified clause for rule engine
  async activateClause(clauseId) {
    return await apiClient.post(`/regulatory/clauses/${encodeURIComponent(clauseId)}/activate`);
  },

  // Get high-resolution page image URL
  getPageImageUrl(sourceId, pageNumber) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    return `${baseUrl}/regulatory/sources/${encodeURIComponent(sourceId)}/page/${pageNumber}/image`;
  },
};

export default regulatoryService;
