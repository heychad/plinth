"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";
import { useState } from "react";

type AgentConfigSummary = {
  configId: string;
  displayName: string;
  status: string;
  templateDisplayName: string;
  lastRunAt?: number;
  monthlyRunCount: number;
};

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  deployed: { bg: "#d1fae5", color: "#065f46", label: "Active" },
  building: { bg: "#fef3c7", color: "#92400e", label: "Setting Up" },
  testing: { bg: "#fef3c7", color: "#92400e", label: "Setting Up" },
  paused: { bg: "#f3f4f6", color: "#6b7280", label: "Paused" },
  archived: { bg: "#f3f4f6", color: "#9ca3af", label: "Archived" },
};

function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export default function ClientHomePage() {
  const [runningConfigId, setRunningConfigId] = useState<string | null>(null);
  const [runErrors, setRunErrors] = useState<Record<string, string>>({});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const homeData = useQuery((api as any).agentConfigs.getClientHome);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const theme = useQuery((api as any).themes.getThemeForCurrentUser);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const triggerRun = useMutation((api as any).agentRuns.triggerAgentRun);

  const isLoading = homeData === undefined;

  async function handleRunNow(configId: string) {
    if (runningConfigId) return;
    setRunErrors((prev) => ({ ...prev, [configId]: "" }));
    setRunningConfigId(configId);
    try {
      await triggerRun({ agentConfigId: configId, input: {} });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to trigger run";
      setRunErrors((prev) => ({ ...prev, [configId]: message }));
    } finally {
      setRunningConfigId(null);
    }
  }

  const platformName = theme?.platformName || "Your Portal";
  const logoUrl = theme?.logoUrl;

  const agentConfigs: AgentConfigSummary[] = homeData?.agentConfigs ?? [];
  const runCount = homeData?.runCount ?? 0;
  const lastRunAt = homeData?.lastRunAt;
  const lastRunAgentName = homeData?.lastRunAgentName;

  return (
    <main id="main-content" tabIndex={-1} style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Branded header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "32px",
        }}
      >
        {logoUrl && (
          <img
            src={logoUrl}
            alt={platformName}
            style={{ height: "40px", objectFit: "contain" }}
          />
        )}
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--color-text, #111827)",
              margin: 0,
            }}
          >
            {platformName}
          </h1>
          <p style={{ color: "#6b7280", margin: "4px 0 0", fontSize: "0.875rem" }}>
            Welcome back
          </p>
        </div>
      </div>

      {/* Quick stats bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "20px 24px",
          }}
        >
          <p
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              margin: "0 0 8px",
            }}
          >
            Runs This Month
          </p>
          <p
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--color-text, #111827)",
              margin: 0,
            }}
          >
            {isLoading ? "—" : runCount}
          </p>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "20px 24px",
          }}
        >
          <p
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              margin: "0 0 8px",
            }}
          >
            Last Run
          </p>
          {isLoading ? (
            <p style={{ fontSize: "1rem", color: "#9ca3af", margin: 0 }}>—</p>
          ) : lastRunAt ? (
            <div>
              <p
                style={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "var(--color-text, #111827)",
                  margin: 0,
                }}
              >
                {lastRunAgentName ?? "Unknown Agent"}
              </p>
              <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "2px 0 0" }}>
                {timeAgo(lastRunAt)}
              </p>
            </div>
          ) : (
            <p style={{ fontSize: "0.875rem", color: "#9ca3af", margin: 0 }}>No runs yet</p>
          )}
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "20px 24px",
          }}
        >
          <p
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              margin: "0 0 8px",
            }}
          >
            Active Agents
          </p>
          <p
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--color-text, #111827)",
              margin: 0,
            }}
          >
            {isLoading
              ? "—"
              : agentConfigs.filter((c) => c.status === "deployed").length}
          </p>
        </div>
      </div>

      {/* Agent status grid */}
      <div>
        <h2
          style={{
            fontSize: "1.1rem",
            fontWeight: 600,
            color: "var(--color-text, #111827)",
            marginBottom: "16px",
          }}
        >
          Your Agents
        </h2>

        {isLoading ? (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "#9ca3af",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          >
            Loading agents...
          </div>
        ) : agentConfigs.length === 0 ? (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "#6b7280",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          >
            No agents have been deployed to your account yet. Your consultant will set them up for you.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {agentConfigs.map((config) => {
              const badge = STATUS_BADGE[config.status] ?? {
                bg: "#f3f4f6",
                color: "#6b7280",
                label: config.status,
              };
              const isDeployed = config.status === "deployed";
              const isRunning = runningConfigId === config.configId;
              const errorMsg = runErrors[config.configId];

              return (
                <div
                  key={config.configId}
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "10px",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    cursor: "pointer",
                    transition: "box-shadow 0.15s",
                  }}
                  onClick={() => {
                    window.location.href = `/app/agents/${config.configId}`;
                  }}
                >
                  {/* Card header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontSize: "1rem",
                          fontWeight: 600,
                          color: "var(--color-text, #111827)",
                          margin: 0,
                        }}
                      >
                        {config.displayName}
                      </h3>
                      <p
                        style={{
                          fontSize: "0.8rem",
                          color: "#6b7280",
                          margin: "2px 0 0",
                        }}
                      >
                        {config.templateDisplayName}
                      </p>
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        backgroundColor: badge.bg,
                        color: badge.color,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      fontSize: "0.8rem",
                      color: "#6b7280",
                    }}
                  >
                    <span>
                      <strong style={{ color: "#374151" }}>{config.monthlyRunCount}</strong> runs this month
                    </span>
                    {config.lastRunAt && (
                      <span>Last: {timeAgo(config.lastRunAt)}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "auto" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link
                      href={`/app/agents/${config.configId}`}
                      style={{
                        padding: "5px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        color: "#374151",
                        textDecoration: "none",
                      }}
                    >
                      View
                    </Link>

                    {isDeployed && (
                      <button
                        onClick={() => handleRunNow(config.configId)}
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
