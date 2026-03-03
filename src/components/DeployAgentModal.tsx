"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

const categoryColors: Record<string, { bg: string; color: string }> = {
  marketing: { bg: "#dbeafe", color: "#1e40af" },
  sales: { bg: "#d1fae5", color: "#065f46" },
  operations: { bg: "#fef3c7", color: "#92400e" },
  coaching: { bg: "#ede9fe", color: "#5b21b6" },
};

interface DeployAgentModalProps {
  tenantId: Id<"tenants">;
  onClose: () => void;
  onDeployed: () => void;
}

export function DeployAgentModal({ tenantId, onClose, onDeployed }: DeployAgentModalProps) {
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templatesResult = useQuery(api.agentTemplates.listAgentTemplates, {
    paginationOpts: { numItems: 50, cursor: null },
  });

  const deployAgentConfig = useMutation(api.agentConfigs.deployAgentConfig);

  const templates = templatesResult?.page ?? [];

  async function handleDeploy(templateId: Id<"agentTemplates">, templateName: string) {
    setDeploying(true);
    setError(null);
    try {
      await deployAgentConfig({
        tenantId,
        templateId,
        displayName: templateName,
      });
      onDeployed();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deploy agent");
      setDeploying(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "var(--color-background, #fff)",
          borderRadius: "12px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          width: "100%",
          maxWidth: "640px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--color-foreground)" }}>
            Deploy New Agent
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1.4rem",
              color: "#6b7280",
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>
          {error && (
            <div
              style={{
                marginBottom: "16px",
                padding: "10px 14px",
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                borderRadius: "6px",
                fontSize: "0.875rem",
              }}
            >
              {error}
            </div>
          )}

          {templatesResult === undefined ? (
            <p style={{ color: "#6b7280", textAlign: "center", padding: "24px 0" }}>
              Loading templates...
            </p>
          ) : templates.length === 0 ? (
            <p style={{ color: "#6b7280", textAlign: "center", padding: "24px 0" }}>
              No active agent templates available.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {templates.map((template) => {
                const catColors = categoryColors[template.category] ?? {
                  bg: "#f3f4f6",
                  color: "#6b7280",
                };
                return (
                  <div
                    key={template._id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "16px",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span style={{ fontWeight: 600, color: "var(--color-foreground)" }}>
                          {template.displayName}
                        </span>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "1px 8px",
                            borderRadius: "9999px",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            backgroundColor: catColors.bg,
                            color: catColors.color,
                          }}
                        >
                          {template.category}
                        </span>
                      </div>

                      <p style={{ margin: "0 0 8px", fontSize: "0.875rem", color: "#4b5563" }}>
                        {template.description}
                      </p>

                      {template.integrationSlots.length > 0 && (
                        <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                          <span style={{ fontWeight: 600 }}>Required integrations: </span>
                          {template.integrationSlots.join(", ")}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeploy(template._id, template.displayName)}
                      disabled={deploying}
                      style={{
                        flexShrink: 0,
                        padding: "8px 16px",
                        backgroundColor: deploying ? "#9ca3af" : "var(--color-primary, #2563eb)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        cursor: deploying ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {deploying ? "Deploying..." : "Select"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
