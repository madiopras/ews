import { api } from "../../../lib/api.js";

export async function listAdminPartners(params, signal) {
  const { data } = await api.get("/admin/partners", { params, signal });
  return data;
}

export async function getAdminPartner(id, signal) {
  const { data } = await api.get(`/admin/partners/${id}`, { signal });
  return data;
}

export async function listDestinationOptions(signal) {
  const { data } = await api.get("/destinations/admin", { signal });
  return data?.data || data || [];
}

export async function createPartner(payload) {
  const { data } = await api.post("/partners/admin", payload);
  return data;
}

export async function updatePartner(id, payload) {
  const { data } = await api.put(`/partners/${id}`, payload);
  return data;
}

export async function setPartnerApproval(id, status, revisionNote = "") {
  const { data } = await api.patch(`/partners/${id}/status`, { status, revision_note: revisionNote });
  return data;
}

export async function assignPartnerOwner(id, email) {
  const { data } = await api.put(`/admin/partners/${id}/owner`, { email });
  return data;
}

export async function togglePartner(id) {
  const { data } = await api.patch(`/partners/${id}/toggle-active`);
  return data;
}

export async function deletePartner(id) {
  await api.delete(`/partners/${id}`);
}

export async function uploadPartnerDocument(id, documentType, file) {
  const payload = new FormData();
  payload.append("document_type", documentType);
  payload.append("file", file);
  const { data } = await api.post(`/partners/${id}/upload-docs`, payload);
  return data;
}

export async function downloadPartnerDocument(partnerId, document) {
  const response = await api.get(`/admin/partners/${partnerId}/documents/${document.id}`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = document.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function deletePartnerDocument(partnerId, documentId) {
  const { data } = await api.delete(`/partners/${partnerId}/documents/${documentId}`);
  return data;
}
