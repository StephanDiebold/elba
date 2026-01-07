// src/lib/api/exam.api.ts
import type { AxiosError } from "axios";
import { httpClient } from "@/lib/httpClient";

/* ===================== Error ===================== */

export class ApiError extends Error {
  status: number;
  body?: string;
  constructor(msg: string, status: number, body?: string) {
    super(msg);
    this.status = status;
    this.body = body;
  }
}

function toApiError(method: string, path: string, err: unknown): ApiError {
  const ax = err as AxiosError<any>;
  const status = ax?.response?.status ?? 0;

  let body: string | undefined;
  try {
    const data = ax?.response?.data;
    body = typeof data === "string" ? data : data ? JSON.stringify(data) : undefined;
  } catch {
    body = undefined;
  }

  const statusText = (ax?.response as any)?.statusText ?? (status ? "Error" : "Network Error");

  return new ApiError(`[${method} ${path}] ${status} ${statusText}`, status, body);
}

/* ===================== Helper ===================== */

async function _getJson<T>(path: string): Promise<T> {
  try {
    const { data } = await httpClient.get<T>(path);
    return data;
  } catch (err) {
    throw toApiError("GET", path, err);
  }
}

async function _postJson<T>(path: string, body?: unknown): Promise<T> {
  try {
    const { data } = await httpClient.post<T>(path, body ?? {});
    return data;
  } catch (err) {
    throw toApiError("POST", path, err);
  }
}

async function _putJson<T>(path: string, body?: unknown): Promise<T> {
  try {
    const { data } = await httpClient.put<T>(path, body ?? {});
    return data;
  } catch (err) {
    throw toApiError("PUT", path, err);
  }
}

/* ==================================================
 *   EXAM API
 *   Backend-Router-Prefix: /exam
 * ================================================== */

export type ExamType = "aevo" | "wfw" | "it" | "custom";

/* ---------- Exam Parts ---------- */

export interface ExamPart {
  exam_part_id: number;
  exam_id: number;
  part_number: number;
  title: string;
  part_mode?: string | null;
  weight: number;
  status: string;
  points?: number | null;
  grade?: number | null;
}

/* ---------- Start / Lifecycle ---------- */

export type Part1Mode = "presentation" | "demonstration";

export interface ExamStartOut {
  exam_id: number;
  status: string;
  started_at: string | null;
  attendance_status: string | null;
  part1_mode: Part1Mode | null;
}

/* ---------- Protokoll (Zeiten/Signaturen) ---------- */

export interface ExamProtocol {
  exam_protocol_id: number;
  exam_id: number;

  start_time?: string | null; // ISO
  end_time?: string | null; // ISO

  // Achtung: Backend kann das evtl. (noch) nicht liefern – optional halten
  signed_by_chair?: boolean;
  signed_by_examiner_2?: boolean;
  signed_by_examiner_3?: boolean;

  // kommt bei dir im Router aus part1.part_mode (nicht aus exam_protocol)
  part1_mode?: Part1Mode | null;
}

export interface ExamProtocolUpdatePayload {
  start_time?: string | null;
  end_time?: string | null;

  signed_by_chair?: boolean;
  signed_by_examiner_2?: boolean;
  signed_by_examiner_3?: boolean;

  // optional, weil dein PUT /protocol part1_mode separat auf exam_part schreibt
  part1_mode?: Part1Mode | null;
}

/* ---------- Check-in (MVP) ---------- */

export interface ExamCheckin {
  exam_id: number;

  identity_checked: boolean;
  fit_for_exam_confirmed: boolean;
  conflict_of_interest_cleared: boolean;
  procedure_info_given: boolean;
  phone_notice_given: boolean;

  guest_observer_consent?: boolean | null;
  notes?: string | null;

  created_at?: string;
  updated_at?: string;
}

export interface ExamCheckinUpdatePayload {
  identity_checked?: boolean;
  fit_for_exam_confirmed?: boolean;
  conflict_of_interest_cleared?: boolean;
  procedure_info_given?: boolean;
  phone_notice_given?: boolean;

  guest_observer_consent?: boolean | null;
  notes?: string | null;
}

/* ---------- Exam With Parts ---------- */

export interface ExamWithParts {
  exam_id: number;
  exam_type: ExamType;
  status: string;

  started_at?: string | null;
  attendance_status?: string | null;
  part1_mode?: Part1Mode | null;

  parts: ExamPart[];
}

/* ---------- Member-Sheet (raw) ---------- */

export interface GradingItem {
  exam_grading_item_id: number;
  exam_grading_sheet_id: number;
  grading_criterion_definition_id: number;

  points: number | null;
  grade: number | null;
  comment: string | null;
}

export interface GradingSheet {
  exam_grading_sheet_id: number;
  exam_part_id: number;

  // kann im Backend existieren, muss aber nicht zwingend im Response sein -> optional halten
  grading_sheet_definition_id?: number;

  examiner_id: number | null;

  sheet_type: "member" | "final";
  status: "draft" | "submitted" | "locked" | string;

  total_points?: number | null;
  total_grade?: number | null;

  items: GradingItem[];
}

export interface GradingItemUpdate {
  exam_grading_item_id: number;
  grade?: number | null;
  points?: number | null;
  comment?: string | null;
}

export interface GradingSheetUpdate {
  items: GradingItemUpdate[];
}

/* ---------- Member-Sheet (view: grouped by grading_area) ---------- */

export interface MemberCriterionItem {
  exam_grading_item_id: number;
  grading_criterion_definition_id: number;

