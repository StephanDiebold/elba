// src/lib/api/committees.api.ts
import { httpClient } from "@/lib/httpClient";
import type {
  CommitteeOut,
  CommitteeCreate,
  CommitteeUpdate,
  CommitteeListQuery,
    UserCommitteeOut,
    UserCommitteeCreate,
} from "@/types/admin.types";

export async function listCommittees(
  params?: CommitteeListQuery
): Promise<CommitteeOut[]> {
  const res = await httpClient.get<CommitteeOut[]>("/admin/committees", {
    params,
  });
  return res.data;
}

export async function getCommittee(
  committeeId: number
): Promise<CommitteeOut> {
  const res = await httpClient.get<CommitteeOut>(
    `/admin/committees/${committeeId}`
  );
  return res.data;
}

export async function createCommittee(
  payload: CommitteeCreate
): Promise<CommitteeOut> {
  const res = await httpClient.post<CommitteeOut>(
    "/admin/committees",
    payload
  );
  return res.data;
}

export async function updateCommittee(
  committeeId: number,
  payload: CommitteeUpdate
): Promise<CommitteeOut> {
  // wir nehmen PATCH – laut OpenAPI erlaubt
  const res = await httpClient.patch<CommitteeOut>(
    `/admin/committees/${committeeId}`,
    payload
  );
  return res.data;
}

export async function deleteCommittee(committeeId: number): Promise<void> {
  await httpClient.delete(`/admin/committees/${committeeId}`);
}

// Mitglieder eines Ausschusses
export async function listCommitteeMembers(
  committeeId: number
): Promise<UserCommitteeOut[]> {
  const res = await httpClient.get<UserCommitteeOut[]>(
    `/admin/committees/${committeeId}/members`
  );
  return res.data;
}

// User einem Ausschuss zuordnen
export async function addUserToCommittee(
  payload: UserCommitteeCreate
): Promise<UserCommitteeOut> {
  const res = await httpClient.post<UserCommitteeOut>(
    "/admin/user-committees",
    payload
  );
  return res.data;
}

// Zuordnung entfernen
export async function removeUserFromCommittee(
  userCommitteeId: number
): Promise<void> {
  await httpClient.delete(`/admin/user-committees/${userCommitteeId}`);
}
// End of src/lib/api/committees.api.ts
