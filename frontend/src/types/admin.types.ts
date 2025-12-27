// frontend/src/types/admin.types.ts
// Sammel-Typen für dein Admin-Frontend (ELBA)
// Hinweis: Das File ist bewusst "flat" gehalten, damit Imports stabil bleiben.

//
// ---------------------------------------------
// Shared / Helpers
// ---------------------------------------------
//

export type OrgUnitType = "chamber" | "district_chamber";

//
// ---------------------------------------------
// Org Units (Organisationseinheiten)
// ---------------------------------------------
//

export interface OrgUnitBase {
  type: OrgUnitType;
  name: string;
  code?: string | null;
  is_active: boolean;
  parent_org_unit_id?: number | null;
}

export interface OrgUnitOut extends OrgUnitBase {
  org_unit_id: number;
  created_at: string; // ISO date-time
  updated_at: string; // ISO date-time
}

export interface OrgUnitCreate {
  type: OrgUnitType;
  name: string;
  code?: string | null;
  is_active?: boolean; // default true backend
  parent_org_unit_id?: number | null;
}

export interface OrgUnitUpdate {
  type?: OrgUnitType | null;
  name?: string | null;
  code?: string | null;
  is_active?: boolean | null;
  parent_org_unit_id?: number | null;
}

export interface OrgUnitListQuery {
  type?: OrgUnitType;
  is_active?: boolean;
  parent_org_unit_id?: number;
  search?: string;
  page?: number;
  size?: number;
}

//
// ---------------------------------------------
// Committees (Ausschüsse) + Meta
// ---------------------------------------------
//

export interface CommitteeOut {
  committee_id: number;
  org_unit_id: number;
  name: string;
  description: string | null;
  is_active: boolean | null;
}

export interface CommitteeCreate {
  org_unit_id: number;
  name: string;
  description?: string | null;
  is_active?: boolean | null;
}

export interface CommitteeUpdate {
  org_unit_id?: number | null;
  name?: string | null;
  description?: string | null;
  is_active?: boolean | null;
}

export interface CommitteeListQuery {
  org_unit_id?: number;
  is_active?: boolean;
  search?: string;
  page?: number;
  size?: number;
}

export interface CommitteeFunctionOut {
  committee_function_id: number;
  code: string;
  display_name_de: string;
}

export interface CommitteePositionOut {
  committee_position_id: number;
  code: string;
  display_name_de: string;
}

//
// ---------------------------------------------
// Users (Admin-Sicht) + Zuordnungen
// ---------------------------------------------
//

export interface AdminUserSummary {
  user_id: number;
  email: string;
  display_name?: string | null;
}

export interface CommitteeMemberOut {
  user_committee_id: number;
  user_id: number;
  committee_id: number;

  committee_function_id: number | null;
  committee_function_name: string | null;

  committee_position_id: number | null;
  committee_position_name: string | null;

  display_name: string;
  email: string;

  is_active: boolean;
}

export interface UserCommitteeOut {
  user_committee_id: number;
  committee_id: number;
  user_id: number;
  user?: AdminUserSummary;
}

export interface UserCommitteeCreate {
  user_id: number;
  committee_id: number;
  committee_function_id?: number | null;
  committee_position_id?: number | null;
  is_active?: boolean | null;
}

export interface UserCommitteeUpdate {
  user_id?: number | null;
  committee_id?: number | null;
  committee_function_id?: number | null;
  committee_position_id?: number | null;
  is_active?: boolean | null;
}

//
// ---------------------------------------------
// Roles (falls vorhanden / später)
// ---------------------------------------------
//

export interface RoleOut {
  role_id: number;
  code: string;
  display_name_de?: string | null;
  is_active?: boolean | null;
}

//
// ---------------------------------------------
// Subjects (Fächer)
// ---------------------------------------------
//

export type SubjectOut = {
  subject_id: number;
  code: string; // z.B. "AEVO"
  display_name_de: string;
  // optional, falls dein Backend es liefert:
  // is_active?: boolean;
};

export type SubjectCreate = {
  code: string;
  display_name_de: string;
  // is_active?: boolean;
};

export type SubjectUpdate = Partial<SubjectCreate>;

//
// ---------------------------------------------
// Time Schemes (Zeitschemata)
// ---------------------------------------------
//

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

  // akzeptiere "HH:MM" oder "HH:MM:SS"
  default_first_slot_start: string;

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

//
// ---------------------------------------------
// Optional: Generic Pagination / Meta
// (nur wenn du es brauchst; ansonsten kannst du das löschen)
// ---------------------------------------------
//

export type ApiMeta = {
  total?: number;
  page?: number;
  size?: number;
};
// End of file