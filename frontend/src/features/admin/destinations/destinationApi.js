import { api } from "../../../lib/api.js";

export async function listAdminDestinations(params, signal) {
  const { data } = await api.get("/admin/destinations", { params, signal });
  return data;
}

export async function getAdminDestination(id, signal) {
  const { data } = await api.get(`/admin/destinations/${id}`, { signal });
  return data;
}

export async function createDestination(payload) {
  const { data } = await api.post("/destinations", payload);
  return data;
}

export async function updateDestination(id, payload) {
  const { data } = await api.put(`/destinations/${id}`, payload);
  return data;
}

export async function toggleDestination(id) {
  const { data } = await api.patch(`/destinations/${id}/toggle-active`);
  return data;
}

export async function deleteDestination(id) {
  await api.delete(`/destinations/${id}`);
}
