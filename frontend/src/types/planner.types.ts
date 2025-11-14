// src/types/planner.types.ts

export type StatusPT =
  | "geplant"
  | "laufend"
  | "pausiert"
  | "abgeschlossen"
  | "archiviert";

export interface PruefungstagLite {
  pruefungstag_id: number;
  datum: string;         // ISO YYYY-MM-DD
  ort: string;
  kammer_id?: number | null;
  bezirkskammer_id?: number | null;
  fachbereich_id?: number | null;
  status?: StatusPT;
}

export interface AusschussLink {
  pta_id: number;
  ausschuss_id: number;
  ausschuss_name?: string;  // <- wichtig, kommt vom Backend
  max_pruefungen?: number | null;
  raum?: string | null;
  aktiv?: boolean;
}

export interface Zeitschema {
  zeitschema_id: number;
  name: string;
  tag_start: string; // "HH:MM:SS"
  slot_dauer_minuten: number;
  puffer_minuten: number;
  pause_start?: string | null;
  pause_ende?: string | null;
  max_kandidaten_pro_slot?: number | null;
  aktiv?: boolean;
}

export interface Slot {
  slot_id: number;
  pruefungstag_id: number;
  pta_id: number;
  start_at: string; // ISO datetime
  end_at: string;
  status: "frei" | "geplant" | "gesperrt" | "abgesagt";
  capacity?: number;
  aktiv?: boolean;
}
