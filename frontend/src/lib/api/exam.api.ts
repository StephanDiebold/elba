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

async function _delete(path: string): Promise<void> {
  try {
    await httpClient.delete(path);
  } catch (err) {
    throw toApiError("DELETE", path, err);
  }
}

/* ==================================================
 *   EXAM API
 *   Backend-Router-Prefix: /exam
 * ================================================== */

const EXAM_BASE = "/exam";

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

/* ---------- Protokoll ---------- */

export interface ExamProtocol {
  exam_protocol_id: number;
  exam_id: number;

  start_time?: string | null;
  end_time?: string | null;

  signed_by_chair?: boolean;
  signed_by_examiner_2?: boolean;
  signed_by_examiner_3?: boolean;

  part1_mode?: Part1Mode | null;
}

export interface ExamProtocolUpdatePayload {
  start_time?: string | null;
  end_time?: string | null;

  signed_by_chair?: boolean;
  signed_by_examiner_2?: boolean;
  signed_by_examiner_3?: boolean;

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

  subject_id?: number | null;

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

/* ---------- Member-Sheet (view) ---------- */

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
  criterion_id: number;
  decided_points?: number | null;
  decided_grade?: number | null;
  combined_comment?: string | null;
}

export interface FinalSheetDecisionIn {
  criteria: FinalCriterionDecisionIn[];
}

/* ==================================================
 *   CORE API-Funktionen
 * ================================================== */

/** Exam inkl. Parts */
export async function fetchExamWithParts(examId: number): Promise<ExamWithParts> {
  return _getJson<ExamWithParts>(`${EXAM_BASE}/exams/${examId}/parts`);
}

/** Prüfung starten */
export async function startExam(examId: number, part1_mode?: Part1Mode): Promise<ExamStartOut> {
  return _postJson<ExamStartOut>(`${EXAM_BASE}/exams/${examId}/start`, {
    part1_mode: part1_mode ?? null,
  });
}

/**
 * Prüfung stoppen (status: in_progress → paused).
 * Backend: POST /exam/exams/{exam_id}/stop
 */
export async function stopExam(examId: number): Promise<ExamStartOut> {
  return _postJson<ExamStartOut>(`${EXAM_BASE}/exams/${examId}/stop`, {});
}

/**
 * Prüfung zurücksetzen: started_at löschen, status → "planned".
 * Timer startet beim nächsten Start neu.
 * Backend: POST /exam/exams/{exam_id}/reset
 */
export async function resetExam(examId: number): Promise<ExamStartOut> {
  return _postJson<ExamStartOut>(`${EXAM_BASE}/exams/${examId}/reset`, {});
}

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

/** Protokoll holen */
export async function fetchExamProtocol(examId: number): Promise<ExamProtocol> {
  return _getJson<ExamProtocol>(`${EXAM_BASE}/exams/${examId}/protocol`);
}

/** Protokoll aktualisieren */
export async function updateExamProtocol(
  examId: number,
  payload: ExamProtocolUpdatePayload
): Promise<ExamProtocol> {
  return _putJson<ExamProtocol>(`${EXAM_BASE}/exams/${examId}/protocol`, payload);
}

/** Member-Sheet (raw) */
export async function fetchMyGradingSheet(examPartId: number): Promise<GradingSheet> {
  return _getJson<GradingSheet>(`${EXAM_BASE}/exam-parts/${examPartId}/my-grading-sheet`);
}

/** Member-Sheet View */
export async function fetchMyGradingSheetView(examPartId: number): Promise<MemberGradingSheetView> {
  return _getJson<MemberGradingSheetView>(
    `${EXAM_BASE}/exam-parts/${examPartId}/my-grading-sheet/view`
  );
}

/** Items auf einem Sheet speichern */
export async function updateGradingSheetItemsApi(
  sheetId: number,
  payload: GradingSheetUpdate
): Promise<void> {
  await _putJson<{ status: string }>(`${EXAM_BASE}/grading-sheets/${sheetId}/items`, payload);
}

