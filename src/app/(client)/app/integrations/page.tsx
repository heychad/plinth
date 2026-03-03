"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useState } from "react";

type IntegrationSlot = {
  slotName: string;
  provider: string;
  connected: boolean;
  connectedAt?: number;
  agentNames: string[];
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function humanizeSlotName(slotName: string): string {
  return slotName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ProviderBadge({ provider }: { provider: string }) {
  const providerColors: Record<string, { bg: string; color: string }> = {
    Google: { bg: "#fef9c3", color: "#854d0e" },
    Slack: { bg: "#ede9fe", color: "#5b21b6" },
    Zoom: { bg: "#dbeafe", color: "#1e40af" },
    Github: { bg: "#f3f4f6", color: "#374151" },
    Notion: { bg: "#f3f4f6", color: "#374151" },
  };
  const style = providerColors[provider] ?? { bg: "#f3f4f6", color: "#6b7280" };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "0.7rem",
        fontWeight: 700,
        backgroundColor: style.bg,
        color: style.color,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {provider}
    </span>
  );
}

function IntegrationCard({
  slot,
  onConnect,
  onDisconnect,
}: {
  slot: IntegrationSlot;
  onConnect: (slotName: string, provider: string) => Promise<void>;
  onDisconnect: (slotName: string) => Promise<void>;
}) {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      await onConnect(slot.slotName, slot.provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    const confirmed = window.confirm(
      `Disconnect ${humanizeSlotName(slot.slotName)}? Agents that rely on this integration will stop working until reconnected.`
    );
    if (!confirmed) return;

    setDisconnecting(true);
    setError(null);
    try {
      await onDisconnect(slot.slotName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "1rem", fontWeight: 600, color: "#111827" }}>
            {humanizeSlotName(slot.slotName)}
          </span>
          <ProviderBadge provider={slot.provider} />
        </div>

        {/* Status indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: slot.connected ? "#22c55e" : "#f97316",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: slot.connected ? "#15803d" : "#c2410c",
            }}
          >
            {slot.connected ? "Connected" : "Not Connected"}
          </span>
        </div>
      </div>

      {/* Connected date */}
      {slot.connected && slot.connectedAt && (
        <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>
          Connected {formatDate(slot.connectedAt)}
        </p>
      )}

      {/* Agents that use this slot */}
      {slot.agentNames.length > 0 && (
        <div>
          <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: "0 0 4px 0", fontWeight: 500 }}>
            Used by:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {slot.agentNames.map((name) => (
              <span
                key={name}
                style={{
                  fontSize: "0.75rem",
                  color: "#374151",
                  background: "#f3f4f6",
                  padding: "2px 8px",
                  borderRadius: "4px",
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p style={{ fontSize: "0.8rem", color: "#dc2626", margin: 0 }}>
          {error}
        </p>
      )}

      {/* Action button */}
      <div>
        {slot.connected ? (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{
              padding: "6px 14px",
              background: "#fff",
              color: disconnecting ? "#9ca3af" : "#dc2626",
              border: `1px solid ${disconnecting ? "#d1d5db" : "#fca5a5"}`,
              borderRadius: "6px",
              fontSize: "0.8rem",
              fontWeight: 500,
              cursor: disconnecting ? "not-allowed" : "pointer",
            }}
          >
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            style={{
              padding: "6px 14px",
              background: connecting
                ? "#9ca3af"
                : "var(--color-primary, #4f46e5)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.8rem",
              fontWeight: 500,
              cursor: connecting ? "not-allowed" : "pointer",
            }}
          >
            {connecting ? "Connecting..." : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUser = useQuery((api as any).auth.getCurrentUser);
  const tenantId = currentUser?.tenantId as string | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slots = useQuery((api as any).credentials.listIntegrationsForTenant) as
    | IntegrationSlot[]
    | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const disconnectCredential = useMutation((api as any).credentials.disconnectCredential);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initiateOAuth = useAction((api as any).integrations.composio.initiateComposioOAuth);

  const isLoading = currentUser === undefined || slots === undefined;

  async function handleConnect(slotName: string, provider: string) {
    if (!tenantId) throw new Error("No tenant");

    const redirectUrl = `${window.location.origin}/oauth/composio/callback`;
    const result = await initiateOAuth({
      tenantId,
      slotName,
      provider: provider.toLowerCase(),
      redirectUrl,
    });

    if (result?.authUrl) {
      window.open(result.authUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function handleDisconnect(slotName: string) {
    if (!tenantId) throw new Error("No tenant");
    await disconnectCredential({ tenantId, slotName });
  }

  // Group slots by provider
  const groupedByProvider: Record<string, IntegrationSlot[]> = {};
  if (slots) {
    for (const slot of slots) {
      if (!groupedByProvider[slot.provider]) {
        groupedByProvider[slot.provider] = [];
      }
      groupedByProvider[slot.provider].push(slot);
    }
  }

  const providers = Object.keys(groupedByProvider).sort();

  return (
    <main style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#111827",
          marginBottom: "8px",
        }}
      >
        Integrations
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "32px" }}>
        Connect third-party services your agents need to function.
      </p>

      {isLoading ? (
        <div
          style={{
            padding: "64px",
            textAlign: "center",
            color: "#9ca3af",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        >
          Loading integrations...
        </div>
      ) : providers.length === 0 ? (
        <div
          style={{
            padding: "64px",
            textAlign: "center",
            color: "#6b7280",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        >
          <p style={{ fontWeight: 500, marginBottom: "8px", color: "#374151" }}>
            No integrations required yet.
          </p>
          <p style={{ margin: 0 }}>
            Your consultant will deploy agents to your account.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
          {providers.map((provider) => (
            <section key={provider}>
              <h2
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#374151",
                  marginBottom: "16px",
                  paddingBottom: "8px",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                {provider}
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "16px",
                }}
              >
                {groupedByProvider[provider].map((slot) => (
                  <IntegrationCard
                    key={slot.slotName}
                    slot={slot}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
