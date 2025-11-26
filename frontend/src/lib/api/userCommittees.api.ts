// src/lib/api/userCommittees.api.ts
import { http } from "@/lib/httpClient";
import type {
  CommitteeMemberOut,
  UserCommitteeCreate,
  UserCommitteeUpdate,
} from "@/types/admin.types";

/**
 * Mitglieder eines Ausschusses laden
 * -> GET /admin/committees/{committee_id}/members
 */
export async function listCommitteeMembers(
  committeeId: number,
  includeInactive = false
): Promise<CommitteeMemberOut[]> {
  const resp = await http.get<CommitteeMemberOut[]>(
    `/admin/committees/${committeeId}/members`,
    { params: { include_inactive: includeInactive } }
  );
  return resp.data;
}

/**
 * Zuordnung anlegen
 * -> POST /admin/user-committees
 */
export async function createUserCommittee(
  payload: UserCommitteeCreate
): Promise<CommitteeMemberOut> {
  const resp = await http.post<CommitteeMemberOut>(
    "/admin/user-committees",
    payload
  );
  return resp.data;
}

/**
 * Zuordnung aktualisieren
 * -> PATCH /admin/user-committees/{user_committee_id}
 */
export async function updateUserCommittee(
  userCommitteeId: number,
  payload: UserCommitteeUpdate
): Promise<CommitteeMemberOut> {
  const resp = await http.patch<CommitteeMemberOut>(
    `/admin/user-committees/${userCommitteeId}`,
    payload
  );
  return resp.data;
}

/**
 * Zuordnung löschen
 * -> DELETE /admin/user-committees/{user_committee_id}
 */
export async function deleteUserCommittee(
  userCommitteeId: number
): Promise<void> {
  await http.delete(`/admin/user-committees/${userCommitteeId}`);
}