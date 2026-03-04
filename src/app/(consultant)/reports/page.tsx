"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { ReportsTable } from "./_components/ReportsTable";

export default function ReportsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = useQuery((api as any).coachingCallReports.listCoachingReportsForConsultant, {});
  const reports = result?.reports ?? [];
  const isLoading = result === undefined;

  return (
    <main id="main-content" tabIndex={-1} className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        {!isLoading && (
          <Badge variant="secondary" className="text-xs">
            {reports.length}
          </Badge>
        )}
      </div>

      <ReportsTable reports={reports} isLoading={isLoading} />
    </main>
  );
}
