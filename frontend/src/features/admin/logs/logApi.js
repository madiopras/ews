import { api } from "../../../lib/api.js";

const ENDPOINTS = { audit: "/admin/audit-logs", ai: "/admin/ai-logs", system: "/admin/system-logs" };
export const listLogs = (type, params, signal) => api.get(ENDPOINTS[type], { params, signal }).then((r) => r.data);
