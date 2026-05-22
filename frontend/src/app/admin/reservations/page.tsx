"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Loader2, User, Clock, Ticket, XCircle,
  CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Search,
} from "lucide-react";
import { api } from "@/api";
import type { AdminReservation } from "@/api";
import { useLanguage } from "@/components/providers/LanguageProvider";

const STATUS_STYLES: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
  reserved: {
    bg: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    icon: <CheckCircle className="size-3" />,
    label: "Reserved",
  },
  cancelled: {
    bg: "bg-gray-100 text-gray-600 border border-gray-200",
    icon: <XCircle className="size-3" />,
    label: "Cancelled",
  },
  pending: {
    bg: "bg-amber-50 text-amber-700 border border-amber-200",
    icon: <Clock className="size-3" />,
    label: "Pending",
  },
  rejected: {
    bg: "bg-red-50 text-red-700 border border-red-200",
    icon: <AlertCircle className="size-3" />,
    label: "Rejected",
  },
};

const PAGE_SIZE = 20;

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const { t } = useLanguage();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchReservations = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.getAllReservations({
        page,
        limit: PAGE_SIZE,
        status: filter || undefined,
        search: debouncedSearch || undefined,
      });
      setReservations(result.data);
      setMeta({ total: result.meta.total, totalPages: result.meta.totalPages });
    } catch {
      toast.error("Failed to load reservation history");
    } finally {
      setIsLoading(false);
    }
  }, [page, filter, debouncedSearch]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // Reset to page 1 when filter/search changes
  useEffect(() => {
    setPage(1);
  }, [filter, debouncedSearch]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          {t("admin.reservations") || "Reservation History"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Full reservation history of all users
          {meta.total > 0 && (
            <span className="text-gray-400 ml-1">({meta.total} total)</span>
          )}
        </p>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {["", "reserved", "pending", "cancelled", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === s
                  ? "bg-brand text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "" ? "All" : STATUS_STYLES[s]?.label || s}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search user email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-brand" />
        </div>
      ) : reservations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white text-center py-20">
          <Ticket className="size-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">
            No reservations found
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            {/* Table header */}
            <div className="grid grid-cols-[180px_1fr_1fr_120px] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[700px]">
              <span>Time</span>
              <span>User</span>
              <span>Concert</span>
              <span>Status</span>
            </div>

            {/* Rows */}
            {reservations.map((item) => {
              const style = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[180px_1fr_1fr_120px] gap-4 px-6 py-4 border-b border-gray-100 last:border-0 items-center text-sm hover:bg-gray-50/50 transition-colors min-w-[700px]"
                >
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="size-4 text-gray-400 shrink-0" />
                    <span className="text-xs">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="size-4 text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {item.user?.fullName || "—"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {item.user?.email || ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-gray-700 text-sm truncate">
                    <span className="font-medium">{item.concert?.name || "—"}</span>
                    {item.concert?.totalSeats != null && (
                      <span className="text-gray-400 ml-1.5 text-xs">
                        ({item.concert.totalSeats} seats)
                      </span>
                    )}
                  </div>
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg}`}>
                      {style.icon}
                      {style.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-xs text-gray-500">
                Page {page} of {meta.totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
