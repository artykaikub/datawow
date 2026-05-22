/**
 * Barrel file — re-exports all API clients and types.
 * Components import from "@/api" and get everything they need.
 */

import { getDataWowConcertTicketsAPI } from './core/generated';
import { getDataWowAuditServiceAPI } from './audit/generated';

import { axiosInstance } from '@/lib/axios-instance';

// Core API (concerts, reservations, auth)
const coreApi = getDataWowConcertTicketsAPI();

// Audit API (audit logs)
const auditApi = getDataWowAuditServiceAPI();

// Merged API object for backward compatibility
export const api = {
  ...coreApi,
  ...auditApi,
  /** Admin: get all reservation history (paginated + filterable) */
  getAllReservations: (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return axiosInstance<PaginatedReservations>({ url: `/api/reservations${qs ? `?${qs}` : ''}`, method: 'GET' });
  },
};

/** Reservation with user + concert info (admin view) */
export interface AdminReservation {
  id: string;
  status: 'pending' | 'reserved' | 'cancelled' | 'rejected';
  rejectedReason?: string | null;
  createdAt: string;
  cancelledAt?: string | null;
  concert: { id: string; name: string; totalSeats: number };
  user: { id: string; email: string; fullName: string };
}

export interface PaginatedReservations {
  data: AdminReservation[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// Re-export types
export type { ConcertWithStats } from './core/model';
export type { Concert } from './core/model';
export type { UserProfile } from './core/model';
export type { UserReservation } from './core/model';
export type { Reservation } from './core/model';
export type { AuthResponse } from './core/model';
export type { CreateConcertDto } from './core/model';
export type { CancelResponse } from './core/model';
export type { AuditLogEntry } from './audit/model';
export type { AuditLogPaginatedResponse } from './audit/model';
