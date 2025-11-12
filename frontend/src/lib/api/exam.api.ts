// src/lib/api/exam.api.ts
import { getJson } from "./core";

/** Backend: /api/common/pruefungstage */
export type Pruefungstag = {
  pruefungstag_id: number;
  datum: string;           // ISO yyyy-mm-dd
  ausschuss_id?: number | null;
  status?: string | null;
};

export type ListPruefungstageParams = {
  ausschuss_id?: number;
  von?: string;  // yyyy-mm-dd
  bis?: string;  // yyyy-mm-dd
  status?: string;
  limit?: number;
  offset?: number;
};

function toQuery(params?: Record<string, any>) {
  if (!params) return "";
  const q = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => [k, String(v)])
  );
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function listPruefungstage(params?: ListPruefungstageParams) {
  return getJson<Pruefungstag[]>(`/api/common/pruefungstage${toQuery(params)}`);
}

export type SlotOut = {
  pruefung_id: number;
  pruefkandidat_id: number | null;
  kandidat_name: string | null;
  start_at: string | null;
  end_at: string | null;
  teil1_art: string | null;
  status: string | null;
  theorie_punkte: number | null;
  theorie_note: string | null;
};

export async function listSlots(pruefungstag_id: number) {
  return getJson<SlotOut[]>(`/api/common/pruefungstage/${pruefungstag_id}/pruefungen`);
}

export type PruefungDetailOut = SlotOut & {
  pruefungstag_id: number;
};

export async function getSlot(pruefung_id: number) {
  return getJson<PruefungDetailOut>(`/api/common/pruefungen/${pruefung_id}`);
}