/** Member-Sheet einreichen */
export async function submitMyGradingSheet(
  sheetId: number
): Promise<{ status: string; all_submitted_for_part: boolean }> {
  return _postJson<{ status: string; all_submitted_for_part: boolean }>(
    `${EXAM_BASE}/grading-sheets/${sheetId}/submit`,
    {}
  );
}

/** Final-Sheet */
export async function fetchFinalGradingSheet(examPartId: number): Promise<FinalSheet> {
  return _getJson<FinalSheet>(`${EXAM_BASE}/exam-parts/${examPartId}/final-grading-sheet`);
}

/** Final-Sheet Entscheidungen */
export async function updateFinalGradingSheet(
  examPartId: number,
  payload: FinalSheetDecisionIn
): Promise<FinalSheet> {
  return _putJson<FinalSheet>(`${EXAM_BASE}/exam-parts/${examPartId}/final-grading-sheet`, payload);
}

/* ==================================================
 *   Expert Discussion (Teil 2 Fachgespräch)
 * ================================================== */

export type AreaScoreUpdateIn = {
  mode: "points" | "grades";
  points_100?: number | null;
  grade?: number | null;
};

export interface ExpertDiscussionBundleOut {
  exam_part_id: number;
  exam_id: number;
  subject_id: number;
  areas: ExamExpertDiscussionAreaOut[];
  // Aggregierte Gesamtwerte (optional, vom Backend berechnet)
  total_points_100?: number | null;
  total_grade?: number | null;
}

export interface ExamExpertDiscussionItemOut {
  exam_expert_discussion_item_id: number;
  exam_expert_discussion_area_id: number;

  template_item_id?: number | null;
  question_text?: string | null;
  answer_text?: string | null;
  examiner_comment?: string | null;

  sort_order: number;
}

export interface ExamExpertDiscussionAreaOut {
  exam_expert_discussion_area_id: number;
  exam_part_id: number;

  expert_discussion_area_id: number;
  area_title: string;

  description?: string | null;
  expected_answer?: string | null;

  points_100?: number | null;
  grade?: number | null;

  items: ExamExpertDiscussionItemOut[];
  // Template-Items für Dropdown-Vorschläge (optional)
  template_items?: ExpertDiscussionAreaTemplate[] | null;
}

export interface ExamExpertDiscussionItemCreateIn {
  template_item_id?: number | null;
  question_text?: string | null;
  answer_text?: string | null;
  examiner_comment?: string | null;
  sort_order?: number | null;
}

export interface ExamExpertDiscussionItemUpdateIn extends ExamExpertDiscussionItemCreateIn {}

/** Template-Item für Dropdown-Vorschläge im Fachgespräch */
export interface ExpertDiscussionAreaTemplate {
  template_item_id: number;
  expert_discussion_area_id: number;
  question_text: string;
  expected_answer?: string | null;
  sort_order?: number | null;
}

export interface ExpertDiscussionAreaCreateIn {
  expert_discussion_area_id?: number | null;
  area_title?: string | null;
}

export async function fetchExpertDiscussionBundle(
  examId: number
): Promise<ExpertDiscussionBundleOut> {
  return _getJson<ExpertDiscussionBundleOut>(
    `${EXAM_BASE}/exams/${examId}/expert-discussion`
  );
}

/**
 * Template-Items für eine Area laden (Dropdown-Vorschläge).
 * Backend: GET /exam/exams/{exam_id}/expert-discussion/areas/{area_id}/templates
 */
export async function fetchExpertDiscussionAreaTemplates(
  examId: number,
  examAreaId: number
): Promise<ExpertDiscussionAreaTemplate[]> {
  return _getJson<ExpertDiscussionAreaTemplate[]>(
    `${EXAM_BASE}/exams/${examId}/expert-discussion/areas/${examAreaId}/templates`
  );
}

/**
 * Eine neue Area zum Fachgespräch hinzufügen.
 * Backend: POST /exam/exams/{exam_id}/expert-discussion/areas
 */
