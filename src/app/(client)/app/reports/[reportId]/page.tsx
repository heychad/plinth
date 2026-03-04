"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";

type DimensionScore = {
  score: number;
  notes?: string;
};

type Report = {
  _id: Id<"coachingCallReports">;
  coachName?: string;
  studentName?: string;
  callNumber: number | "onboarding" | "bonus";
  overallScore: number;
  dimensionScores: Record<string, DimensionScore | number>;
  highlights: string[];
  concerns: string[];
  narrative: string;
  editedNarrative?: string;
  recordedAt?: number;
  durationMinutes?: number;
  createdAt: number;
};

function getScoreColor(score: number): { bg: string; color: string } {
  if (score >= 80) return { bg: "#d1fae5", color: "#065f46" };
  if (score >= 70) return { bg: "#fef3c7", color: "#92400e" };
  return { bg: "#fee2e2", color: "#991b1b" };
}

function formatCallNumber(callNumber: number | "onboarding" | "bonus"): string {
  if (callNumber === "onboarding") return "Onboarding Call";
  if (callNumber === "bonus") return "Bonus Call";
  return `Call #${callNumber}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(minutes?: number): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function getDimensionScore(value: DimensionScore | number): {
  score: number;
  notes?: string;
} {
  if (typeof value === "number") return { score: value };
  return { score: value.score, notes: value.notes };
}

function formatDimensionName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CoachReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.reportId as Id<"coachingCallReports">;

  const report = useQuery(api.coachingCallReports.getCoachingReport, {
    reportId,
  }) as Report | null | undefined;

  if (report === undefined) {
    return (
      <main id="main-content" tabIndex={-1} style={{ padding: "40px 32px", maxWidth: "900px", margin: "0 auto" }}>
        <p style={{ color: "#6b7280" }}>Loading report...</p>
      </main>
    );
  }

  if (report === null) {
    return (
      <main id="main-content" tabIndex={-1} style={{ padding: "40px 32px", maxWidth: "900px", margin: "0 auto" }}>
        <button
          onClick={() => router.push("/app/reports")}
          style={{
            marginBottom: "24px",
            background: "none",
            border: "none",
            color: "var(--color-primary, #4f46e5)",
            fontSize: "0.875rem",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          &larr; Back to Reports
        </button>
        <p style={{ color: "#991b1b" }}>Report not found or you do not have access to this report.</p>
      </main>
    );
  }

  const overallColor = getScoreColor(report.overallScore);
  const narrative = report.editedNarrative || report.narrative;
  const dateTs = report.recordedAt ?? report.createdAt;
  const dimensionEntries = Object.entries(report.dimensionScores ?? {});

  return (
    <main id="main-content" tabIndex={-1} style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
      {/* Back nav */}
      <button
        onClick={() => router.push("/app/reports")}
        style={{
          marginBottom: "24px",
          background: "none",
          border: "none",
          color: "var(--color-primary, #4f46e5)",
          fontSize: "0.875rem",
          cursor: "pointer",
          padding: 0,
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        &larr; Back to Reports
      </button>

      {/* Header card */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "24px",
          marginBottom: "24px",
          display: "flex",
          gap: "24px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        {/* Meta info */}
        <div style={{ flex: 1, minWidth: "200px" }}>
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#111827",
              marginBottom: "4px",
            }}
          >
            {formatCallNumber(report.callNumber)}
          </h1>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "6px 16px",
              marginTop: "16px",
              fontSize: "0.875rem",
            }}
          >
            {report.coachName && (
              <>
                <span style={{ color: "#9ca3af", fontWeight: 500 }}>Coach</span>
                <span style={{ color: "#111827" }}>{report.coachName}</span>
              </>
            )}
            {report.studentName && (
              <>
                <span style={{ color: "#9ca3af", fontWeight: 500 }}>Student</span>
                <span style={{ color: "#111827" }}>{report.studentName}</span>
              </>
            )}
            <span style={{ color: "#9ca3af", fontWeight: 500 }}>Date</span>
            <span style={{ color: "#374151" }}>{formatDate(dateTs)}</span>
            <span style={{ color: "#9ca3af", fontWeight: 500 }}>Duration</span>
            <span style={{ color: "#374151" }}>{formatDuration(report.durationMinutes)}</span>
          </div>
        </div>

        {/* Overall score */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Overall Score
          </span>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              backgroundColor: overallColor.bg,
              color: overallColor.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.75rem",
              fontWeight: 800,
              border: `3px solid ${overallColor.color}`,
            }}
          >
            {report.overallScore}
          </div>
          <span style={{ fontSize: "0.75rem", color: overallColor.color, fontWeight: 600 }}>
            {report.overallScore >= 80 ? "Strong" : report.overallScore >= 70 ? "Developing" : "Needs Work"}
          </span>
        </div>
      </div>

      {/* Dimension scorecard */}
      {dimensionEntries.length > 0 && (
        <section
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "#111827",
              marginBottom: "16px",
            }}
          >
            Dimension Scorecard
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {dimensionEntries.map(([key, value], idx) => {
              const { score, notes } = getDimensionScore(
                value as DimensionScore | number
              );
              const dimColor = getScoreColor(score);
              const isLast = idx === dimensionEntries.length - 1;

              return (
                <div
                  key={key}
                  style={{
                    padding: "14px 0",
                    borderBottom: isLast ? "none" : "1px solid #f3f4f6",
                    display: "flex",
                    gap: "16px",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#374151",
                        fontSize: "0.875rem",
                        marginBottom: notes ? "4px" : 0,
                      }}
                    >
                      {formatDimensionName(key)}
                    </div>
                    {notes && (
                      <div style={{ fontSize: "0.8rem", color: "#6b7280", lineHeight: "1.5" }}>
                        {notes}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      flexShrink: 0,
                      padding: "2px 12px",
                      borderRadius: "9999px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      backgroundColor: dimColor.bg,
                      color: dimColor.color,
                    }}
                  >
                    {score}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Highlights */}
      {report.highlights.length > 0 && (
        <section
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "#166534",
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>+</span>
            Highlights
          </h2>
          <ul style={{ margin: 0, padding: "0 0 0 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {report.highlights.map((h, i) => (
              <li key={i} style={{ color: "#166534", fontSize: "0.875rem", lineHeight: "1.6" }}>
                {h}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Concerns */}
      {report.concerns.length > 0 && (
        <section
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "#9a3412",
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>!</span>
            Areas for Growth
          </h2>
          <ul style={{ margin: 0, padding: "0 0 0 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {report.concerns.map((c, i) => (
              <li key={i} style={{ color: "#9a3412", fontSize: "0.875rem", lineHeight: "1.6" }}>
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Narrative */}
      {narrative && (
        <section
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "#111827",
              marginBottom: "14px",
            }}
          >
            Feedback Summary
          </h2>
          <p
            style={{
              color: "#374151",
              fontSize: "0.9rem",
              lineHeight: "1.75",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {narrative}
          </p>
        </section>
      )}
    </main>
  );
}
