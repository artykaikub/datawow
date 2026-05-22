import { Loader2 } from "lucide-react";

/**
 * F-H1: Loading state for user routes during navigation transitions.
 */
export default function UserLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="size-8 animate-spin text-brand" />
    </div>
  );
}
