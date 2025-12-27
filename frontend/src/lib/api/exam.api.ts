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

  const statusText =
    (ax?.response as any)?.statusText ??
    (status ? "Error" : "Network Error");

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
 *   NEU (Prüfungsteile, Protokoll, Bewertung)
 *   Backend-Router-Prefix: /exam -> hier /api/exam/...
 * ================================================== */

export type ExamType = "aevo" | "wfw" | "it" | "custom";

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
  protocol_text?: string | null;
}

export interface ExamWithParts {
  exam_id: number;
  exam_type: ExamType;
  status: string;
  parts: ExamPart[];
}

/* ---------- Protokoll (Pre-Check & Zeiten) ---------- */

export interface ExamProtocol {
  exam_protocol_id: number;
  exam_id: number;

  identity_checked: boolean;
  exam_ability_asked: boolean;
  bias_cleared: boolean;
  guest_examiner_consent: boolean;
  instructions_given: boolean;
  fraud_notice_given: boolean;
  devices_notice_given: boolean;

  precheck_comment?: string | null;

  start_time?: string | null; // ISO
  end_time?: string | null; // ISO

  part1_mode?: string | null; // 'presentation' | 'demonstration'
}

export interface ExamProtocolUpdatePayload {
  identity_checked?: boolean;
  exam_ability_asked?: boolean;
  bias_cleared?: boolean;
  guest_examiner_consent?: boolean;
  instructions_given?: boolean;
  fraud_notice_given?: boolean;
  devices_notice_given?: boolean;

  precheck_comment?: string | null;

  start_time?: string | null;
  end_time?: string | null;

  part1_mode?: string | null;
}

/* ---------- Member-Grading-Sheet ---------- */

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
  grading_sheet_definition_id: number;
  examiner_id: number | null;

  sheet_type: "member" | "final";
  status: "draft" | "submitted" | "locked" | string;

  total_points: number | null;
  total_grade: number | null;

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

/* ---------- API-Funktionen ---------- */

const EXAM_BASE = "/api/exam";

/** Exam inkl. automatisch angelegter Parts */
export async function fetchExamWithParts(examId: number): Promise<ExamWithParts> {
  return _getJson<ExamWithParts>(`${EXAM_BASE}/exams/${examId}/parts`);
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

/** Member-Sheet für aktuellen User & Prüfungsteil */
export async function fetchMyGradingSheet(examPartId: number): Promise<GradingSheet> {
  return _getJson<GradingSheet>(`${EXAM_BASE}/exam-parts/${examPartId}/my-grading-sheet`);
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

// End of frontend/src/lib/api/exam.api.ts
