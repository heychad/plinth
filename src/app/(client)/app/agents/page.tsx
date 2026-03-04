"use client";

import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useState } from "react";

type AgentConfig = {
  _id: string;
  displayName: string;
  status: string;
  templateId: string;
  createdAt: number;
};

type AgentTemplate = {
  _id: string;
  displayName: string;
};

const configStatusBadge: Record<string, { bg: string; color: string; label: string }> = {
  deployed: { bg: "#d1fae5", color: "#065f46", label: "Active" },
  building: { bg: "#fef3c7", color: "#92400e", label: "Setting Up" },
  testing: { bg: "#fef3c7", color: "#92400e", label: "Testing" },
  paused: { bg: "#f3f4f6", color: "#6b7280", label: "Paused" },
  archived: { bg: "#f3f4f6", color: "#9ca3af", label: "Archived" },
};

export default function ClientAgentsPage() {
  const [runningConfigId, setRunningConfigId] = useState<string | null>(null);
  const [runError, setRunError] = useState<Record<string, string>>({});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUser = useQuery((api as any).auth.getCurrentUser);
  const tenantId = currentUser?.tenantId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { results: configs, status: paginationStatus, loadMore } = usePaginatedQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).agentConfigs.listAgentConfigsForTenant,
    tenantId ? { tenantId } : "skip",
    { initialNumItems: 50 }
  );

  // Fetch all templates for name lookup (client-side join)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const templatesResult = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).agentTemplates.listAgentTemplates,
    tenantId ? { paginationOpts: { numItems: 200, cursor: null } } : "skip"
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const triggerRun = useMutation((api as any).agentRuns.triggerAgentRun);

  const isLoading =
    currentUser === undefined || paginationStatus === "LoadingFirstPage";
  const canLoadMore = paginationStatus === "CanLoadMore";

  // Build template name lookup map
  const templateNameMap: Record<string, string> = {};
  const templatePages = templatesResult?.page ?? [];
  for (const t of templatePages as AgentTemplate[]) {
    templateNameMap[t._id] = t.displayName;
  }

  async function handleRunNow(configId: string) {
    if (runningConfigId) return;
    setRunError((prev) => ({ ...prev, [configId]: "" }));
    setRunningConfigId(configId);
    try {
      await triggerRun({ agentConfigId: configId, input: {} });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to trigger run";
      setRunError((prev) => ({ ...prev, [configId]: message }));
    } finally {
      setRunningConfigId(null);
    }
  }

  return (
    <main id="main-content" tabIndex={-1} style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#111827",
          marginBottom: "8px",
        }}
      >
        My Agents
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "24px" }}>
        All agents deployed to your account.
      </p>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {isLoading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>
            Loading agents...
          </div>
        ) : configs.length === 0 ? (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            No agents deployed yet. Your consultant will deploy agents to your account.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.875rem",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb", background: "#f9fafb" }}>
                  {["Name", "Status", "Template", "Last Run", "Runs This Month", "Actions"].map(
                    (col) => (
                      <th
                        key={col}
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontWeight: 600,
                          color: "#374151",
                          whiteSpace: "nowrap",
                          fontSize: "0.8rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {configs.map((config: AgentConfig) => {
                  const badgeInfo =
                    configStatusBadge[config.status] ?? {
                      bg: "#f3f4f6",
                      color: "#6b7280",
                      label: config.status,
                    };
                  const isDeployed = config.status === "deployed";
                  const isRunning = runningConfigId === config._id;
                  const errorMsg = runError[config._id];

                  return (
                    <tr
                      key={config._id}
                      style={{ borderBottom: "1px solid #f3f4f6" }}
                    >
                      <td style={{ padding: "14px 16px", fontWeight: 500, color: "#111827" }}>
                        {config.displayName}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor: badgeInfo.bg,
                            color: badgeInfo.color,
                          }}
                        >
                          {badgeInfo.label}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#6b7280" }}>
                        {templateNameMap[config.templateId] ?? "—"}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#6b7280" }}>
                        {/* Last run — shown as em dash; would require a separate query per agent */}
                        —
                      </td>
                      <td style={{ padding: "14px 16px", color: "#374151" }}>
                        {/* Runs this month — would require a separate aggregation query */}
                        —
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {isDeployed && (
                            <button
                              onClick={() => handleRunNow(config._id)}
                              disabled={isRunning || runningConfigId !== null}
                              style={{
                                padding: "5px 12px",
                                background:
                                  isRunning || runningConfigId !== null
                                    ? "#9ca3af"
                                    : "var(--color-primary, #4f46e5)",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "0.8rem",
                                fontWeight: 500,
                                cursor:
                                  isRunning || runningConfigId !== null
                                    ? "not-allowed"
                                    : "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isRunning ? "Running..." : "Run Now"}
                            </button>
                          )}
                          {errorMsg && (
                            <span style={{ fontSize: "0.75rem", color: "#dc2626" }}>
                              {errorMsg}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canLoadMore && (
        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <button
            onClick={() => loadMore(50)}
            style={{
              padding: "10px 28px",
              background: "var(--color-primary, #4f46e5)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Load more
          </button>
        </div>
      )}
    </main>
  );
}
