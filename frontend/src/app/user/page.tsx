"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  UserConcertCard,
  type UserConcert,
} from "@/components/user/UserConcertCard";
import { api } from "@/api";
import type { ConcertWithStats } from "@/api";
import { getErrorMessage } from "@/lib/api-error";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

/** Map API concert to component-friendly shape */
function toConcert(
  c: ConcertWithStats,
  reservedConcertIds: Set<string>
): UserConcert {
  return {
    id: c.id!,
    name: c.name!,
    description: c.description!,
    totalSeats: c.totalSeats!,
    availableSeats: c.availableSeats ?? c.totalSeats!,
    isReserved: reservedConcertIds.has(c.id!),
  };
}

export default function UserHomePage() {
  const [concerts, setConcerts] = useState<UserConcert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  /** H-4: Track which concert ID is currently processing */
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const { t } = useLanguage();

  const fetchConcerts = useCallback(async () => {
    try {
      const [concertList, myReservations] = await Promise.all([
        api.findAllConcerts(),
        api.getMyReservations(),
      ]);

      const reservedIds = new Set(
        myReservations
          .filter((r) => r.status === "reserved" || r.status === "pending")
          .map((r) => r.concert?.id!)
          .filter(Boolean)
      );

      setConcerts(concertList.map((c) => toConcert(c, reservedIds)));
    } catch {
      toast.error(t("user.load_error"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchConcerts();
  }, [fetchConcerts]);

  const handleReserve = async (concert: UserConcert) => {
    setActionLoadingId(concert.id);
    try {
      await api.reserveSeat(concert.id);
      setConcerts((prev) =>
        prev.map((c) =>
          c.id === concert.id ? { ...c, isReserved: true } : c
        )
      );
      toast.success(t("user.reserved_success"));
    } catch (err) {
      toast.error(getErrorMessage(err, t("user.reserve_error")));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (concert: UserConcert) => {
    setActionLoadingId(concert.id);
    try {
      await api.cancelReservation(concert.id);
      setConcerts((prev) =>
        prev.map((c) =>
          c.id === concert.id ? { ...c, isReserved: false } : c
        )
      );
      toast.success(t("user.cancel_success"));
    } catch (err) {
      toast.error(getErrorMessage(err, t("user.cancel_error")));
    } finally {
      setActionLoadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t("user.title")}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {t("user.subtitle")}
        </p>
      </div>

      <div className="space-y-4">
        {concerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white text-center py-20">
            <p className="text-gray-500 text-sm font-medium">
              {t("user.no_concerts_title")}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {t("user.no_concerts_subtitle")}
            </p>
          </div>
        ) : (
          concerts.map((concert) => (
            <UserConcertCard
              key={concert.id}
              concert={concert}
              onReserve={handleReserve}
              onCancel={handleCancel}
              isActionLoading={actionLoadingId === concert.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
