// src/lib/api/planner.api.ts

import { http } from "@/lib/httpClient";

/* ------------------------------------------------------------------
 * Enums / Types
 * ------------------------------------------------------------------ */

export type ExamDayStatus = "planned" | "in_progress" | "done" | "canceled";
export type SlotStatus = "free" | "reserved" | "booked" | "blocked";

export type ExamType = "aevo" | "wfw" | "it" | "custom";
export type ExamStatus =
  | "planned"
  | "in_progress"
  | "done"
  | "canceled"
  | "no_show";

/* ------------------------------------------------------------------
 * Exam Day
 * ------------------------------------------------------------------ */

export interface ExamDay {
  exam_day_id: number;
  org_unit_id: number;
  subject_id: number;
  time_scheme_id: number;
  date: string; // ISO
  location: string | null;
  default_room: string | null;
  status: ExamDayStatus;
  is_active: boolean;
}

export interface ExamDayQueryParams {
  org_unit_id?: number;
  subject_id?: number;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

export interface ExamDayCreate {
  org_unit_id: number;
  subject_id: number;
  time_scheme_id?: number; // optional (Default im Backend)
  date: string;
  location?: string | null;
  default_room?: string | null;
  status?: ExamDayStatus;
  is_active?: boolean;
}

/* ------------------------------------------------------------------
 * Teams (UI: Ausschüsse)
 * ------------------------------------------------------------------ */

export interface ExamDayTeamMember {
  user_id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface ExamDayTeam {
  exam_day_team_id: number;
  exam_day_id: number;
  name: string;
  time_scheme_id: number;
  time_scheme_name?: string | null;

  members: ExamDayTeamMember[];

  slot_count: number;
  exam_count: number;
  can_delete: boolean;
}

export interface ExamDayTeamCreate {
  name?: string;
  time_scheme_id?: number;
  user_ids: number[]; // exakt 3
}

export interface ExamDayTeamUpdate {
  name?: string;
  time_scheme_id?: number;
}

/* ------------------------------------------------------------------
 * Slots
 * ------------------------------------------------------------------ */

export interface ExamSlot {
  exam_slot_id: number;
  exam_day_id: number;
  exam_day_team_id: number;

  slot_index: number;
  start_time: string;
  end_time: string;
  status: SlotStatus;

  exam_id?: number | null;
  candidate_id?: number | null;
  candidate_first_name?: string | null;
  candidate_last_name?: string | null;
}

export interface GenerateSlotsResponse {
  created_slots: number;
}

/* ------------------------------------------------------------------
 * Exams
 * ------------------------------------------------------------------ */

export interface Exam {
  exam_id: number;
  candidate_id: number;
  exam_day_id: number;
  exam_slot_id: number;
  exam_day_team_id: number;
  exam_type: ExamType;
  status: ExamStatus;
}

export interface ExamCreate {
  candidate_id: number;
  exam_day_id: number;
  exam_slot_id: number;
  exam_type?: ExamType;
}

/* ------------------------------------------------------------------
 * Exam Days API
 * ------------------------------------------------------------------ */

export async function listExamDays(
  params: ExamDayQueryParams = {}
): Promise<ExamDay[]> {
  const res = await http.get<ExamDay[]>("/planner/exam-days", { params });
  return res.data;
}

export async function getExamDay(id: number): Promise<ExamDay> {
  const res = await http.get<ExamDay>(`/planner/exam-days/${id}`);
  return res.data;
}

export async function createExamDay(
  payload: ExamDayCreate
): Promise<ExamDay> {
  const res = await http.post<ExamDay>("/planner/exam-days", payload);
  return res.data;
}

export async function deleteExamDay(id: number): Promise<void> {
  await http.delete(`/planner/exam-days/${id}`);
}

/* ------------------------------------------------------------------
 * Teams API
 * ------------------------------------------------------------------ */

export async function listExamDayTeams(
  examDayId: number
): Promise<ExamDayTeam[]> {
  const res = await http.get<ExamDayTeam[]>(
    `/planner/exam-days/${examDayId}/teams`
  );
  return res.data;
}

export async function createExamDayTeam(
  examDayId: number,
  payload: ExamDayTeamCreate
): Promise<ExamDayTeam> {
  const res = await http.post<ExamDayTeam>(
    `/planner/exam-days/${examDayId}/teams`,
    payload
  );
  return res.data;
}

export async function updateExamDayTeam(
  teamId: number,
  payload: ExamDayTeamUpdate
): Promise<ExamDayTeam> {
  const res = await http.patch<ExamDayTeam>(
    `/planner/exam-days/teams/${teamId}`,
    payload
  );
  return res.data;
}

export async function deleteExamDayTeam(teamId: number): Promise<void> {
  await http.delete(`/planner/exam-days/teams/${teamId}`);
}

/* ------------------------------------------------------------------
 * Slots API (Team-basiert)
 * ------------------------------------------------------------------ */

export async function generateSlotsForTeam(
  teamId: number
): Promise<GenerateSlotsResponse> {
  const res = await http.post<GenerateSlotsResponse>(
    `/planner/exam-days/teams/${teamId}/slots/generate`
  );
  return res.data;
}

export async function deleteSlotsForTeam(teamId: number): Promise<void> {
  await http.delete(`/planner/exam-days/teams/${teamId}/slots`);
}

export async function listExamSlots(
  examDayId: number,
  teamId?: number
): Promise<ExamSlot[]> {
  const params: Record<string, number> = {};
  if (teamId !== undefined) {
    params.team_id = teamId;
  }

  const res = await http.get<ExamSlot[]>(
    `/planner/exam-days/${examDayId}/slots`,
    { params }
  );
  return res.data;
}

/* ------------------------------------------------------------------
 * Exams API
 * ------------------------------------------------------------------ */

export async function createExam(
  payload: ExamCreate
): Promise<Exam> {
  const res = await http.post<Exam>("/planner/exams", payload);
  return res.data;
}

export async function deleteExam(examId: number): Promise<void> {
  await http.delete(`/planner/exams/${examId}`);
}

export async function updateExam(
  examId: number,
  payload: ExamCreate
): Promise<Exam> {
  const res = await http.patch<Exam>(
    `/planner/exams/${examId}`,
    payload
  );
  return res.data;
}

/* ------------------------------------------------------------------
 * Aggregat
 * ------------------------------------------------------------------ */

export const plannerApi = {
  // exam days
  listExamDays,
  getExamDay,
  createExamDay,
  deleteExamDay,

  // teams
  listExamDayTeams,
  createExamDayTeam,
  updateExamDayTeam,
  deleteExamDayTeam,

  // slots
  listExamSlots,
  generateSlotsForTeam,
  deleteSlotsForTeam,

  // exams
  createExam,
  deleteExam,
  updateExam,
};

export default plannerApi;
// end of src/lib/api/planner.api.ts