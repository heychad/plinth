"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";

type StatusFilter = "all" | "flagged" | "sent" | "clear" | "no_action";

function getStatusLabel(status: string, flagged: boolean): string {
  if (flagged && status === "draft") return "Flagged";
  if (status === "sent") return "Sent";
  if (status === "no_action") return "No Action";
  if (status === "reviewed") return "Reviewed";
  return "Clear";
}

function StatusBadge({ status, flagged }: { status: string; flagged: boolean }) {
  const label = getStatusLabel(status, flagged);

  const styles: Record<string, { bg: string; color: string }> = {
    Flagged: { bg: "#fee2e2", color: "#991b1b" },
    Sent: { bg: "#dbeafe", color: "#1e40af" },
    "No Action": { bg: "#f3f4f6", color: "#6b7280" },
    Reviewed: { bg: "#fef9c3", color: "#92400e" },
    Clear: { bg: "#f3f4f6", color: "#6b7280" },
  };

  const s = styles[label] ?? { bg: "#f3f4f6", color: "#6b7280" };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        background: s.bg,
        color: s.color,
      }}
    >
      {label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "#16a34a" : score >= 70 ? "#d97706" : "#dc2626";
  const bg =
    score >= 80 ? "#dcfce7" : score >= 70 ? "#fef3c7" : "#fee2e2";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 700,
        background: bg,
        color,
      }}
    >
      {score}
    </span>
  );
}

export default function ReportsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [coachFilter, setCoachFilter] = useState("");
  const [callNumberFilter, setCallNumberFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Build query args
  const queryArgs: Record<string, unknown> = {};

  if (statusFilter !== "all") {
    queryArgs.status = statusFilter === "clear" ? "draft" : statusFilter;
    if (statusFilter === "flagged") {
      delete queryArgs.status;
      queryArgs.status = "flagged";
    }
  }

  if (coachFilter.trim()) {
    queryArgs.coachId = coachFilter.trim();
  }

  if (callNumberFilter.trim()) {
    const num = Number(callNumberFilter);
    if (!isNaN(num)) {
      queryArgs.callNumber = num;
    } else if (
      callNumberFilter === "onboarding" ||
      callNumberFilter === "bonus"
    ) {
      queryArgs.callNumber = callNumberFilter;
    }
  }

  if (dateFrom) {
    queryArgs.dateFrom = new Date(dateFrom).getTime();
  }
  if (dateTo) {
    queryArgs.dateTo = new Date(dateTo).getTime() + 86400000; // end of day
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = useQuery((api as any).coachingCallReports.listCoachingReportsForConsultant, queryArgs);
  const reports = result?.reports ?? [];
  const isLoading = result === undefined;

  return (
    <main id="main-content" tabIndex={-1} style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#111827",
          marginBottom: "8px",
        }}
      >
        Reports
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "28px" }}>
        Coaching call reports across all clients
      </p>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "24px",
          alignItems: "flex-end",
        }}
      >
        {/* Status filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label
            style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}
          >
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
              color: "#111827",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            <option value="all">All</option>
            <option value="flagged">Flagged</option>
            <option value="sent">Sent</option>
            <option value="clear">Clear</option>
            <option value="no_action">No Action</option>
          </select>
        </div>

        {/* Coach filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label
            style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}
          >
            Coach ID
          </label>
          <input
            type="text"
            placeholder="Filter by coach..."
            value={coachFilter}
            onChange={(e) => setCoachFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
              color: "#111827",
              background: "#fff",
              width: "180px",
            }}
          />
        </div>

        {/* Call number filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label
            style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}
          >
            Call #
          </label>
          <input
            type="text"
            placeholder="1, 2, onboarding..."
            value={callNumberFilter}
            onChange={(e) => setCallNumberFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
              color: "#111827",
              background: "#fff",
              width: "150px",
            }}
          />
        </div>

        {/* Date from */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label
            style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}
          >
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
              color: "#111827",
              background: "#fff",
            }}
          />
        </div>

        {/* Date to */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label
            style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}
          >
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
              color: "#111827",
              background: "#fff",
            }}
          />
        </div>

        {/* Clear filters */}
        {(statusFilter !== "all" ||
          coachFilter ||
          callNumberFilter ||
          dateFrom ||
          dateTo) && (
          <button
            onClick={() => {
              setStatusFilter("all");
              setCoachFilter("");
              setCallNumberFilter("");
              setDateFrom("");
              setDateTo("");
            }}
            style={{
              padding: "8px 16px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
              color: "#6b7280",
              background: "#fff",
              cursor: "pointer",
              alignSelf: "flex-end",
            }}
          >
            Clear
          </button>
        )}
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
          <div style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>
            Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>
            No reports found.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                {[
                  "Date",
                  "Client",
                  "Coach",
                  "Student",
                  "Call #",
                  "Score",
                  "Status",
                  "Actions",
                ].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {reports.map((report: any, idx: number) => {
                const date = report.recordedAt
                  ? new Date(report.recordedAt).toLocaleDateString()
                  : new Date(report.createdAt).toLocaleDateString();

                return (
                  <tr
                    key={report._id}
                    style={{
                      borderBottom:
                        idx < reports.length - 1 ? "1px solid #f3f4f6" : "none",
                      background: report.flagged && report.status === "draft"
                        ? "#fffbeb"
                        : "#fff",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: "0.875rem",
                        color: "#374151",
                      }}
                    >
                      {date}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: "0.875rem",
                        color: "#374151",
                      }}
                    >
                      {report.tenantBusinessName || "—"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: "0.875rem",
                        color: "#374151",
                      }}
                    >
                      {report.coachName || report.coachId || "—"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: "0.875rem",
                        color: "#374151",
                      }}
                    >
                      {report.studentName || report.studentId || "—"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: "0.875rem",
                        color: "#374151",
                      }}
                    >
                      {String(report.callNumber)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <ScoreBadge score={report.overallScore} />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge
                        status={report.status}
                        flagged={report.flagged}
                      />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Link
                        href={`/reports/${report._id}`}
                        style={{
                          display: "inline-block",
                          padding: "4px 12px",
                          background:
                            report.status === "sent"
                              ? "#f3f4f6"
                              : "var(--color-primary, #4f46e5)",
                          color:
                            report.status === "sent"
                              ? "#374151"
                              : "#fff",
                          borderRadius: "6px",
                          textDecoration: "none",
                          fontSize: "0.8rem",
                          fontWeight: 500,
                        }}
                      >
                        {report.status === "sent" ? "View" : "Review"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
