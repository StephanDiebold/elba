// src/hooks/useCommitteeMeta.ts
import { useQuery } from "@tanstack/react-query";
import {
  listCommitteeFunctions,
  listCommitteePositions,
} from "@/lib/api/committeeMeta.api";
import type {
  CommitteeFunctionOut,
  CommitteePositionOut,
} from "@/types/admin.types";

export function useCommitteeFunctions() {
  const { data, isLoading, isError, error } = useQuery<
    CommitteeFunctionOut[],
    Error
  >({
    queryKey: ["committee-functions"],
    queryFn: () => listCommitteeFunctions(),
  });

  return {
    functions: data ?? [],
    loading: isLoading,
    error: isError ? error ?? new Error("Unknown error") : null,
  };
}

export function useCommitteePositions() {
  const { data, isLoading, isError, error } = useQuery<
    CommitteePositionOut[],
    Error
  >({
    queryKey: ["committee-positions"],
    queryFn: () => listCommitteePositions(),
  });

  return {
    positions: data ?? [],
    loading: isLoading,
    error: isError ? error ?? new Error("Unknown error") : null,
  };
}
// End of file: frontend/src/hooks/useCommitteeMeta.ts