export async function addExpertDiscussionArea(
  examId: number,
  payload: ExpertDiscussionAreaCreateIn
): Promise<ExamExpertDiscussionAreaOut> {
  return _postJson<ExamExpertDiscussionAreaOut>(
    `${EXAM_BASE}/exams/${examId}/expert-discussion/areas`,
    payload
  );
}

/**
 * Eine Area aus dem Fachgespräch entfernen.
 * Backend: DELETE /exam/exams/{exam_id}/expert-discussion/areas/{area_id}
 */
export async function deleteExpertDiscussionArea(
  examId: number,
  examAreaId: number
): Promise<void> {
  return _delete(
    `${EXAM_BASE}/exams/${examId}/expert-discussion/areas/${examAreaId}`
  );
}

export async function updateExpertDiscussionAreaScore(
  examId: number,
  examAreaId: number,
  payload: AreaScoreUpdateIn
): Promise<ExamExpertDiscussionAreaOut> {
  return _putJson<ExamExpertDiscussionAreaOut>(
    `${EXAM_BASE}/exams/${examId}/expert-discussion/areas/${examAreaId}`,
    payload
  );
}

export async function createExpertDiscussionItem(
  examId: number,
  examAreaId: number,
  payload: ExamExpertDiscussionItemCreateIn
): Promise<ExamExpertDiscussionItemOut> {
  return _postJson<ExamExpertDiscussionItemOut>(
    `${EXAM_BASE}/exams/${examId}/expert-discussion/areas/${examAreaId}/items`,
    payload
  );
}

export async function updateExpertDiscussionItem(
  examId: number,
  itemId: number,
  payload: ExamExpertDiscussionItemUpdateIn
): Promise<ExamExpertDiscussionItemOut> {
  return _putJson<ExamExpertDiscussionItemOut>(
    `${EXAM_BASE}/exams/${examId}/expert-discussion/items/${itemId}`,
    payload
  );
}

export async function deleteExpertDiscussionItem(
  examId: number,
  itemId: number
): Promise<void> {
  return _delete(`${EXAM_BASE}/exams/${examId}/expert-discussion/items/${itemId}`);
}

export async function submitExpertDiscussion(examId: number): Promise<{ ok: boolean }> {
  return _postJson<{ ok: boolean }>(
    `${EXAM_BASE}/exams/${examId}/expert-discussion/submit`,
    {}
  );
}

/* ==================================================
 *   Grade Key (IHK)
 * ================================================== */

export interface ActiveGradeKeyOut {
  subject_id: number;
  grade_key_version_id: number;
}

export interface GradeKeyEntryOut {
  grade_key_entry_id: number;
  grade_key_version_id: number;
  points_100: number;
  grade_decimal: number;
  grade_letter?: string | null;
  grade_text?: string | null;
}

export async function fetchActiveGradeKey(subjectId: number): Promise<ActiveGradeKeyOut> {
  return _getJson<ActiveGradeKeyOut>(`${EXAM_BASE}/subjects/${subjectId}/grade-key/active`);
}

export async function fetchGradeKeyEntries(gradeKeyVersionId: number): Promise<GradeKeyEntryOut[]> {
  return _getJson<GradeKeyEntryOut[]>(`${EXAM_BASE}/grade-keys/${gradeKeyVersionId}/entries`);
}

export interface ActiveGradeKeyWithEntriesOut {
  subject_id: number;
  grade_key_version_id: number;
  entries: GradeKeyEntryOut[];
}

export async function fetchActiveGradeKeyWithEntries(
  subjectId: number
): Promise<ActiveGradeKeyWithEntriesOut> {
  const active = await fetchActiveGradeKey(subjectId);
  const entries = await fetchGradeKeyEntries(active.grade_key_version_id);
  return {
    subject_id: active.subject_id,
    grade_key_version_id: active.grade_key_version_id,
    entries,
  };
}
// end of src/lib/api/exam.api.ts
