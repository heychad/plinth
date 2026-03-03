"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

type ClientPickerModalProps = {
  templateId: string;
  templateName: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function ClientPickerModal({
  templateId,
  templateName,
  onClose,
  onSuccess,
}: ClientPickerModalProps) {
  const [deploying, setDeploying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successTenantId, setSuccessTenantId] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantsResult = useQuery((api as any).tenants.listTenants, {
    paginationOpts: { numItems: 100, cursor: null },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deployMutation = useMutation((api as any).agentConfigs.deployAgentConfig);

  const tenants = tenantsResult?.page ?? [];
  const isLoading = tenantsResult === undefined;

  async function handleDeploy(tenantId: string, businessName: string) {
    if (deploying) return;
    setError(null);
    setDeploying(tenantId);

    try {
      await deployMutation({
        tenantId,
        templateId,
      });
      setSuccessTenantId(tenantId);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deploy failed";
      if (message.includes("already exists")) {
        setError(`"${templateName}" is already deployed to ${businessName}.`);
      } else {
        setError(message);
      }
    } finally {
      setDeploying(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: "12px",
          padding: "28px",
          width: "100%",
          maxWidth: "480px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827", margin: 0 }}>
              Deploy to Client
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: "4px 0 0" }}>
              Select which client should receive{" "}
              <strong style={{ color: "#374151" }}>{templateName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.25rem",
              color: "#9ca3af",
              cursor: "pointer",
              padding: "2px 6px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              borderRadius: "6px",
              padding: "10px 14px",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Client list */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {isLoading ? (
            <div style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}>
              Loading clients...
            </div>
          ) : tenants.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "#6b7280" }}>
              No clients found. Add a client first.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {tenants.map((tenant: { _id: string; businessName: string; ownerName: string; status: string }) => (
                <div
                  key={tenant._id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    background: successTenantId === tenant._id ? "#f0fdf4" : "#fafafa",
                    transition: "background 0.2s",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: "#111827", fontSize: "0.875rem" }}>
                      {tenant.businessName}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {tenant.ownerName}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        backgroundColor:
                          tenant.status === "active"
                            ? "#d1fae5"
                            : tenant.status === "paused"
                            ? "#fef3c7"
                            : "#f3f4f6",
                        color:
                          tenant.status === "active"
                            ? "#065f46"
                            : tenant.status === "paused"
                            ? "#92400e"
                            : "#6b7280",
                      }}
                    >
                      {tenant.status}
                    </span>
                    {successTenantId === tenant._id ? (
                      <span style={{ fontSize: "0.8rem", color: "#16a34a", fontWeight: 500 }}>
                        Deployed!
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDeploy(tenant._id, tenant.businessName)}
                        disabled={deploying === tenant._id}
                        style={{
                          padding: "5px 14px",
                          background:
                            deploying === tenant._id
                              ? "#9ca3af"
                              : "var(--color-primary, #4f46e5)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "0.8rem",
                          fontWeight: 500,
                          cursor: deploying === tenant._id ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {deploying === tenant._id ? "Deploying..." : "Select"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
