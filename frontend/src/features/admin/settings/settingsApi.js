import { api } from "../../../lib/api.js";

export const getGeneralSettings = (signal) => api.get("/admin/settings", { signal }).then((r) => r.data);
export const updateGeneralSettings = (payload) => api.put("/admin/settings", payload).then((r) => r.data);
export const getIntegrationStatus = (signal) => api.get("/admin/settings/integrations", { signal }).then((r) => r.data);

export const listLlmProfiles = (q = "", signal) => api.get("/admin/llm-profiles", { params: { q }, signal }).then((r) => r.data);
export const getLlmProfile = (id, signal) => api.get(`/admin/llm-profiles/${id}`, { signal }).then((r) => r.data);
export const getLlmRuntime = (signal) => api.get("/admin/llm-profiles/runtime", { signal }).then((r) => r.data);
export const createLlmProfile = (payload) => api.post("/admin/llm-profiles", payload).then((r) => r.data);
export const updateLlmProfile = (id, payload) => api.put(`/admin/llm-profiles/${id}`, payload).then((r) => r.data);
export const duplicateLlmProfile = (id) => api.post(`/admin/llm-profiles/${id}/duplicate`).then((r) => r.data);
export const testLlmProfile = (id) => api.post(`/admin/llm-profiles/${id}/test`).then((r) => r.data);
export const activateLlmProfile = (id) => api.post(`/admin/llm-profiles/${id}/activate`).then((r) => r.data);
export const activateEnvironmentLlm = () => api.post("/admin/llm-profiles/use-environment").then((r) => r.data);
export const deleteLlmProfile = (id) => api.delete(`/admin/llm-profiles/${id}`).then((r) => r.data);

export const listEmailTemplates = (params, signal) => api.get("/admin/email-templates", { params, signal }).then((r) => r.data);
export const getEmailTemplate = (id, signal) => api.get(`/admin/email-templates/${id}`, { signal }).then((r) => r.data);
export const createEmailTemplate = (payload) => api.post("/admin/email-templates", payload).then((r) => r.data);
export const updateEmailTemplate = (id, payload) => api.put(`/admin/email-templates/${id}`, payload).then((r) => r.data);
export const deleteEmailTemplate = (id) => api.delete(`/admin/email-templates/${id}`).then((r) => r.data);

export const getBackupStatus = (signal) => api.get("/admin/backups/status", { signal }).then((r) => r.data);
export const listBackups = (params, signal) => api.get("/admin/backups", { params, signal }).then((r) => r.data);
export const createBackup = () => api.post("/admin/backups").then((r) => r.data);
export const deleteBackup = (id) => api.delete(`/admin/backups/${id}`).then((r) => r.data);
export const downloadBackup = (id) => api.get(`/admin/backups/${id}/download`, { responseType: "blob" }).then((r) => r.data);
