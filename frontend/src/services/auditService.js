import { apiClient } from './apiClient';

export function normalizeAuditEvent(entry) {
  if (!entry) return entry;
  const eventData = entry.event_data || {};
  const appId = entry.entity_type === 'application' ? entry.entity_id : (eventData.application_id || '');

  return {
    ...entry,
    id: `AUD-${entry.id}`,
    eventType: entry.event_type ? entry.event_type.replace(/_/g, ' ').toUpperCase() : 'SYSTEM_EVENT',
    actor: entry.actor || 'Compliance Officer / System',
    applicationId: appId,
    entityType: entry.entity_type ? entry.entity_type.replace(/_/g, ' ') : 'System',
    description: `${entry.event_type} recorded on ${entry.entity_type} [${entry.entity_id || 'System'}]`,
    timestamp: entry.created_at || entry.timestamp || new Date().toISOString(),
    prevHash: entry.previous_hash || entry.prev_hash || '0'.repeat(64),
    entryHash: entry.entry_hash || '',
  };
}

export const auditService = {
  async getAuditEvents(filter = {}) {
    const limit = filter.pageSize || filter.limit || 100;
    const raw = await apiClient.get('/audit/log', { params: { limit } });
    const rawList = Array.isArray(raw) ? raw : (raw.events || []);
    const list = rawList.map(normalizeAuditEvent);
    return { data: list, total: list.length };
  },

  async getAuditLogs(filter = {}) {
    return this.getAuditEvents(filter);
  },

  async verifyAuditChain() {
    return apiClient.get('/audit/verify');
  },
};

export default auditService;