  criterion_number: number;
  criterion_title: string;
  criterion_description?: string | null;
  max_points: number;

  grade: number | null;
  points: number | null;
  comment: string | null;
}

export interface MemberArea {
  grading_area_id: number;
  area_number: number;
  title: string;
  description?: string | null;

  criteria: MemberCriterionItem[];
}

export interface MemberGradingSheetView {
  exam_grading_sheet_id: number;
  exam_part_id: number;
  examiner_id: number;
  sheet_type: "member";
  status: "draft" | "submitted" | "locked" | string;

  areas: MemberArea[];
}

/* ---------- Final-Sheet ---------- */

export interface MemberRating {
  examiner_id: number;
  examiner_name: string;
  grade?: number | null;
  points?: number | null;
  comment?: string | null;
}

export interface FinalCriterion {
  criterion_id: number;
  criterion_number: number;
  title: string;
  description?: string | null;
  max_points: number;

  member_ratings: MemberRating[];

  suggested_points?: number | null;
  suggested_grade?: number | null;

  decided_points?: number | null;
  decided_grade?: number | null;
  combined_comment?: string | null;

  max_grade_diff?: number | null;
  max_points_diff?: number | null;
  has_conflict: boolean;
}

export interface FinalSheet {
  exam_part_id: number;
  exam_id: number;
  part_number: number;
  title: string;
  status: string;
  final_sheet_id?: number | null;
  criteria: FinalCriterion[];
}

export interface FinalCriterionDecisionIn {
  /** criterion_id == grading_criterion_definition_id */
  criterion_id: number;
  decided_points?: number | null;
  decided_grade?: number | null;
  combined_comment?: string | null;
}

export interface FinalSheetDecisionIn {
  criteria: FinalCriterionDecisionIn[];
}

/* ---------- API-Funktionen ---------- */

const EXAM_BASE = "/exam";

/** Check-in holen */
export async function fetchExamCheckin(examId: number): Promise<ExamCheckin> {
  return _getJson<ExamCheckin>(`${EXAM_BASE}/exams/${examId}/checkin`);
}

/** Check-in aktualisieren */
export async function updateExamCheckin(
  examId: number,
  payload: ExamCheckinUpdatePayload
): Promise<ExamCheckin> {
  return _putJson<ExamCheckin>(`${EXAM_BASE}/exams/${examId}/checkin`, payload);
}

/** Exam inkl. automatisch angelegter Parts */
export async function fetchExamWithParts(examId: number): Promise<ExamWithParts> {
  return _getJson<ExamWithParts>(`${EXAM_BASE}/exams/${examId}/parts`);
}

/** Prüfung starten (setzt started_at/status; optional part1_mode) */
export async function startExam(examId: number, part1_mode?: Part1Mode): Promise<ExamStartOut> {
  return _postJson<ExamStartOut>(`${EXAM_BASE}/exams/${examId}/start`, {
    part1_mode: part1_mode ?? null,
  });
}

/** Protokoll holen */
export async function fetchExamProtocol(examId: number): Promise<ExamProtocol> {
  return _getJson<ExamProtocol>(`${EXAM_BASE}/exams/${examId}/protocol`);
}

/** Protokoll aktualisieren (Pre-Check + Zeiten + part1_mode) */
export async function updateExamProtocol(
  examId: number,
  payload: ExamProtocolUpdatePayload
): Promise<ExamProtocol> {
  return _putJson<ExamProtocol>(`${EXAM_BASE}/exams/${examId}/protocol`, payload);
}

/** Member-Sheet (raw) für aktuellen User & Prüfungsteil */
export async function fetchMyGradingSheet(examPartId: number): Promise<GradingSheet> {
  return _getJson<GradingSheet>(`${EXAM_BASE}/exam-parts/${examPartId}/my-grading-sheet`);
}

/** Member-Sheet View (grouped by grading_area) */
export async function fetchMyGradingSheetView(examPartId: number): Promise<MemberGradingSheetView> {
  return _getJson<MemberGradingSheetView>(
    `${EXAM_BASE}/exam-parts/${examPartId}/my-grading-sheet/view`
  );
}

/** Items (Noten/Punkte/Kommentare) auf einem Sheet speichern */
export async function updateGradingSheetItemsApi(
  sheetId: number,
  payload: GradingSheetUpdate
): Promise<void> {
  await _putJson<{ status: string }>(`${EXAM_BASE}/grading-sheets/${sheetId}/items`, payload);
}

/** Member-Sheet einreichen (Status -> submitted) */
export async function submitMyGradingSheet(
  sheetId: number
): Promise<{ status: string; all_submitted_for_part: boolean }> {
  return _postJson<{ status: string; all_submitted_for_part: boolean }>(
    `${EXAM_BASE}/grading-sheets/${sheetId}/submit`,
    {}
  );
}

/** Konsolidiertes Final-Sheet für einen Prüfungsteil */
export async function fetchFinalGradingSheet(examPartId: number): Promise<FinalSheet> {
  return _getJson<FinalSheet>(`${EXAM_BASE}/exam-parts/${examPartId}/final-grading-sheet`);
}

/** Final-Sheet Entscheidungen schreiben (Ausschuss-Bogen) */
export async function updateFinalGradingSheet(
  examPartId: number,
  payload: FinalSheetDecisionIn
): Promise<FinalSheet> {
  return _putJson<FinalSheet>(`${EXAM_BASE}/exam-parts/${examPartId}/final-grading-sheet`, payload);
}

// End of src/lib/api/exam.api.ts
