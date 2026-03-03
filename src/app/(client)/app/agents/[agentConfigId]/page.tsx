"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import Link from "next/link";

type InputSchemaField = {
  label?: string;
  type?: "text" | "textarea" | "select" | "number" | "boolean";
  required?: boolean;
  placeholder?: string;
  options?: string[];
  description?: string;
};

type InputSchema = Record<string, InputSchemaField>;

type AgentRun = {
  _id: string;
  agentConfigId: string;
  tenantId: string;
  status: string;
  triggerType?: string;
  createdAt: number;
  startedAt?: number;
  durationMs?: number;
  output?: unknown;
};

const statusBadgeStyle: Record<string, { bg: string; color: string; label: string }> = {
  deployed: { bg: "#d1fae5", color: "#065f46", label: "Active" },
  building: { bg: "#fef3c7", color: "#92400e", label: "Setting Up" },
  testing: { bg: "#fef3c7", color: "#92400e", label: "Testing" },
  paused: { bg: "#f3f4f6", color: "#6b7280", label: "Paused" },
  archived: { bg: "#f3f4f6", color: "#9ca3af", label: "Archived" },
};

const runStatusBadgeStyle: Record<string, { bg: string; color: string }> = {
  completed: { bg: "#d1fae5", color: "#065f46" },
  failed: { bg: "#fee2e2", color: "#991b1b" },
  running: { bg: "#dbeafe", color: "#1e40af" },
  queued: { bg: "#fef3c7", color: "#92400e" },
  cancelled: { bg: "#f3f4f6", color: "#6b7280" },
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms?: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  const secs = (ms / 1000).toFixed(1);
  return `${secs}s`;
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentConfigId = params.agentConfigId as Id<"agentConfigs">;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUser = useQuery((api as any).auth.getCurrentUser);
  const tenantId = currentUser?.tenantId;

  const agentData = useQuery(api.agentConfigs.getAgentConfigForClient, { agentConfigId });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { results: recentRuns, status: runsPaginationStatus } = usePaginatedQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).agentRuns.listAgentRunsForTenant,
    tenantId ? { tenantId, agentConfigId } : "skip",
    { initialNumItems: 10 }
  );

  const updateConfig = useMutation(api.agentConfigs.updateAgentConfig);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const triggerRun = useMutation((api as any).agentRuns.triggerAgentRun);

  // Config editing state: { [fieldKey]: editedValue }
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<Record<string, string>>({});

  // Run trigger form state
  const [runInputs, setRunInputs] = useState<Record<string, string | boolean | number>>({});
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string>("");

  const isLoading = agentData === undefined || currentUser === undefined;
  const runsLoading = runsPaginationStatus === "LoadingFirstPage";

  // Initialize field values from config when data loads
  function getFieldCurrentValue(fieldKey: string): string {
    if (fieldValues[fieldKey] !== undefined) return fieldValues[fieldKey];
    const config = agentData?.config as Record<string, unknown> | undefined;
    if (config && config[fieldKey] !== undefined) {
      return String(config[fieldKey]);
    }
    return "";
  }

  function startEditField(fieldKey: string) {
    const current = getFieldCurrentValue(fieldKey);
    setFieldValues((prev) => ({ ...prev, [fieldKey]: current }));
    setEditingField(fieldKey);
    setSaveError((prev) => ({ ...prev, [fieldKey]: "" }));
  }

  function cancelEditField() {
    setEditingField(null);
  }

  async function saveField(fieldKey: string) {
    setSavingField(fieldKey);
    setSaveError((prev) => ({ ...prev, [fieldKey]: "" }));
    try {
      await updateConfig({
        agentConfigId,
        config: { [fieldKey]: fieldValues[fieldKey] },
      });
      setEditingField(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setSaveError((prev) => ({ ...prev, [fieldKey]: message }));
    } finally {
      setSavingField(null);
    }
  }

  async function handleRunAgent() {
    if (isTriggering) return;
    setTriggerError("");

    // Validate required fields
    const inputSchema = agentData?.template?.inputSchema as InputSchema | undefined;
    if (inputSchema) {
      for (const [fieldKey, fieldDef] of Object.entries(inputSchema)) {
        if (fieldDef.required && !runInputs[fieldKey] && runInputs[fieldKey] !== false) {
          setTriggerError(`"${fieldDef.label ?? fieldKey}" is required.`);
          return;
        }
      }
    }

    setIsTriggering(true);
    try {
      const runId = await triggerRun({ agentConfigId, input: runInputs });
      router.push(`/app/agents/${agentConfigId}/runs/${runId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to trigger run";
      setTriggerError(message);
      setIsTriggering(false);
    }
  }

  if (isLoading) {
    return (
      <main style={{ padding: "40px 32px", maxWidth: "900px", margin: "0 auto" }}>
        <p style={{ color: "#6b7280" }}>Loading...</p>
      </main>
    );
  }

  if (agentData === null) {
    return (
      <main style={{ padding: "40px 32px", maxWidth: "900px", margin: "0 auto" }}>
        <p style={{ color: "#991b1b" }}>Agent not found or access denied.</p>
      </main>
    );
  }

  const {
    displayName,
    status,
    template,
    config: agentConfig,
    customizableFields,
    integrationSlots,
  } = agentData;

  const isDeployed = status === "deployed";
  const hasCustomizableFields = customizableFields && customizableFields.length > 0;
  const configValues = (agentConfig as Record<string, unknown>) ?? {};
  const inputSchema = template?.inputSchema as InputSchema | undefined;
  const statusBadge = statusBadgeStyle[status] ?? { bg: "#f3f4f6", color: "#6b7280", label: status };

  return (
    <main style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
      {/* Back link */}
      <Link
        href="/app/agents"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          color: "var(--color-primary, #4f46e5)",
          textDecoration: "none",
          fontSize: "0.875rem",
          marginBottom: "20px",
        }}
      >
        &larr; Back to Agents
      </Link>

      {/* Agent info section */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "10px",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.4rem",
                fontWeight: 700,
                color: "#111827",
                marginBottom: "4px",
              }}
            >
              {displayName}
            </h1>
            {template?.displayName && (
              <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                Template: {template.displayName}
              </p>
            )}
          </div>
          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: "9999px",
              fontSize: "0.8rem",
              fontWeight: 600,
              backgroundColor: statusBadge.bg,
              color: statusBadge.color,
            }}
          >
            {statusBadge.label}
          </span>
        </div>

        {template?.description && (
          <p style={{ color: "#374151", fontSize: "0.9rem", marginBottom: "20px" }}>
            {template.description}
          </p>
        )}

        {/* Integration slots */}
        {integrationSlots && integrationSlots.length > 0 && (
          <div>
            <h3
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#374151",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: "10px",
              }}
            >
              Integrations
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {integrationSlots.map((slot: { slotName: string; connected: boolean; connectedAt?: number }) => (
                <div
                  key={slot.slotName}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: slot.connected ? "#6ee7b7" : "#fca5a5",
                    background: slot.connected ? "#f0fdf4" : "#fff7f7",
                    fontSize: "0.8rem",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: slot.connected ? "#10b981" : "#ef4444",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: "#374151", fontWeight: 500 }}>{slot.slotName}</span>
                  <span style={{ color: slot.connected ? "#065f46" : "#991b1b" }}>
                    {slot.connected ? "Connected" : "Not Connected"}
                  </span>
                </div>
              ))}
            </div>
            {integrationSlots.some((s: { connected: boolean }) => !s.connected) && (
              <p style={{ marginTop: "10px", fontSize: "0.8rem", color: "#6b7280" }}>
                Some integrations are not connected.{" "}
                <Link
                  href="/app/integrations"
                  style={{ color: "var(--color-primary, #4f46e5)" }}
                >
                  Connect them here
                </Link>
                .
              </p>
            )}
          </div>
        )}
      </div>

      {/* Config self-service section */}
      {hasCustomizableFields && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            padding: "24px",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "#111827",
              marginBottom: "4px",
            }}
          >
            Configuration
          </h2>
          <p style={{ color: "#6b7280", fontSize: "0.85rem", marginBottom: "20px" }}>
            These settings can be customized for your account.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {customizableFields.map((fieldKey: string) => {
              const isEditing = editingField === fieldKey;
              const isSaving = savingField === fieldKey;
              const currentValue = configValues[fieldKey];
              const error = saveError[fieldKey];

              return (
                <div
                  key={fieldKey}
                  style={{
                    padding: "14px 16px",
                    border: "1px solid",
                    borderColor: isEditing ? "var(--color-primary, #4f46e5)" : "#e5e7eb",
                    borderRadius: "8px",
                    transition: "border-color 0.15s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "#374151",
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                          marginBottom: "4px",
                        }}
                      >
                        {fieldKey}
                      </label>

                      {isEditing ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <input
                            type="text"
                            value={fieldValues[fieldKey] ?? ""}
                            onChange={(e) =>
                              setFieldValues((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                            }
                            style={{
                              flex: 1,
                              minWidth: "200px",
                              padding: "6px 10px",
                              border: "1px solid #d1d5db",
                              borderRadius: "6px",
                              fontSize: "0.875rem",
                              outline: "none",
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => saveField(fieldKey)}
                            disabled={isSaving}
                            style={{
                              padding: "6px 14px",
                              background: isSaving ? "#9ca3af" : "var(--color-primary, #4f46e5)",
                              color: "#fff",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "0.8rem",
                              fontWeight: 500,
                              cursor: isSaving ? "not-allowed" : "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isSaving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEditField}
                            disabled={isSaving}
                            style={{
                              padding: "6px 14px",
                              background: "#f3f4f6",
                              color: "#374151",
                              border: "1px solid #d1d5db",
                              borderRadius: "6px",
                              fontSize: "0.8rem",
                              fontWeight: 500,
                              cursor: isSaving ? "not-allowed" : "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <p
                          style={{
                            color: currentValue !== undefined ? "#111827" : "#9ca3af",
                            fontSize: "0.9rem",
                          }}
                        >
                          {currentValue !== undefined ? String(currentValue) : "(not set)"}
                        </p>
                      )}
                      {error && (
                        <p style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}>
                          {error}
                        </p>
                      )}
                    </div>

                    {!isEditing && (
                      <button
                        onClick={() => startEditField(fieldKey)}
                        style={{
                          padding: "5px 12px",
                          background: "#f9fafb",
                          color: "#374151",
                          border: "1px solid #d1d5db",
                          borderRadius: "6px",
                          fontSize: "0.8rem",
                          fontWeight: 500,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Run trigger section */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "10px",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        <h2
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: "#111827",
            marginBottom: "4px",
          }}
        >
          Run Agent
        </h2>

        {!isDeployed ? (
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              background: "#f9fafb",
              borderRadius: "8px",
              border: "1px dashed #d1d5db",
              marginTop: "16px",
            }}
          >
            <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
              This agent is not yet available to run.
            </p>
            <p style={{ color: "#9ca3af", fontSize: "0.8rem", marginTop: "4px" }}>
              Status: <strong>{statusBadge.label}</strong>. Your consultant is still setting it up.
            </p>
          </div>
        ) : (
          <>
            <p style={{ color: "#6b7280", fontSize: "0.85rem", marginBottom: "20px" }}>
              Fill in the inputs below and click Run Agent to start a new run.
            </p>

            {inputSchema && Object.keys(inputSchema).length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
                {Object.entries(inputSchema).map(([fieldKey, fieldDef]) => {
                  const label = fieldDef.label ?? fieldKey;
                  const required = fieldDef.required === true;
                  const fieldType = fieldDef.type ?? "text";

                  return (
                    <div key={fieldKey}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          color: "#374151",
                          marginBottom: "6px",
                        }}
                      >
                        {label}
                        {required && (
                          <span style={{ color: "#ef4444", marginLeft: "2px" }}>*</span>
                        )}
                      </label>

                      {fieldDef.description && (
                        <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "6px" }}>
                          {fieldDef.description}
                        </p>
                      )}

                      {fieldType === "textarea" ? (
                        <textarea
                          value={(runInputs[fieldKey] as string) ?? ""}
                          onChange={(e) =>
                            setRunInputs((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                          }
                          placeholder={fieldDef.placeholder}
                          rows={4}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            fontSize: "0.875rem",
                            resize: "vertical",
                            boxSizing: "border-box",
                            outline: "none",
                          }}
                        />
                      ) : fieldType === "select" && fieldDef.options ? (
                        <select
                          value={(runInputs[fieldKey] as string) ?? ""}
                          onChange={(e) =>
                            setRunInputs((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                          }
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            fontSize: "0.875rem",
                            background: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          <option value="">Select an option...</option>
                          {fieldDef.options.map((opt: string) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : fieldType === "boolean" ? (
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={(runInputs[fieldKey] as boolean) ?? false}
                            onChange={(e) =>
                              setRunInputs((prev) => ({ ...prev, [fieldKey]: e.target.checked }))
                            }
                            style={{ width: "16px", height: "16px", cursor: "pointer" }}
                          />
                          <span style={{ fontSize: "0.875rem", color: "#374151" }}>
                            {label}
                          </span>
                        </label>
                      ) : fieldType === "number" ? (
                        <input
                          type="number"
                          value={(runInputs[fieldKey] as number) ?? ""}
                          onChange={(e) =>
                            setRunInputs((prev) => ({
                              ...prev,
                              [fieldKey]: e.target.value === "" ? "" : Number(e.target.value),
                            }))
                          }
                          placeholder={fieldDef.placeholder}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            fontSize: "0.875rem",
                            boxSizing: "border-box",
                            outline: "none",
                          }}
                        />
                      ) : (
                        <input
                          type="text"
                          value={(runInputs[fieldKey] as string) ?? ""}
                          onChange={(e) =>
                            setRunInputs((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                          }
                          placeholder={fieldDef.placeholder}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            fontSize: "0.875rem",
                            boxSizing: "border-box",
                            outline: "none",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: "#6b7280", fontSize: "0.85rem", marginBottom: "20px" }}>
                No inputs required for this agent.
              </p>
            )}

            {triggerError && (
              <div
                style={{
                  marginBottom: "16px",
                  padding: "10px 14px",
                  background: "#fee2e2",
                  border: "1px solid #fca5a5",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  color: "#991b1b",
                }}
              >
                {triggerError}
              </div>
            )}

            <button
              onClick={handleRunAgent}
              disabled={isTriggering}
              style={{
                padding: "10px 24px",
                background: isTriggering ? "#9ca3af" : "var(--color-primary, #4f46e5)",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: isTriggering ? "not-allowed" : "pointer",
              }}
            >
              {isTriggering ? "Starting..." : "Run Agent"}
            </button>
          </>
        )}
      </div>

      {/* Run history table */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "10px",
          padding: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#111827" }}>
            Run History
          </h2>
          <Link
            href={`/app/runs?agentConfigId=${agentConfigId}`}
            style={{
              fontSize: "0.85rem",
              color: "var(--color-primary, #4f46e5)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            View All
          </Link>
        </div>

        {runsLoading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#9ca3af" }}>
            Loading runs...
          </div>
        ) : recentRuns.length === 0 ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "#6b7280",
              border: "1px dashed #d1d5db",
              borderRadius: "8px",
              fontSize: "0.875rem",
            }}
          >
            No runs yet. Use "Run Agent" above to start your first run.
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
                  style={{ borderBottom: "2px solid #e5e7eb", background: "#f9fafb" }}
                >
                  {["Status", "Trigger", "Started", "Duration", ""].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: "#374151",
                        whiteSpace: "nowrap",
                        fontSize: "0.78rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run: AgentRun) => {
                  const badge = runStatusBadgeStyle[run.status] ?? {
                    bg: "#f3f4f6",
                    color: "#6b7280",
                  };
                  return (
                    <tr
                      key={run._id}
                      style={{ borderBottom: "1px solid #f3f4f6" }}
                    >
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {run.status === "running" ? "Running..." : run.status}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "12px 14px",
                          color: "#6b7280",
                          textTransform: "capitalize",
                        }}
                      >
                        {run.triggerType ?? "—"}
                      </td>
                      <td
                        style={{
                          padding: "12px 14px",
                          color: "#6b7280",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDate(run.createdAt)}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#6b7280" }}>
                        {formatDuration(run.durationMs)}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <Link
                          href={`/app/agents/${agentConfigId}/runs/${run._id}`}
                          style={{
                            padding: "4px 12px",
                            background: "var(--color-primary, #4f46e5)",
                            color: "#fff",
                            borderRadius: "6px",
                            fontSize: "0.78rem",
                            fontWeight: 500,
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          View
                        </Link>
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
