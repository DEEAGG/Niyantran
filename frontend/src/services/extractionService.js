import { apiClient } from './apiClient';

export function normalizeExtractedField(f) {
  if (!f) return f;
  const val = (f.field_value !== undefined && f.field_value !== null)
    ? String(f.field_value)
    : (f.extracted_value !== undefined && f.extracted_value !== null)
    ? String(f.extracted_value)
    : (f.extractedValue || '');

  let status = f.status || f.verificationStatus;
  if (!status || status === 'Valid' || status === 'Confirmed') {
    if (!val || val.trim().toLowerCase() === 'not found') {
      status = 'Not Found';
    } else if (f.is_confirmed || f.confirmed || f.isConfirmed) {
      status = 'Supported';
    } else if (typeof f.confidence === 'number' && f.confidence < 0.85) {
      status = 'Needs Review';
    } else {
      status = 'Needs Review'; // Default to Needs Review until verified
    }
  }

  let bbox = f.bbox || f.bounding_box || f.coordinates || null;
  if (!bbox && f.bbox_json) {
    try {
      bbox = typeof f.bbox_json === 'string' ? JSON.parse(f.bbox_json) : f.bbox_json;
    } catch {
      bbox = null;
    }
  }
  return {
    ...f,
    id: f.id,
    documentId: f.document_id || f.documentId || null,
    fieldName: f.fieldName || (f.field_name ? f.field_name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Extracted Field'),
    extractedValue: val || 'Not found',
    sourceDocument: f.original_filename || f.document_name || f.sourceDocument || 'Document.pdf',
    pageNumber: Number(f.page_number || f.pageNumber || 1),
    extractionMethod: f.extraction_method || f.extractionMethod || 'Pattern extraction',
    confidence: typeof f.confidence === 'number' ? f.confidence : (f.is_confirmed ? 1.0 : null),
    status: status,
    isConfirmed: Boolean(f.is_confirmed || f.confirmed || f.isConfirmed),
    bbox,
    coordinates: bbox,
  };
}

export const extractionService = {
  async getExtractedFields(applicationId) {
    const rawFields = await apiClient.get(`/applications/${applicationId}/fields`);
    const fields = Array.isArray(rawFields) ? rawFields.map(normalizeExtractedField) : [];
    return { data: fields };
  },

  async triggerExtraction(applicationId) {
    const res = await apiClient.post(`/applications/${applicationId}/extract`);
    // Extract fields from batch results or database
    let rawFields = [];
    if (res?.results && Array.isArray(res.results)) {
      rawFields = res.results.flatMap((r) => r.fields || []);
    } else if (Array.isArray(res)) {
      rawFields = res;
    } else if (res?.fields && Array.isArray(res.fields)) {
      rawFields = res.fields;
    }

    // Ensure all stored fields for the application are reflected
    if (rawFields.length === 0) {
      const dbFields = await apiClient.get(`/applications/${applicationId}/fields`).catch(() => []);
      if (Array.isArray(dbFields)) rawFields = dbFields;
    }

    const fields = rawFields.map(normalizeExtractedField);
    return {
      data: fields,
      documentsProcessed: res?.documents_processed || 1,
      message: 'Entity extraction completed across uploaded documents.',
    };
  },

  async confirmField(applicationId, fieldId) {
    const res = await apiClient.post(`/fields/${fieldId}/confirm`, {
      confirmed: true,
      confirmed_by: 'compliance-officer',
    });
    return { data: normalizeExtractedField(res), message: 'Extracted field verified and confirmed.' };
  },

  async updateField(fieldId, { fieldValue, confirmed = true }) {
    const res = await apiClient.patch(`/fields/${fieldId}`, {
      field_value: fieldValue,
      confirmed: confirmed,
      confirmed_by: 'compliance-officer',
    });
    return { data: normalizeExtractedField(res), message: 'Extracted field value corrected and confirmed.' };
  },
};

export default extractionService;
