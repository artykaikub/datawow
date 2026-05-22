/**
 * TanStack Query keys — centralized to ensure consistent cache invalidation.
 *
 * Convention: each key is a tuple starting with entity name.
 * Use queryKeys.xxx.all() for list queries, .detail(id) for single items.
 */
export const queryKeys = {
  concerts: {
    all: () => ["concerts"] as const,
    detail: (id: string) => ["concerts", id] as const,
  },
  reservations: {
    /** User's own reservations */
    my: () => ["reservations", "my"] as const,
    /** Admin: all reservations (paginated + filtered) */
    admin: (params: { page: number; status?: string; search?: string }) =>
      ["reservations", "admin", params] as const,
  },
  auditLogs: {
    all: (params?: { page?: number }) =>
      ["audit-logs", params ?? {}] as const,
  },
} as const;
