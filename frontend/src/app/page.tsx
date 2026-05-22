"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CircleUserRound, UsersRound, ArrowRight } from "lucide-react";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-brand-surface flex flex-col">
      {/* ─── Top bar with brand (top-left) + language switcher (top-right) ─── */}
      <header className="px-6 sm:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-brand" />
          <span className="text-sm font-bold text-brand tracking-wide">BRAND</span>
        </div>
        <LanguageSwitcher />
      </header>

      {/* ─── Content ─── */}
      <main className="flex-1 flex flex-col items-center px-6 pb-16">
        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mt-6 mb-3 text-center">
          {t("landing.title")}
        </h1>
        <p className="text-sm text-muted-foreground mb-12 text-center max-w-[420px] leading-relaxed">
          {t("landing.subtitle")}
        </p>

        {/* Role Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-[680px]">
          {/* ─── User Card ─── */}
          <Link href="/login" className="no-underline group" id="role-user-card">
            <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col h-[380px] transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
              <div className="mb-6">
                <CircleUserRound className="size-14 text-brand" strokeWidth={1.5} />
              </div>
              <h2 className="text-xl font-bold text-brand mb-3">{t("landing.user")}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-auto">
                {t("landing.user_desc")}
              </p>
              <Button className="w-full h-11 rounded-full bg-brand hover:bg-brand-dark text-brand-foreground text-sm font-semibold mt-6 gap-2">
                {t("landing.user_btn")} <ArrowRight className="size-4" />
              </Button>
            </div>
          </Link>

          {/* ─── Admin Card ─── */}
          <Link href="/login?role=admin" className="no-underline group" id="role-admin-card">
            <div className="bg-brand rounded-2xl border border-brand p-8 flex flex-col h-[380px] transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
              <div className="mb-6">
                <UsersRound className="size-14 text-brand-foreground" strokeWidth={1.5} />
              </div>
              <h2 className="text-xl font-bold text-brand-foreground mb-3">{t("landing.admin")}</h2>
              <p className="text-sm text-brand-foreground/80 leading-relaxed mb-auto">
                {t("landing.admin_desc")}
              </p>
              <Button
                variant="outline"
                className="w-full h-11 rounded-full border-2 border-brand-foreground text-brand-foreground bg-transparent hover:bg-brand-foreground/10 text-sm font-semibold mt-6 gap-2"
              >
                {t("landing.admin_btn")} <ArrowRight className="size-4" />
              </Button>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
