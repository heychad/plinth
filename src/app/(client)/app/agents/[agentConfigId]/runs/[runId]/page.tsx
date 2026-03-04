"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../../convex/_generated/dataModel";
import { StepTimeline } from "@/components/StepTimeline";

type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
type TriggerType = "manual" | "scheduled" | "webhook";

const statusConfig: Record<RunStatus, { label: string; backgroundColor: string; color: string }> = {
  queued: { label: "Queued", backgroundColor: "#f3f4f6", color: "#6b7280" },
  running: { label: "Running", backgroundColor: "#dbeafe", color: "#1d4ed8" },
  completed: { label: "Completed", backgroundColor: "#d1fae5", color: "#065f46" },
  failed: { label: "Failed", backgroundColor: "#fee2e2", color: "#991b1b" },
  cancelled: { label: "Cancelled", backgroundColor: "#f3f4f6", color: "#6b7280" },
};

const triggerLabels: Record<TriggerType, string> = {
  manual: "Manual",
  scheduled: "Scheduled",
  webhook: "Webhook",
};

function formatDuration(durationMs?: number, status?: RunStatus): string {
  if (status === "running" || status === "queued") return "Running...";
  if (!durationMs) return "—";
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatCost(costUsd: number): string {
  return `$${costUsd.toFixed(4)}`;
}

function OutputSection({ output }: { output: unknown }) {
  const [expanded, setExpanded] = useState(false);

  if (output === undefined || output === null) return null;

  const outputStr =
    typeof output === "string" ? output : JSON.stringify(output, null, 2);

  // Extract URLs from output to render as clickable links
  const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
  const urls = outputStr.match(urlRegex) ?? [];

  return (
    <div
      style={{
        marginTop: "32px",
        padding: "20px 24px",
        backgroundColor: "#f0fdf4",
        border: "1px solid #bbf7d0",
        borderRadius: "8px",
      }}
    >
      <h2
        style={{
          fontSize: "1.125rem",
          fontWeight: 700,
          color: "#065f46",
          margin: "0 0 12px 0",
        }}
      >
        Output
      </h2>

      {/* Render detected URLs as clickable links */}
      {urls.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          {urls.map((url, i) => (
            <div key={i} style={{ marginBottom: "8px" }}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--color-primary, #6366f1)",
                  textDecoration: "underline",
                  fontSize: "0.9375rem",
                  wordBreak: "break-all",
                }}
              >
                {url}
              </a>
            </div>
          ))}
        </div>
      )}

      {/* View Full Output toggle */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 14px",
          backgroundColor: "#ffffff",
          border: "1px solid #d1fae5",
          borderRadius: "6px",
          fontSize: "0.8125rem",
          fontWeight: 500,
          color: "#065f46",
          cursor: "pointer",
          marginBottom: expanded ? "12px" : "0",
        }}
      >
        {expanded ? "Hide" : "View Full Output"}
        <span
          style={{
            fontSize: "0.6875rem",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          ▼
        </span>
      </button>

      {expanded && (
        <pre
          style={{
            margin: 0,
            padding: "12px",
            backgroundColor: "#1f2937",
            color: "#e5e7eb",
            borderRadius: "6px",
            fontSize: "0.8125rem",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
          {outputStr}
        </pre>
      )}
    </div>
  );
}

export default function ClientRunDetailPage() {
  const params = useParams();
  const agentConfigId = params.agentConfigId as string;
  const runId = params.runId as Id<"agentRuns">;

  const data = useQuery(api.runDetail.getRunDetail, { runId });

  if (data === undefined) {
    return (
      <main id="main-content" tabIndex={-1} style={{ padding: "24px", color: "var(--color-foreground, #111827)" }}>
        <p style={{ color: "#6b7280" }}>Loading run details...</p>
      </main>
    );
  }

  if (data === null) {
    return (
      <main id="main-content" tabIndex={-1} style={{ padding: "24px", color: "var(--color-foreground, #111827)" }}>
        <p style={{ color: "#991b1b" }}>Run not found.</p>
        <a
          href={`/app/agents/${agentConfigId}`}
          style={{
            color: "var(--color-primary, #6366f1)",
            textDecoration: "none",
            fontSize: "0.875rem",
          }}
        >
          &larr; Back to Agent
        </a>
      </main>
    );
  }

  const { run, agentName, steps } = data;
  const statusStyle = statusConfig[run.status as RunStatus] ?? statusConfig.queued;

  return (
    <main id="main-content" tabIndex={-1} style={{ maxWidth: "1024px", margin: "0 auto", padding: "0 0 48px 0" }}>
      {/* Run header */}
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
            href={`/app/agents/${agentConfigId}`}
            style={{
              fontSize: "0.875rem",
              color: "var(--color-primary, #6366f1)",
              textDecoration: "none",
            }}
          >
            &larr; Back to Agent
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
            {run.status === "running" && (
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

          {/* Start time */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.8125rem", color: "#6b7280" }}>Started:</span>
            <span
              style={{
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "var(--color-foreground, #111827)",
              }}
            >
              {new Date(run.startedAt ?? run.createdAt).toLocaleString()}
            </span>
          </div>

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
              {triggerLabels[run.triggerType as TriggerType] ?? run.triggerType}
            </span>
          </div>

          {/* Duration */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.8125rem", color: "#6b7280" }}>Duration:</span>
            <span
              style={{
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "var(--color-foreground, #111827)",
              }}
            >
              {formatDuration(run.durationMs, run.status as RunStatus)}
            </span>
          </div>

          {/* Cost — shown after completion */}
          {run.status === "completed" && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "0.8125rem", color: "#6b7280" }}>Cost:</span>
              <span
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--color-foreground, #111827)",
                }}
              >
                {formatCost(run.totalCostUsd)}
              </span>
            </div>
          )}
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>

      <div style={{ padding: "0 24px" }}>
        {/* Queued with no steps yet */}
        {run.status === "queued" && steps.length === 0 && (
          <div
            style={{
              marginBottom: "32px",
              padding: "20px 24px",
              backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              color: "#6b7280",
              fontSize: "0.9375rem",
              fontStyle: "italic",
            }}
          >
            Waiting to start...
          </div>
        )}

        {/* Error detail section — only shown when run failed */}
        {run.status === "failed" && (
          <div
            style={{
              marginBottom: "32px",
              padding: "20px 24px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
            }}
          >
            <h2
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "#991b1b",
                margin: "0 0 8px 0",
              }}
            >
              {run.errorMessage ?? "Run failed"}
            </h2>
            {run.errorDetail !== undefined && run.errorDetail !== null && (
              <pre
                style={{
                  margin: "12px 0 0 0",
                  padding: "12px",
                  backgroundColor: "#fee2e2",
                  borderRadius: "6px",
                  fontSize: "0.8125rem",
                  color: "#7f1d1d",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
              >
                {typeof run.errorDetail === "string"
                  ? run.errorDetail
                  : JSON.stringify(run.errorDetail, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Step timeline */}
        <div>
          <h2
            style={{
              fontSize: "1.125rem",
              fontWeight: 700,
              color: "var(--color-foreground, #111827)",
              margin: "0 0 16px 0",
            }}
          >
            Step Timeline
          </h2>
          <StepTimeline steps={steps} />
        </div>

        {/* Output section — only shown when completed */}
        {run.status === "completed" && <OutputSection output={run.output} />}
      </div>
    </main>
  );
}
