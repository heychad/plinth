"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Bot,
  FileText,
  Settings,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function ConsultantSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="icon"
      aria-label="Consultant navigation"
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-primary group-data-[collapsible=icon]:hidden">
            Plinth
          </span>
          <SidebarTrigger className="ml-auto min-h-[44px] min-w-[44px]" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (pathname.startsWith(item.href + "/") &&
                    item.href !== "/dashboard");

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className="min-h-[44px]"
                    >
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-2">
          <UserButton afterSignOutUrl="/sign-in" />
          <span className="truncate text-sm text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Account
          </span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
