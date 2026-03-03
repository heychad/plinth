"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

function ScoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 70) return "#d97706";
  return "#dc2626";
}

function ScoreBg(score: number): string {
  if (score >= 80) return "#dcfce7";
  if (score >= 70) return "#fef3c7";
  return "#fee2e2";
}

function ConfirmModal({
  coachName,
  onConfirm,
  onCancel,
}: {
  coachName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "28px 32px",
          maxWidth: "440px",
          width: "90%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        <h2
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "#111827",
            marginBottom: "12px",
          }}
        >
          Send to Coach
        </h2>
        <p style={{ color: "#374151", marginBottom: "24px", lineHeight: 1.6 }}>
          Send feedback to{" "}
          <strong>{coachName || "this coach"}</strong>? They will receive an
          email notification.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 20px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              background: "#fff",
              color: "#374151",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: "0.9rem",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 20px",
              border: "none",
              borderRadius: "6px",
              background: "var(--color-primary, #4f46e5)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            Confirm Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.reportId as Id<"coachingCallReports">;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report = useQuery((api as any).coachingCallReports.getCoachingReport, {
    reportId,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transcriptUrlResult = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).coachingCallReports.getTranscriptUrl,
    report ? { reportId } : "skip"
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateNarrative = useMutation((api as any).coachingCallReports.updateReportNarrative);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendToCoach = useMutation((api as any).coachingCallReports.sendReportToCoach);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markNoAction = useMutation((api as any).coachingCallReports.markNoAction);

  const [narrative, setNarrative] = useState("");
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [transcriptError, setTranscriptError] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isMarkingNoAction, setIsMarkingNoAction] = useState(false);

  // Sync narrative from report on first load
  useEffect(() => {
    if (report) {
      setNarrative(report.editedNarrative ?? report.narrative ?? "");
    }
  }, [report?._id]);

  // Fetch transcript from URL
  useEffect(() => {
    if (transcriptUrlResult && typeof transcriptUrlResult === "string") {
      fetch(transcriptUrlResult)
        .then((res) => res.text())
        .then((text) => setTranscriptText(text))
        .catch(() => setTranscriptError(true));
    } else if (transcriptUrlResult === null) {
      setTranscriptError(true);
    }
  }, [transcriptUrlResult]);

  const handleNarrativeBlur = useCallback(async () => {
    if (!report) return;
    try {
      await updateNarrative({ reportId, editedNarrative: narrative });
    } catch {
      // Silent fail on blur save — narrative still reflects local state
    }
  }, [report, reportId, narrative, updateNarrative]);

  const handleSaveDraft = async () => {
    if (!report || isSavingDraft) return;
    setIsSavingDraft(true);
    try {
      await updateNarrative({ reportId, editedNarrative: narrative });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSendToCoach = async () => {
    if (!report || isSending) return;
    setIsSending(true);
    setShowConfirmModal(false);
    try {
      await sendToCoach({ reportId });
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkNoAction = async () => {
    if (!report || isMarkingNoAction) return;
    setIsMarkingNoAction(true);
    try {
      await markNoAction({ reportId });
    } finally {
      setIsMarkingNoAction(false);
    }
  };

  if (report === undefined) {
    return (
      <main style={{ padding: "40px 32px", maxWidth: "1400px", margin: "0 auto" }}>
        <p style={{ color: "#6b7280" }}>Loading report...</p>
      </main>
    );
  }

  if (report === null) {
    return (
      <main style={{ padding: "40px 32px", maxWidth: "1400px", margin: "0 auto" }}>
        <p style={{ color: "#991b1b" }}>Report not found or access denied.</p>
      </main>
    );
  }

  const alreadySent = report.status === "sent";
  const activeNarrative = narrative;
  const narrativeLength = activeNarrative.trim().length;
  const canSend = !alreadySent && narrativeLength >= 50 && !isSending;

  // Parse dimension scores for progress bars
  const dimensionScores: Record<string, { score: number; maxScore: number }> =
    report.dimensionScores ?? {};

  const callNumberDisplay = String(report.callNumber);
  const date = report.recordedAt
    ? new Date(report.recordedAt).toLocaleDateString()
    : new Date(report.createdAt).toLocaleDateString();

  return (
    <>
      {showConfirmModal && (
        <ConfirmModal
          coachName={report.coachName ?? report.coachId ?? ""}
          onConfirm={handleSendToCoach}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}

      <main style={{ padding: "24px 32px", maxWidth: "1400px", margin: "0 auto" }}>
        {/* Back nav */}
        <button
          onClick={() => router.back()}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-primary, #4f46e5)",
            cursor: "pointer",
            fontSize: "0.875rem",
            padding: "0",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          ← Back to Reports
        </button>

        {/* Two-panel layout */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            alignItems: "flex-start",
          }}
        >
          {/* Left panel (60%) */}
          <div style={{ flex: "0 0 60%", minWidth: 0 }}>
            {/* Coach + student header */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "20px 24px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <h1
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: "#111827",
                      marginBottom: "4px",
                    }}
                  >
                    Call #{callNumberDisplay}
                  </h1>
                  <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                    {date}
                    {report.durationMinutes !== undefined &&
                      ` · ${report.durationMinutes} min`}
                    {report.coachTalkPercent !== undefined &&
                      ` · Coach talk: ${report.coachTalkPercent}%`}
                  </p>
                </div>
                {alreadySent && (
                  <span
                    style={{
                      padding: "4px 10px",
                      background: "#dbeafe",
                      color: "#1e40af",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    Sent
                  </span>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  fontSize: "0.875rem",
                }}
              >
                <div>
                  <span style={{ color: "#9ca3af", fontWeight: 500 }}>Coach: </span>
                  <span style={{ color: "#111827" }}>
                    {report.coachName || report.coachId}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#9ca3af", fontWeight: 500 }}>Student: </span>
                  <span style={{ color: "#111827" }}>
                    {report.studentName || report.studentId || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Scorecard */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "20px 24px",
                marginBottom: "16px",
              }}
            >
              <h2
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "16px",
                }}
              >
                Scorecard
              </h2>

              {/* Overall score */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "50%",
                    background: ScoreBg(report.overallScore),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 800,
                      color: ScoreColor(report.overallScore),
                    }}
                  >
                    {report.overallScore}
                  </span>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "1rem",
                      fontWeight: 700,
                      color: "#111827",
                      marginBottom: "2px",
                    }}
                  >
                    Overall Score
                  </p>
                  <p style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                    {report.overallScore >= 80
                      ? "Strong performance"
                      : report.overallScore >= 70
                      ? "Room for improvement"
                      : "Needs attention"}
                  </p>
                </div>
              </div>

              {/* Dimension progress bars */}
              {Object.keys(dimensionScores).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {Object.entries(dimensionScores).map(([dim, val]) => {
                    const score =
                      typeof val === "object" && val !== null
                        ? (val as { score: number; maxScore: number }).score
                        : Number(val);
                    const maxScore =
                      typeof val === "object" && val !== null && "maxScore" in val
                        ? (val as { score: number; maxScore: number }).maxScore
                        : 100;
                    const pct = Math.round((score / maxScore) * 100);
                    return (
                      <div key={dim}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "4px",
                          }}
                        >
                          <span
                            style={{ fontSize: "0.8rem", color: "#374151", fontWeight: 500 }}
                          >
                            {dim}
                          </span>
                          <span
                            style={{ fontSize: "0.8rem", color: "#6b7280" }}
                          >
                            {score}/{maxScore}
                          </span>
                        </div>
                        <div
                          style={{
                            height: "6px",
                            borderRadius: "3px",
                            background: "#f3f4f6",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: ScoreColor(pct),
                              borderRadius: "3px",
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Highlights */}
            {report.highlights && report.highlights.length > 0 && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  padding: "16px 20px",
                  marginBottom: "12px",
                }}
              >
                <h3
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#15803d",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "10px",
                  }}
                >
                  Highlights
                </h3>
                <ul style={{ margin: 0, padding: "0 0 0 18px" }}>
                  {report.highlights.map((h: string, i: number) => (
                    <li
                      key={i}
                      style={{
                        fontSize: "0.875rem",
                        color: "#166534",
                        marginBottom: "4px",
                        lineHeight: 1.5,
                      }}
                    >
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Concerns */}
            {report.concerns && report.concerns.length > 0 && (
              <div
                style={{
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  borderRadius: "8px",
                  padding: "16px 20px",
                  marginBottom: "12px",
                }}
              >
                <h3
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#c2410c",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "10px",
                  }}
                >
                  Concerns
                </h3>
                <ul style={{ margin: 0, padding: "0 0 0 18px" }}>
                  {report.concerns.map((c: string, i: number) => (
                    <li
                      key={i}
                      style={{
                        fontSize: "0.875rem",
                        color: "#9a3412",
                        marginBottom: "4px",
                        lineHeight: 1.5,
                      }}
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Narrative */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "20px 24px",
                marginBottom: "16px",
              }}
            >
              <h2
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "12px",
                }}
              >
                Narrative
              </h2>
              {alreadySent ? (
                <p
                  style={{
                    fontSize: "0.9rem",
                    color: "#374151",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {report.editedNarrative || report.narrative}
                </p>
              ) : (
                <>
                  <textarea
                    value={narrative}
                    onChange={(e) => setNarrative(e.target.value)}
                    onBlur={handleNarrativeBlur}
                    placeholder="Write coaching feedback..."
                    rows={8}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontSize: "0.9rem",
                      color: "#111827",
                      lineHeight: 1.6,
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: narrativeLength < 50 ? "#dc2626" : "#9ca3af",
                      marginTop: "4px",
                    }}
                  >
                    {narrativeLength} / 50 characters minimum
                  </p>
                </>
              )}
            </div>

            {/* Action buttons */}
            {!alreadySent && (
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={!canSend}
                  style={{
                    padding: "10px 24px",
                    border: "none",
                    borderRadius: "6px",
                    background: canSend
                      ? "var(--color-primary, #4f46e5)"
                      : "#e5e7eb",
                    color: canSend ? "#fff" : "#9ca3af",
                    cursor: canSend ? "pointer" : "not-allowed",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                  }}
                >
                  {isSending ? "Sending..." : "Send to Coach"}
                </button>

                <button
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft}
                  style={{
                    padding: "10px 24px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    background: "#fff",
                    color: "#374151",
                    cursor: isSavingDraft ? "not-allowed" : "pointer",
                    fontWeight: 500,
                    fontSize: "0.9rem",
                  }}
                >
                  {isSavingDraft ? "Saving..." : "Save Draft"}
                </button>

                <button
                  onClick={handleMarkNoAction}
                  disabled={isMarkingNoAction}
                  style={{
                    padding: "10px 24px",
                    border: "none",
                    borderRadius: "6px",
                    background: "none",
                    color: "#6b7280",
                    cursor: isMarkingNoAction ? "not-allowed" : "pointer",
                    fontWeight: 500,
                    fontSize: "0.9rem",
                    textDecoration: "underline",
                  }}
                >
                  {isMarkingNoAction ? "Marking..." : "Mark No Action"}
                </button>
              </div>
            )}

            {alreadySent && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  color: "#1e40af",
                }}
              >
                This report has been sent to the coach and cannot be edited.
                {report.sentAt &&
                  ` Sent on ${new Date(report.sentAt).toLocaleDateString()}.`}
              </div>
            )}
          </div>

          {/* Right panel (40%) */}
          <div style={{ flex: "0 0 calc(40% - 24px)", minWidth: 0 }}>
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                overflow: "hidden",
                position: "sticky",
                top: "24px",
                maxHeight: "calc(100vh - 80px)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #e5e7eb",
                  background: "#f9fafb",
                }}
              >
                <h2
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "#374151",
                    margin: 0,
                  }}
                >
                  Transcript
                </h2>
              </div>

              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  padding: "16px 20px",
                }}
              >
                {transcriptUrlResult === undefined ? (
                  <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                    Loading transcript...
                  </p>
                ) : transcriptError || transcriptUrlResult === null ? (
                  <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
                    Transcript unavailable.
                  </p>
                ) : transcriptText === null ? (
                  <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                    Loading transcript content...
                  </p>
                ) : (
                  <pre
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      color: "#374151",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {transcriptText}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
