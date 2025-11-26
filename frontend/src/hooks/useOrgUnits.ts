// src/hooks/useOrgUnits.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  OrgUnitOut,
  OrgUnitCreate,
  OrgUnitUpdate,
  OrgUnitListQuery,
} from "@/types/admin.types";
import {
  listOrgUnits,
  getOrgUnit,
  createOrgUnit,
  updateOrgUnit,
  deleteOrgUnit,
} from "@/lib/api/orgUnits.api";

const ORG_UNITS_KEY = ["org-units"] as const;

/**
 * Hook: Liste der Organization Units
 * - nutzt React Query Cache
 * - lädt automatisch
 * - refetch bei invalidate
 */
export function useOrgUnitList(query?: OrgUnitListQuery) {
  const queryKey = query ? [...ORG_UNITS_KEY, query] : ORG_UNITS_KEY;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<OrgUnitOut[], Error>({
    queryKey,
    queryFn: () => listOrgUnits(query),
  });

  return {
    orgUnits: data ?? [],
    loading: isLoading,
    error: isError ? error ?? new Error("Unknown error") : null,
    refetch,
  };
}

/**
 * Hook: einzelne Organization Unit laden
 */
export function useOrgUnit(orgUnitId: number | null | undefined) {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<OrgUnitOut, Error>({
    queryKey: ["org-unit", orgUnitId],
    queryFn: () => {
      if (orgUnitId == null) {
        return Promise.reject(new Error("No orgUnitId provided"));
      }
      return getOrgUnit(orgUnitId);
    },
    enabled: orgUnitId != null,
  });

  return {
    orgUnit: data ?? null,
    loading: isLoading,
    error: isError ? error ?? new Error("Unknown error") : null,
    refetch,
  };
}

/**
 * Hook: Organization Unit anlegen (Mutation)
 */
export function useCreateOrgUnit() {
  const queryClient = useQueryClient();

  const mutation = useMutation<OrgUnitOut, Error, OrgUnitCreate>({
    mutationFn: (payload: OrgUnitCreate) => createOrgUnit(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_UNITS_KEY });
    },
  });

  return {
    create: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.isError
      ? mutation.error ?? new Error("Unknown error")
      : null,
  };
}

/**
 * Hook: Organization Unit aktualisieren (Mutation)
 */
export function useUpdateOrgUnit() {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    OrgUnitOut,
    Error,
    { orgUnitId: number; payload: OrgUnitUpdate }
  >({
    mutationFn: ({
      orgUnitId,
      payload,
    }: {
      orgUnitId: number;
      payload: OrgUnitUpdate;
    }) => updateOrgUnit(orgUnitId, payload),

    onSuccess: (data: OrgUnitOut) => {
      queryClient.invalidateQueries({ queryKey: ORG_UNITS_KEY });
      queryClient.setQueryData(["org-unit", data.org_unit_id], data);
    },
  });

  return {
    update: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.isError
      ? mutation.error ?? new Error("Unknown error")
      : null,
  };
}

/**
 * Hook: Organization Unit löschen (Mutation)
 */
export function useDeleteOrgUnit() {
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, number>({
    mutationFn: (orgUnitId: number) => deleteOrgUnit(orgUnitId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_UNITS_KEY });
    },
  });

  return {
    remove: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.isError
      ? mutation.error ?? new Error("Unknown error")
      : null,
  };
}

/** End of useOrgUnits.ts */
