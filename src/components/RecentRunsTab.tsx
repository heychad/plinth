"use client";

import { useRouter } from "next/navigation";
import { Id } from "../../convex/_generated/dataModel";

const runStatusConfig: Record<string, { label: string; bg: string; color: string }> = {
  queued: { label: "Queued", bg: "#f3f4f6", color: "#6b7280" },
  running: { label: "Running", bg: "#dbeafe", color: "#1e40af" },
  completed: { label: "Completed", bg: "#d1fae5", color: "#065f46" },
  failed: { label: "Failed", bg: "#fee2e2", color: "#991b1b" },
  cancelled: { label: "Cancelled", bg: "#f3f4f6", color: "#6b7280" },
};

interface AgentRun {
  _id: Id<"agentRuns">;
  agentDisplayName: string;
  status: string;
  triggerType: string;
  durationMs?: number;
  totalCostUsd: number;
  createdAt: number;
}

interface RecentRunsTabProps {
  tenantId: Id<"tenants">;
  recentRuns: AgentRun[];
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function RecentRunsTab({ tenantId, recentRuns }: RecentRunsTabProps) {
  const router = useRouter();

  if (recentRuns.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "48px 24px",
          border: "2px dashed #e5e7eb",
          borderRadius: "8px",
          color: "#6b7280",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.875rem" }}>No runs yet for this client.</p>
      </div>
    );
  }

  return (
    <div>
      <h2
        style={{
          margin: "0 0 20px",
          fontSize: "1.1rem",
          fontWeight: 700,
          color: "var(--color-foreground)",
        }}
      >
        Recent Runs
      </h2>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              {["Agent", "Status", "Trigger", "Duration", "Cost", "Started At"].map((col) => (
                <th
                  key={col}
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#6b7280",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentRuns.map((run) => {
              const statusInfo = runStatusConfig[run.status] ?? {
                label: run.status,
                bg: "#f3f4f6",
                color: "#6b7280",
              };
              return (
                <tr
                  key={run._id}
                  onClick={() => router.push(`/clients/${tenantId}/runs/${run._id}`)}
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    cursor: "pointer",
                  }}
                >
                  <td style={{ padding: "12px 12px", fontWeight: 500, color: "var(--color-foreground)" }}>
                    {run.agentDisplayName}
                  </td>
                  <td style={{ padding: "12px 12px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        backgroundColor: statusInfo.bg,
                        color: statusInfo.color,
                      }}
                    >
                      {statusInfo.label}
                    </span>
                  </td>
                  <td style={{ padding: "12px 12px", color: "#4b5563", textTransform: "capitalize" }}>
                    {run.triggerType}
                  </td>
                  <td style={{ padding: "12px 12px", color: "#4b5563" }}>
                    {formatDuration(run.durationMs)}
                  </td>
                  <td style={{ padding: "12px 12px", color: "#4b5563" }}>
                    ${run.totalCostUsd.toFixed(4)}
                  </td>
                  <td style={{ padding: "12px 12px", color: "#4b5563", whiteSpace: "nowrap" }}>
                    {formatDate(run.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
