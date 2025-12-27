// frontend/src/lib/api/adminTimeSchemes.api.ts
import { httpClient } from "@/lib/httpClient";

import type {
  TimeSchemeOut,
  TimeSchemeCreate,
  TimeSchemeUpdate,
  TimeSchemeDefaultOut,
  TimeSchemeDefaultCreate,
  TimeSchemeDefaultUpdate,
  ResolvedTimeSchemeOut,
} from "@/types/admin.types";

export const listTimeSchemes = (params?: { is_active?: boolean; search?: string }) => {
  const qs = new URLSearchParams();
  if (params?.is_active !== undefined) qs.set("is_active", String(params.is_active));
  if (params?.search) qs.set("search", params.search);
  const q = qs.toString();
  return httpClient.get<TimeSchemeOut[]>(`/admin/time-schemes${q ? `?${q}` : ""}`);
};

export const createTimeScheme = (payload: TimeSchemeCreate) =>
  httpClient.post<TimeSchemeOut>("/admin/time-schemes", payload);

export const updateTimeScheme = (time_scheme_id: number, payload: TimeSchemeUpdate) =>
  httpClient.patch<TimeSchemeOut>(`/admin/time-schemes/${time_scheme_id}`, payload);

export const deleteTimeScheme = (time_scheme_id: number) =>
  httpClient.delete<{ ok: boolean; time_scheme_id: number }>(`/admin/time-schemes/${time_scheme_id}`);

export const listTimeSchemeDefaults = (params?: {
  org_unit_id?: number;
  subject_id?: number;
  is_active?: boolean;
}) => {
  const qs = new URLSearchParams();
  if (params?.org_unit_id !== undefined) qs.set("org_unit_id", String(params.org_unit_id));
  if (params?.subject_id !== undefined) qs.set("subject_id", String(params.subject_id));
  if (params?.is_active !== undefined) qs.set("is_active", String(params.is_active));
  const q = qs.toString();
  return httpClient.get<TimeSchemeDefaultOut[]>(`/admin/time-scheme-defaults${q ? `?${q}` : ""}`);
};

export const createTimeSchemeDefault = (payload: TimeSchemeDefaultCreate) =>
  httpClient.post<TimeSchemeDefaultOut>("/admin/time-scheme-defaults", payload);

export const updateTimeSchemeDefault = (id: number, payload: TimeSchemeDefaultUpdate) =>
  httpClient.patch<TimeSchemeDefaultOut>(`/admin/time-scheme-defaults/${id}`, payload);

export const deleteTimeSchemeDefault = (id: number) =>
  httpClient.delete<{ ok: boolean; time_scheme_default_id: number }>(`/admin/time-scheme-defaults/${id}`);

export const resolveTimeScheme = (org_unit_id: number, subject_id: number) =>
  httpClient.get<ResolvedTimeSchemeOut>(
    `/admin/time-schemes/resolve?org_unit_id=${org_unit_id}&subject_id=${subject_id}`
  );
// End of frontend/src/lib/api/adminTimeSchemes.api.ts