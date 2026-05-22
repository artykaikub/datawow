"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, LogOut, Music, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function UserSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { href: "/user", label: t("user.home"), icon: Home },
    { href: "/user/history", label: t("user.history"), icon: History },
  ];

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-white border border-gray-200 shadow-sm"
        aria-label="Open menu"
      >
        <Menu className="size-5 text-gray-700" />
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "bg-white border-r border-gray-200 flex flex-col z-50 transition-transform duration-300",
          // Desktop: static sidebar
          "lg:relative lg:translate-x-0 lg:w-[240px] lg:min-w-[240px] lg:h-full",
          // Mobile: slide-in overlay
          "fixed inset-y-0 left-0 w-[260px]",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Close button (mobile only) */}
        <button
          onClick={() => setIsOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100"
          aria-label="Close menu"
        >
          <X className="size-5 text-gray-500" />
        </button>

        {/* Brand */}
        <div className="px-6 pt-7 pb-8 flex items-center gap-3">
          <div className="size-9 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center shadow-md shadow-brand/20">
            <Music className="size-4 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-gray-900 leading-tight">
              {user?.fullName || "User"}
            </p>
            <p className="text-[11px] text-gray-500 leading-tight">{t("user.concert_hub")}</p>
          </div>
        </div>

        {/* Section label */}
        <p className="px-6 pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        {t("menu.label")}
      </p>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 flex-1 px-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/user"
                ? pathname === "/user"
                : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                id={`user-nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 no-underline",
                  isActive
                    ? "bg-brand/10 text-brand"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                <Icon
                  className={cn(
                    "size-[18px]",
                    isActive ? "text-brand" : "text-gray-500"
                  )}
                  strokeWidth={isActive ? 2 : 1.5}
                />
                {label}
                {isActive && (
                  <span className="ml-auto size-1.5 rounded-full bg-brand" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer: Logout */}
        <div className="px-3 pb-6 pt-4 border-t border-gray-100 mx-3">
          <button
            id="user-logout-btn"
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200 w-full text-left group"
          >
            <LogOut className="size-[18px] text-gray-500 group-hover:text-red-500 transition-colors" />
            {t("user.logout")}
          </button>
        </div>
      </aside>
    </>
  );
}
