"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * H-1 fix: Error boundary for /admin routes.
 * Catches unhandled errors and shows a friendly recovery UI.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="size-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <AlertTriangle className="size-8 text-red-400" strokeWidth={1.5} />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-gray-500 max-w-md mb-6">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <Button
        onClick={reset}
        className="gap-2 bg-brand hover:bg-brand-dark text-white"
      >
        <RefreshCw className="size-4" />
        Try again
      </Button>
    </div>
  );
}
