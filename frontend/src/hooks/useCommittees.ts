// src/hooks/useCommittees.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CommitteeOut,
  CommitteeCreate,
  CommitteeUpdate,
  CommitteeListQuery,
} from "@/types/admin.types";
import {
  listCommittees,
  getCommittee,
  createCommittee,
  updateCommittee,
  deleteCommittee,
} from "@/lib/api/committees.api";

const COMMITTEES_KEY = ["committees"] as const;

export function useCommitteeList(query?: CommitteeListQuery) {
  const queryKey = query ? [...COMMITTEES_KEY, query] : COMMITTEES_KEY;

  const { data, isLoading, isError, error, refetch } = useQuery<
    CommitteeOut[],
    Error
  >({
    queryKey,
    queryFn: () => listCommittees(query),
  });

  return {
    committees: data ?? [],
    loading: isLoading,
    error: isError ? error ?? new Error("Unknown error") : null,
    refetch,
  };
}

export function useCommittee(committeeId: number | null | undefined) {
  const { data, isLoading, isError, error, refetch } = useQuery<
    CommitteeOut,
    Error
  >({
    queryKey: ["committee", committeeId],
    queryFn: () => {
      if (committeeId == null) {
        return Promise.reject(new Error("No committeeId provided"));
      }
      return getCommittee(committeeId);
    },
    enabled: committeeId != null,
  });

  return {
    committee: data ?? null,
    loading: isLoading,
    error: isError ? error ?? new Error("Unknown error") : null,
    refetch,
  };
}

export function useCreateCommittee() {
  const queryClient = useQueryClient();

  const mutation = useMutation<CommitteeOut, Error, CommitteeCreate>({
    mutationFn: (payload) => createCommittee(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMITTEES_KEY });
    },
  });

  return {
    create: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.isError ? mutation.error ?? new Error("Unknown error") : null,
  };
}

export function useUpdateCommittee() {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    CommitteeOut,
    Error,
    { committeeId: number; payload: CommitteeUpdate }
  >({
    mutationFn: ({ committeeId, payload }) =>
      updateCommittee(committeeId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: COMMITTEES_KEY });
      queryClient.setQueryData(["committee", data.committee_id], data);
    },
  });

  return {
    update: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.isError ? mutation.error ?? new Error("Unknown error") : null,
  };
}

export function useDeleteCommittee() {
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, number>({
    mutationFn: (committeeId) => deleteCommittee(committeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMITTEES_KEY });
    },
  });

  return {
    remove: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.isError ? mutation.error ?? new Error("Unknown error") : null,
  };
}

// End of useCommittees.ts