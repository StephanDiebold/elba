// src/lib/api/candidate.api.ts

import { http } from "@/lib/httpClient"; 

export interface Candidate {
  candidate_id: number;
  candidate_number?: string | null;
  first_name: string;
  last_name: string;
  email?: string | null;
  mobile_number?: string | null;
  is_active?: boolean;
}

export interface CandidateCreate {
  candidate_number?: string | null;
  first_name: string;
  last_name: string;
  email?: string | null;
  mobile_number?: string | null;
  is_active?: boolean;
}

export interface CandidateUpdate {
  candidate_number?: string | null;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  mobile_number?: string | null;
  is_active?: boolean;
}

export interface CandidateListParams {
  q?: string;
  only_active?: boolean;
}

/* -----------------------------------------
 * API Calls
 * ----------------------------------------- */

// Liste
export async function listCandidates(params?: CandidateListParams) {
  return http.get<Candidate[]>("/candidate", { params }).then((r) => r.data);
}

// Anlegen
export async function createCandidate(payload: CandidateCreate) {
  return http.post<Candidate>("/candidate", payload).then((r) => r.data);
}

// Aktualisieren
export async function updateCandidate(id: number, payload: CandidateUpdate) {
  return http.put<Candidate>(`/candidate/${id}`, payload).then((r) => r.data);
}

// Löschen
export async function deleteCandidate(id: number) {
  return http.delete(`/candidate/${id}`).then((r) => r.data);
}
/* End of frontend/src/lib/api/candidate.api.ts */