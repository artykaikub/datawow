"use client";

import { Armchair, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/LanguageProvider";

export interface UserConcert {
  id: string;
  name: string;
  description: string;
  totalSeats: number;
  availableSeats: number;
  isReserved: boolean;
}

interface UserConcertCardProps {
  concert: UserConcert;
  onReserve: (concert: UserConcert) => void;
  onCancel: (concert: UserConcert) => void;
  /** H-4 fix: Loading state to disable button during API call */
  isActionLoading?: boolean;
}

export function UserConcertCard({
  concert,
  onReserve,
  onCancel,
  isActionLoading = false,
}: UserConcertCardProps) {
  const { t } = useLanguage();

  return (
    <div className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:shadow-md hover:border-gray-300">
      {/* Title */}
      <h3 className="text-base font-semibold text-brand mb-1">
        {concert.name}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed mb-5">
        {concert.description}
      </p>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5">
          <Armchair className="size-3.5 text-gray-500" strokeWidth={1.8} />
          <span className="text-[12px] text-gray-500">{t("user.seats")}</span>
          <span className="text-[13px] font-semibold text-gray-700">
            {concert.availableSeats.toLocaleString()}
          </span>
          <span className="text-[11px] text-gray-400">
            / {concert.totalSeats.toLocaleString()}
          </span>
        </div>

        {concert.isReserved ? (
          <Button
            size="sm"
            className="rounded-lg h-9 px-5 text-[13px] font-semibold bg-[#E53935] hover:bg-[#C62828] text-white shadow-sm"
            onClick={() => onCancel(concert)}
            disabled={isActionLoading}
          >
            {isActionLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("user.cancel")
            )}
          </Button>
        ) : (
          <Button
            size="sm"
            className="rounded-lg h-9 px-5 text-[13px] font-semibold bg-brand hover:bg-brand-dark text-white shadow-sm"
            onClick={() => onReserve(concert)}
            disabled={isActionLoading}
          >
            {isActionLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("user.reserve")
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
