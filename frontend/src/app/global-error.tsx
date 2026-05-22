"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

/**
 * F-C1 fix: Global error boundary — catches errors in root layout.
 * Unlike error.tsx, this MUST include <html> and <body> tags because
 * the root layout itself may have failed to render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <div className="size-20 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="size-10 text-red-400" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Something went wrong
          </h1>
          <p className="text-sm text-gray-500 mb-8">
            {error.message || "An unexpected error occurred. Please try again."}
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={reset}
              className="gap-2 bg-[#1B7EAD] hover:bg-[#155E85] text-white"
            >
              <RefreshCw className="size-4" />
              Try again
            </Button>
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <Home className="size-4" />
                Go home
              </Button>
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
