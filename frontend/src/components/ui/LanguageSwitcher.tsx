"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, isReady } = useLanguage();

  // Don't render until client has loaded the saved locale
  if (!isReady) {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-full bg-gray-100 p-0.5 border border-gray-200 h-[30px] w-[72px]",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full bg-gray-100 p-0.5 border border-gray-200",
        className
      )}
      role="radiogroup"
      aria-label="Select language"
    >
      <button
        onClick={() => setLocale("en")}
        role="radio"
        aria-checked={locale === "en"}
        className={cn(
          "px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200",
          locale === "en"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        )}
      >
        EN
      </button>
      <button
        onClick={() => setLocale("th")}
        role="radio"
        aria-checked={locale === "th"}
        className={cn(
          "px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200",
          locale === "th"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        )}
      >
        TH
      </button>
    </div>
  );
}
