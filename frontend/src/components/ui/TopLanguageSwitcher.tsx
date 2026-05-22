"use client";

import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

/**
 * Fixed top-right language switcher for dashboard layouts.
 * Used in admin/user layouts (Server Components can't use hooks directly).
 */
export function TopLanguageSwitcher() {
  return (
    <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-30">
      <LanguageSwitcher />
    </div>
  );
}
