// src/hooks/useAdminUsers.ts
import { useQuery } from "@tanstack/react-query";
import type { AdminUserSummary } from "@/types/admin.types";
import { listAdminUsers } from "@/lib/api/users.api";

const ADMIN_USERS_KEY = ["admin-users"] as const;

export function useAdminUsers() {
  const { data, isLoading, isError, error, refetch } = useQuery<
    AdminUserSummary[],
    Error
  >({
    queryKey: ADMIN_USERS_KEY,
    queryFn: () => listAdminUsers(),
  });

  return {
    users: data ?? [],
    loading: isLoading,
    error: isError ? error ?? new Error("Unknown error") : null,
    refetch,
  };
}
// End of src/hooks/useAdminUsers.ts
