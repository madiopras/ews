import { api } from "../../../lib/api.js";

export async function listAdminUsers(params, signal) {
  const { data } = await api.get("/admin/users", { params, signal });
  return data;
}

export async function updateAdminUser(id, changes) {
  const { data } = await api.patch(`/admin/users/${id}`, changes);
  return data;
}
