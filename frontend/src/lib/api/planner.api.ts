// src/lib/api/planner.api.ts

import { http } from "@/lib/httpClient";

export type ExamDayStatus = "planned" | "in_progress" | "done" | "canceled";
export type SlotStatus = "free" | "reserved" | "booked" | "blocked";

export type ExamType = "aevo" | "wfw" | "it" | "custom";
export type ExamStatus = "planned" | "in_progress" | "done" | "canceled" | "no_show";

export interface ExamDay {
  exam_day_id: number;
  org_unit_id: number;
  subject_id: number;
  time_scheme_id: number;
  date: string; // ISO-String vom Backend
  location: string | null;
  default_room: string | null;
  status: ExamDayStatus;
  is_active: boolean;
}

export interface ExamDayQueryParams {
  org_unit_id?: number;
  subject_id?: number;
  from?: string; // "YYYY-MM-DD"
  to?: string;   // "YYYY-MM-DD"
  status?: ExamDayStatus;
}

export interface ExamSlot {
  exam_slot_id: number;
  exam_day_id: number;
  committee_id: number;
  slot_index: number;
  start_time: string;
  end_time: string;
  status: SlotStatus;
  exam_id?: number | null;
  candidate_id?: number | null;
  candidate_first_name?: string | null;
  candidate_last_name?: string | null;
}

export interface Exam {
  exam_id: number;
  candidate_id: number;
  exam_day_id: number;
  exam_slot_id: number;
  committee_id: number;
  exam_type: ExamType;
  status: ExamStatus;
}

export interface ExamCreate {
  candidate_id: number;
  exam_day_id: number;
  exam_slot_id: number;
  exam_type?: ExamType;
}

// --- Exams ---

export async function createExam(payload: ExamCreate): Promise<Exam> {
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
  const res = await http.patch<Exam>(`/planner/exams/${examId}`, payload);
  return res.data;
}

// --- Exam Days ---

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

export interface ExamDayCreate {
  org_unit_id: number;
  subject_id: number;
  time_scheme_id: number;
  date: string; // "YYYY-MM-DD"
  location?: string | null;
  default_room?: string | null;
  status?: ExamDayStatus;
  is_active?: boolean;
}

export async function createExamDay(
  payload: ExamDayCreate
): Promise<ExamDay> {
  const res = await http.post<ExamDay>("/planner/exam-days", payload);
  return res.data;
}

// --- Committees am Prüfungstag ---

export interface ExamDayCommittee {
  exam_day_committee_id: number;
  exam_day_id: number;
  committee_id: number;
  room: string | null;
  location: string | null;
  time_scheme_id: number | null;
}

export interface ExamDayCommitteeCreate {
  committee_id: number;
  room?: string | null;
  location?: string | null;
  time_scheme_id: number;
}

export async function listExamDayCommittees(
  examDayId: number
): Promise<ExamDayCommittee[]> {
  const res = await http.get<ExamDayCommittee[]>(
    `/planner/exam-days/${examDayId}/committees`
  );
  return res.data;
}

export async function createExamDayCommittee(
  examDayId: number,
  payload: ExamDayCommitteeCreate
): Promise<ExamDayCommittee> {
  const res = await http.post<ExamDayCommittee>(
    `/planner/exam-days/${examDayId}/committees`,
    payload
  );
  return res.data;
}

// --- Slots generieren & laden ---

export interface GenerateSlotsResponse {
  created_slots: number;
}

export async function generateSlotsForCommittee(
  examDayCommitteeId: number
): Promise<GenerateSlotsResponse> {
  const res = await http.post<GenerateSlotsResponse>(
    `/planner/exam-day-committees/${examDayCommitteeId}/generate-slots`,
    {}
  );
  return res.data;
}

export async function listExamSlots(
  examDayId: number,
  committeeId?: number
): Promise<ExamSlot[]> {
  const params: Record<string, number> = {};
  if (committeeId !== undefined) {
    params.committee_id = committeeId;
  }

  const res = await http.get<ExamSlot[]>(
    `/planner/exam-days/${examDayId}/slots`,
    { params }
  );
  return res.data;
}

// Optionales Aggregat
export const plannerApi = {
  listExamDays,
  getExamDay,
  createExamDay,
  listExamDayCommittees,
  createExamDayCommittee,
  generateSlotsForCommittee,
  listExamSlots,
  createExam,
  deleteExam,
  updateExam,
};

export default plannerApi;

// End of frontend/src/lib/api/planner.api.ts
