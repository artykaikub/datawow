import Link from "next/link";
import { Home, SearchX } from "lucide-react";

/**
 * F-C2 fix: Custom 404 page matching the brand design.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-4">
        <div className="size-20 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-6">
          <SearchX className="size-10 text-brand" strokeWidth={1.5} />
        </div>
        <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">
          Page Not Found
        </h2>
        <p className="text-sm text-gray-500 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold text-sm transition-colors no-underline"
        >
          <Home className="size-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
