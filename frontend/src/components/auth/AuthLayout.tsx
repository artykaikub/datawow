"use client";

import React from "react";
import { Circle } from "lucide-react";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Shared auth layout matching Figma:
 * - Gray background wrapper
 * - 50/50 split: left brand panel (rounded) + right form area
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen min-h-dvh bg-brand-surface flex items-center justify-center p-6 relative">
      {/* Language switcher — top-right corner */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-[960px] grid grid-cols-1 lg:grid-cols-2 bg-white rounded-2xl shadow-lg overflow-hidden min-h-[600px]">
        {/* ─── Left Brand Panel (50%) ─── */}
        <aside className="hidden lg:flex flex-col bg-brand text-brand-foreground p-10 rounded-2xl m-2 mr-0 relative overflow-hidden">
          {/* Brand — top */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white/20 border border-white/10 flex items-center justify-center">
              <Circle className="size-4 fill-white text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">BRAND</span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Tagline — bottom */}
          <div>
            <h2 className="text-2xl font-bold leading-snug mb-5 italic">
              &ldquo;Powering the tools that
              <br />
              power the team.&rdquo;
            </h2>
            <p className="text-sm leading-relaxed text-brand-foreground/70">
              Lorem ipsum dolor sit amet consectetur. Elit purus nam gravida porttitor
              nibh urna sit ornare a. Proin dolor morbi id ornare aenean noni
            </p>
          </div>
        </aside>

        {/* ─── Right Form Area (50%) ─── */}
        <main className="flex items-center justify-center p-8 lg:p-12">
          <div className="w-full max-w-[340px]">
            {/* Mobile brand (visible only on small screens) */}
            <div className="flex items-center gap-2.5 mb-8 lg:hidden">
              <div className="w-5 h-5 rounded-full bg-brand" />
              <span className="text-sm font-bold text-brand tracking-wide">BRAND</span>
            </div>

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
