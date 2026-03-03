"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

const reportStatusConfig: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: "Draft", bg: "#f3f4f6", color: "#6b7280" },
  reviewed: { label: "Reviewed", bg: "#fef3c7", color: "#92400e" },
  sent: { label: "Sent", bg: "#dbeafe", color: "#1e40af" },
  no_action: { label: "No Action", bg: "#f3f4f6", color: "#6b7280" },
};

interface CoachingReport {
  _id: Id<"coachingCallReports">;
  coachName?: string;
  studentName?: string;
  callNumber: number | "onboarding" | "bonus";
  overallScore: number;
  flagged: boolean;
  status: string;
  createdAt: number;
}

interface ReportsTabProps {
  reports: CoachingReport[];
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ScoreBadge({ score }: { score: number }) {
  let bg = "#d1fae5";
  let color = "#065f46";
  if (score < 70) {
    bg = "#fee2e2";
    color = "#991b1b";
  } else if (score < 80) {
    bg = "#fef3c7";
    color = "#92400e";
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 700,
        backgroundColor: bg,
        color,
      }}
    >
      {score}
    </span>
  );
}

export function ReportsTab({ reports }: ReportsTabProps) {
  const sendReportToCoach = useMutation(api.coachingCallReports.sendReportToCoach);

  async function handleSendToCoach(reportId: Id<"coachingCallReports">) {
    // eslint-disable-next-line no-undef
    if (!window.confirm("Send this report to the coach? This action cannot be undone.")) return;
    try {
      await sendReportToCoach({ reportId });
    } catch (err) {
      // eslint-disable-next-line no-undef
      window.alert(err instanceof Error ? err.message : "Failed to send report");
    }
  }

  if (reports.length === 0) {
    return null;
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
        Coaching Reports
      </h2>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              {["Date", "Coach", "Student", "Call #", "Score", "Status", "Actions"].map((col) => (
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
            {reports.map((report) => {
              const statusInfo = reportStatusConfig[report.status] ?? {
                label: report.status,
                bg: "#f3f4f6",
                color: "#6b7280",
              };
              return (
                <tr
                  key={report._id}
                  style={{ borderBottom: "1px solid #f3f4f6" }}
                >
                  <td style={{ padding: "12px 12px", color: "#4b5563", whiteSpace: "nowrap" }}>
                    {formatDate(report.createdAt)}
                    {report.flagged && (
                      <span
                        style={{
                          marginLeft: "6px",
                          display: "inline-block",
                          padding: "1px 6px",
                          borderRadius: "9999px",
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          backgroundColor: "#fee2e2",
                          color: "#991b1b",
                        }}
                      >
                        Flagged
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 12px", color: "#4b5563" }}>
                    {report.coachName ?? "—"}
                  </td>
                  <td style={{ padding: "12px 12px", color: "#4b5563" }}>
                    {report.studentName ?? "—"}
                  </td>
                  <td style={{ padding: "12px 12px", color: "#4b5563" }}>
                    {String(report.callNumber)}
                  </td>
                  <td style={{ padding: "12px 12px" }}>
                    <ScoreBadge score={report.overallScore} />
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
                  <td style={{ padding: "12px 12px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <button
                        // eslint-disable-next-line no-undef
                        onClick={() => window.alert("Report detail coming soon")}
                        style={{
                          padding: "4px 10px",
                          backgroundColor: "transparent",
                          color: "var(--color-primary, #2563eb)",
                          border: "1px solid var(--color-primary, #2563eb)",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Review
                      </button>

                      {report.status !== "sent" && (
                        <button
                          onClick={() => handleSendToCoach(report._id)}
                          style={{
                            padding: "4px 10px",
                            backgroundColor: "var(--color-primary, #2563eb)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Send to Coach
                        </button>
                      )}
                    </div>
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
