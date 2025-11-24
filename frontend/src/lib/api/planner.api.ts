// src/lib/api/planner.api.ts
import { getJson, postJson, putJson, del } from "./core";
import type { PruefungstagLite, Zeitschema, Slot } from "@/types/planner.types";

const PREFIX = "/planner";

/* ====================== Stammdaten ====================== */
export interface Kammer {
  kammer_id: number;
  kammer_name: string;
}

export interface Bezirkskammer {
  bezirkskammer_id: number;
  kammer_id: number;
  bezirkskammer_name: string;
}

export async function listKammern() {
  return await getJson<Kammer[]>(`/stammdaten/kammer`);
}

export async function listBezirkskammern(kammer_id?: number) {
  const qs = kammer_id ? `?kammer_id=${kammer_id}` : "";
  return await getJson<Bezirkskammer[]>(`/stammdaten/bezirkskammer${qs}`);
}

/* ===== Fachbereiche & Ausschüsse ===== */

export interface Fachbereich {
  fachbereich_id: number;
  fachbereich_name: string;
}

export async function listFachbereiche() {
  return await getJson<Fachbereich[]>(`/stammdaten/fachbereiche`);
}

export interface AusschussLite {
  ausschuss_id: number;
  ausschuss_name: string;
}

/* ====================== Planner ====================== */

export interface PruefungstagListResp {
  items: PruefungstagLite[];
  total: number;
  page?: number;
  size?: number;
}

export interface PTAItem {
  pta_id: number;
  pruefungstag_id: number;
  ausschuss_id: number;
  raum?: string | null;
  max_pruefungen: number;
  bemerkung?: string | null;
  // vom Backend kommen zusätzlich z.B. ausschuss_name, aktiv – die
  // kannst du bei Bedarf hier ergänzen
}

const plannerApi = {
  // --- Prüfungstage ---
  listPruefungstage: async (params?: {
    page?: number;
    size?: number;
    von?: string;
    bis?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.size) qs.set("size", String(params.size));
    if (params?.von) qs.set("von", params.von);
    if (params?.bis) qs.set("bis", params.bis);

    const url = `${PREFIX}/pruefungstage${
      qs.toString() ? `?${qs.toString()}` : ""
    }`;

    const raw = await getJson<any>(url);
    const items: PruefungstagLite[] = Array.isArray(raw)
      ? raw
      : raw?.items ?? [];
    const total = Array.isArray(raw) ? items.length : raw?.total ?? items.length;
    const page = Array.isArray(raw) ? 1 : raw?.page;
    const size = Array.isArray(raw) ? items.length : raw?.size;

    const resp: PruefungstagListResp = { items, total, page, size };
    return resp;
  },

  createPruefungstag: async (dto: {
    datum: string;
    ort: string;
    kammer_id?: number;
    bezirkskammer_id?: number;
    fachbereich_id?: number;
    status?:
      | "geplant"
      | "laufend"
      | "pausiert"
      | "abgeschlossen"
      | "archiviert";
    raum_default?: string;
    bemerkung?: string;
  }) =>
    postJson<{ pruefungstag_id: number }>(`${PREFIX}/pruefungstage`, dto),

  getPruefungstag: async (pt_id: number) => {
    type Detail = {
      pruefungstag_id: number;
      datum: string;
      ort: string;
      status: string;
      kammer_id?: number;
      bezirkskammer_id?: number;
      fachbereich_id?: number;
      raum_default?: string | null;
      bemerkung?: string | null;
      ausschuesse: PTAItem[];
      slots: Slot[];
    };
    return await getJson<Detail>(`${PREFIX}/pruefungstage/${pt_id}`);
  },

  updatePruefungstag: async (pt_id: number, dto: UpdatePruefungstagDto) =>
    putJson<{ ok: boolean }>(`${PREFIX}/pruefungstage/${pt_id}`, dto),

  deletePruefungstag: async (pt_id: number) =>
    del(`${PREFIX}/pruefungstage/${pt_id}`),

  listAusschuesseForTag: async (pt_id: number) =>
    getJson<PTAItem[]>(`${PREFIX}/pruefungstage/${pt_id}/ausschuesse`),

  // --- Zeitschemata ---
  listZeitschemata: async () =>
    getJson<Zeitschema[]>(`${PREFIX}/zeitschemata`),

  // --- Slots ---
  listSlotsByPta: async (pta_id: number) =>
    getJson<Slot[]>(`${PREFIX}/pruefungstag_ausschuss/${pta_id}/slots`),

  generateSlots: async (
    pta_id: number,
    zeitschema_id: number,
    anzahl = 6,
    ueberschreiben = false,
  ) =>
    postJson<{ ok: boolean; anzahl: number }>(
      `${PREFIX}/pruefungstag_ausschuss/${pta_id}/slots/generate`,
      { zeitschema_id, anzahl, ueberschreiben },
    ),

  changeSlotStatus: async (
    slot_id: number,
    status: "frei" | "geplant" | "gesperrt" | "abgesagt",
  ) =>
    postJson<{ ok: boolean }>(`${PREFIX}/slots/${slot_id}/status`, {
      status,
    }),

  assignSlot: async (slot_id: number, pruefkandidat_id: number) =>
    postJson<{ ok: boolean; pruefung_id: number }>(
      `${PREFIX}/slots/${slot_id}/assign`,
      {
        pruefkandidat_id,
      },
    ),

  unassignSlot: async (slot_id: number) =>
    postJson<{ ok: boolean }>(`${PREFIX}/slots/${slot_id}/unassign`, {}),

  // ===== Wrapper für Stammdaten, damit plannerApi.listKammern() etc. weiter funktionieren
  listKammern: async () => listKammern(),
  listBezirkskammern: async (kammer_id?: number) =>
    listBezirkskammern(kammer_id),
  listFachbereiche: async () => listFachbereiche(),

  // ===== Fachbereiche & Ausschüsse (für Neuanlage / Filter) =====
  listAusschuesse: async (params?: {
    fachbereich_id?: number;
    kammer_id?: number;
    bezirkskammer_id?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.fachbereich_id)
      qs.set("fachbereich_id", String(params.fachbereich_id));
    if (params?.kammer_id) qs.set("kammer_id", String(params.kammer_id));
    if (params?.bezirkskammer_id)
      qs.set("bezirkskammer_id", String(params.bezirkskammer_id));

    const url = `${PREFIX}/ausschuesse${
      qs.toString() ? `?${qs.toString()}` : ""
    }`;
    return await getJson<AusschussLite[]>(url);
  },

  // Zuordnung Tag ↔ Ausschuss bleibt im Planner-Router
  assignAusschussToTag: async (
    pt_id: number,
    payload: {
      ausschuss_id: number;
      raum?: string;
      ort?: string;
      max_pruefungen?: number;
      aktiv?: boolean;
    },
  ) =>
    postJson<{ ok: boolean; pta_id: number }>(
      `${PREFIX}/pruefungstage/${pt_id}/ausschuesse`,
      payload,
    ),
};

export interface UpdatePruefungstagDto {
  datum?: string;
  ort?: string;
  kammer_id?: number | null;
  bezirkskammer_id?: number | null;
  fachbereich_id?: number | null;
  raum_default?: string | null;
  bemerkung?: string | null;
  status?: "geplant" | "laufend" | "pausiert" | "abgeschlossen" | "archiviert";
}

export default plannerApi;
