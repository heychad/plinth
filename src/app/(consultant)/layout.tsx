import { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { ConsultantSidebar } from "@/components/consultant/ConsultantSidebar";

export default async function ConsultantLayout({ children }: { children: ReactNode }) {
  // Role guard: only consultants and platform admins can access consultant routes
  if (process.env.NEXT_PUBLIC_TEST_MODE !== "true") {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;

    if (role !== "consultant" && role !== "platform_admin") {
      redirect("/app");
    }
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <ConsultantSidebar />
      <SidebarInset id="main-content" tabIndex={-1}>
        <header className="flex h-14 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger className="min-h-[44px] min-w-[44px]" />
          <span className="text-base font-bold text-primary">Plinth</span>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
