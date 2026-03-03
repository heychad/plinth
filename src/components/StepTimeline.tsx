"use client";

import { useState } from "react";

type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

interface AgentRunStep {
  _id: string;
  stepOrder: number;
  stepDisplayName: string;
  status: StepStatus;
  durationMs?: number;
  promptTokens: number;
  completionTokens: number;
  output?: unknown;
  rawResponse?: unknown;
  errorMessage?: string;
}

interface StepTimelineProps {
  steps: AgentRunStep[];
}

const stepStatusConfig: Record<StepStatus, { label: string; backgroundColor: string; color: string }> = {
  pending: { label: "Pending", backgroundColor: "#f3f4f6", color: "#6b7280" },
  running: { label: "Running", backgroundColor: "#dbeafe", color: "#1d4ed8" },
  completed: { label: "Completed", backgroundColor: "#d1fae5", color: "#065f46" },
  failed: { label: "Failed", backgroundColor: "#fee2e2", color: "#991b1b" },
  skipped: { label: "Skipped", backgroundColor: "#f3f4f6", color: "#9ca3af" },
};

function formatDurationMs(durationMs?: number): string {
  if (!durationMs) return "—";
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function StepCard({ step }: { step: AgentRunStep }) {
  const [expanded, setExpanded] = useState(false);
  const statusStyle = stepStatusConfig[step.status] ?? stepStatusConfig.pending;
  const totalTokens = step.promptTokens + step.completionTokens;

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        overflow: "hidden",
        transition: "box-shadow 0.15s ease",
      }}
    >
      {/* Step header — click to expand */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "14px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {/* Step order */}
        <span
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            backgroundColor: statusStyle.backgroundColor,
            color: statusStyle.color,
            fontSize: "0.75rem",
            fontWeight: 700,
          }}
        >
          {step.stepOrder + 1}
        </span>

        {/* Step name */}
        <span
          style={{
            flex: 1,
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "#111827",
          }}
        >
          {step.stepDisplayName}
        </span>

        {/* Status badge */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "2px 10px",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: 600,
            backgroundColor: statusStyle.backgroundColor,
            color: statusStyle.color,
            flexShrink: 0,
          }}
        >
          {step.status === "running" && (
            <span
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: statusStyle.color,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          )}
          {statusStyle.label}
        </span>

        {/* Duration */}
        <span style={{ fontSize: "0.8125rem", color: "#6b7280", flexShrink: 0 }}>
          {formatDurationMs(step.durationMs)}
        </span>

        {/* Token count */}
        <span style={{ fontSize: "0.8125rem", color: "#6b7280", flexShrink: 0 }}>
          {totalTokens.toLocaleString()} tokens
        </span>

        {/* Expand chevron */}
        <span
          style={{
            fontSize: "0.75rem",
            color: "#9ca3af",
            flexShrink: 0,
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          ▼
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            padding: "16px",
            backgroundColor: "#f9fafb",
          }}
        >
          {/* Error message for failed steps */}
          {step.status === "failed" && step.errorMessage && (
            <div
              style={{
                marginBottom: "16px",
                padding: "10px 14px",
                backgroundColor: "#fee2e2",
                borderRadius: "6px",
                color: "#991b1b",
                fontSize: "0.875rem",
              }}
            >
              <strong>Error:</strong> {step.errorMessage}
            </div>
          )}

          {/* Token breakdown */}
          <div style={{ marginBottom: "12px", fontSize: "0.8125rem", color: "#6b7280" }}>
            <span>Prompt tokens: <strong style={{ color: "#374151" }}>{step.promptTokens.toLocaleString()}</strong></span>
            <span style={{ margin: "0 12px" }}>|</span>
            <span>Completion tokens: <strong style={{ color: "#374151" }}>{step.completionTokens.toLocaleString()}</strong></span>
          </div>

          {/* Step output */}
          {step.output !== undefined && step.output !== null && (
            <div style={{ marginBottom: "16px" }}>
              <h4
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#374151",
                  margin: "0 0 8px 0",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Step Output
              </h4>
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
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
              >
                {typeof step.output === "string"
                  ? step.output
                  : JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          )}

          {/* Raw model response */}
          {step.rawResponse !== undefined && step.rawResponse !== null && (
            <div>
              <h4
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#374151",
                  margin: "0 0 8px 0",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Raw Model Response
              </h4>
              <pre
                style={{
                  margin: 0,
                  padding: "12px",
                  backgroundColor: "#1f2937",
                  color: "#d1d5db",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
              >
                {typeof step.rawResponse === "string"
                  ? step.rawResponse
                  : JSON.stringify(step.rawResponse, null, 2)}
              </pre>
            </div>
          )}

          {/* No content message */}
          {(step.output === undefined || step.output === null) &&
            (step.rawResponse === undefined || step.rawResponse === null) && (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#9ca3af", fontStyle: "italic" }}>
                No output recorded for this step.
              </p>
            )}
        </div>
      )}
    </div>
  );
}

export function StepTimeline({ steps }: StepTimelineProps) {
  if (steps.length === 0) {
    return (
      <div
        style={{
          padding: "32px",
          textAlign: "center",
          color: "#9ca3af",
          fontSize: "0.875rem",
          fontStyle: "italic",
        }}
      >
        No steps recorded for this run.
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Vertical timeline line */}
      <div
        style={{
          position: "absolute",
          left: "27px",
          top: "14px",
          bottom: "14px",
          width: "2px",
          backgroundColor: "#e5e7eb",
          zIndex: 0,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingLeft: "0" }}>
        {steps.map((step) => (
          <StepCard key={step._id} step={step} />
        ))}
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
