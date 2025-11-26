// src/lib/api/orgUnits.api.ts

import { http } from "@/lib/httpClient";
import type {
  OrgUnitOut,
  OrgUnitCreate,
  OrgUnitUpdate,
  OrgUnitListQuery,
} from "@/types/admin.types";

export type OrgUnitId = number;

const BASE_PATH = "/admin/org-units";

/**
 * Hilfsfunktion, um nur sinnvolle Query-Parameter zu senden.
 */
function buildOrgUnitQueryParams(params?: OrgUnitListQuery) {
  if (!params) return undefined;

  const query: Record<string, string | number | boolean> = {};

  if (params.type) query.type = params.type;
  if (typeof params.is_active === "boolean") query.is_active = params.is_active;
  if (params.search && params.search.trim().length > 0) {
    query.search = params.search.trim();
  }
  if (params.page) query.page = params.page;
  if (params.size) query.size = params.size;

  return query;
}

/**
 * Liste aller Organisationseinheiten
 * GET /admin/org-units
 */
export async function listOrgUnits(
  params?: OrgUnitListQuery
): Promise<OrgUnitOut[]> {
  const { data } = await http.get<OrgUnitOut[]>(BASE_PATH, {
    params: buildOrgUnitQueryParams(params),
  });
  return data;
}

/**
 * Einzelne Organisationseinheit laden
 * GET /admin/org-units/{org_unit_id}
 */
export async function getOrgUnit(orgUnitId: OrgUnitId): Promise<OrgUnitOut> {
  const { data } = await http.get<OrgUnitOut>(`${BASE_PATH}/${orgUnitId}`);
  return data;
}

/**
 * Neue Organisationseinheit anlegen
 * POST /admin/org-units
 */
export async function createOrgUnit(
  payload: OrgUnitCreate
): Promise<OrgUnitOut> {
  const { data } = await http.post<OrgUnitOut>(BASE_PATH, payload);
  return data;
}

/**
 * Organisationseinheit vollständig ersetzen
 * PUT /admin/org-units/{org_unit_id}
 */
export async function replaceOrgUnit(
  orgUnitId: OrgUnitId,
  payload: OrgUnitCreate
): Promise<OrgUnitOut> {
  const { data } = await http.put<OrgUnitOut>(
    `${BASE_PATH}/${orgUnitId}`,
    payload
  );
  return data;
}

/**
 * Organisationseinheit teilweise aktualisieren
 * PATCH /admin/org-units/{org_unit_id}
 */
export async function updateOrgUnit(
  orgUnitId: OrgUnitId,
  payload: OrgUnitUpdate
): Promise<OrgUnitOut> {
  const { data } = await http.patch<OrgUnitOut>(
    `${BASE_PATH}/${orgUnitId}`,
    payload
  );
  return data;
}

/**
 * Organisationseinheit löschen
 * DELETE /admin/org-units/{org_unit_id}
 */
export async function deleteOrgUnit(orgUnitId: OrgUnitId): Promise<void> {
  await http.delete(`${BASE_PATH}/${orgUnitId}`);
}
/** End of orgUnits.api.ts */