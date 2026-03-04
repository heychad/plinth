"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { ClientDetailHeader } from "../../../../components/ClientDetailHeader";
import { AgentsTab } from "../../../../components/AgentsTab";
import { IntegrationsTab } from "../../../../components/IntegrationsTab";
import { RecentRunsTab } from "../../../../components/RecentRunsTab";
import { ReportsTab } from "../../../../components/ReportsTab";

type Tab = "agents" | "integrations" | "runs" | "reports";

export default function ClientDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId as Id<"tenants">;
  const [activeTab, setActiveTab] = useState<Tab>("agents");
  const [refreshKey, setRefreshKey] = useState(0);

  const data = useQuery(api.clientDetail.getClientDetail, { tenantId });

  if (data === undefined) {
    return (
      <main id="main-content" tabIndex={-1} style={{ padding: "40px 32px", maxWidth: "1100px", margin: "0 auto" }}>
        <p style={{ color: "#6b7280" }}>Loading...</p>
      </main>
    );
  }

  if (data === null) {
    return (
      <main id="main-content" tabIndex={-1} style={{ padding: "40px 32px", maxWidth: "1100px", margin: "0 auto" }}>
        <p style={{ color: "#991b1b" }}>Client not found or access denied.</p>
      </main>
    );
  }

  const { tenant, agentConfigs, credentials, recentRuns, reports } = data;
  const hasReports = reports.length > 0;

  const tabs: { id: Tab; label: string; hidden?: boolean }[] = [
    { id: "agents", label: "Agents" },
    { id: "integrations", label: "Integrations" },
    { id: "runs", label: "Recent Runs" },
    { id: "reports", label: "Reports", hidden: !hasReports },
  ];

  return (
    <main id="main-content" tabIndex={-1} style={{ padding: "24px 32px", maxWidth: "1100px", margin: "0 auto" }}>
      <ClientDetailHeader
        businessName={tenant.businessName}
        ownerName={tenant.ownerName}
        vertical={tenant.vertical}
        status={tenant.status}
      />

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          borderBottom: "2px solid #e5e7eb",
          marginBottom: "28px",
        }}
      >
        {tabs
          .filter((t) => !t.hidden)
          .map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 20px",
                background: "none",
                border: "none",
                borderBottom:
                  activeTab === tab.id
                    ? "2px solid var(--color-primary, #2563eb)"
                    : "2px solid transparent",
                marginBottom: "-2px",
                fontWeight: activeTab === tab.id ? 700 : 500,
                color:
                  activeTab === tab.id
                    ? "var(--color-primary, #2563eb)"
                    : "#6b7280",
                cursor: "pointer",
                fontSize: "0.9rem",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
      </div>

      {/* Tab content */}
      {activeTab === "agents" && (
        <AgentsTab
          key={refreshKey}
          tenantId={tenantId}
          agentConfigs={agentConfigs}
          onAgentDeployed={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {activeTab === "integrations" && (
        <IntegrationsTab agentConfigs={agentConfigs} credentials={credentials} />
      )}

      {activeTab === "runs" && (
        <RecentRunsTab tenantId={tenantId} recentRuns={recentRuns} />
      )}

      {activeTab === "reports" && hasReports && (
        <ReportsTab reports={reports} />
      )}
    </main>
  );
}
