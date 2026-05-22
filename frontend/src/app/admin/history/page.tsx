"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, User, Clock, Plus, Trash2 } from "lucide-react";
import { api } from "@/api";
import type { AuditLogEntry } from "@/api";
import { useLanguage } from "@/components/providers/LanguageProvider";

const ACTION_STYLES: Record<string, { bg: string; icon: React.ReactNode }> = {
  CREATE_CONCERT: {
    bg: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    icon: <Plus className="size-3" />,
  },
  DELETE_CONCERT: {
    bg: "bg-red-50 text-red-700 border border-red-200",
    icon: <Trash2 className="size-3" />,
  },
};

export default function AdminHistoryPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    async function fetchLogs() {
      try {
        const result = await api.getAuditLogs();
        setLogs(result.data ?? []);
      } catch {
        toast.error(t("audit.load_error"));
      } finally {
        setIsLoading(false);
      }
    }
    fetchLogs();
  }, []);

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
          {t("audit.title")}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {t("audit.subtitle")}
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white text-center py-20">
          <p className="text-gray-500 text-sm font-medium">
            {t("audit.no_logs")}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            {/* Table header */}
            <div className="grid grid-cols-[180px_1fr_1fr_1fr] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[700px]">
              <span>{t("audit.col_time")}</span>
              <span>{t("audit.col_action")}</span>
              <span>{t("audit.col_details")}</span>
              <span>{t("audit.col_admin")}</span>
            </div>

            {/* Rows */}
            {logs.map((item) => {
              const style = ACTION_STYLES[item.action ?? ''] || {
                bg: "bg-gray-100 text-gray-600",
                icon: null,
              };
              const details = item.details as Record<string, unknown> | null;

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[180px_1fr_1fr_1fr] gap-4 px-6 py-4 border-b border-gray-100 last:border-0 items-center text-sm hover:bg-gray-50/50 transition-colors min-w-[700px]"
                >
                  {/* Time */}
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="size-4 text-gray-400 shrink-0" />
                    <span className="text-xs">
                      {new Date(item.createdAt ?? '').toLocaleString()}
                    </span>
                  </div>

                  {/* Action badge */}
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg}`}
                    >
                      {style.icon}
                      {t(`audit.${item.action}` as any) || item.action}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="text-gray-700 text-sm truncate">
                    {details?.name ? (
                      <span>
                        <span className="font-medium">{String(details.name)}</span>
                        {details.totalSeats != null && (
                          <span className="text-gray-400 ml-1.5 text-xs">
                            ({String(details.totalSeats)} seats)
                          </span>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>

                  {/* Admin */}
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="size-4 text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {item.performer?.fullName || "—"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {item.performer?.email || ""}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
