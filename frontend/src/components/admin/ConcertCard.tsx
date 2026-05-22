"use client";

import { Users, Trash2, TicketCheck, Armchair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/LanguageProvider";

/** H-3 fix: Extended concert type with stats from API */
export interface Concert {
  id: string;
  name: string;
  description: string;
  totalSeats: number;
  reservedSeats?: number;
  availableSeats?: number;
}

interface ConcertCardProps {
  concert: Concert;
  onDelete: (concert: Concert) => void;
}

export function ConcertCard({ concert, onDelete }: ConcertCardProps) {
  const { t } = useLanguage();

  return (
    <div className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:shadow-md hover:border-gray-300">
      {/* Header */}
      <h3 className="text-base font-semibold text-brand mb-1">
        {concert.name}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed mb-5">
        {concert.description}
      </p>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
        {/* Stats badges with labels */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Total seats */}
          <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5">
            <Users className="size-3.5 text-gray-500" strokeWidth={1.8} />
            <span className="text-[12px] text-gray-500">{t("admin.total_of_seats")}</span>
            <span className="text-[13px] font-semibold text-gray-700">
              {concert.totalSeats.toLocaleString()}
            </span>
          </div>

          {/* Reserved */}
          {concert.reservedSeats != null && (
            <div className="flex items-center gap-1.5 bg-emerald-50 rounded-lg px-3 py-1.5">
              <TicketCheck className="size-3.5 text-emerald-600" strokeWidth={1.8} />
              <span className="text-[12px] text-emerald-500">{t("admin.reserved")}</span>
              <span className="text-[13px] font-semibold text-emerald-700">
                {concert.reservedSeats}
              </span>
            </div>
          )}

          {/* Available */}
          {concert.availableSeats != null && (
            <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-3 py-1.5">
              <Armchair className="size-3.5 text-blue-600" strokeWidth={1.8} />
              <span className="text-[12px] text-blue-500">{t("user.seats")}</span>
              <span className="text-[13px] font-semibold text-blue-700">
                {concert.availableSeats}
              </span>
            </div>
          )}
        </div>

        <Button
          size="sm"
          className="gap-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg h-8 px-4 text-[13px] shadow-sm"
          onClick={() => onDelete(concert)}
        >
          <Trash2 className="size-3.5" />
          {t("admin.delete")}
        </Button>
      </div>
    </div>
  );
}
