import { api } from "../../../lib/api.js";

export async function listAdminPlans(params, signal) {
  const { data } = await api.get("/admin/premium/plans", { params, signal });
  return data;
}

export async function createPlan(payload) {
  const { data } = await api.post("/admin/premium/plans", payload);
  return data;
}

export async function updatePlan(id, payload) {
  const { data } = await api.put(`/admin/premium/plans/${id}`, payload);
  return data;
}

export async function deletePlan(id) {
  await api.delete(`/admin/premium/plans/${id}`);
}
