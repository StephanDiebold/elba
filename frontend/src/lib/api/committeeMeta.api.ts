// src/lib/api/committeeMeta.api.ts
import { http } from "@/lib/httpClient";
import type {
  CommitteeFunctionOut,
  CommitteePositionOut,
} from "@/types/admin.types";

/**
 * Liste der Ausschuss-Funktionen
 * GET /admin/committee-functions
 */
export async function listCommitteeFunctions(
  search?: string
): Promise<CommitteeFunctionOut[]> {
  const resp = await http.get<CommitteeFunctionOut[]>("/admin/committee-functions", {
    params: search ? { search } : undefined,
  });
  return resp.data;
}

/**
 * Liste der Ausschuss-Positionen
 * GET /admin/committee-positions
 */
export async function listCommitteePositions(
  search?: string
): Promise<CommitteePositionOut[]> {
  const resp = await http.get<CommitteePositionOut[]>("/admin/committee-positions", {
    params: search ? { search } : undefined,
  });
  return resp.data;
}
// End of file: frontend/src/lib/api/committeeMeta.api.ts
