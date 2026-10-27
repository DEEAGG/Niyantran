import { apiClient } from './apiClient';

export function normalizeApplication(a) {
  if (!a) return a;
  const rawStatus = a.status || 'draft';
  const statusDisplayMap = {
    draft: 'Draft',
    validated: 'Evaluated',
    verified: 'Verified',
    under_review: 'Under Review',
    discrepancy: 'Discrepancy Detected',
    discrepancy_detected: 'Discrepancy Detected',
    missing_documents: 'Missing Documents',
  };
  const status = statusDisplayMap[rawStatus.toLowerCase()] || rawStatus;

  const docs = (a.documents || []).map((d) => ({
    id: d.id,
    name: d.original_filename || d.name || 'Document.pdf',
    category: d.document_type || d.category || 'General Document',
    size: typeof d.file_size === 'number' ? `${(d.file_size / 1024).toFixed(1)} KB` : (d.size || ''),
    uploadDate: d.uploaded_at ? d.uploaded_at.split('T')[0] : (d.uploadDate || ''),
    pages: d.page_count || d.pages || 0,
    status: d.processing_status || d.status || 'Uploaded',
    sha256: d.sha256 || '',
  }));

  return {
    ...a,
    id: a.id,
    institutionName: a.institution_name || a.institutionName || a.applicant_name || a.id,
    institutionCode: a.institutionCode || a.institution_code || a.id,
    applicationType: a.application_type || a.applicationType || 'Technical Approval',
    applicantName: a.applicant_name || a.applicantName || '',
    contactEmail: a.contactEmail || a.contact_email || '',
    contactPhone: a.contactPhone || a.contact_phone || '',
    address: a.address || '',
    intakeCapacity: a.intakeCapacity || a.intake_capacity || 0,
    status,
    submittedAt: a.created_at || a.submittedAt || '',
    updatedAt: a.updated_at || a.updatedAt || '',
    documentCount: a.documentCount ?? docs.length,
    requiredDocumentCount: a.requiredDocumentCount || (docs.length > 0 ? docs.length : 0),
    findingsCount: a.findingsCount ?? 0,
    criticalFindingsCount: a.criticalFindingsCount ?? 0,
    complianceStatus: status === 'Verified' ? 'Passed' : status === 'Discrepancy Detected' ? 'Action Required' : 'Under Review',
    documents: docs,
  };
}

export const applicationService = {
  async getApplications(params = {}) {
    const rawList = await apiClient.get('/applications');
    let list = Array.isArray(rawList) ? rawList.map(normalizeApplication) : [];

    if (params.search) {
      const query = params.search.toLowerCase();
      list = list.filter(
        (a) =>
          a.institutionName.toLowerCase().includes(query) ||
          a.id.toLowerCase().includes(query) ||
          (a.institutionCode && a.institutionCode.toLowerCase().includes(query))
      );
    }

    if (params.status && params.status !== 'All') {
      list = list.filter((a) => a.status.toLowerCase() === params.status.toLowerCase());
    }

    return {
      data: list,
      total: list.length,
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    };
  },

  async getApplicationById(id) {
    const res = await apiClient.get(`/applications/${id}`);
    return { data: normalizeApplication(res) };
  },

  async getApplicationDocuments(id) {
    const rawDocs = await apiClient.get(`/applications/${id}/documents`);
    const docs = Array.isArray(rawDocs) ? rawDocs.map((d) => ({
      id: d.id,
      name: d.original_filename || d.name || 'Document.pdf',
      original_filename: d.original_filename || d.name || 'Document.pdf',
      category: d.document_type || d.category || 'General Document',
      size: typeof d.file_size === 'number' ? `${(d.file_size / 1024).toFixed(1)} KB` : (d.size || ''),
      file_size: d.file_size || 0,
      uploadDate: d.uploaded_at ? d.uploaded_at.split('T')[0] : (d.uploadDate || ''),
      pages: d.page_count || d.pages || 0,
      page_count: d.page_count || d.pages || 0,
      status: d.processing_status || d.status || 'Uploaded',
      sha256: d.sha256 || '',
    })) : [];
    return { data: docs };
  },

  async createApplication(payload) {
    const body = {
      application_type: payload.applicationType || payload.application_type || 'Technical Approval',
      applicant_name: payload.contactEmail || payload.applicantName || payload.applicant_name,
      institution_name: payload.institutionName || payload.institution_name,
      address: payload.address,
      intakeCapacity: payload.intakeCapacity,
      institutionCode: payload.institutionCode,
      academicYear: payload.academicYear,
      contactEmail: payload.contactEmail,
      contactPhone: payload.contactPhone,
    };

    const res = await apiClient.post('/applications', body);
    return { data: normalizeApplication(res), message: 'Application registered successfully' };
  },

  async updateApplication(id, updates) {
    return apiClient.put(`/applications/${id}`, updates);
  },
};

export default applicationService;
