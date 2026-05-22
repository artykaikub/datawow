import type { Metadata } from "next";
import { UserSidebar } from "@/components/user/UserSidebar";
import { TopLanguageSwitcher } from "@/components/ui/TopLanguageSwitcher";

export const metadata: Metadata = {
  title: "User Dashboard",
  description: "Browse and reserve concert tickets.",
};

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen bg-[#F8F9FC] flex overflow-hidden">
      <UserSidebar />
      <main className="flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:py-8 lg:px-10 pt-16 lg:pt-8">
        {children}
      </main>
      <TopLanguageSwitcher />
    </div>
  );
}
