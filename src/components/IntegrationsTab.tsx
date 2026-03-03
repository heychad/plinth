"use client";

import { Id } from "../../convex/_generated/dataModel";

interface Credential {
  _id: Id<"credentials">;
  slotName: string;
  provider: string;
  status: string;
  connectedAt?: number;
}

interface AgentConfig {
  integrationSlots: string[];
}

interface IntegrationsTabProps {
  agentConfigs: AgentConfig[];
  credentials: Credential[];
}

interface IntegrationSlotView {
  slotName: string;
  provider: string;
  status: string;
  connectedAt?: number;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function IntegrationsTab({ agentConfigs, credentials }: IntegrationsTabProps) {
  // Collect all unique integration slots from deployed templates
  const allSlots = Array.from(
    new Set(agentConfigs.flatMap((c) => c.integrationSlots))
  );

  if (allSlots.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "48px 24px",
          border: "2px dashed #e5e7eb",
          borderRadius: "8px",
          color: "#6b7280",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.875rem" }}>
          No integration slots required by any deployed agents.
        </p>
      </div>
    );
  }

  // Build credential status map by slotName
  const credBySlot = new Map<string, Credential>();
  for (const cred of credentials) {
    credBySlot.set(cred.slotName, cred);
  }

  // Build slot view list
  const slotViews: IntegrationSlotView[] = allSlots.map((slotName) => {
    const cred = credBySlot.get(slotName);
    return {
      slotName,
      provider: cred?.provider ?? slotName,
      status: cred?.status ?? "pending",
      connectedAt: cred?.connectedAt,
    };
  });

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
        Integration Connections
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {slotViews.map((slot) => {
          const isConnected = slot.status === "active";
          return (
            <div
              key={slot.slotName}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "var(--color-foreground)", marginBottom: "2px" }}>
                  {slot.slotName}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                  Provider: {slot.provider}
                </div>
                {isConnected && slot.connectedAt && (
                  <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                    Connected: {formatDate(slot.connectedAt)}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 10px",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    backgroundColor: isConnected ? "#d1fae5" : "#fee2e2",
                    color: isConnected ? "#065f46" : "#991b1b",
                  }}
                >
                  {isConnected ? "Connected" : "Disconnected"}
                </span>

                {!isConnected && (
                  <button
                    // eslint-disable-next-line no-undef
                    onClick={() => window.alert("OAuth flow coming soon")}
                    style={{
                      padding: "6px 14px",
                      backgroundColor: "var(--color-primary, #2563eb)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
