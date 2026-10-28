import { apiClient } from './apiClient';

export function normalizeDocument(d) {
  if (!d) return d;
  return {
    ...d,
    id: d.id,
    name: d.original_filename || d.name || 'Document.pdf',
    category: d.document_type || d.category || 'General Document',
    size: typeof d.file_size === 'number' ? `${(d.file_size / 1024).toFixed(1)} KB` : (d.size || ''),
    uploadDate: d.uploaded_at ? d.uploaded_at.split('T')[0] : (d.uploadDate || ''),
    pages: d.page_count || d.pages || 0,
    status: d.processing_status || d.status || 'Uploaded',
    sha256: d.sha256 || '',
  };
}

export const documentService = {
  async getDocuments(applicationId) {
    const rawDocs = await apiClient.get(`/applications/${applicationId}/documents`);
    const docs = Array.isArray(rawDocs) ? rawDocs.map(normalizeDocument) : [];
    return { data: docs };
  },

  async uploadDocument(applicationId, file, documentType = 'General Document') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);
    const res = await apiClient.post(`/applications/${applicationId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { data: normalizeDocument(res) };
  },

  async uploadDocuments(applicationId, files) {
    const items = files.map((item) => ({ item }))
      .filter(({ item }) => {
        const fileBlob = item.file || item;
        return fileBlob instanceof Blob || fileBlob instanceof File;
      });
    const uploaded = new Array(items.length);
    let cursor = 0;

    // Upload a small batch in parallel instead of waiting for each remote
    // Supabase Storage round-trip before starting the next file.
    const worker = async () => {
      while (true) {
        const slot = cursor++;
        if (slot >= items.length) return;
        const { item } = items[slot];
        const fileBlob = item.file || item;
        const category = item.category || 'Supporting Declaration';
        const res = await this.uploadDocument(applicationId, fileBlob, category);
        uploaded[slot] = res.data;
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(3, items.length) }, () => worker())
    );

    return {
      data: uploaded.filter(Boolean),
      message: `${uploaded.filter(Boolean).length} document(s) uploaded successfully.`,
    };
  },
};

export default documentService;
