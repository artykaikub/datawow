"use client";

import React from "react";
import { Loader2, Music, Calendar, Tag } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useMyReservations } from "@/hooks/use-api";

const STATUS_STYLES: Record<string, string> = {
  reserved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  cancelled: "bg-gray-100 text-gray-600 border border-gray-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
};

export default function UserHistoryPage() {
  const { t } = useLanguage();
  const { data: reservations = [], isLoading } = useMyReservations();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          {t("user.history_title")}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {t("user.history_subtitle")}
        </p>
      </div>

      {reservations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white text-center py-20">
          <p className="text-gray-500 text-sm font-medium">
            {t("user.no_reservations")}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_120px_180px] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[600px]">
              <span>{t("user.col_concert")}</span>
              <span>{t("user.col_date")}</span>
              <span>{t("user.col_status")}</span>
              <span>{t("user.col_cancelled_at")}</span>
            </div>

            {/* Rows */}
            {reservations.map((item) => (
              <div
                key={item.id ?? ''}
                className="grid grid-cols-[1fr_1fr_120px_180px] gap-4 px-6 py-4 border-b border-gray-100 last:border-0 items-center text-sm hover:bg-gray-50/50 transition-colors min-w-[600px]"
              >
                {/* Concert */}
                <div className="flex items-center gap-2 min-w-0">
                  <Music className="size-4 text-gray-400 shrink-0" />
                  <span className="truncate text-gray-700">
                    {item.concert?.name || "—"}
                  </span>
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="size-4 text-gray-400 shrink-0" />
                  {item.createdAt
                    ? new Date(item.createdAt).toLocaleString()
                    : "—"}
                </div>

                {/* Status badge */}
                <div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[item.status ?? ''] || "bg-gray-100 text-gray-600"}`}
                  >
                    <Tag className="size-3" />
                    {item.status ?? '—'}
                  </span>
                </div>

                {/* Cancelled At */}
                <span className="text-gray-500 text-xs">
                  {item.cancelledAt
                    ? new Date(item.cancelledAt).toLocaleString()
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
