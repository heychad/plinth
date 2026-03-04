"use client";

import { useState } from "react";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentConfigsTab } from "./AgentConfigsTab";
import { RunHistoryTab } from "./RunHistoryTab";
import { ReportsTab } from "./ReportsTab";
import { ClientSettingsTab } from "./ClientSettingsTab";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ClientDetailTabsProps {
  tenantId: Id<"tenants">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenant: any;
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
  tenant,
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
        <AgentConfigsTab
          key={refreshKey}
          tenantId={tenantId}
          agentConfigs={agentConfigs}
          onAgentDeployed={() => setRefreshKey((k) => k + 1)}
        />
      </TabsContent>

      <TabsContent value="run-history" className="mt-6">
        <RunHistoryTab
          tenantId={tenantId}
          recentRuns={recentRuns}
          agentConfigs={agentConfigs}
        />
      </TabsContent>

      <TabsContent value="reports" className="mt-6">
        <ReportsTab tenantId={tenantId} reports={reports} />
      </TabsContent>

      <TabsContent value="client-settings" className="mt-6">
        <ClientSettingsTab tenantId={tenantId} tenant={tenant} />
      </TabsContent>
    </Tabs>
  );
}

export { TabSkeleton };
