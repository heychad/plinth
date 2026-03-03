"use client";

type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
type TriggerType = "manual" | "scheduled" | "webhook";

interface RunHeaderProps {
  agentName: string;
  status: RunStatus;
  triggerType: TriggerType;
  durationMs?: number;
  totalCostUsd: number;
  tenantId: string;
}

const statusConfig: Record<RunStatus, { label: string; backgroundColor: string; color: string }> = {
  queued: { label: "Queued", backgroundColor: "#f3f4f6", color: "#6b7280" },
  running: { label: "Running", backgroundColor: "#dbeafe", color: "#1d4ed8" },
  completed: { label: "Completed", backgroundColor: "#d1fae5", color: "#065f46" },
  failed: { label: "Failed", backgroundColor: "#fee2e2", color: "#991b1b" },
  cancelled: { label: "Cancelled", backgroundColor: "#f3f4f6", color: "#6b7280" },
};

const triggerConfig: Record<TriggerType, string> = {
  manual: "Manual",
  scheduled: "Scheduled",
  webhook: "Webhook",
};

function formatDuration(durationMs?: number, status?: RunStatus): string {
  if (status === "running" || status === "queued") {
    return "Running...";
  }
  if (!durationMs) {
    return "—";
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function formatCost(costUsd: number): string {
  return `$${costUsd.toFixed(4)}`;
}

export function RunHeader({ agentName, status, triggerType, durationMs, totalCostUsd, tenantId }: RunHeaderProps) {
  const statusStyle = statusConfig[status] ?? statusConfig.queued;

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: "var(--color-background, #ffffff)",
        borderBottom: "1px solid #e5e7eb",
        marginBottom: "24px",
      }}
    >
      <div style={{ marginBottom: "16px" }}>
        <a
          href={`/clients/${tenantId}`}
          style={{
            fontSize: "0.875rem",
            color: "var(--color-primary, #6366f1)",
            textDecoration: "none",
          }}
        >
          &larr; Back to Client
        </a>
      </div>

      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--color-foreground, #111827)",
          margin: "0 0 16px 0",
        }}
      >
        {agentName}
      </h1>

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
        {/* Status badge */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 12px",
            borderRadius: "9999px",
            fontSize: "0.8125rem",
            fontWeight: 600,
            backgroundColor: statusStyle.backgroundColor,
            color: statusStyle.color,
          }}
        >
          {status === "running" && (
            <span
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: statusStyle.color,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          )}
          {statusStyle.label}
        </span>

        {/* Trigger type */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "0.8125rem", color: "#6b7280" }}>Trigger:</span>
          <span
            style={{
              display: "inline-block",
              padding: "2px 10px",
              borderRadius: "9999px",
              fontSize: "0.8125rem",
              fontWeight: 500,
              backgroundColor: "#f3f4f6",
              color: "#374151",
            }}
          >
            {triggerConfig[triggerType] ?? triggerType}
          </span>
        </div>

        {/* Duration */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "0.8125rem", color: "#6b7280" }}>Duration:</span>
          <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-foreground, #111827)" }}>
            {formatDuration(durationMs, status)}
          </span>
        </div>

        {/* Cost */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "0.8125rem", color: "#6b7280" }}>Cost:</span>
          <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-foreground, #111827)" }}>
            {formatCost(totalCostUsd)}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
