"use client";

import { Users, Award, XCircle } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

interface StatsOverviewProps {
  totalSeats: number;
  reserved: number;
  cancelled: number;
}

export function StatsOverview({
  totalSeats,
  reserved,
  cancelled,
}: StatsOverviewProps) {
  const { t } = useLanguage();

  const cards = [
    {
      label: t("admin.total_of_seats"),
      value: totalSeats,
      icon: <Users className="size-8 text-white" strokeWidth={1.5} />,
      bg: "bg-[#0B7EC2]",
    },
    {
      label: t("admin.reserved"),
      value: reserved,
      icon: <Award className="size-8 text-white" strokeWidth={1.5} />,
      bg: "bg-[#17B890]",
    },
    {
      label: t("admin.cancelled"),
      value: cancelled,
      icon: <XCircle className="size-8 text-white" strokeWidth={1.5} />,
      bg: "bg-[#EF5B6C]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      {cards.map((card) => (
        <div
          key={card.label}
          role="group"
          aria-label={`${card.label}: ${card.value}`}
          className={`${card.bg} rounded-2xl px-6 pt-6 pb-8 text-white flex flex-col items-center text-center`}
        >
          <div className="mb-2">{card.icon}</div>
          <p className="text-sm font-medium text-white/90 mb-3">{card.label}</p>
          <p className="text-5xl font-bold tracking-tight leading-none">
            {card.value.toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
