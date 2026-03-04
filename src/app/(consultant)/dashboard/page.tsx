"use client";

import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";
import { StatCards } from "./_components/StatCards";
import { RecentClientsTable } from "./_components/RecentClientsTable";
import { DraftReports } from "./_components/DraftReports";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user } = useUser();
  const firstName = user?.firstName ?? "there";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dashboardStats = useQuery((api as any).dashboard.getConsultantDashboard);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientsResult = useQuery((api as any).dashboard.listClientsForConsultant, {
    sortBy: "businessName" as const,
    sortDir: "asc" as const,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reportsResult = useQuery((api as any).coachingCallReports.listCoachingReportsForConsultant, {
    status: "draft",
    limit: 3,
  });

  const statsLoading = dashboardStats === undefined;
  const clientsLoading = clientsResult === undefined;
  const reportsLoading = reportsResult === undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening with your clients today.
        </p>
      </div>

      <StatCards stats={dashboardStats} isLoading={statsLoading} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentClientsTable
            clients={clientsResult?.tenants ?? []}
            isLoading={clientsLoading}
          />
        </div>
        <div>
          <DraftReports
            reports={reportsResult?.reports}
            isLoading={reportsLoading}
          />
        </div>
      </div>
    </div>
  );
}
