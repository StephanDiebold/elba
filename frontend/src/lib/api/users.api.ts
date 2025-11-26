// src/lib/api/users.api.ts
import { httpClient } from "@/lib/httpClient";
import type { AdminUserSummary } from "@/types/admin.types";

export async function listAdminUsers(): Promise<AdminUserSummary[]> {
  const res = await httpClient.get<AdminUserSummary[]>("/admin/users");
  return res.data;
}
// End of src/lib/api/users.api.ts
