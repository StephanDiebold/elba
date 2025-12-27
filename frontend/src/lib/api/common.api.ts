// frontend/src/lib/api/common.api.ts
import { httpClient } from "@/lib/httpClient";
import type { OrgUnitOut, OrgUnitType } from "@/types/admin.types";

/**
 * Backwards-Compat Typen (damit RegisterForm/AuthContext nicht explodieren)
 * Wir nutzen intern org_unit.
 */
export type Kammer = {
  kammer_id: number;
  kammer_name: string;
  kammer_kuerzel: string | null;
};

export type Bezirkskammer = {
  bezirkskammer_id: number;
  bezirkskammer_name: string;
  bezirkskammer_kuerzel: string | null;
  kammer_id: number;
};

function mapOrgUnitToKammer(u: OrgUnitOut): Kammer {
  return {
    kammer_id: u.org_unit_id,
    kammer_name: u.name,
    kammer_kuerzel: u.code ?? null,
  };
}

function mapOrgUnitToBezirkskammer(u: OrgUnitOut): Bezirkskammer {
  return {
    bezirkskammer_id: u.org_unit_id,
    bezirkskammer_name: u.name,
    bezirkskammer_kuerzel: u.code ?? null,
    kammer_id: u.parent_org_unit_id ?? 0,
  };
}

/**
 * Kammern = OrgUnits vom Typ "chamber"
 * GET /admin/org-units?type=chamber
 */
export async function getKammern(): Promise<Kammer[]> {
  const { data } = await httpClient.get<OrgUnitOut[]>("/admin/org-units", {
    params: { type: "chamber" satisfies OrgUnitType, is_active: true },
  });
  return data.map(mapOrgUnitToKammer);
}

/**
 * Bezirkskammern = OrgUnits vom Typ "district_chamber" mit parent_org_unit_id = kammer_id
 * GET /admin/org-units?type=district_chamber
 * -> Filter parent im Frontend (weil der Admin-Endpunkt in deinem orgUnits.api.ts aktuell keinen parent-filter hat)
 */
export async function getBezirkskammern(
  kammer_id: number
): Promise<Bezirkskammer[]> {
  const { data } = await httpClient.get<OrgUnitOut[]>("/admin/org-units", {
    params: { type: "district_chamber" satisfies OrgUnitType, is_active: true },
  });

  return data
    .filter((u) => (u.parent_org_unit_id ?? null) === kammer_id)
    .map(mapOrgUnitToBezirkskammer);
}
