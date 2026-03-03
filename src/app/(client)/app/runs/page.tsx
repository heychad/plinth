"use client";

import { useState } from "react";
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import Link from "next/link";

type AgentConfig = {
  _id: string;
  displayName: string;
};

type AgentRun = {
  _id: string;
  agentConfigId: string;
  status: string;
  triggerType?: string;
  createdAt: number;
  durationMs?: number;
  totalCostUsd?: number;
};

const statusBadgeStyle: Record<string, { bg: string; color: string }> = {
  completed: { bg: "#d1fae5", color: "#065f46" },
  failed: { bg: "#fee2e2", color: "#991b1b" },
  running: { bg: "#dbeafe", color: "#1e40af" },
  queued: { bg: "#fef3c7", color: "#92400e" },
  cancelled: { bg: "#f3f4f6", color: "#6b7280" },
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms?: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  const secs = (ms / 1000).toFixed(1);
  return `${secs}s`;
}

function formatCost(usd?: number): string {
  if (!usd) return "—";
  return `$${usd.toFixed(4)}`;
}

export default function RunHistoryPage() {
  const [agentConfigFilter, setAgentConfigFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUser = useQuery((api as any).auth.getCurrentUser);
  const tenantId = currentUser?.tenantId;

  // Load agent configs for filter dropdown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configsResult = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).agentConfigs.listAgentConfigsForTenant,
    tenantId
      ? { tenantId, paginationOpts: { numItems: 100, cursor: null } }
      : "skip"
  );

  const agentConfigs: AgentConfig[] = configsResult?.page ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { results, status: paginationStatus, loadMore } = usePaginatedQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).agentRuns.listAgentRunsForTenant,
    tenantId
      ? {
          tenantId,
          agentConfigId: agentConfigFilter || undefined,
          status: statusFilter || undefined,
        }
      : "skip",
    { initialNumItems: 50 }
  );

  const isLoading = currentUser === undefined || paginationStatus === "LoadingFirstPage";
  const canLoadMore = paginationStatus === "CanLoadMore";

  // Build a lookup map for agentConfig displayNames
  const configNameMap: Record<string, string> = {};
  for (const cfg of agentConfigs) {
    configNameMap[cfg._id] = cfg.displayName;
  }

  return (
    <main style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#111827",
          marginBottom: "8px",
        }}
      >
        Run History
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "24px" }}>
        All agent runs across your account.
      </p>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "24px",
          alignItems: "center",
        }}
      >
        <select
          value={agentConfigFilter}
          onChange={(e) => setAgentConfigFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "0.875rem",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="">All Agents</option>
          {agentConfigs.map((cfg) => (
            <option key={cfg._id} value={cfg._id}>
              {cfg.displayName}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "0.875rem",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
        </select>
      </div>

      {/* Table */}
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
            Loading runs...
          </div>
        ) : results.length === 0 ? (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            No runs found.
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
                  {["Agent", "Status", "Trigger", "Started", "Duration", "Cost", "Actions"].map(
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
                {results.map((run: AgentRun) => {
                  const badgeStyle =
                    statusBadgeStyle[run.status] ?? {
                      bg: "#f3f4f6",
                      color: "#6b7280",
                    };
                  return (
                    <tr
                      key={run._id}
                      style={{ borderBottom: "1px solid #f3f4f6" }}
                    >
                      <td style={{ padding: "14px 16px", fontWeight: 500, color: "#111827" }}>
                        {configNameMap[run.agentConfigId] ?? "—"}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor: badgeStyle.bg,
                            color: badgeStyle.color,
                          }}
                        >
                          {run.status === "running" ? "Running..." : run.status}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#6b7280", textTransform: "capitalize" }}>
                        {run.triggerType ?? "—"}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#6b7280", whiteSpace: "nowrap" }}>
                        {formatDate(run.createdAt)}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#6b7280" }}>
                        {formatDuration(run.durationMs)}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#374151" }}>
                        {formatCost(run.totalCostUsd)}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <Link
                          href={`/app/runs/${run._id}`}
                          style={{
                            padding: "5px 12px",
                            background: "var(--color-primary, #4f46e5)",
                            color: "#fff",
                            borderRadius: "6px",
                            fontSize: "0.8rem",
                            fontWeight: 500,
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          View
                        </Link>
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
