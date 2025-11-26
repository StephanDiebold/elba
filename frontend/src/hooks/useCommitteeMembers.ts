// src/hooks/useCommitteeMembers.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CommitteeMemberOut,
  UserCommitteeCreate,
  UserCommitteeUpdate,
} from "@/types/admin.types";
import {
  listCommitteeMembers,
  createUserCommittee,
  updateUserCommittee,
  deleteUserCommittee,
} from "@/lib/api/userCommittees.api";

const COMMITTEE_MEMBERS_KEY = (committeeId: number | null | undefined) =>
  ["committee-members", committeeId] as const;

/**
 * Mitglieder eines Ausschusses laden
 */
export function useCommitteeMembers(
  committeeId: number | null | undefined,
  includeInactive = false
) {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<CommitteeMemberOut[], Error>({
    queryKey: COMMITTEE_MEMBERS_KEY(committeeId ?? 0),
    queryFn: () => {
      if (committeeId == null) {
        return Promise.resolve([]);
      }
      return listCommitteeMembers(committeeId, includeInactive);
    },
    enabled: committeeId != null,
  });

  return {
    members: data ?? [],
    loading: isLoading,
    error: isError ? error ?? new Error("Unknown error") : null,
    refetch,
  };
}

/**
 * Mitglied hinzufügen
 */
export function useAddCommitteeMember() {
  const queryClient = useQueryClient();

  const mutation = useMutation<CommitteeMemberOut, Error, UserCommitteeCreate>({
    mutationFn: (payload) => createUserCommittee(payload),
    onSuccess: (member) => {
      queryClient.invalidateQueries({
        queryKey: COMMITTEE_MEMBERS_KEY(member.committee_id),
      });
    },
  });

  return {
    addMember: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.isError ? mutation.error ?? new Error("Unknown error") : null,
  };
}

/**
 * Mitglied aktualisieren
 */
export function useUpdateCommitteeMember() {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    CommitteeMemberOut,
    Error,
    { userCommitteeId: number; payload: UserCommitteeUpdate }
  >({
    mutationFn: ({ userCommitteeId, payload }) =>
      updateUserCommittee(userCommitteeId, payload),
    onSuccess: (member) => {
      queryClient.invalidateQueries({
        queryKey: COMMITTEE_MEMBERS_KEY(member.committee_id),
      });
    },
  });

  return {
    updateMember: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.isError ? mutation.error ?? new Error("Unknown error") : null,
  };
}

/**
 * Mitglied löschen
 */
export function useDeleteCommitteeMember() {
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, { userCommitteeId: number; committeeId: number }>(
    {
      mutationFn: ({ userCommitteeId }) => deleteUserCommittee(userCommitteeId),
      onSuccess: (_data, { committeeId }) => {
        queryClient.invalidateQueries({
          queryKey: COMMITTEE_MEMBERS_KEY(committeeId),
        });
      },
    }
  );

  return {
    deleteMember: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.isError ? mutation.error ?? new Error("Unknown error") : null,
  };
}
