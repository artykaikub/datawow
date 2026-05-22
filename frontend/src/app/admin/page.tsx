"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsOverview } from "@/components/admin/StatsOverview";
import { ConcertCard, type Concert } from "@/components/admin/ConcertCard";
import { CreateConcertForm } from "@/components/admin/CreateConcertForm";
import { DeleteConcertDialog } from "@/components/admin/DeleteConcertDialog";
import type { ConcertWithStats } from "@/api";
import { getErrorMessage } from "@/lib/api-error";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useConcerts, useDeleteConcert } from "@/hooks/use-api";

/** H-3 fix: Map API data to ConcertCard shape (now includes stats) */
function toAdminConcert(c: ConcertWithStats): Concert {
  return {
    id: c.id!,
    name: c.name!,
    description: c.description!,
    totalSeats: c.totalSeats!,
    reservedSeats: c.reservedSeats ?? 0,
    availableSeats: c.availableSeats ?? 0,
  };
}

export default function AdminHomePage() {
  const [deleteTarget, setDeleteTarget] = useState<Concert | null>(null);
  const { t } = useLanguage();

  const { data: concertsData, isLoading } = useConcerts();
  const deleteMutation = useDeleteConcert();

  const concerts = (concertsData ?? []).map(toAdminConcert);
  const stats = {
    totalSeats: (concertsData ?? []).reduce((sum, c) => sum + (c.totalSeats ?? 0), 0),
    reserved: (concertsData ?? []).reduce((sum, c) => sum + (c.reservedSeats ?? 0), 0),
    cancelled: (concertsData ?? []).reduce((sum, c) => sum + (c.cancelledSeats ?? 0), 0),
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(t("admin.delete_success"));
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast.error(getErrorMessage(err, t("admin.delete_error")));
        setDeleteTarget(null);
      },
    });
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
        <h2 className="text-xl font-bold text-gray-900">{t("admin.title")}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {t("admin.subtitle")}
        </p>
      </div>

      <StatsOverview
        totalSeats={stats.totalSeats}
        reserved={stats.reserved}
        cancelled={stats.cancelled}
      />

      <Tabs defaultValue="overview">
        <TabsList
          variant="line"
          className="w-auto justify-start gap-1 border-b border-gray-200 h-auto pb-0"
        >
          <TabsTrigger
            value="overview"
            className="px-4 pb-3 text-sm font-medium text-gray-500 data-active:text-brand after:!bg-brand after:!rounded-full after:!h-[2px]"
          >
            {t("admin.tab_overview")}
          </TabsTrigger>
          <TabsTrigger
            value="create"
            className="px-4 pb-3 text-sm font-medium text-gray-500 data-active:text-brand after:!bg-brand after:!rounded-full after:!h-[2px]"
          >
            {t("admin.tab_create")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-4">
          {concerts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white text-center py-20">
              <p className="text-gray-500 text-sm font-medium">
                {t("admin.no_concerts")}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {t("admin.no_concerts_hint")}
              </p>
            </div>
          ) : (
            concerts.map((concert) => (
              <ConcertCard
                key={concert.id}
                concert={concert}
                onDelete={setDeleteTarget}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <CreateConcertForm />
        </TabsContent>
      </Tabs>

      <DeleteConcertDialog
        concertName={deleteTarget?.name ?? null}
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
