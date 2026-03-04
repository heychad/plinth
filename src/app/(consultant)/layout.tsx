import { ReactNode } from "react";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { ConsultantSidebar } from "@/components/consultant/ConsultantSidebar";

export default function ConsultantLayout({ children }: { children: ReactNode }) {
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
