// frontend/src/types/admin.types.ts

export type TimeSchemeOut = {
  time_scheme_id: number;
  name: string;
  default_first_slot_start: string; // "HH:MM:SS"
  exam_duration_minutes: number;
  discussion_buffer_minutes: number;
  max_slots: number;
  lunch_after_slots: number | null;
  lunch_break_duration_minutes: number | null;
  is_active: boolean;
  created_at: string; // ISO
  updated_at: string; // ISO
};

export type TimeSchemeCreate = {
  name: string;
  default_first_slot_start: string; // "HH:MM" oder "HH:MM:SS"
  exam_duration_minutes: number;
  discussion_buffer_minutes: number;
  max_slots: number;
  lunch_after_slots?: number | null;
  lunch_break_duration_minutes?: number | null;
  is_active?: boolean;
};

export type TimeSchemeUpdate = Partial<TimeSchemeCreate>;

export type TimeSchemeDefaultOut = {
  time_scheme_default_id: number;
  org_unit_id: number;
  subject_id: number;
  time_scheme_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TimeSchemeDefaultCreate = {
  org_unit_id: number;
  subject_id: number;
  time_scheme_id: number;
  is_active?: boolean;
};

export type TimeSchemeDefaultUpdate = Partial<TimeSchemeDefaultCreate>;

export type ResolvedTimeSchemeOut = {
  org_unit_id: number;
  subject_id: number;
  resolved_time_scheme_id: number | null;
  resolved_from_org_unit_id: number | null;
};
