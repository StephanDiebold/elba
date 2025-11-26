// src/types/admin.types.ts

// erlaubte Typen aus dem OpenAPI-Schema:
// enum: ["chamber", "district_chamber"]
export type OrgUnitType = "chamber" | "district_chamber";

/**
 * Basisstruktur einer Organisationseinheit
 * (gemeinsame Felder für Create/Update/Out)
 */
export interface OrgUnitBase {
  type: OrgUnitType;
  name: string;
  code?: string | null;
  is_active: boolean;
  parent_org_unit_id?: number | null;
}

/**
 * OrgUnit, wie sie von der API zurückgegeben wird
 * (GET /admin/org-units, GET /admin/org-units/{id})
 *
 * OpenAPI: OrgUnitOut
 */
export interface OrgUnitOut extends OrgUnitBase {
  org_unit_id: number;
  created_at: string; // ISO-String (date-time)
  updated_at: string; // ISO-String (date-time)
}

/**
 * Payload für das Anlegen einer Organisationseinheit
 * (POST /admin/org-units)
 *
 * OpenAPI: OrgUnitCreate
 * required: type, name
 */
export interface OrgUnitCreate {
  type: OrgUnitType;
  name: string;
  code?: string | null;
  /**
   * optional – default ist true im Backend
   */
  is_active?: boolean;
  parent_org_unit_id?: number | null;
}

/**
 * Payload für das (partielle) Aktualisieren
 * (PATCH /admin/org-units/{org_unit_id})
 *
 * OpenAPI: OrgUnitUpdate
 * Alle Felder optional, können auch null sein.
 */
export interface OrgUnitUpdate {
  type?: OrgUnitType | null;
  name?: string | null;
  code?: string | null;
  is_active?: boolean | null;
  parent_org_unit_id?: number | null;
}

/**
 * Query-Parameter für die Liste
 * (GET /admin/org-units)
 *
 * type:  Filter nach Typ
 * is_active: nur aktive/inaktive
 * search: Volltextsuche auf name / code
 * page/size: Pagination
 */
export interface OrgUnitListQuery {
  type?: OrgUnitType;
  is_active?: boolean;
  search?: string;
  page?: number;
  size?: number;
}

/* === Committees (Ausschüsse) === */

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
}

// === Admin-User (vereinfachte Sicht) ===
export interface AdminUserSummary {
  user_id: number;
  email: string;
  display_name?: string | null;
}

// === User ↔ Committee Mapping ===
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
  user?: AdminUserSummary; // kommt meist aus /admin/committees/{id}/members
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

// Ausschuss-Funktion
export interface CommitteeFunctionOut {
  committee_function_id: number;
  code: string;
  display_name_de: string;
}

// Ausschuss-Position
export interface CommitteePositionOut {
  committee_position_id: number;
  code: string;
  display_name_de: string;
}

/** End of admin.types.ts */