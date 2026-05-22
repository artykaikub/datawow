import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api";
import type { ConcertWithStats, UserReservation, AuditLogPaginatedResponse } from "@/api";
import type { AdminReservation, PaginatedReservations } from "@/api";
import { queryKeys } from "@/lib/query-keys";

// ─── Concerts ───

/** Fetch all concerts with stats (both admin + user) */
export function useConcerts() {
  return useQuery<ConcertWithStats[]>({
    queryKey: queryKeys.concerts.all(),
    queryFn: () => api.findAllConcerts(),
  });
}

/** Create a concert (admin) — invalidates concert list */
export function useCreateConcert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; description: string; totalSeats: number }) =>
      api.createConcert(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.concerts.all() });
    },
  });
}

/** Delete a concert (admin) — invalidates concert list */
export function useDeleteConcert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteConcert(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.concerts.all() });
    },
  });
}

// ─── Reservations (User) ───

/** Fetch user's own reservation history */
export function useMyReservations() {
  return useQuery<UserReservation[]>({
    queryKey: queryKeys.reservations.my(),
    queryFn: () => api.getMyReservations(),
  });
}

/** Reserve a seat — invalidates concerts + my reservations */
export function useReserveSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (concertId: string) => api.reserveSeat(concertId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.concerts.all() });
      qc.invalidateQueries({ queryKey: queryKeys.reservations.my() });
    },
  });
}

/** Cancel a reservation — invalidates concerts + my reservations */
export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (concertId: string) => api.cancelReservation(concertId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.concerts.all() });
      qc.invalidateQueries({ queryKey: queryKeys.reservations.my() });
    },
  });
}

// ─── Reservations (Admin) ───

/** Fetch paginated reservation history (admin) */
export function useAdminReservations(params: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}) {
  return useQuery<PaginatedReservations>({
    queryKey: queryKeys.reservations.admin({
      page: params.page,
      status: params.status,
      search: params.search,
    }),
    queryFn: () => api.getAllReservations(params),
    placeholderData: (prev) => prev, // Keep previous data while loading next page
  });
}

// ─── Audit Logs ───

/** Fetch paginated audit logs (admin) */
export function useAuditLogs(params?: { page?: number }) {
  return useQuery<AuditLogPaginatedResponse>({
    queryKey: queryKeys.auditLogs.all(params),
    queryFn: () => api.getAuditLogs(params),
  });
}
