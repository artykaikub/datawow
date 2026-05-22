"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale after 30s — matches backend Redis cache TTL
            staleTime: 30_000,
            // Keep unused data in cache for 5 minutes
            gcTime: 5 * 60_000,
            // Retry once on failure
            retry: 1,
            // Don't refetch when window regains focus (prevent noise)
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
