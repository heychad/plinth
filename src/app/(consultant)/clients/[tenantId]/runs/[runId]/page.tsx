"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";
import { RunHeader } from "@/components/RunHeader";
import { StepTimeline } from "@/components/StepTimeline";

export default function RunDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const runId = params.runId as Id<"agentRuns">;

  const data = useQuery(api.runDetail.getRunDetail, { runId });

  if (data === undefined) {
    return (
      <main style={{ padding: "24px", color: "var(--color-foreground, #111827)" }}>
        <p style={{ color: "#6b7280" }}>Loading run details...</p>
      </main>
    );
  }

  if (data === null) {
    return (
      <main style={{ padding: "24px", color: "var(--color-foreground, #111827)" }}>
        <p style={{ color: "#991b1b" }}>Run not found.</p>
        <a
          href={`/clients/${tenantId}`}
          style={{ color: "var(--color-primary, #6366f1)", textDecoration: "none", fontSize: "0.875rem" }}
        >
          &larr; Back to Client
        </a>
      </main>
    );
  }

  const { run, agentName, steps } = data;

  return (
    <main style={{ maxWidth: "1024px", margin: "0 auto", padding: "0 0 48px 0" }}>
      {/* Run header */}
      <RunHeader
        agentName={agentName}
        status={run.status}
        triggerType={run.triggerType}
        durationMs={run.durationMs}
        totalCostUsd={run.totalCostUsd}
        tenantId={tenantId}
      />

      <div style={{ padding: "0 24px" }}>
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
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
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
      </div>
    </main>
  );
}
