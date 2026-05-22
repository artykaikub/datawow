import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { TopLanguageSwitcher } from "@/components/ui/TopLanguageSwitcher";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Admin dashboard for managing concerts and reservations.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen bg-[#F8F9FC] flex overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:py-8 lg:px-10 pt-16 lg:pt-8">
        {children}
      </main>
      <TopLanguageSwitcher />
    </div>
  );
}
