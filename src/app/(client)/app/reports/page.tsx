"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";

type Report = {
  _id: Id<"coachingCallReports">;
  studentName?: string;
  callNumber: number | "onboarding" | "bonus";
  overallScore: number;
  status: "draft" | "reviewed" | "sent" | "no_action";
  createdAt: number;
  recordedAt?: number;
};

function getScoreBadgeStyle(score: number): { bg: string; color: string } {
  if (score >= 80) return { bg: "#d1fae5", color: "#065f46" };
  if (score >= 70) return { bg: "#fef3c7", color: "#92400e" };
  return { bg: "#fee2e2", color: "#991b1b" };
}

function formatCallNumber(callNumber: number | "onboarding" | "bonus"): string {
  if (callNumber === "onboarding") return "Onboarding";
  if (callNumber === "bonus") return "Bonus";
  return `Call #${callNumber}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isReviewed(status: string): boolean {
  return status === "reviewed" || status === "no_action";
}

export default function CoachReportsPage() {
  const router = useRouter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUser = useQuery((api as any).auth.getCurrentUser);
  const tenantId = currentUser?.tenantId as Id<"tenants"> | undefined;

  const result = useQuery(
    api.coachingCallReports.listCoachingReports,
    tenantId
      ? {
          tenantId,
          paginationOpts: { numItems: 50, cursor: null },
        }
      : "skip"
  );

  const isLoading = currentUser === undefined || result === undefined;
  const reports: Report[] = (result?.reports as Report[] | undefined) ?? [];

  return (
    <main style={{ padding: "32px", maxWidth: "1100px", margin: "0 auto" }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#111827",
          marginBottom: "8px",
        }}
      >
        Feedback Reports
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "28px" }}>
        Coaching call feedback from your program admin.
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
            Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div
            style={{
              padding: "56px 48px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            <p
              style={{
                fontSize: "1rem",
                marginBottom: "8px",
                color: "#374151",
                fontWeight: 500,
              }}
            >
              No feedback reports yet.
            </p>
            <p style={{ fontSize: "0.875rem" }}>
              Reports will appear here when your program admin shares feedback.
            </p>
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
                <tr
                  style={{
                    borderBottom: "2px solid #e5e7eb",
                    background: "#f9fafb",
                  }}
                >
                  {["Date", "Student", "Call #", "Score", "Status"].map(
                    (col) => (
                      <th
                        key={col}
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontWeight: 600,
                          color: "#374151",
                          fontSize: "0.8rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const scoreBadge = getScoreBadgeStyle(report.overallScore);
                  const reviewed = isReviewed(report.status);
                  const dateTs = report.recordedAt ?? report.createdAt;

                  return (
                    <tr
                      key={report._id}
                      onClick={() => router.push(`/app/reports/${report._id}`)}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        cursor: "pointer",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = "#f9fafb";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                      }}
                    >
                      <td
                        style={{
                          padding: "14px 16px",
                          color: "#6b7280",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDate(dateTs)}
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          fontWeight: 500,
                          color: "#111827",
                        }}
                      >
                        {report.studentName ?? "—"}
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          color: "#374151",
                        }}
                      >
                        {formatCallNumber(report.callNumber)}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            backgroundColor: scoreBadge.bg,
                            color: scoreBadge.color,
                          }}
                        >
                          {report.overallScore}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {reviewed ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 10px",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: 500,
                              backgroundColor: "#f3f4f6",
                              color: "#6b7280",
                            }}
                          >
                            Reviewed
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 10px",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              backgroundColor: "#dbeafe",
                              color: "#1e40af",
                            }}
                          >
                            New
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
