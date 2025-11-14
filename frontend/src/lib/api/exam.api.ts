// src/lib/api/exam.api.ts
import { api } from "@/lib/api";

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

/* ===================== Helper ===================== */
async function _getJson<T>(path: string): Promise<T> {
  const res = await api.reqRaw(path, { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(`[GET ${path}] ${res.status} ${res.statusText}`, res.status, text);
  }
  return (await res.json()) as T;
}

async function _postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await api.reqRaw(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? "{}" : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(`[POST ${path}] ${res.status} ${res.statusText}`, res.status, text);
  }
  return (await res.json()) as T;
}

async function _deleteJson<T>(path: string): Promise<T> {
  const res = await api.reqRaw(path, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(`[DELETE ${path}] ${res.status} ${res.statusText}`, res.status, text);
  }
  return (await res.json()) as T;
}


/* ===================== Types ===================== */
export type ExamDay = {
  pruefungstag_id: number;
  datum: string;                           // yyyy-mm-dd
  ort: string;
  raum?: string | null;
  ausschuss_id: number;
  status: "geplant" | "laufend" | "pausiert" | "abgeschlossen" | "archiviert";
  start_time: string;                      // "08:10:00"
  exam_minutes: number;                    // 30
  debrief_minutes: number;                 // 25
  break_start: string;                     // "12:40:00"
  break_end: string;                       // "13:30:00"
  max_exams: number;                       // 9
};

export type ExamSlot = {
  pruefung_id: number;
  pruefkandidat_id?: number | null;
  kandidat_name?: string | null;
  start_at?: string | null;                // ISO datetime
  end_at?: string | null;
  teil1_art: "praesentation" | "durchfuehrung";
  status: "geplant" | "aufgerufen" | "teil1" | "teil2" | "bewertung" | "final";
  theorie_punkte?: number | null;
  theorie_note?: number | null;
};

export async function clearSlots(dayId: number): Promise<{ ok: boolean; deleted: number }> {
  return _deleteJson<{ ok: boolean; deleted: number }>(`/api/exam/pruefungstage/${dayId}/pruefungen`);
}

/* ===================== API ===================== */
/** Liste der Prüfungstage */
export async function fetchExamDays(): Promise<ExamDay[]> {
  return _getJson<ExamDay[]>("/api/exam/pruefungstage");
}

/** Einzelner Prüfungstag */
export async function fetchExamDay(id: number): Promise<ExamDay> {
  return _getJson<ExamDay>(`/api/exam/pruefungstage/${id}`);
}

/** Slots/Prüfungen eines Tages */
export async function fetchExamSlots(dayId: number): Promise<ExamSlot[]> {
  return _getJson<ExamSlot[]>(`/api/exam/pruefungstage/${dayId}/pruefungen`);
}

/** Slots gemäß Tageskonfiguration generieren */
export async function generateSlots(dayId: number): Promise<{ ok: boolean; created: number[] }> {
  return _postJson<{ ok: boolean; created: number[] }>(
    `/api/exam/pruefungstage/${dayId}/generate`,
    {}
  );
}
