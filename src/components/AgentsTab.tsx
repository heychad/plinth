"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { DeployAgentModal } from "./DeployAgentModal";

const agentStatusConfig: Record<string, { label: string; bg: string; color: string }> = {
  building: { label: "Building", bg: "#dbeafe", color: "#1e40af" },
  testing: { label: "Testing", bg: "#fef3c7", color: "#92400e" },
  deployed: { label: "Deployed", bg: "#d1fae5", color: "#065f46" },
  paused: { label: "Paused", bg: "#f3f4f6", color: "#6b7280" },
  archived: { label: "Archived", bg: "#fee2e2", color: "#991b1b" },
};

interface AgentConfig {
  _id: Id<"agentConfigs">;
  displayName: string;
  status: string;
  version: number;
  templateDisplayName: string;
  templateVersion: number | null;
  lastRunAt?: number;
  runCountThisMonth: number;
}

interface AgentsTabProps {
  tenantId: Id<"tenants">;
  agentConfigs: AgentConfig[];
  onAgentDeployed: () => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AgentsTab({ tenantId, agentConfigs, onAgentDeployed }: AgentsTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [syncingId, setSyncingId] = useState<Id<"agentConfigs"> | null>(null);
  const [syncError, setSyncError] = useState<Record<string, string>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncMutation = useMutation((api as any).agentConfigs.syncAgentConfigWithTemplate);

  async function handleSync(configId: Id<"agentConfigs">) {
    setSyncingId(configId);
    setSyncError((prev) => ({ ...prev, [configId]: "" }));
    try {
      await syncMutation({ agentConfigId: configId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      setSyncError((prev) => ({ ...prev, [configId]: message }));
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--color-foreground)" }}>
          Deployed Agents
        </h2>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: "8px 18px",
            backgroundColor: "var(--color-primary, #2563eb)",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Deploy New Agent
        </button>
      </div>

      {agentConfigs.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            border: "2px dashed #e5e7eb",
            borderRadius: "8px",
            color: "#6b7280",
          }}
        >
          <p style={{ margin: "0 0 12px", fontSize: "1rem", fontWeight: 600 }}>No agents deployed yet</p>
          <p style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
            Deploy an agent template to get started.
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: "8px 18px",
              backgroundColor: "var(--color-primary, #2563eb)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Deploy an Agent
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {agentConfigs.map((config) => {
            const statusInfo = agentStatusConfig[config.status] ?? {
              label: config.status,
              bg: "#f3f4f6",
              color: "#6b7280",
            };
            const hasUpdate =
              config.templateVersion !== null &&
              config.version < config.templateVersion;
            const isSyncing = syncingId === config._id;
            const errMsg = syncError[config._id] ?? "";
            return (
              <div
                key={config._id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                  backgroundColor: "#fafafa",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-foreground)" }}>
                      {config.displayName}
                    </span>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "1px 8px",
                        borderRadius: "9999px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        backgroundColor: statusInfo.bg,
                        color: statusInfo.color,
                      }}
                    >
                      {statusInfo.label}
                    </span>
                    {hasUpdate && (
                      <span
                        style={{
                          display: "inline-block",
                          padding: "1px 8px",
                          borderRadius: "9999px",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          backgroundColor: "#fef9c3",
                          color: "#854d0e",
                          border: "1px solid #fde047",
                        }}
                      >
                        Update Available
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                    Template: {config.templateDisplayName}
                  </div>
                  {errMsg && (
                    <div style={{ fontSize: "0.75rem", color: "#991b1b", marginTop: "4px" }}>
                      {errMsg}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flexShrink: 0 }}>
                  <div style={{ textAlign: "right", fontSize: "0.8rem", color: "#6b7280" }}>
                    <div>
                      Last run:{" "}
                      {config.lastRunAt ? formatDate(config.lastRunAt) : "Never"}
                    </div>
                    <div>{config.runCountThisMonth} runs this month</div>
                  </div>
                  {hasUpdate && (
                    <button
                      onClick={() => handleSync(config._id)}
                      disabled={isSyncing}
                      style={{
                        padding: "5px 12px",
                        backgroundColor: isSyncing ? "#e5e7eb" : "#fef9c3",
                        color: isSyncing ? "#9ca3af" : "#854d0e",
                        border: "1px solid #fde047",
                        borderRadius: "6px",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                        cursor: isSyncing ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isSyncing ? "Syncing..." : "Sync to Latest"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <DeployAgentModal
          tenantId={tenantId}
          onClose={() => setShowModal(false)}
          onDeployed={onAgentDeployed}
        />
      )}
    </div>
  );
}
