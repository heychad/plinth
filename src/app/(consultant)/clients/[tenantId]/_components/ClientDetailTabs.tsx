"use client";

import { useState } from "react";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentsTab } from "@/components/AgentsTab";
import { RecentRunsTab } from "@/components/RecentRunsTab";
import { ReportsTab } from "@/components/ReportsTab";

// Accept the data exactly as returned by clientDetail.getClientDetail
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ClientDetailTabsProps {
  tenantId: Id<"tenants">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agentConfigs: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recentRuns: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reports: any[];
}

function TabSkeleton() {
  return (
    <div className="space-y-4 py-4">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export function ClientDetailTabs({
  tenantId,
  agentConfigs,
  recentRuns,
  reports,
}: ClientDetailTabsProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <Tabs defaultValue="agent-configs" className="w-full">
      <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto">
        <TabsTrigger
          value="agent-configs"
          className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          Agent Configs
        </TabsTrigger>
        <TabsTrigger
          value="run-history"
          className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          Run History
        </TabsTrigger>
        <TabsTrigger
          value="reports"
          className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          Reports
        </TabsTrigger>
        <TabsTrigger
          value="client-settings"
          className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          Client Settings
        </TabsTrigger>
      </TabsList>

      <TabsContent value="agent-configs" className="mt-6">
        <AgentsTab
          key={refreshKey}
          tenantId={tenantId}
          agentConfigs={agentConfigs}
          onAgentDeployed={() => setRefreshKey((k) => k + 1)}
        />
      </TabsContent>

      <TabsContent value="run-history" className="mt-6">
        <RecentRunsTab tenantId={tenantId} recentRuns={recentRuns} />
      </TabsContent>

      <TabsContent value="reports" className="mt-6">
        {reports.length > 0 ? (
          <ReportsTab reports={reports} />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">No reports yet for this client.</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="client-settings" className="mt-6">
        <TabSkeleton />
      </TabsContent>
    </Tabs>
  );
}

export { TabSkeleton };
